# VS Code 拡張機能へようこそ

## フォルダー構成

* このフォルダーには拡張機能に必要なファイル一式が含まれています。
* `package.json` - 拡張機能やコマンドを宣言するマニフェストです。
  * サンプル拡張はコマンドを登録し、そのタイトルとコマンド名を定義します。これにより VS Code はコマンドパレットにコマンドを表示できます。まだプラグイン本体を読み込む必要はありません。
* `src/extension.ts` - コマンドの実装を記述するメインファイルです。
  * このファイルは `activate` という関数をエクスポートします。この関数は拡張機能が初めてアクティブ化されるとき（ここではコマンド実行時）に呼び出されます。`activate` 内で `registerCommand` を呼び出します。
  * コマンドの実装を含む関数を `registerCommand` の第2引数として渡します。

## すぐに実行して試す

* `F5` を押して、拡張機能を読み込んだ新しいウィンドウを開きます。
* コマンドパレット（Windows/Linux: `Ctrl+Shift+P`, macOS: `Cmd+Shift+P`）で `Hello World` と入力してコマンドを実行します。
* `src/extension.ts` 内のコードにブレークポイントを設定してデバッグします。
* 拡張機能の出力はデバッグコンソールで確認できます。

## 変更を反映する

* `src/extension.ts` を変更したら、デバッグツールバーから拡張機能を再起動できます。
* また、VS Code ウィンドウを再読み込み（Windows/Linux: `Ctrl+R`, macOS: `Cmd+R`）して変更を読み込むこともできます。

## API を確認する

* `node_modules/@types/vscode/index.d.ts` を開くと、API の全体像を参照できます。

## テストを実行する

* [Extension Test Runner](https://marketplace.visualstudio.com/items?itemName=ms-vscode.extension-test-runner) をインストールします。
* **Tasks: Run Task** コマンドから "watch" タスクを実行します。これが動作していないとテストが検出されない場合があります。
* アクティビティバーの Testing ビューを開き、"Run Test" ボタンをクリックするか、ショートカット `Ctrl/Cmd + ; A` を使用します。
* テスト結果は Test Results ビューで確認できます。
* `src/test/extension.test.ts` を変更するか、`test` フォルダー内に新しいテストファイルを作成します。
  * 付属のテストランナーは `**.test.ts` に一致するファイルのみを対象にします。
  * `test` フォルダー内に任意の構成でサブフォルダーを作成して構いません。

## さらに進めるには

* VS Code のインターフェイス/パターンに自然に溶け込む拡張機能を作成するために、[UX ガイドライン](https://code.visualstudio.com/api/ux-guidelines/overview) に従ってください。
* [拡張機能をバンドル](https://code.visualstudio.com/api/working-with-extensions/bundling-extension) してサイズを削減し、起動時間を改善します。
* VS Code 拡張機能マーケットプレイスに[公開](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)します。
* [CI（継続的インテグレーション）](https://code.visualstudio.com/api/working-with-extensions/continuous-integration) を設定してビルドを自動化します。
* [Issue 報告フロー](https://code.visualstudio.com/api/get-started/wrapping-up#issue-reporting) を統合し、ユーザーからの不具合報告や機能要望を受け取れるようにします。
