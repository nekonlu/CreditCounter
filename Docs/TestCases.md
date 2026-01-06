# テストケース一覧

本ドキュメントでは `web/lib/__tests__/syllabus.test.js` に実装されたテストケースを列挙します。テストはいずれも `vitest` を利用し、`npm test` で実行できます。

## escapeRegExp

| テスト名 | 目的 | 想定する前提条件 | 期待される結果 | 例 |
| --- | --- | --- | --- | --- |
| escapes regex metacharacters safely | 正規表現のメタ文字が安全にエスケープされるかを確認 | 特殊文字とバックスラッシュを含む入力を渡す | すべてのメタ文字が `\` 付きで返る | `escapeRegExp(".*+?^${}()|[]\\")` を実行 |

## normalizeYear

| テスト名 | 目的 | 想定する前提条件 | 期待される結果 | 例 |
| --- | --- | --- | --- | --- |
| falls back to default year when input is empty | 未指定時に既定年度へフォールバックするかを確認 | `year` を `undefined` や空値で呼び出し | `DEFAULT_YEAR` が返る | `normalizeYear()` で `undefined` を渡す |
| accepts numeric year strings | フォーマット済みの 4 桁文字列を受け入れるかを確認 | `"2024"` などの 4 桁数字文字列を渡す | 同じ文字列が返る | `normalizeYear("2024")` |
| throws HttpError for malformed values | 不正な年度文字列で例外が出るかを確認 | アルファベット混在など 4 桁以外を渡す | `HttpError(400)` が送出される | `normalizeYear("20A4")` |

## resolveDepartment

| テスト名 | 目的 | 想定する前提条件 | 期待される結果 | 例 |
| --- | --- | --- | --- | --- |
| returns the first department when code is missing | 入力なしでデフォルト学科を返すかを確認 | `departmentCode` を省略 | `DEPARTMENTS[0]` が返る | `resolveDepartment()` |
| matches codes case-insensitively | 学科コードの大小文字を区別しないことを確認 | 小文字化した有効コードを渡す | 対応する学科オブジェクトが返る | `resolveDepartment("j")` |
| throws HttpError for unknown codes | 未定義コードで例外が起きるか確認 | 存在しないコードを渡す | `HttpError(400)` が送出される | `resolveDepartment("ZZ")` |

## parseSubjects

| テスト名 | 目的 | 想定する前提条件 | 期待される結果 | 例 |
| --- | --- | --- | --- | --- |
| extracts normalized subjects from HTML markup | HTML 断片から科目情報を抽出できるか確認 | ミニマルな HTML フィクスチャを渡す | 2 件の科目が抽出され、留学生科目の区分が `必修（留学生）` に補正される | `parseSubjects(PARSE_SUBJECTS_HTML, department, "2025")` |
| throws HttpError when no subjects can be parsed | HTML に科目が無い場合のエラー確認 | `.mcc-hide` 要素が存在しない HTML を渡す | `HttpError(502)` が送出される | `parseSubjects("<html></html>", department, "2025")` |

## fetchSubjects

| テスト名 | 目的 | 想定する前提条件 | 期待される結果 | 例 |
| --- | --- | --- | --- | --- |
| loads subjects from local CSV fixtures | CSV フィクスチャを優先的に読み込めることを確認 | `SYLLABUS_CSV_DIR` がローカル CSV を指し、ネットワークを利用しない | `meta.source` が `csv`、科目配列が空でない、`fetch` が呼ばれない | `fetchSubjects({ departmentCode: "J", year: "2025" })` |
| returns cached data on subsequent requests | メモリキャッシュが有効であることを確認 | 同一の学科コード・年度で連続呼び出し | 2 回目以降のレスポンスで `meta.cached` が `true` になり、`subjects` 配列が同一参照になる | 同じ引数で 2 度 `fetchSubjects({ departmentCode: "J", year: "2025" })` を実行 |
| rejects non 4-digit year values | 年度バリデーションの入力チェック | `year` に 4 桁以外の文字列を指定 | `HttpError`(400) が発生しメッセージが "year must be a 4 digit string" となる | `fetchSubjects({ departmentCode: "J", year: "20" })` |
| rejects unknown department codes | 学科コードバリデーションの確認 | 未定義の学科コードを指定 | `HttpError`(400) が発生しメッセージが "unknown department code" となる | `fetchSubjects({ departmentCode: "Z", year: "2025" })` |
| propagates HttpError instances | `resolveDepartment` と `normalizeYear` のエラー伝播確認 | `departmentCode` や `year` に空文字など不正値を指定 | `HttpError` がそのまま呼び出し元へ伝播する | `fetchSubjects({ departmentCode: "", year: "abcd" })` |

## 実行方法

```bash
cd web
npm test
```

- テストは Node.js 18 以上を想定しています。
- ネットワークへアクセスしないため、オフラインでも実行できます。
