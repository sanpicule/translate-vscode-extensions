// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { marked } from 'marked';
const translate = require('google-translate-api-x');
const path = require('path');

// Google Translateを使用した翻訳関数
async function translateWithGoogleTranslate(text: string): Promise<string> {
    if (!text || text.trim() === '') {
        return text;
    }

    // 長文は分割して翻訳（Google Translateの制限回避）
    const MAX_CHUNK = 3800; // 余裕を持って分割
    const chunks: string[] = [];
    if (text.length > MAX_CHUNK) {
        let buf = '';
        for (const line of text.split(/\r?\n/)) {
            if ((buf + (buf ? '\n' : '') + line).length > MAX_CHUNK) {
                if (buf) chunks.push(buf);
                buf = line;
            } else {
                buf = buf ? `${buf}\n${line}` : line;
            }
        }
        if (buf) chunks.push(buf);
    } else {
        chunks.push(text);
    }

    try {
        const results: string[] = [];
        for (const c of chunks) {
            const r = await translate(c, { to: 'ja' });
            results.push(r.text);
        }
        return results.join('\n');
    } catch (error) {
        console.error('Google Translate エラー:', error);
        return text; // エラー時は原文を返す
    }
}

// Gemini APIを使用した翻訳関数
async function translateWithGemini(text: string, apiKey: string): Promise<string> {
    if (!text || text.trim() === '') {
        return text;
    }
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `以下のMarkdownテキストを、自然で高品質な日本語に翻訳してください。
ただし、コードブロック（\`\`\`）やインラインコード（\`）の中身、URL、ファイルパス、HTMLタグは絶対に翻訳・変更しないでください。
Markdownの構造（見出し、リスト、リンク、画像など）は完全に維持してください。

---
${text}
---
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('Gemini翻訳エラー:', error);
        throw error; // Geminiが失敗した場合はエラーを投げてフォールバックさせる
    }
}

// 拡張機能の詳細説明（短いテキスト）を翻訳する関数
async function translateExtensionDescription(text: string): Promise<string> {
    if (!text || text.trim() === '') {
        return '';
    }
    const config = vscode.workspace.getConfiguration('translateDescription');
    const geminiApiKey = config.get<string>('geminiApiKey');

    try {
        if (geminiApiKey && geminiApiKey.trim() !== '') {
            const simplePrompt = `Translate the following English text into natural-sounding Japanese:\n\n${text}`;
            const genAI = new GoogleGenerativeAI(geminiApiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await model.generateContent(simplePrompt);
            return (await result.response).text().trim();
        } else {
            return await translateWithGoogleTranslate(text);
        }
    } catch (error) {
        console.error('拡張機能説明翻訳エラー:', error);
        return translateWithGoogleTranslate(text);
    }
}

// マークダウンテキスト全体を翻訳するメイン関数
async function translateMarkdownText(markdownText: string): Promise<string> {
    if (!markdownText || markdownText.trim() === '') {
        return '';
    }
    const config = vscode.workspace.getConfiguration('translateDescription');
    const geminiApiKey = config.get<string>('geminiApiKey');

    try {
        if (geminiApiKey && geminiApiKey.trim() !== '') {
            return await translateWithGemini(markdownText, geminiApiKey);
        } else {
            return await translateMarkdownWithPlaceholders(markdownText);
        }
    } catch (error) {
        console.error('マークダウン翻訳エラー:', error);
        if (error instanceof Error && (error.message.includes('Gemini') || (error as any).type === 'gemini-error')) {
            console.log('Gemini failed, falling back to Google Translate placeholder method.');
            return await translateMarkdownWithPlaceholders(markdownText);
        }
        return markdownText;
    }
}

// プレースホルダー方式によるMarkdown翻訳（Google Translate用）
async function translateMarkdownWithPlaceholders(markdownText: string): Promise<string> {
    const placeholders: { [key: string]: string } = {};
    let counter = 0;

    let processedText = markdownText
        .replace(/```[\s\S]*?```/g, match => {
            const ph = `__CODEBLOCK_${counter++}__`;
            placeholders[ph] = match;
            return ph;
        })
        .replace(/<[^>]+>/g, match => {
            const ph = `__HTML_${counter++}__`;
            placeholders[ph] = match;
            return ph;
        })
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, match => {
            const ph = `__IMAGE_${counter++}__`;
            placeholders[ph] = match;
            return ph;
        })
        .replace(/\[([^\]]*)\]\(([^)]+)\)/g, match => {
            const ph = `__LINK_${counter++}__`;
            placeholders[ph] = match;
            return ph;
        })
        .replace(/`[^`]+`/g, match => {
            const ph = `__INLINECODE_${counter++}__`;
            placeholders[ph] = match;
            return ph;
        });

    const translatedText = await translateWithGoogleTranslate(processedText);

    let result = translatedText;
    for (const [ph, original] of Object.entries(placeholders)) {
        const regex = new RegExp(ph.replace(/([.*+?^${}()|[\]\\])/g, '\\$1'), 'g');
        result = result.replace(regex, original);
    }

    return result;
}


// WebViewを作成・表示する関数
async function createTranslationWebView(context: vscode.ExtensionContext, extension: vscode.Extension<any>, originalReadme: string, translatedReadme: string) {
    const translatedDescription = await translateExtensionDescription(extension.packageJSON.description || '');
    
    const panel = vscode.window.createWebviewPanel(
        'translationResult',
        `${extension.packageJSON.displayName || extension.packageJSON.name} - 翻訳結果`,
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.file(extension.extensionPath),
                context.extensionUri,
                vscode.Uri.file('/'),
            ]
        }
    );

    const renderMarkdownToHtml = async (markdown: string): Promise<string> => {
        const renderer = new marked.Renderer();
        const basePath = extension.extensionPath;

        const normalizeHref = (href: string | null | undefined): string => {
            let s = (href || '').trim();
            if ((s.startsWith('<') && s.endsWith('>')) || (s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'" ) && s.endsWith("'" ))) {
                s = s.slice(1, -1);
            }
            return s.replace(/\r?\n/g, '');
        };

        const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

        renderer.image = ({ href, title, text }) => {
            let src = normalizeHref(href);
            if (src && !src.startsWith('https:') && !src.startsWith('http:') && !src.startsWith('data:')) {
                try {
                    const localPath = path.isAbsolute(src) ? src : path.join(basePath, src);
                    const localUri = vscode.Uri.file(localPath);
                    src = panel.webview.asWebviewUri(localUri).toString();
                } catch (e) {
                    console.error(`Failed to resolve image URI for: ${href}`, e);
                }
            }
            const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';
            return `<img src="${escapeAttr(src)}"${titleAttr} alt="${escapeAttr(text)}">`;
        };

        renderer.link = ({ href, title, text }) => {
            let finalHref = normalizeHref(href);
            const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';

            if (finalHref.startsWith('http:') || finalHref.startsWith('https:')) {
                return `<a href="#" data-external-link="${escapeAttr(finalHref)}"${titleAttr}>${text}</a>`;
            }
            if (finalHref.startsWith('file:') || path.isAbsolute(finalHref)) {
                return `<a href="#" data-file-link="${escapeAttr(finalHref)}"${titleAttr}>${text}</a>`;
            }
            if (finalHref.startsWith('#') || finalHref.startsWith('mailto:')) {
                 return `<a href="${escapeAttr(finalHref)}"${titleAttr}>${text}</a>`;
            }
            try {
                const localPath = path.join(basePath, finalHref);
                const localUri = vscode.Uri.file(localPath);
                finalHref = panel.webview.asWebviewUri(localUri).toString();
            } catch (e) {
                console.error(`Failed to resolve link URI for: ${href}`, e);
            }
            return `<a href="${escapeAttr(finalHref)}"${titleAttr}>${text}</a>`;
        };
        
        return await marked.parse(markdown, { renderer }) || '';
    };

    const originalHtml = await renderMarkdownToHtml(originalReadme);
    const translatedHtml = await renderMarkdownToHtml(translatedReadme);

    const extensionIcon = extension.packageJSON.icon 
        ? panel.webview.asWebviewUri(vscode.Uri.file(path.join(extension.extensionPath, extension.packageJSON.icon)))
        : null;

    const nonce = getNonce();
    panel.webview.html = getWebviewContent(
        nonce,
        panel.webview.cspSource,
        extension,
        extensionIcon,
        translatedDescription,
        originalHtml,
        translatedHtml
    );

    panel.webview.onDidReceiveMessage(async (msg) => {
        if (msg.command === 'openExternal' && msg.href) {
            vscode.env.openExternal(vscode.Uri.parse(msg.href));
        } else if (msg.command === 'openFile' && msg.path) {
            const uri = msg.path.startsWith('file://') ? vscode.Uri.parse(msg.path) : vscode.Uri.file(msg.path);
            vscode.commands.executeCommand('vscode.open', uri);
        }
    });
}

function getWebviewContent(
    nonce: string,
    cspSource: string,
    extension: vscode.Extension<any>,
    extensionIcon: vscode.Uri | null,
    translatedDescription: string,
    originalHtml: string,
    translatedHtml: string
): string {
    return `
        <!DOCTYPE html>
        <html lang="ja">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https: data:; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>翻訳結果</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; margin: 20px; background-color: var(--vscode-editor-background); color: var(--vscode-editor-foreground); }
                .header { display: flex; align-items: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid var(--vscode-panel-border); }
                .header img { width: 48px; height: 48px; margin-right: 15px; }
                .header-info h1 { margin: 0 0 5px 0; font-size: 1.5em; }
                .header-info p { margin: 0; opacity: 0.8; }
                .description { margin-bottom: 20px; padding: 15px; background-color: var(--vscode-editor-inactiveSelectionBackground); border-radius: 5px; }
                pre { background-color: var(--vscode-textCodeBlock-background); padding: 10px; border-radius: 5px; overflow-x: auto; }
                code { font-family: 'SF Mono', Monaco, Menlo, Consolas, 'Ubuntu Mono', monospace; }
                img { max-width: 100%; }
                a { color: var(--vscode-textLink-foreground); }
                table { border-collapse: collapse; width: 100%; margin: 15px 0; }
                th, td { border: 1px solid var(--vscode-panel-border); padding: 8px; text-align: left; }
                th { background-color: var(--vscode-editor-inactiveSelectionBackground); }
            </style>
        </head>
        <body>
            <div class="header">
                ${extensionIcon ? `<img src="${extensionIcon}" alt="Extension Icon">` : ''}
                <div class="header-info">
                    <h1>${extension.packageJSON.displayName || extension.packageJSON.name}</h1>
                    <p>バージョン: ${extension.packageJSON.version}</p>
                </div>
            </div>
            <div class="description">
                <h3>説明</h3>
                <p><strong>原文:</strong> ${extension.packageJSON.description || '説明なし'}</p>
                <p><strong>翻訳:</strong> ${translatedDescription}</p>
            </div>
            <div id="translated">
                <div class="markdown-body">${translatedHtml}</div>
            </div>
            <script nonce="${nonce}">
                const vscode = acquireVsCodeApi();
                document.addEventListener('click', (e) => {
                    const target = e.target.closest('a');
                    if (!target) return;
                    const href = target.getAttribute('data-external-link');
                    const filePath = target.getAttribute('data-file-link');
                    if (href) {
                        e.preventDefault();
                        vscode.postMessage({ command: 'openExternal', href });
                    } else if (filePath) {
                        e.preventDefault();
                        vscode.postMessage({ command: 'openFile', path: filePath });
                    }
                });
            </script>
        </body>
        </html>
    `;
}

async function getExtensionReadme(extension: vscode.Extension<any>): Promise<string> {
    try {
        const readmePath = path.join(extension.extensionPath, 'README.md');
        const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.file(readmePath));
        return Buffer.from(fileContent).toString('utf8');
    } catch (error) {
        console.error('README取得エラー:', error);
        return 'README.mdファイルが見つかりませんでした。';
    }
}

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('translate-description.translateDescription', async () => {
        try {
            const extensions = vscode.extensions.all.filter(ext => !ext.id.startsWith('vscode.'));
            if (extensions.length === 0) {
                vscode.window.showInformationMessage('翻訳可能な拡張機能が見つかりませんでした。');
                return;
            }

            const items = extensions.map(ext => ({
                label: ext.packageJSON.displayName || ext.packageJSON.name,
                description: ext.packageJSON.description || '',
                extension: ext
            }));

            const selected = await vscode.window.showQuickPick(items, { placeHolder: '翻訳したい拡張機能を選択してください' });
            if (!selected) return;

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "翻訳中…",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: "READMEを読み込み中..." });
                const originalReadme = await getExtensionReadme(selected.extension);
                
                progress.report({ increment: 50, message: "翻訳しています..." });
                const translatedReadme = await translateMarkdownText(originalReadme);
                
                progress.report({ increment: 100, message: "表示を準備中..." });
                await createTranslationWebView(context, selected.extension, originalReadme, translatedReadme);
            });

        } catch (error) {
            console.error('翻訳処理全体でエラー:', error);
            vscode.window.showErrorMessage(`翻訳中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
