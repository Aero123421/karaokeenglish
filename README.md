# Karaoke English

A browser-based speech recognition karaoke reader for English pronunciation practice.

## 概要

ブラウザ上で動作する音声認識カラオケリーダーです。Web Speech APIを活用し、発話した単語をリアルタイムでハイライト表示します。

## 主な機能

- **リアルタイム音声認識**: Web Speech APIによる即座の発話認識
- **2つの認識モード**: 正確性重視の「正確モード」と応答性重視の「高速モード」
- **モバイル対応**: iPad/タブレットを含むモバイル環境で動作
- **ダークモード対応**: ライト/ダークテーマの切り替え
- **自動再接続**: 無音時に自動で再接続し、途切れなく動作

## 使い方

1. `index.html`をブラウザで開く（Chrome/Edge推奨）
2. テキストエリアに英文を貼り付け、または「サンプル」ボタンで例文を読み込む
3. 「リーダーを開く」ボタンでセッション画面に移動
4. 設定で認識言語・モード・自動スクロールを調整
5. 「再生開始」ボタンでマイク入力開始
6. 発話すると該当単語がハイライト表示される

## 認識モード

- **正確モード**: 高精度な単語整列を優先
- **高速モード**: 応答速度を重視した軽量アルゴリズム

## 対応言語

- EN-US (アメリカ英語)
- EN-GB (イギリス英語)
- JA-JP (日本語)
- RU-RU (ロシア語)
- VI-VN (ベトナム語)

## 技術仕様

- **音声認識**: Web Speech API (SpeechRecognition)
- **対応ブラウザ**: Chrome, Edge (Safari は一部制限あり)
- **実装**: プレーンHTML/CSS/JavaScript (フレームワーク不使用)

## ローカルでの実行

```bash
# Python 3
python3 -m http.server 8080

# または Node.js
npx http-server . -p 8080
```

ブラウザで `http://localhost:8080` にアクセスしてください。

詳細な技術情報は`docs`ディレクトリを参照してください。

## ライセンス

MIT License
