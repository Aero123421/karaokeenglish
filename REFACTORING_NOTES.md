# リファクタリングノート

## 概要

このドキュメントは、コードベースリファクタリングで実施した変更内容を記録しています。

## 2025年 - プレーンHTML/CSS/JSへの移行

### 実施した変更

#### 1. ✅ React/ViteからプレーンHTML/CSS/JSへの完全移行

**変更前:**
- React 18 + Vite によるSPA構成
- JSXコンポーネントによる構造
- 複数のReactフックとサービス

**変更後:**
```
/
├── index.html              # メインHTML
├── public/
│   ├── css/
│   │   └── style.css       # スタイルシート
│   ├── js/
│   │   └── app.js          # アプリケーションロジック
│   ├── 404.html
│   └── _redirects
├── docs/
├── README.md
└── REFACTORING_NOTES.md
```

**メリット:**
- フレームワーク依存なし
- ビルドプロセス不要
- デプロイが簡単（静的ファイルのみ）
- パフォーマンス向上

---

#### 2. ✅ 音声認識の安定性向上

**改善内容:**
- `no-speech` エラーの適切な処理（認識継続）
- `aborted` エラーのハンドリング
- アイドルガードによる自動再接続
- 状態管理の簡素化

**修正前の問題:**
- 一文字読み上げ後に停止
- エラー時の復帰処理なし

**修正後:**
- 継続的な音声認識
- エラー時の自動復帰
- 無音時の自動再接続

---

## ファイル構造

### 新規ファイル
- `public/css/style.css` - スタイルシート
- `public/js/app.js` - アプリケーションロジック

### 削除ファイル
- `src/` ディレクトリ全体（React関連）
- `vite.config.js`
- `package-lock.json`
- `node_modules/`

---

## 開発環境

### ローカルサーバーの起動

```bash
# Python 3
python3 -m http.server 8080

# Node.js (http-server)
npx http-server . -p 8080

# PHP
php -S localhost:8080
```

### アクセス
```
http://localhost:8080
```

---

## デバッグ

### ブラウザのコンソール
アプリケーションは初期化時に以下のログを出力します:
```
English Karaoke Application initialized
```

### 状態の確認
ブラウザのコンソールで `appState` 変数を確認できます。

---

## テスト項目

### 基本機能
- [x] テキスト入力
- [x] サンプルテキストの読み込み
- [x] 音声認識の開始/停止
- [x] 単語のハイライト
- [x] ハイライトのリセット
- [x] 継続的な音声認識（停止しない）

### 設定機能
- [x] 言語選択（EN-US, EN-GB, JA-JP, RU-RU, VI-VN）
- [x] モード切り替え（正確/高速）
- [x] スクロール切り替え（自動/手動）
- [x] テーマ切り替え（ライト/ダーク）

### 画面遷移
- [x] 入力画面からセッション画面への遷移
- [x] セッション画面から入力画面への戻り

---

## セキュリティ

### CSP（Content Security Policy）
- スクリプト: 'self' + 'unsafe-inline'
- スタイル: 'self' + 'unsafe-inline' + Google Fonts
- フォント: 'self' + Google Fonts
- 画像: 'self' + data URI
- メディア: 'self'

---

## 変更履歴

### 2025-XX-XX - プレーンHTML/CSS/JSへの移行
- React/Viteからの完全移行
- 音声認識の安定性向上
- コードの簡素化
- ビルドプロセスの削除

### 2025-01-XX - メジャーリファクタリング (旧)
- モジュール化の実施
- 状態管理の改善
- エラーハンドリングの強化

---

## ライセンス

元のプロジェクトと同じライセンスを適用します。
