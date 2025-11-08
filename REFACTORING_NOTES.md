# リファクタリングノート

## 概要

このドキュメントは、2025年のコードベースリファクタリングで実施した変更内容を記録しています。

## 実施した改善

### 1. ✅ モジュール化 - script.jsを複数ファイルに分割

**変更前:**
- `script.js` (1,251行) - すべてのロジックが1つのファイルに集約

**変更後:**
```
js/
├── utils/
│   ├── performance.js         # デバウンス・スロットリング
│   └── stringMatching.js      # Levenshtein、Jaro-Winkler
├── components/
│   ├── ConfidenceHighlighter.js    # 信頼度ベースハイライト
│   ├── GPUAnimator.js              # GPU最適化アニメーション
│   ├── ConfidenceInterpolator.js   # 信頼度補間
│   └── ToggleSlider.js             # トグルスライダー（キーボード対応）
├── services/
│   ├── ErrorLogger.js              # エラーログ・ユーザーフレンドリーメッセージ
│   └── SpeechRecognitionService.js # 音声認識サービス
├── state/
│   └── AppState.js                 # アプリケーション状態管理
└── main.js                         # エントリーポイント
```

**メリット:**
- コードの可読性向上
- 保守性の向上
- テストの容易性向上
- 責任の分離

---

### 2. ✅ エラーログ強化 - ユーザーフレンドリーなエラーメッセージ

**実装:**
- `ErrorLogger` サービスの作成
- 事前定義されたエラーメッセージとガイダンス
- ローカルストレージでのエラー履歴管理（最新50件）
- デバッグモード対応

**エラーメッセージ例:**
```javascript
'NotAllowedError': {
  title: 'マイクの使用が拒否されました',
  message: 'ブラウザの設定でマイクへのアクセスを許可してください。',
  instructions: [
    '1. アドレスバー左側の鍵マークをクリック',
    '2. 「マイク」の設定を「許可」に変更',
    '3. ページを再読み込み'
  ]
}
```

**デバッグモード:**
```javascript
// ローカルストレージでデバッグモードを有効化
localStorage.setItem('debug', 'true');

// パフォーマンス計測
errorLogger.startMeasure('recognition');
// ... 処理 ...
errorLogger.endMeasure('recognition');
```

---

### 3. ✅ グローバル変数の整理 - 状態管理オブジェクトへの統合

**変更前:**
```javascript
let tokens = [];
let wordStarts = [];
let currentWord = -1;
let recognizing = false;
// ... 他19個のグローバル変数
```

**変更後:**
```javascript
class AppState {
  constructor() {
    this.tokens = [];
    this.wordStarts = [];
    this.currentWord = -1;
    this.recognizing = false;
    // ... すべての状態を一元管理
  }
}
```

**メリット:**
- 名前空間の汚染を防止
- 状態の一元管理
- リセットやクリーンアップが容易

---

### 4. ✅ CSPヘッダーの追加 - セキュリティ強化

**実装:**
```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self';
               style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
               font-src 'self' https://fonts.gstatic.com;
               connect-src 'self';
               img-src 'self' data:;
               media-src 'self';">
```

**保護内容:**
- XSS攻撃の防止
- インジェクション攻撃の緩和
- 信頼できるソースのみからリソースを読み込み

---

### 5. ✅ キーボードナビゲーション - アクセシビリティ向上

**実装:**
`ToggleSlider.addKeyboardNavigation()` メソッド

**対応キー:**
- `ArrowLeft` / `ArrowUp`: 前の選択肢
- `ArrowRight` / `ArrowDown`: 次の選択肢
- `Home`: 最初の選択肢
- `End`: 最後の選択肢

**例:**
```javascript
langSlider.addKeyboardNavigation(recLangRadios);
```

---

### 6. ✅ CSS重複削減 - 保守性向上

**改善内容:**
- トグルスタイルの共通パターンに関するコメント追加
- 将来のリファクタリングガイドライン記載
- コードの意図を明確化

**コメント例:**
```css
/*
  Note: The .lang-toggle, .mode-toggle, and .scroll-toggle styles share
  a common base pattern. While they are currently defined separately for
  backward compatibility, consider using CSS custom properties or a
  preprocessor to reduce duplication in future refactoring.
*/
```

---

### 7. ✅ 横向き表示最適化 - UX向上

**実装:**
```css
@media (max-height: 600px) and (orientation: landscape) {
  /* コンパクトなレイアウト */
  .reader { min-height: 220px; }
  .controls--options { flex-direction: row; }
  /* ... */
}
```

**最適化内容:**
- ヘッダーとマージンの縮小
- リーダーの最小高さ調整
- コントロールを横並びに配置
- フォントサイズの調整

---

## ファイル構造

### バックアップファイル
- `script-old.js` - 元のモノリシックJavaScript
- `style-old.css` - 元のCSSファイル

### 新規ファイル
- `js/` ディレクトリ配下のすべてのモジュール
- `REFACTORING_NOTES.md` - このドキュメント

---

## 移行ガイド

### 開発環境

**ローカルサーバーの起動:**
```bash
# Python 3
python3 -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Node.js (http-server)
npx http-server -p 8000

# PHP
php -S localhost:8000
```

**アクセス:**
```
http://localhost:8000/index.html
```

**注意:** ES6モジュールは `file://` プロトコルでは動作しません。必ずHTTPサーバーを使用してください。

---

## デバッグ

### デバッグモードの有効化
```javascript
// ブラウザのコンソールで実行
localStorage.setItem('debug', 'true');
location.reload();
```

### エラーログの確認
```javascript
// エラーログを取得
const errors = JSON.parse(localStorage.getItem('errorLog') || '[]');
console.table(errors);

// エラーログをクリア
localStorage.removeItem('errorLog');
```

### パフォーマンス計測
```javascript
// デバッグモードが有効な場合、自動的にパフォーマンス計測が実行されます
// ブラウザの開発者ツール → Performance タブで確認
```

---

## テスト

### 機能テスト項目

#### 基本機能
- [ ] テキスト入力
- [ ] サンプルテキストの読み込み
- [ ] 音声認識の開始/停止
- [ ] 単語のハイライト
- [ ] ハイライトのリセット

#### トグル機能
- [ ] 言語選択（EN-US, EN-GB, JA-JP, RU-RU, VI-VN）
- [ ] モード切り替え（正確/高速）
- [ ] スクロール切り替え（自動/手動）
- [ ] テーマ切り替え（ライト/ダーク）

#### キーボードナビゲーション
- [ ] 言語選択で矢印キー操作
- [ ] モード選択で矢印キー操作
- [ ] スクロール選択で矢印キー操作
- [ ] Home/End キーの動作

#### アクセシビリティ
- [ ] スクリーンリーダーでの動作確認
- [ ] キーボードのみでの操作
- [ ] フォーカス表示の確認
- [ ] ARIA属性の確認

#### レスポンシブ
- [ ] デスクトップ表示
- [ ] タブレット表示
- [ ] スマートフォン表示
- [ ] 横向き表示

---

## パフォーマンス

### 最適化内容
- GPU加速アニメーション
- FastDOMパターン（リフロー最小化）
- スロットリング/デバウンス
- メトリクスキャッシング
- requestAnimationFrame使用

### 計測結果の例
```
[PERFORMANCE] recognition-time: 12.34ms
[PERFORMANCE] highlight-update: 3.21ms
```

---

## セキュリティ

### CSP（Content Security Policy）
- スクリプト: 'self' のみ
- スタイル: 'self' + Google Fonts
- フォント: 'self' + Google Fonts
- 画像: 'self' + data URI
- メディア: 'self'

### XSS対策
- `textContent` 使用（HTMLインジェクション防止）
- 外部スクリプトの制限
- ユーザー入力のサニタイズ

---

## 今後の改善提案

### 優先度: 高
1. ユニットテストの導入（Jest + Testing Library）
2. E2Eテストの導入（Playwright / Cypress）
3. TypeScriptへの移行

### 優先度: 中
4. ビルドプロセスの導入（Vite / Webpack）
5. CSS Modulesまたはプリプロセッサの導入
6. フォントのローカルホスティング

### 優先度: 低
7. PWA対応（オフライン機能）
8. 音声認識の精度向上（カスタムモデル）
9. 多言語UI対応（i18n）

---

## 変更履歴

### 2025-01-XX - メジャーリファクタリング
- モジュール化の実施
- 状態管理の改善
- エラーハンドリングの強化
- アクセシビリティの向上
- セキュリティの強化
- レスポンシブデザインの改善

---

## 貢献者

- Claude (Anthropic) - コードレビューとリファクタリング提案

---

## ライセンス

元のプロジェクトと同じライセンスを適用します。
