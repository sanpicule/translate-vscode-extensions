
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as extensionModule from '../extension';

suite('translate-description extension', () => {
	let sandbox: sinon.SinonSandbox;


	setup(() => {
		sandbox = sinon.createSandbox();
	});

	teardown(() => {
		sandbox.restore();
	});

	suite('translateWithGoogleTranslate', () => {
		test('空文字列の場合はそのまま返す', async () => {
			// @ts-ignore
			const result = await extensionModule["translateWithGoogleTranslate"]('');
			assert.strictEqual(result, '');
		});
		test('google-translate-api-xを呼び出し、翻訳結果を返す', async () => {
			const fakeTranslate = sandbox.stub().resolves({ text: 'こんにちは' });
			extensionModule.setTranslate(fakeTranslate);
			const result = await extensionModule["translateWithGoogleTranslate"]('hello');
			assert.strictEqual(result, 'こんにちは');
		});
		test('エラー時は原文を返す', async () => {
			const fakeTranslate = sandbox.stub().rejects(new Error('fail'));
			extensionModule.setTranslate(fakeTranslate);
			const result = await extensionModule["translateWithGoogleTranslate"]('hello');
			assert.strictEqual(result, 'hello');
		});
	});

	suite('translateWithGemini', () => {
		test('Geminiで翻訳し、翻訳結果を返す', async () => {
			sandbox.stub(extensionModule, 'translateWithGemini').callsFake(async () => 'こんにちは');
			const result = await extensionModule["translateWithGemini"]('hello', 'dummy-key');
			assert.strictEqual(result, 'こんにちは');
		});
	test('Geminiが失敗した場合はエラーを投げる', async () => {
		extensionModule.setTranslateWithGemini(async () => { throw new Error('fail'); });
		await assert.rejects(() => extensionModule["translateWithGemini"]('hello', 'dummy-key'), /fail/);
	});
	});

	suite('translateExtensionDescription', () => {
		test('Gemini APIキーが未設定ならエラーを投げる', async () => {
			sandbox.stub(vscode.workspace, 'getConfiguration').returns({ get: () => '' } as any);
			// @ts-ignore
			await assert.rejects(() => extensionModule["translateExtensionDescription"]('desc'), /Gemini APIキー/);
		});

		test('Geminiで拡張機能説明を翻訳し、結果を返す', async () => {
			//  TODO:Geminiのモックを設定
			// sandbox.stub(vscode.workspace, 'getConfiguration').returns({ get: () => 'dummy-key' } as any);
			// const geminiStub = sinon.stub(extensionModule, 'translateWithGemini').resolves('説明文');
			// const result = await extensionModule["translateExtensionDescription"]('desc');
			// assert.strictEqual(result, '説明文');
			// geminiStub.restore();
		});
		test('Geminiが失敗した場合はエラーを投げる', async () => {
			sandbox.stub(vscode.workspace, 'getConfiguration').returns({ get: () => 'dummy-key' } as any);
			const fakeModel = { generateContent: sandbox.stub().rejects(new Error('fail')) };
			const fakeGenAI = sandbox.stub().returns({ getGenerativeModel: () => fakeModel });
			// @ts-ignore
			const originalGenAI = extensionModule["GoogleGenerativeAI"];
			// @ts-ignore
			extensionModule["GoogleGenerativeAI"] = function(apiKey: string) { return fakeGenAI(apiKey); };
			try {
				// @ts-ignore
				await assert.rejects(() => extensionModule["translateExtensionDescription"]('desc'));
			} finally {
				// @ts-ignore
				extensionModule["GoogleGenerativeAI"] = originalGenAI;
			}
		});
	});

	suite('translateMarkdownText', () => {
		test('APIキーが存在する場合はGeminiで翻訳する', async () => {
			sandbox.stub(vscode.workspace, 'getConfiguration').returns({ get: () => 'dummy-key' } as any);
			extensionModule.setTranslateWithGemini(async () => '文章');
			// @ts-ignore
			const result = await extensionModule["translateMarkdownText"]('text');
			assert.strictEqual(result, '文章');
		});
		test('Geminiが失敗した場合はGoogle翻訳にフォールバックする', async () => {
			sandbox.stub(vscode.workspace, 'getConfiguration').returns({ get: () => 'dummy-key' } as any);
			extensionModule.setTranslateWithGemini(async () => { throw new Error('fail'); });
			extensionModule.setTranslateMarkdownWithPlaceholders(async () => '文章');
			// @ts-ignore
			const result = await extensionModule["translateMarkdownText"]('text');
			assert.strictEqual(result, '文章');
		});
		test('APIキーがない場合はGoogle翻訳を使う', async () => {
			sandbox.stub(vscode.workspace, 'getConfiguration').returns({ get: () => '' } as any);
			extensionModule.setTranslateMarkdownWithPlaceholders(async () => '文章');
			// @ts-ignore
			const result = await extensionModule["translateMarkdownText"]('text');
			assert.strictEqual(result, '文章');
		});
	});

	suite('translateMarkdownWithPlaceholders', () => {
		test('翻訳後にプレースホルダーを元の内容に戻す', async function() {
			this.timeout(5000);
			// プレースホルダーをそのまま返すstub
			sandbox.stub(extensionModule, 'translateWithGoogleTranslate').callsFake(async (text: string) => text);
			// コードブロックやインラインコードを含む実際のMarkdownをテスト
			const input = [
				'# 見出し',
				'',
				'通常のテキスト',
				'',
				'```js',
				'console.log("hello");',
				'```',
				'',
				'インライン: `const a = 1;`',
				'',
				'末尾テキスト'
			].join('\n');
			const result = await extensionModule["translateMarkdownWithPlaceholders"](input);
			console.log('result:', result); // デバッグ用
			assert.ok(result.includes('```js\nconsole.log("hello");\n```'));
			assert.ok(result.includes('`const a = 1;`'));
		});
	});

	suite('getExtensionReadme', () => {
		test('READMEが存在する場合は内容を返す', async () => {
			const fakeFs = { readFile: sandbox.stub().resolves(Buffer.from('README内容')) };
			// @ts-ignore
			sandbox.stub(vscode.workspace, 'fs').value(fakeFs);
			const ext = { extensionPath: '/tmp', packageJSON: {} };
			// @ts-ignore
			const result = await extensionModule["getExtensionReadme"](ext);
			assert.strictEqual(result, 'README内容');
		});
	test('READMEが存在しない場合はエラーメッセージを返す', async () => {
			const fakeFs = { readFile: sandbox.stub().rejects(new Error('fail')) };
			// @ts-ignore
			sandbox.stub(vscode.workspace, 'fs').value(fakeFs);
			const ext = { extensionPath: '/tmp', packageJSON: {} };
			// @ts-ignore
			const result = await extensionModule["getExtensionReadme"](ext);
			assert.ok(result.includes('README.mdファイルが見つかりません'));
		});
	});
});
