# クレジットカウンター 実装用詳細設計書（改訂版）

最終更新: 2025-10-21

## 1. システム構成
- フロントエンド: Next.js 15（App Router, JavaScript）
- サーバーレス API: Next.js Route Handlers (`app/api/subjects/route.js`)
- スタイリング: CSS Modules + utility クラス（Tailwind は未使用）
- HTML 解析: `cheerio` を用いたサーバー側スクレイピング
- データキャッシュ: サーバー内メモリに 15 分の TTL キャッシュを実装
- 状態永続化: `localStorage` に選択中の科目・入力値・設定を保存

## 2. 主要ドメインモデル
```ts
// 科目情報
Subject {
  id: string;          // `${department}-${year}-${slug}`
  name: string;        // 教科名
  grade: 1 | 2 | 3 | 4 | 5;
  classification: '一般' | '専門';
  requirement: '必修' | '必修（留学生）' | '選択';
  credits: number;
}

// ユーザー設定
StudentSettings {
  department: DepartmentCode;   // 'M' | 'E' | 'D' | 'J' | 'C'
  year: string;                 // 2021 など
  normalRequired: number;       // 一般（共通）科目の必要単位
  specialtyRequired: number;    // 専門科目の必要単位
  extraRequired: number;        // 選択など自由枠の必要単位
}

// クレジット集計結果
CreditSummary {
  earnedNormal: number;
  earnedSpecialty: number;
  earnedExtra: number;
  remainingNormal: number;
  remainingSpecialty: number;
  remainingExtra: number;
  isGraduationPossible: boolean;
}
```

## 3. API 設計
- `GET /api/subjects?department=M&year=2021`
  - クエリ
    - `department`: `M|E|D|J|C`
    - `year`: 西暦 4 桁。未指定時は最新年（2021）
  - レスポンス
    ```json
    {
      "subjects": Subject[],
      "meta": {
        "department": "M",
        "departmentName": "機械工学科",
        "year": "2021",
        "fetchedAt": "2025-10-21T07:00:00.000Z",
        "cached": true
      }
    }
    ```
  - エラーレスポンス
    - `400` 不正なパラメータ
    - `502` スクレイピング先の失敗

## 4. スクレイピングフロー
1. パラメータに応じ URL `https://syllabus.kosen-k.go.jp/Pages/PublicSubjects` を生成
2. `fetch` で HTML を取得（User-Agent 指定）
3. `cheerio` で以下の情報を抽出
   - `.mcc-hide` から教科名
   - `td` から分類（一般/専門）、必修/選択、単位数
   - `class c{1..5}m` から学年ブロックを推定
4. 特定科目の重複や名称差異を調整（`英語演習ⅠＡ / ⅠＢ` 例はスキップ処理）
5. CSV 相当の配列を構築し、`Subject[]` に整形
6. キャッシュへ保存（キー: `${department}-${year}`）

## 5. フロントエンド UI 構成
- `app/page.js` に SPA 風 UI を構築
  - **固定ヘッダー**: タイトル、最終取得時刻
  - **学科選択パネル**: 5 科ボタン、選択状態を強調
  - **シラバス選択**: 年度ドロップダウン（2021〜現在）
  - **必要単位入力**: 3 つの数値入力（一般/専門/自由）
  - **クレジットサマリー**: 残単位と「卒業可/不可」表示
  - **フィルタバー**: 学年、分類、必修/選択トグル
  - **科目テーブル**: 教科名・学年・区分・単位・履修済チェックボックス
    - 行クリックでチェック状態をトグル
    - 上部「必修を全て履修済にする」ボタン
    - 表示中アイテムへの一括選択/解除ボタンを提供
  - **状態保持**: `localStorage` でユーザー操作を保持

## 6. 状態管理
- React Hooks (`useReducer`) を用いて `SubjectState` を管理
- ユーザー設定は `useState` + `useEffect` で保存/復元
- クレジット集計はメモ化 (`useMemo`) で再計算

## 7. バリデーション・エラーハンドリング
- 入力は 0〜200 の整数に正規化
- API エラー時はメッセージとリトライボタンを表示
- スクレイピング中はローディングスピナーを表示

## 8. テスト方針
- 単体テスト: `vitest` + `@testing-library/react` を追加予定（未実装）
- E2E: Playwright を将来導入可能性あり（未実装）

## 9. 今後の TODO
- 単位要件のデフォルト値を学科別に自動設定
- オフラインキャッシュ
- PDF など外部出力

```diff
+ DetailDesign.md の旧記述は参照のみ。実装は本書に従う。
```