/**
 * Main Application Entry Point
 * メインアプリケーションエントリーポイント
 */

import { normalizeForMatch } from './utils/stringMatching.js';
import { ConfidenceHighlighter } from './components/ConfidenceHighlighter.js';
import { GPUAnimator } from './components/GPUAnimator.js';
import { ConfidenceInterpolator } from './components/ConfidenceInterpolator.js';
import { ToggleSlider } from './components/ToggleSlider.js';
import { AppState } from './state/AppState.js';
import { ErrorLogger } from './services/ErrorLogger.js';
import { SpeechRecognitionService } from './services/SpeechRecognitionService.js';

// ====== アプリケーション初期化 ======
class KaraokeEnglishApp {
  constructor() {
    // DOM Elements
    this.textInput = document.getElementById('textInput');
    this.reader = document.getElementById('reader');
    this.loadSample = document.getElementById('loadSample');
    this.resetHL = document.getElementById('resetHL');
    this.recStatus = document.getElementById('recStatus');
    this.btnMicStart = document.getElementById('btnMicStart');
    this.btnMicStop = document.getElementById('btnMicStop');
    this.themeToggle = document.getElementById('themeToggle');
    this.themeIcon = document.getElementById('themeIcon');
    this.themeText = document.getElementById('themeText');

    // Language toggle
    this.recLangRadios = Array.from(document.querySelectorAll('input[name="recLang"]'));
    this.langToggleEl = document.querySelector('.lang-toggle');
    this.langSliderEl = this.langToggleEl?.querySelector('.lang-toggle__slider');

    // Mode toggle
    this.recModeRadios = Array.from(document.querySelectorAll('input[name="recMode"]'));
    this.modeToggleEl = document.querySelector('.mode-toggle');
    this.modeSliderEl = this.modeToggleEl?.querySelector('.mode-toggle__slider');

    // Scroll toggle
    this.scrollModeRadios = Array.from(document.querySelectorAll('input[name="scrollMode"]'));
    this.scrollToggleEl = document.querySelector('.scroll-toggle');
    this.scrollSliderEl = this.scrollToggleEl?.querySelector('.scroll-toggle__slider');

    // Initialize services
    this.appState = new AppState();
    this.errorLogger = new ErrorLogger();
    this.confidenceHighlighter = new ConfidenceHighlighter();
    this.gpuAnimator = new GPUAnimator();
    this.confidenceInterpolator = new ConfidenceInterpolator();
    this.speechRecognition = new SpeechRecognitionService(
      this.appState,
      this.confidenceInterpolator,
      this.errorLogger
    );

    // Toggle sliders
    this.initializeToggleSliders();

    // Event listeners
    this.initializeEventListeners();

    // Initial setup
    this.initializeApp();
  }

  /**
   * トグルスライダーを初期化
   */
  initializeToggleSliders() {
    // Language toggle
    if (this.langToggleEl && this.langSliderEl) {
      this.langSlider = new ToggleSlider(
        this.langToggleEl,
        this.langSliderEl,
        '--slider-offset',
        '--slider-width'
      );
      this.langSlider.addKeyboardNavigation(this.recLangRadios);
      this.langSlider.addDraggable(
        Array.from(this.langToggleEl.querySelectorAll('.lang-toggle__option')),
        this.recLangRadios
      );
    }

    // Mode toggle
    if (this.modeToggleEl && this.modeSliderEl) {
      this.modeSlider = new ToggleSlider(
        this.modeToggleEl,
        this.modeSliderEl,
        '--mode-slider-offset',
        '--mode-slider-width'
      );
      this.modeSlider.addKeyboardNavigation(this.recModeRadios);
      this.modeSlider.addDraggable(
        Array.from(this.modeToggleEl.querySelectorAll('.mode-toggle__option')),
        this.recModeRadios
      );
    }

    // Scroll toggle
    if (this.scrollToggleEl && this.scrollSliderEl) {
      this.scrollSlider = new ToggleSlider(
        this.scrollToggleEl,
        this.scrollSliderEl,
        '--scroll-slider-offset',
        '--scroll-slider-width'
      );
      this.scrollSlider.addKeyboardNavigation(this.scrollModeRadios);
      this.scrollSlider.addDraggable(
        Array.from(this.scrollToggleEl.querySelectorAll('.scroll-toggle__option')),
        this.scrollModeRadios
      );
    }
  }

  /**
   * イベントリスナーを初期化
   */
  initializeEventListeners() {
    // Mic controls
    this.btnMicStart.addEventListener('click', () => this.micStart());
    this.btnMicStop.addEventListener('click', () => this.micStop());

    // Reset highlight
    this.resetHL.addEventListener('click', () => this.resetHighlight());

    // Load sample
    this.loadSample.addEventListener('click', () => this.loadSampleText());

    // Mode change
    this.recModeRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        this.appState.recognitionMode = radio.value;
        this.appState.lastResultKey = '';
        this.appState.lastSpeedNorm = '';
        this.appState.unmatchedCount = 0;
        this.appState.pendingGap = false;
        this.appState.resetSpeedState();
        this.appState.speedState.lastReliable = this.appState.currentWord;
        this.appState.speedState.anchor = this.appState.currentWord;
        this.recStatus.textContent = this.appState.recognitionMode === 'speed'
          ? '高速モード準備完了'
          : '正確モード準備完了';
      });
    });

    // Scroll mode
    this.scrollModeRadios.forEach(input => {
      input.addEventListener('change', () => {
        this.appState.autoScrollEnabled = input.value === 'auto';
      });
    });

    // Theme toggle
    this.themeToggle.addEventListener('click', () => this.toggleTheme());

    // Speech recognition callbacks
    this.speechRecognition.onStart = () => {
      this.btnMicStart.disabled = true;
      this.btnMicStop.disabled = false;
    };

    this.speechRecognition.onEnd = () => {
      this.btnMicStart.disabled = false;
      this.btnMicStop.disabled = true;
    };

    this.speechRecognition.onStatusUpdate = (text) => {
      this.recStatus.textContent = text;
    };

    this.speechRecognition.onHighlight = (index, options) => {
      this.highlightTo(index, options);
    };
  }

  /**
   * アプリケーションを初期化
   */
  initializeApp() {
    // Load saved theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      this.setTheme(savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      this.setTheme('dark');
    }

    // Initial render
    this.appState.tokenize('');
    this.appState.normalizedWords = this.appState.tokens
      .filter(t => t.type === 'word')
      .map(t => normalizeForMatch(t.text));
    this.appState.wordStates = new Array(this.appState.normalizedWords.length).fill('pending');
    this.render();

    this.reader.style.fontSize = '16px';
    this.reader.style.lineHeight = '1.7';
    this.recStatus.textContent = '準備完了';
  }

  /**
   * テーマを設定
   * @param {string} theme - テーマ ('light' or 'dark')
   */
  setTheme(theme) {
    // トランジション無効化で瞬時に切り替え
    document.documentElement.classList.add('theme-switching');

    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      this.themeIcon.textContent = '☀️';
      this.themeText.textContent = 'ライトモード';
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      this.themeIcon.textContent = '🌙';
      this.themeText.textContent = 'ダークモード';
      localStorage.setItem('theme', 'light');
    }

    // 次フレームでトランジション再有効化
    requestAnimationFrame(() => {
      document.documentElement.classList.remove('theme-switching');
    });
  }

  /**
   * テーマを切り替え
   */
  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    this.setTheme(currentTheme === 'dark' ? 'light' : 'dark');
  }

  /**
   * 選択された言語を取得
   * @returns {string} 言語コード
   */
  getSelectedLang() {
    const active = this.recLangRadios.find(input => input.checked);
    return active ? active.value : 'en-US';
  }

  /**
   * 単語スパンを取得
   * @returns {NodeList} 単語スパンのリスト
   */
  getWordSpans() {
    return this.reader.querySelectorAll('.word');
  }

  /**
   * トークンインデックスから単語インデックスを取得
   * @param {number} tokenIdx - トークンインデックス
   * @returns {number} 単語インデックス
   */
  wordIndexFromTokenIndex(tokenIdx) {
    let count = 0;
    for (let i = 0; i <= tokenIdx; i++) {
      if (this.appState.tokens[i].type === 'word') count++;
    }
    return count - 1;
  }

  /**
   * スパンに状態を適用
   * @param {HTMLElement} span - スパン要素
   * @param {string} state - 状態
   */
  applySpanState(span, state) {
    span.classList.toggle('word--matched', state === 'matched');
    span.classList.toggle('word--missed', state === 'missed');
    span.classList.toggle('word--pending', state === 'pending');
  }

  /**
   * 単語の状態を更新
   * @param {number} index - 単語のインデックス
   * @param {string} state - 状態
   * @param {NodeList} spans - スパンのリスト
   */
  updateWordState(index, state, spans) {
    if (index < 0 || index >= this.appState.wordStates.length) return;
    this.appState.wordStates[index] = state;
    const list = spans || this.getWordSpans();
    const span = list[index];
    if (span) this.applySpanState(span, state);
  }

  /**
   * 単語の状態を範囲で更新
   * @param {number} from - 開始インデックス
   * @param {number} to - 終了インデックス
   * @param {string} state - 状態
   * @param {NodeList} spans - スパンのリスト
   */
  updateWordStateRange(from, to, state, spans) {
    if (!this.appState.wordStates.length) return;
    const list = spans || this.getWordSpans();
    const start = Math.max(0, from);
    const end = Math.min(this.appState.wordStates.length - 1, to);
    if (end < start) return;
    for (let i = start; i <= end; i++) {
      this.appState.wordStates[i] = state;
      const span = list[i];
      if (span) this.applySpanState(span, state);
    }
  }

  /**
   * ハイライトを巻き戻し
   * @param {number} targetIndex - ターゲットインデックス
   */
  rewindHighlight(targetIndex) {
    const spans = this.getWordSpans();
    const clamped = Math.min(Math.max(targetIndex, -1), spans.length - 1);

    for (let i = clamped + 1; i < this.appState.wordStates.length; i++) {
      if (this.appState.wordStates[i] !== 'pending') {
        this.appState.wordStates[i] = 'pending';
      }
      const span = spans[i];
      if (span) {
        this.applySpanState(span, 'pending');
        span.classList.remove('word--active', 'active');
      }
    }

    if (this.appState.currentWord >= 0 && this.appState.currentWord < spans.length) {
      spans[this.appState.currentWord].classList.remove('word--active', 'active');
    }

    this.appState.currentWord = clamped;
    this.appState.lastMicIndex = clamped;

    if (clamped >= 0) {
      spans[clamped].classList.add('word--active', 'active');
      if (this.appState.autoScrollEnabled) {
        spans[clamped].scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }

  /**
   * 指定したインデックスまでハイライト
   * @param {number} index - ハイライトする単語のインデックス
   * @param {Object} options - オプション
   */
  highlightTo(index, options = {}) {
    const { manual = false, outcome = 'match', markSkipped = true, confidence = 0.7, tentative = false } = options;
    const wordSpans = this.getWordSpans();

    if (outcome === 'rollback' && !manual) {
      this.rewindHighlight(index);
      this.appState.pendingGap = false;
      this.appState.unmatchedCount = 0;
      return;
    }

    if (index < 0 || index >= wordSpans.length) return;

    // 距離チェック：透明ハイライトが離れすぎている場合は適用しない
    if (tentative && this.appState.currentWord >= 0) {
      const distance = index - this.appState.currentWord;
      if (distance > 5 || distance < 1) {
        return;
      }
    }

    if (!manual && !tentative) {
      const prev = this.appState.currentWord;
      if (outcome === 'match') {
        if (markSkipped) {
          const start = prev >= 0 ? prev + 1 : 0;
          if (index - start > 0) {
            this.updateWordStateRange(start, index - 1, 'missed', wordSpans);
          }
        }
        this.updateWordState(index, 'matched', wordSpans);
        this.appState.speedState.lastReliable = Math.max(this.appState.speedState.lastReliable, index);

        // 信頼度に基づいたスタイルを適用
        this.confidenceHighlighter.applyConfidenceStyle(wordSpans[index], confidence);
      } else if (outcome === 'skip') {
        if (markSkipped) {
          const from = prev < index ? prev + 1 : index;
          this.updateWordStateRange(from, index, 'missed', wordSpans);
        }
      }
    }

    if (this.appState.currentWord >= 0 && this.appState.currentWord < wordSpans.length) {
      wordSpans[this.appState.currentWord].classList.remove('word--active', 'active');
    }
    wordSpans[index].classList.add('word--active', 'active');

    if (!tentative) {
      this.appState.currentWord = index;
      this.appState.lastMicIndex = index;
      this.appState.pendingGap = false;
      this.appState.unmatchedCount = 0;
    }

    if (this.appState.autoScrollEnabled) {
      wordSpans[index].scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  /**
   * レンダリング
   */
  render() {
    const frag = document.createDocumentFragment();
    this.appState.tokens.forEach((tok, k) => {
      if (tok.type === 'word') {
        const span = document.createElement('span');
        span.className = 'word';
        span.dataset.i = this.wordIndexFromTokenIndex(k);
        span.textContent = tok.text;
        span.addEventListener('click', () => {
          this.highlightTo(parseInt(span.dataset.i, 10), { manual: true });
        });
        frag.appendChild(span);
      } else {
        frag.appendChild(document.createTextNode(tok.text));
      }
    });

    this.reader.innerHTML = '';
    this.reader.appendChild(frag);

    const spans = this.getWordSpans();
    if (this.appState.wordStates.length !== spans.length) {
      this.appState.wordStates = new Array(spans.length).fill('pending');
    }

    spans.forEach((span, idx) => {
      this.applySpanState(span, this.appState.wordStates[idx] || 'pending');
      // GPU最適化を全単語に適用
      this.gpuAnimator.forceGPULayer(span);
    });

    this.appState.currentWord = -1;
    this.appState.lastMicIndex = -1;
    this.appState.pendingGap = false;
    this.appState.unmatchedCount = 0;
  }

  /**
   * ハイライトをリセット
   */
  resetHighlight() {
    const spans = this.getWordSpans();
    spans.forEach(span => {
      span.classList.remove('word--active', 'active', 'word--matched', 'word--missed', 'word--pending');

      // Confidenceスタイルをクリア
      span.style.transform = '';
      span.style.willChange = '';
      span.style.opacity = '';
      span.style.transition = '';
      span.removeAttribute('data-confidence');
      span.style.removeProperty('--confidence-opacity');
      span.style.removeProperty('--confidence-color');

      this.applySpanState(span, 'pending');
    });

    this.appState.resetAllWordStates();
    this.appState.lastResultKey = '';
    this.appState.lastSpeedNorm = '';
    this.appState.unmatchedCount = 0;
    this.appState.pendingGap = false;
    this.appState.resetSpeedState();
  }

  /**
   * サンプルテキストを読み込み
   */
  loadSampleText() {
    const sample = `Teacher: Today's unit question is "How do we make decisions?"
Yuna: We make decisions every day—what to wear, what to eat, what to watch.
Teacher: Great. What kinds of factors affect our decisions?
Sophy: A big factor for me is my parents' opinions.
Teacher: Often other people influence our choices. What else?
Marcus: Sometimes we want to change or feel better about ourselves.`;

    this.textInput.value = sample;
    this.appState.tokenize(sample);
    this.appState.normalizedWords = this.appState.tokens
      .filter(t => t.type === 'word')
      .map(t => normalizeForMatch(t.text));
    this.appState.wordStates = new Array(this.appState.normalizedWords.length).fill('pending');
    this.render();
  }

  /**
   * マイク開始
   */
  async micStart() {
    const text = this.textInput.value.trim();
    if (!text) {
      alert('テキストを入力してください。');
      return;
    }

    // テキストが変更されている場合、トークン化
    if (text !== this.appState.lastSourceText || this.appState.tokens.length === 0) {
      this.appState.tokenize(text);
      this.appState.normalizedWords = this.appState.tokens
        .filter(t => t.type === 'word')
        .map(t => normalizeForMatch(t.text));
      this.appState.wordStates = new Array(this.appState.normalizedWords.length).fill('pending');
      this.render();
    } else if (!this.reader.childNodes.length) {
      this.render();
    }

    const lang = this.getSelectedLang();
    await this.speechRecognition.start({ lang });
  }

  /**
   * マイク停止
   */
  micStop() {
    this.speechRecognition.stop();
  }
}

// アプリケーションを初期化
document.addEventListener('DOMContentLoaded', () => {
  window.app = new KaraokeEnglishApp();
});
