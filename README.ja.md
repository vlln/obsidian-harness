<h1 align="center">Obsidian Harness</h1>

<p align="center">
  <img src="https://img.shields.io/github/downloads/vlln/obsidian-harness/total" alt="GitHub Downloads">
  <img src="https://img.shields.io/github/license/vlln/obsidian-harness" alt="License">
  <img src="https://img.shields.io/github/v/release/vlln/obsidian-harness" alt="GitHub release">
  <img src="https://img.shields.io/github/last-commit/vlln/obsidian-harness" alt="GitHub last commit">
  <a href="https://github.com/vlln/obsidian-harness/discussions"><img src="https://img.shields.io/github/discussions/vlln/obsidian-harness" alt="GitHub Discussions"></a>
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a>
</p>

> Obsidian をコックピットに、Agent をエンジンに — ナレッジベースから AI コーディングエージェントを管理。

AIエージェント（Claude Code、Codex、Gemini CLI、Pi）をObsidianに直接統合。Vault内からAIアシスタントとチャットでき、ノートをすべてのエージェントセッションの制御平面として利用できます。

このプラグインは、Zed の [Agent Client Protocol (ACP)](https://github.com/agentclientprotocol/agent-client-protocol) で構築されています。

https://github.com/user-attachments/assets/0fcb6751-84cb-4eb9-b373-adb28e8115e0

## 機能

- **ノートメンション**: `@ノート名`でノートを参照
- **画像添付**: チャットに画像をペーストまたはドラッグ&ドロップ
- **スラッシュコマンド**: エージェントが提供する`/`コマンドを使用
- **マルチエージェント**: Claude Code、Codex、Gemini CLI、Pi、カスタムエージェントを切り替え
- **マルチセッション**: 複数のエージェントを別々のビューで同時実行
- **フローティングチャット**: 素早くアクセスできる折りたたみ可能なチャットウィンドウ
- **モード・モデル切り替え**: チャット画面からAIモデルやエージェントモードを変更
- **セッション履歴**: 過去の会話を再開またはフォーク
- **チャットエクスポート**: 会話をMarkdownノートとして保存
- **ターミナル統合**: エージェントがコマンドを実行し結果を返す
- **MCPサポート**: エージェントに設定済みのMCPサーバーがそのまま利用可能 — プラグイン側の追加設定は不要

## インストール

### BRAT経由（推奨）

このプラグインはまだ Obsidian コミュニティプラグインディレクトリに登録されていません。[BRAT](https://github.com/TfTHacker/obsidian42-brat) を使ってインストールします:

1. [BRAT](https://github.com/TfTHacker/obsidian42-brat) プラグインをインストール
2. **設定 → BRAT → Add Beta Plugin** に移動
3. 貼り付け: `https://github.com/vlln/obsidian-harness`
4. プラグインリストから **Obsidian Harness** を有効化

### 手動インストール

1. [リリース](https://github.com/vlln/obsidian-harness/releases)から `main.js`、`manifest.json`、`styles.css` をダウンロード
2. `VaultFolder/.obsidian/plugins/obsidian-harness/` に配置
3. **設定 → コミュニティプラグイン** でプラグインを有効化

## クイックスタート

ターミナル（macOS/LinuxではTerminal、WindowsではPowerShell）を開き、以下のコマンドを実行します。

1. **エージェントとACPアダプタをインストール**（例: Claude Code）:
   ```bash
   curl -fsSL https://claude.ai/install.sh | bash   # Claude Codeをインストール
   npm install -g @agentclientprotocol/claude-agent-acp   # ACPアダプタをインストール
   ```

2. **ログイン**（APIキーを使う場合はスキップ）:
   ```bash
   claude
   ```
   プロンプトに従ってAnthropicアカウントで認証します。

3. **パスを確認**:
   ```bash
   which node   # macOS/Linux
   which claude-agent-acp

   where.exe node   # Windows
   where.exe claude-agent-acp
   ```

4. **設定 → Obsidian Harness** で設定:
   - **Node.js path**: 例: `/usr/local/bin/node`
   - **Agents → Claude Code → Path**: 例: `/usr/local/bin/claude-agent-acp`（`claude`ではない）
   - **API key**: キーを追加、またはCLIでログイン済みの場合は空欄

5. **チャット開始**: リボンのロボットアイコンをクリック

### セットアップガイド

- [Claude Code](https://vlln.github.io/obsidian-harness/agent-setup/claude-code.html)
- [Codex](https://vlln.github.io/obsidian-harness/agent-setup/codex.html)
- [Gemini CLI](https://vlln.github.io/obsidian-harness/agent-setup/gemini-cli.html)
- [Pi](https://vlln.github.io/obsidian-harness/agent-setup/pi.html)
- [カスタムエージェント](https://vlln.github.io/obsidian-harness/agent-setup/custom-agents.html)（OpenCode、Qwen Code、Kiro、Mistral Vibeなど）

**[ドキュメント全文](https://vlln.github.io/obsidian-harness/)**

## 開発

```bash
npm install
npm run dev
```

プロダクションビルド:
```bash
npm run build
```

## ライセンス

Apache License 2.0 - 詳細は [LICENSE](LICENSE) を参照。
