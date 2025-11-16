/**
 * Application State Management
 * アプリケーション状態管理
 */

export class AppState {
  constructor() {
    // Tokenization state
    this.tokens = [];           // {text, type: 'word'|'ws', start}
    this.wordStarts = [];       // word token の開始インデックス
    this.normalizedWords = [];  // 正規化された単語の配列
    this.wordStates = [];       // 各単語の状態 ('pending', 'matched', 'missed')

    // Recognition state
    this.currentWord = -1;      // 現在ハイライトしている word index
    this.recognizing = false;   // mic 状態
    this.lastMicIndex = -1;     // マイクで進んだインデックス
    this.recognizer = null;     // SpeechRecognition インスタンス

    // Matching state
    this.lastResultKey = '';
    this.unmatchedCount = 0;
    this.pendingGap = false;
    this.lastSourceText = '';

    // Auto-restart state
    this.shouldAutoRestart = false;
    this.userStopRequested = false;
    this.restartTimer = null;
    this.idleTimer = null;
    this.lastTranscriptTimestamp = 0;
    this.recognitionSession = { resume: false, fromRestart: false };
    this.permissionPrimed = false;

    // Mode state
    this.recognitionMode = 'precise';  // 'precise' or 'speed'
    this.lastSpeedNorm = '';
    this.speedState = {
      history: [],
      map: [],
      lastReliable: -1,
      anchor: -1,
      missCount: 0,
      stability: 0,
      lastInputTs: 0,
      lastEmitTs: 0
    };

    // UI state
    this.autoScrollEnabled = true;
  }

  /**
   * 状態をリセット
   */
  reset() {
    this.tokens = [];
    this.wordStarts = [];
    this.normalizedWords = [];
    this.wordStates = [];
    this.currentWord = -1;
    this.lastMicIndex = -1;
    this.lastResultKey = '';
    this.unmatchedCount = 0;
    this.pendingGap = false;
    this.lastSpeedNorm = '';
    this.resetSpeedState();
  }

  /**
   * Speed state をリセット
   */
  resetSpeedState() {
    this.speedState = {
      history: [],
      map: [],
      lastReliable: -1,
      anchor: -1,
      missCount: 0,
      stability: 0,
      lastInputTs: 0,
      lastEmitTs: 0
    };
  }

  /**
   * 認識状態を確認
   * @returns {boolean} 認識中かどうか
   */
  get isRecognizing() {
    return this.recognizing;
  }

  /**
   * タイマーをクリア
   */
  clearTimers() {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  /**
   * トークン化（文字列を単語と空白に分割）
   * @param {string} text - トークン化するテキスト
   */
  tokenize(text) {
    this.tokens = [];
    this.wordStarts = [];
    this.normalizedWords = [];
    this.lastResultKey = '';
    this.unmatchedCount = 0;
    this.pendingGap = false;
    this.shouldAutoRestart = false;
    this.userStopRequested = false;
    this.clearTimers();
    this.lastTranscriptTimestamp = 0;
    this.lastSpeedNorm = '';
    this.resetSpeedState();

    let i = 0;
    while (i < text.length) {
      if (/\s/.test(text[i])) {
        let j = i + 1;
        while (j < text.length && /\s/.test(text[j])) j++;
        this.tokens.push({ text: text.slice(i, j), type: 'ws', start: i });
        i = j;
      } else {
        let j = i + 1;
        while (j < text.length && !/\s/.test(text[j])) j++;
        const wordText = text.slice(i, j);
        this.tokens.push({ text: wordText, type: 'word', start: i });
        this.wordStarts.push(i);
        i = j;
      }
    }

    this.lastSourceText = text;
  }

  /**
   * 単語の状態を取得
   * @param {number} index - 単語のインデックス
   * @returns {string} 状態 ('pending', 'matched', 'missed')
   */
  getWordState(index) {
    return this.wordStates[index] || 'pending';
  }

  /**
   * 単語の状態を設定
   * @param {number} index - 単語のインデックス
   * @param {string} state - 状態 ('pending', 'matched', 'missed')
   */
  setWordState(index, state) {
    if (index >= 0 && index < this.wordStates.length) {
      this.wordStates[index] = state;
    }
  }

  /**
   * 単語の状態を範囲で設定
   * @param {number} from - 開始インデックス
   * @param {number} to - 終了インデックス
   * @param {string} state - 状態
   */
  setWordStateRange(from, to, state) {
    if (!this.wordStates.length) return;
    const start = Math.max(0, from);
    const end = Math.min(this.wordStates.length - 1, to);
    if (end < start) return;
    for (let i = start; i <= end; i++) {
      this.wordStates[i] = state;
    }
  }

  /**
   * すべての単語の状態をリセット
   */
  resetAllWordStates() {
    this.wordStates = new Array(this.normalizedWords.length).fill('pending');
    this.currentWord = -1;
  }
}
