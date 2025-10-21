# 開発進捗ログ

- 2025-10-21  作業開始。Next.js (JavaScript) ベースの Web プロジェクトを `web/` 以下に作成する方針を決定。
- 2025-10-21  `web/` に Next.js プロジェクトを作成（`create-next-app`）。生成済みリポジトリの `.git` を削除。
- 2025-10-21  新しい詳細設計書 `Docs/DetailDesignRevised.md` を作成し、実装方針を整理。
- 2025-10-21  シラバススクレイピング用モジュール `web/lib/syllabus.js` と API ルートを実装。`cheerio` を導入し、動作確認スクリプトを追加。
- 2025-10-21  フロントエンド UI を刷新。`app/page.js` を実装し、学科選択・単位集計・フィルタ・一括操作などの機能を追加。スタイルを CSS Modules で整備。
