## クレジットカウンター Web

高専シラバス情報をスクレイピングし、卒業に必要な単位数を可視化する Next.js 製アプリケーションです。学科ごとに科目をチェックし、必要単位とのギャップをリアルタイムに把握できます。

主な機能は `Docs/DetailDesignRevised.md` にまとめています。

## セットアップ

```bash
cd web
npm install
```

Node.js 18 以降（推奨: 20 以上）を利用してください。

## 開発サーバー

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開くとアプリを確認できます。データ取得に成功すると、ヘッダーに学科名と最終更新時刻が表示されます。

## ビルド

```bash
npm run build
npm start
```

`npm run build` は Turbopack ベースの本番ビルドを行い、`npm start` で本番モードを起動します。

## ディレクトリ構成

- `app/`
	- `page.js` : UI 実装（React Hooks + CSS Modules）
	- `api/subjects/route.js` : シラバスデータ取得 API
- `lib/`
	- `syllabus.js` : cheerio を用いたスクレイピングロジックとメモリキャッシュ
	- `constants.js` : 学科定義やデフォルト設定
	- `cache.js`, `errors.js` : 共通ユーティリティ
- `scripts/sanity.mjs` : 取得結果の簡易確認スクリプト（Node で実行）

## スクレイピングについて

- 参照元: [高専シラバス公開サイト](https://syllabus.kosen-k.go.jp/Pages/PublicSubjects)
- HTML 解析: `cheerio`
- キャッシュ: サーバー内メモリに 15 分保持（`CACHE_TTL_MS`）
- ユーザーエージェント: `CreditCounter/1.0 (+https://github.com/yoji/)`

科目名・区分などの取得ロジックは `lib/syllabus.js` を参照してください。必要に応じて正規化ルールを更新します。

## フロントエンドの特徴

- 学科・年度切り替え、必要単位のカスタム入力
- 学年 / 区分 / 必修・選択 / キーワードフィルタ
- 必修のみ・表示中のみ等の一括チェック機能
- 取得済み単位の集計と不足単位の即時表示
- ローカルストレージによる設定・チェック状態の永続化

## 動作確認

1. `npm run dev` を実行
2. ブラウザで http://localhost:3000/
3. 学科ボタンを切り替え、年次・フィルタを操作
4. 必修一括ボタンや表示中の一括選択で科目をチェック
5. ヘッダーに取得時刻が更新され、サマリーが変化することを確認

## ライセンスと注意事項

- 本リポジトリのコードはプロジェクトの目的範囲内で利用してください。
- シラバスサイトへのアクセスは短時間に大量リクエストが発生しないよう配慮してください。

## 参考リンク

- [DetailDesignRevised.md](../Docs/DetailDesignRevised.md)
- 旧ツール参考コード（スクレイピング）: https://github.com/imaimai17468/imaimai-portfolio/blob/master/public/CreditsCounterforKNCT/js/scraping.py
