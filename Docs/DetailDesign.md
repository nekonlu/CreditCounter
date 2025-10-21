# コンパイルエラー詳細設計書

## 1. 外部設計

### ハードウェア環境
- ユーザー：PC、スマホ、タブレット  
- サーバー：プロジェクト担当者のPC

### ソフトウェア環境
- Webブラウザ：Google Chrome、Safari、Microsoft Edge

### 画面構成
- GUI（画像あり）

### ウィジェット構成
- 各機能要件は後述

#### 機能一覧（抜粋）

| 大分類 | 機能名 | 小分類 | 機能名 |
|--------|--------|--------|--------|
| 1 | 上部バナー | 1-1 | 固定バナー |
| 2 | 学科選択ボタン | 1-2 | 残り単位数カウンター |
| 3 | 使用シラバスドロップダウンリスト | 1-3 | 種別単位数カウンター |
| 4 | 必要単位数入力テキストボックス | 2-1〜2-5 | 各学科ボタン（M/E/D/J/C） |
| 5 | 一括チェックボタン | 5-1〜5-6 | 必修科目の一括チェック機能 |
| 6 | 絞り込みドロップダウンリスト | 6-1〜6-3 | 学年・種別・必修選択の絞り込み |
| 7 | 科目リスト | 7-1〜7-2 | 科目表示とチェックボックス |

---

## 2. 内部設計

### 図構成（画像あり）
- データフロー図  
- アクティビティ図  
- クラス図

---

## 3. クラス仕様

### controller クラス
- **役割**：各情報を統括して操作
- **インスタンス変数**：
  - `student`
  - `subject_list`
  - `database`
  - `UI_UX`
- **メソッド**：
  - `subject_list_generater(int grade, int department)`
  - `student_info_change(int grade, int department)`
  - `subject_status_change(bool credit_status)`

### student クラス
- **ユーザ情報を格納**
- `grade`, `department`, `normal_sub`, `specialty_sub`, `extra_sub`

### subject_list クラス
- **科目情報を格納**
- `name`, `grade`, `type_required_optional`, `type_normal_specialty`, `credit_status`

### database クラス
- **科目データベース管理**
- `syllabas_database`, `select_department`, `select_syllabas`, `view_grade`, `view_classification`, `view_required`
- **メソッド**：
  - `scraping(int grade, int department)`
  - `take_database(int grade, int department)`
  - `save_database(int grade, int department)`
  - `syllabas_displayer(int mode)`

---

## 4. 使用定数

| 内部定数 | 要件 |
|----------|------|
| NOT_SELECTED | 0 |
| MACHINE | 1 |
| ELECTRIC | 2 |
| DENKI | 3 |
| JOHO | 4 |
| CIVIL | 5 |

---

## 5. 画面の詳細項目（抜粋）

| 小分類 | 機能名 | 要件 |
|--------|--------|------|
| 1-1 | 固定バナー | スクロールしても画面上部に表示され続ける |
| 1-2 | 残り単位数カウンター | 単位数に応じて「卒業可」「卒業不可」を表示 |
| 2-1〜2-5 | 学科選択ボタン | student.department に対応する定数を代入 |
| 3-1 | 使用シラバスドロップダウン | 西暦と和暦で表示、select_syllabus に代入 |
| 4-1〜4-3 | 必要単位数入力 | 半角数字のみ、各変数に代入 |
| 5-1〜5-6 | 必修科目一括チェック | 条件に応じて履修フラグを操作 |
| 6-1〜6-3 | 絞り込みドロップダウン | 表示対象の科目を絞り込み |
| 7-1〜7-2 | 科目リストとチェック | 条件に合う科目を表示し、履修フラグを操作
