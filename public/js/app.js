/**
 * English Karaoke Application - Plain JavaScript Version
 * 英語カラオケアプリケーション - プレーンJavaScript版
 */

// ===== String Matching Utilities =====

/**
 * マッチング用に文字列を正規化
 */
function normalizeForMatch(str) {
  if (str == null) return '';
  const strValue = String(str);
  try {
    return strValue.toLowerCase()
      .replace(/[\u2019\u2018]/g, "'")
      .replace(/[^\p{L}\p{N}'\s]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch (e) {
    return strValue.toLowerCase()
      .replace(/[^a-z0-9'\s]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

/**
 * Levenshtein距離を計算
 */
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      if (a[i - 1] === b[j - 1]) dp[j] = prev;
      else dp[j] = Math.min(prev, dp[j - 1], dp[j]) + 1;
      prev = temp;
    }
  }
  return dp[n];
}

/**
 * Jaro-Winkler類似度を計算
 */
function jaroWinkler(s1, s2) {
  if (s1 === s2) return 1.0;
  const len1 = s1.length, len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0;

  const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);
  let matches = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * 単語マッチングのスコアを計算
 */
function scoreWordMatch(a, b) {
  if (!a || !b) return -100;
  if (a === b) return 3;
  if (a.startsWith(b) || b.startsWith(a)) return 2;

  const dist = levenshtein(a, b);
  const minLen = Math.min(a.length, b.length);
  const maxLen = Math.max(a.length, b.length);

  if (dist === 1) return 2;
  if (dist === 2 && minLen > 4) return 1.5;
  if (dist === 2 && minLen > 3) return 1.2;
  if (dist <= Math.ceil(minLen / 2) && minLen >= 5) return 1;

  if (maxLen >= 4) {
    const similarity = jaroWinkler(a, b);
    if (similarity >= 0.75) return 1.2;
    if (similarity >= 0.7) return 0.9;
    if (similarity >= 0.65) return 0.7;
    if (similarity >= 0.6) return 0.5;
  }

  return -100;
}

const MATCH_CONSTANTS = {
  PENALTY_WEIGHT_LOG: 0.8,
  PENALTY_WEIGHT_LINEAR: 0.3,
  GLOBAL_PENALTY_LOG: 1.2,
  GLOBAL_PENALTY_LINEAR: 0.4,
  MIN_SCORE_SINGLE: 0.8,
  MIN_SCORE_MULTI: 1.0,
  GLOBAL_MIN_SCORE_SINGLE: 0.6,
  GLOBAL_MIN_SCORE_MULTI: 0.8,
  GLOBAL_MIN_THRESHOLD: 0.6,
};

// ===== Application State =====

/**
 * Centralized application state object.
 * Using a plain object for simplicity in this single-file application.
 * This approach provides direct access to state properties while keeping
 * all state in one place for easy debugging and resetting.
 */
const appState = {
  // Text and tokens
  tokens: [],
  normalizedWords: [],
  wordStates: [],
  currentWord: -1,
  lastSourceText: '',

  // Settings
  recLang: 'en-US',
  recMode: 'precise',
  autoScrollEnabled: true,

  // Recognition state
  lastMicIndex: -1,
  lastResultKey: '',
  lastSpeedNorm: '',
  unmatchedCount: 0,
  pendingGap: false,

  // Speech recognition
  recognizer: null,
  recognizing: false,
  starting: false,
  shouldAutoRestart: false,
  userStopRequested: false,
  permissionPrimed: false,
  lastTranscriptTimestamp: 0,
  restartTimer: null,
  idleTimer: null,

  // Auto-scroll state
  isScrolling: false,
  scrollTimer: null,

  // Confidence interpolation
  confidenceHistory: [],
  maxHistorySize: 10,

  // Stage
  stage: 'input',

  // Clear timers
  clearTimers() {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.scrollTimer) {
      clearTimeout(this.scrollTimer);
      this.scrollTimer = null;
    }
  },

  // Reset state
  resetRecognitionState() {
    this.lastResultKey = '';
    this.lastSpeedNorm = '';
    this.unmatchedCount = 0;
    this.pendingGap = false;
  }
};

// ===== DOM Elements =====

let elements = {};

function initializeElements() {
  elements = {
    // Theme
    themeToggle: document.getElementById('themeToggle'),
    themeIcon: document.getElementById('themeIcon'),
    themeText: document.getElementById('themeText'),

    // Input stage
    inputStage: document.getElementById('inputStage'),
    textInput: document.getElementById('textInput'),
    btnSample: document.getElementById('btnSample'),
    btnReset: document.getElementById('btnReset'),
    btnContinue: document.getElementById('btnContinue'),

    // Session stage
    sessionStage: document.getElementById('sessionStage'),
    btnEditScript: document.getElementById('btnEditScript'),
    recStatus: document.getElementById('recStatus'),
    btnMicStart: document.getElementById('btnMicStart'),
    btnMicStop: document.getElementById('btnMicStop'),
    recLangSelect: document.getElementById('recLangSelect'),
    recModeSelect: document.getElementById('recModeSelect'),
    scrollModeSelect: document.getElementById('scrollModeSelect'),
    reader: document.getElementById('reader'),
  };
}

// ===== Theme Management =====

function initTheme() {
  let theme = 'light';
  try {
    const saved = localStorage.getItem('theme');
    if (saved) {
      theme = saved;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      theme = 'dark';
    }
  } catch (e) {
    console.warn('localStorage not available:', e);
  }
  applyTheme(theme);
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    elements.themeIcon.textContent = '☀️';
    elements.themeText.textContent = 'ライト';
  } else {
    document.documentElement.removeAttribute('data-theme');
    elements.themeIcon.textContent = '🌙';
    elements.themeText.textContent = 'ダーク';
  }
  try {
    localStorage.setItem('theme', theme);
  } catch (e) {
    console.warn('Failed to save theme:', e);
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const newTheme = current === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
}

// ===== Tokenization =====

function tokenize(text) {
  if (text == null || typeof text !== 'string') {
    console.error('Invalid text provided to tokenize:', text);
    return;
  }

  try {
    const newTokens = [];
    let i = 0;

    while (i < text.length) {
      if (/\s/.test(text[i])) {
        let j = i + 1;
        while (j < text.length && /\s/.test(text[j])) j++;
        newTokens.push({ text: text.slice(i, j), type: 'ws', start: i });
        i = j;
      } else {
        let j = i + 1;
        while (j < text.length && !/\s/.test(text[j])) j++;
        newTokens.push({ text: text.slice(i, j), type: 'word', start: i });
        i = j;
      }
    }

    appState.tokens = newTokens;
    appState.normalizedWords = newTokens
      .filter(t => t.type === 'word')
      .map(t => normalizeForMatch(t.text));
    appState.wordStates = new Array(appState.normalizedWords.length).fill('pending');
    appState.currentWord = -1;
    appState.lastSourceText = text;
    appState.lastMicIndex = -1;
    appState.resetRecognitionState();
  } catch (error) {
    console.error('Error during tokenization:', error);
    appState.tokens = [];
    appState.normalizedWords = [];
    appState.wordStates = [];
    appState.currentWord = -1;
  }
}

// ===== Word Rendering =====

function renderWords() {
  const container = elements.reader;
  container.innerHTML = '';

  let wordIndex = 0;
  appState.tokens.forEach((token, idx) => {
    if (token.type === 'word') {
      const span = document.createElement('span');
      span.className = 'word word--pending';
      span.textContent = token.text;
      span.dataset.i = wordIndex;
      span.addEventListener('click', () => handleWordClick(parseInt(span.dataset.i, 10)));
      container.appendChild(span);
      wordIndex++;
    } else {
      const span = document.createElement('span');
      span.textContent = token.text;
      container.appendChild(span);
    }
  });
}

function updateWordStyles() {
  const wordSpans = elements.reader.querySelectorAll('.word');
  wordSpans.forEach((span, idx) => {
    const state = appState.wordStates[idx] || 'pending';
    span.className = 'word';
    span.classList.add(`word--${state}`);
    if (idx === appState.currentWord) {
      span.classList.add('word--active', 'active');
    }
  });
}

// ===== Highlighting =====

function highlightTo(index, options = {}) {
  const { manual = false, outcome = 'match', markSkipped = true, confidence = 0.7 } = options;
  const wordSpans = elements.reader.querySelectorAll('.word');

  if (outcome === 'rollback' && !manual) {
    rewindHighlight(index, wordSpans);
    return;
  }

  if (index < 0 || index >= wordSpans.length) return;

  if (!manual) {
    const prev = appState.currentWord;
    if (outcome === 'match') {
      if (markSkipped) {
        const start = prev >= 0 ? prev + 1 : 0;
        for (let i = start; i < index; i++) {
          appState.wordStates[i] = 'missed';
        }
      }
      appState.wordStates[index] = 'matched';
    } else if (outcome === 'skip') {
      if (markSkipped) {
        const from = prev < index ? prev + 1 : index;
        for (let i = from; i <= index; i++) {
          appState.wordStates[i] = 'missed';
        }
      }
    }
  }

  if (appState.currentWord >= 0 && appState.currentWord < wordSpans.length) {
    wordSpans[appState.currentWord].classList.remove('word--active', 'active');
  }
  wordSpans[index].classList.add('word--active', 'active');

  appState.currentWord = index;
  appState.lastMicIndex = index;
  appState.pendingGap = false;
  appState.unmatchedCount = 0;

  if (appState.autoScrollEnabled && !appState.isScrolling) {
    appState.isScrolling = true;
    wordSpans[index].scrollIntoView({ block: 'center', behavior: 'smooth' });
    
    // Clear any existing scroll timer
    if (appState.scrollTimer) {
      clearTimeout(appState.scrollTimer);
    }
    
    // Reset scrolling flag after animation completes
    // Smooth scroll typically takes 300-500ms
    appState.scrollTimer = setTimeout(() => {
      appState.isScrolling = false;
      appState.scrollTimer = null;
    }, 500);
  }

  updateWordStyles();
}

function rewindHighlight(targetIndex, wordSpans) {
  const clamped = Math.min(Math.max(targetIndex, -1), wordSpans.length - 1);

  for (let i = clamped + 1; i < appState.wordStates.length; i++) {
    appState.wordStates[i] = 'pending';
  }

  if (appState.currentWord >= 0 && appState.currentWord < wordSpans.length) {
    wordSpans[appState.currentWord].classList.remove('word--active', 'active');
  }

  appState.currentWord = clamped;
  appState.lastMicIndex = clamped;

  if (clamped >= 0) {
    wordSpans[clamped].classList.add('word--active', 'active');
    if (appState.autoScrollEnabled && !appState.isScrolling) {
      appState.isScrolling = true;
      wordSpans[clamped].scrollIntoView({ block: 'center', behavior: 'smooth' });
      
      // Clear any existing scroll timer
      if (appState.scrollTimer) {
        clearTimeout(appState.scrollTimer);
      }
      
      // Reset scrolling flag after animation completes
      appState.scrollTimer = setTimeout(() => {
        appState.isScrolling = false;
        appState.scrollTimer = null;
      }, 500);
    }
  }

  updateWordStyles();
}

function handleWordClick(index) {
  highlightTo(index, { manual: true });
}

function resetHighlight() {
  const spans = elements.reader.querySelectorAll('.word');
  spans.forEach(span => {
    span.classList.remove('word--active', 'active', 'word--matched', 'word--missed');
    span.classList.add('word--pending');
  });

  appState.wordStates = new Array(appState.normalizedWords.length).fill('pending');
  appState.currentWord = -1;
  appState.lastMicIndex = -1;
  appState.resetRecognitionState();
}

// ===== Word Matching =====

function findNextWordIndex(parts, baseIndex, lookAhead) {
  const maxContext = Math.min(4, parts.length);
  const backtrack = 3;

  for (let context = 1; context <= maxContext; context++) {
    const slice = parts.slice(-context);
    const start = Math.max(0, baseIndex + 1 - backtrack);
    const end = Math.min(appState.normalizedWords.length - context + 1, baseIndex + 1 + lookAhead);
    if (end <= start) continue;

    let bestScore = -100;
    let bestIdx = -1;

    for (let i = start; i < end; i++) {
      let score = 0;

      for (let j = 0; j < context; j++) {
        const candidate = appState.normalizedWords[i + j];
        const wordScore = scoreWordMatch(candidate, slice[j]);
        if (wordScore < 0) {
          score = -100;
          break;
        }
        score += wordScore;
      }

      if (score <= -100) continue;

      const candidateIdx = i + context - 1;
      const distance = Math.max(0, candidateIdx - baseIndex);
      const distancePenalty = distance > 0
        ? (Math.log2(distance + 1) * MATCH_CONSTANTS.PENALTY_WEIGHT_LOG +
           distance * MATCH_CONSTANTS.PENALTY_WEIGHT_LINEAR)
        : 0;
      const finalScore = score - distancePenalty;

      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestIdx = candidateIdx;
      }
    }

    const minScore = context === 1
      ? MATCH_CONSTANTS.MIN_SCORE_SINGLE
      : context * MATCH_CONSTANTS.MIN_SCORE_MULTI;

    if (bestIdx !== -1 && bestScore >= minScore) {
      return bestIdx;
    }
  }

  return -1;
}

function findBestGlobalMatch(parts, baseIndex) {
  if (appState.normalizedWords.length === 0) return -1;

  const maxContext = Math.min(4, parts.length);
  const start = Math.max(0, baseIndex + 1);
  let bestIdx = -1;
  let bestScore = -100;

  for (let context = 1; context <= maxContext; context++) {
    const slice = parts.slice(-context);
    const end = appState.normalizedWords.length - context + 1;
    if (end <= start) continue;

    for (let i = start; i < end; i++) {
      let score = 0;

      for (let j = 0; j < context; j++) {
        const candidate = appState.normalizedWords[i + j];
        const wordScore = scoreWordMatch(candidate, slice[j]);
        if (wordScore < 0) {
          score = -100;
          break;
        }
        score += wordScore;
      }

      if (score <= -100) continue;

      const candidateIdx = i + context - 1;
      const distance = candidateIdx - baseIndex;
      const penalty = distance > 0
        ? (Math.log2(distance + 1) * MATCH_CONSTANTS.GLOBAL_PENALTY_LOG +
           distance * MATCH_CONSTANTS.GLOBAL_PENALTY_LINEAR)
        : 0;
      const finalScore = score - penalty;

      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestIdx = candidateIdx;
      }
    }

    const minScore = context === 1
      ? MATCH_CONSTANTS.GLOBAL_MIN_SCORE_SINGLE
      : context * MATCH_CONSTANTS.GLOBAL_MIN_SCORE_MULTI;

    if (bestIdx !== -1 && bestScore >= minScore) {
      return bestIdx;
    }
  }

  return bestScore >= MATCH_CONSTANTS.GLOBAL_MIN_THRESHOLD ? bestIdx : -1;
}

// ===== Confidence Interpolation =====

function smoothConfidence(currentConfidence) {
  appState.confidenceHistory.push(currentConfidence);
  if (appState.confidenceHistory.length > appState.maxHistorySize) {
    appState.confidenceHistory.shift();
  }
  return appState.confidenceHistory.reduce((a, b) => a + b, 0) / appState.confidenceHistory.length;
}

function resetConfidenceHistory() {
  appState.confidenceHistory = [];
}

// ===== Speech Recognition =====

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

async function primeMicPermission() {
  if (appState.permissionPrimed) return true;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return true;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    appState.permissionPrimed = true;
    return true;
  } catch (err) {
    console.error('Microphone permission error:', err);
    updateStatus('❌ マイクの使用が拒否されました');
    return false;
  }
}

function scheduleIdleGuard() {
  appState.clearTimers();

  appState.idleTimer = setTimeout(() => {
    if (!appState.recognizing || !appState.shouldAutoRestart || !appState.recognizer) return;

    const elapsed = Date.now() - appState.lastTranscriptTimestamp;
    if (elapsed >= 9000) {
      appState.pendingGap = true;
      try {
        appState.recognizer.stop();
      } catch (e) {
        console.warn('Failed to stop recognizer for idle:', e);
      }
    } else {
      scheduleIdleGuard();
    }
  }, 4000);
}

function ensureRecognizer() {
  if (appState.recognizer) return;

  appState.recognizer = new SpeechRecognition();
  appState.recognizer.continuous = true;
  appState.recognizer.interimResults = true;

  appState.recognizer.onstart = handleRecognizerStart;
  appState.recognizer.onend = handleRecognizerEnd;
  appState.recognizer.onerror = handleRecognizerError;
  appState.recognizer.onresult = handleRecognizerResult;
}

function handleRecognizerStart() {
  appState.starting = false;
  appState.recognizing = true;
  appState.pendingGap = false;
  appState.unmatchedCount = 0;
  appState.lastTranscriptTimestamp = Date.now();
  scheduleIdleGuard();

  const modePrefix = appState.recMode === 'speed' ? '【高速】' : '【正確】';
  updateStatus(`${modePrefix}取得中… 話し始めてください`);

  elements.btnMicStart.disabled = true;
  elements.btnMicStop.disabled = false;
}

function handleRecognizerEnd() {
  appState.starting = false;
  appState.recognizing = false;
  appState.clearTimers();

  if (appState.userStopRequested || !appState.shouldAutoRestart) {
    appState.resetRecognitionState();
    const statusText = appState.userStopRequested ? '停止しました' : '待機中';
    appState.userStopRequested = false;
    appState.shouldAutoRestart = false;

    elements.btnMicStart.disabled = false;
    elements.btnMicStop.disabled = true;
    updateStatus(statusText);
    return;
  }

  updateStatus('⏳ 無音が続いたため再接続しています…');

  if (appState.restartTimer) {
    clearTimeout(appState.restartTimer);
  }
  appState.restartTimer = setTimeout(() => {
    appState.restartTimer = null;
    if (appState.starting) return;
    startRecognition({ resume: true, fromRestart: true });
  }, 180);
}

function handleRecognizerError(ev) {
  appState.starting = false;
  console.error('Speech recognition error:', ev.error);

  if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
    appState.shouldAutoRestart = false;
    updateStatus('❌ マイクの使用が拒否されました');
  } else if (ev.error === 'no-speech') {
    // no-speechエラーは認識を継続するために無視する
    // これがないと、一文字読み上げ後に停止する問題が発生する
    // Web Speech APIは無音が続くとno-speechエラーを発生させるが、
    // ユーザーはまだ話し続ける可能性があるため、認識を維持する
    updateStatus('🎤 音声が検出されませんでした。話し続けてください');
  } else if (ev.error === 'aborted') {
    // abortedエラーは手動停止または自動再接続時に発生する
    // これは正常な動作の一部であり、エラーとして扱わない
    console.log('Recognition aborted');
  } else {
    updateStatus(`❌ エラー: ${ev.error}`);
  }
}

function handleRecognizerResult(ev) {
  appState.lastTranscriptTimestamp = Date.now();
  scheduleIdleGuard();

  let transcript = '';
  let hasFinal = false;
  let totalConfidence = 0;
  let confidenceCount = 0;

  for (let i = ev.resultIndex; i < ev.results.length; i++) {
    transcript += ev.results[i][0].transcript;
    if (ev.results[i].isFinal) hasFinal = true;

    if (ev.results[i][0].confidence !== undefined) {
      totalConfidence += ev.results[i][0].confidence;
      confidenceCount++;
    }
  }

  const rawConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0.5;
  const smoothedConfidence = smoothConfidence(rawConfidence);

  const norm = normalizeForMatch(transcript);
  if (!norm) {
    updateStatus(`聞き取り中: ${transcript} (信頼度: ${(smoothedConfidence * 100).toFixed(0)}%)`);
    return;
  }

  const parts = norm.split(' ').filter(Boolean);
  if (parts.length === 0) {
    updateStatus(`聞き取り中: ${transcript} (信頼度: ${(smoothedConfidence * 100).toFixed(0)}%)`);
    return;
  }

  const isSpeedMode = appState.recMode === 'speed';
  const lastNorm = isSpeedMode ? appState.lastSpeedNorm : appState.lastResultKey;

  if (norm === lastNorm && !hasFinal) {
    const prefix = isSpeedMode ? '高速処理中' : '聞き取り中';
    updateStatus(`${prefix}: ${transcript}`);
    return;
  }

  if (isSpeedMode) {
    appState.lastSpeedNorm = norm;
  } else {
    appState.lastResultKey = norm;
  }

  if (appState.normalizedWords.length === 0) {
    updateStatus(`${isSpeedMode ? '高速' : '正確'}モード: テキストがありません`);
    return;
  }

  let baseIndex = Math.max(appState.currentWord, appState.lastMicIndex);
  if (baseIndex < -1) baseIndex = -1;

  const lookAhead = hasFinal ? 22 : 14;
  const targetIndex = findNextWordIndex(parts, baseIndex, lookAhead);

  processRecognitionMatch(targetIndex, parts, smoothedConfidence, hasFinal);

  const statusPrefix = hasFinal
    ? (isSpeedMode ? '高速認識' : '認識')
    : (isSpeedMode ? '高速処理中' : '聞き取り中');

  updateStatus(`${statusPrefix}: ${transcript} (信頼度: ${(smoothedConfidence * 100).toFixed(0)}%)`);
}

function processRecognitionMatch(targetIndex, parts, smoothedConfidence, hasFinal) {
  if (targetIndex !== -1 && (targetIndex >= appState.currentWord || hasFinal || appState.currentWord === -1)) {
    highlightTo(targetIndex, { outcome: 'match', confidence: smoothedConfidence });
  } else {
    appState.unmatchedCount++;
    const needsRecovery = hasFinal || appState.unmatchedCount >= 2 || appState.pendingGap;

    if (needsRecovery) {
      const globalIndex = findBestGlobalMatch(parts, Math.max(appState.currentWord, appState.lastMicIndex));

      if (globalIndex !== -1 && (globalIndex >= appState.currentWord || appState.currentWord === -1)) {
        highlightTo(globalIndex, { outcome: 'match', confidence: smoothedConfidence });
      } else if (hasFinal && appState.normalizedWords.length) {
        const softAdvance = Math.min(
          (appState.currentWord === -1 ? 0 : appState.currentWord + 1),
          appState.normalizedWords.length - 1
        );

        if (softAdvance > appState.currentWord) {
          highlightTo(softAdvance, { outcome: 'skip', markSkipped: false, confidence: smoothedConfidence });
        } else {
          appState.pendingGap = true;
        }
      } else {
        appState.pendingGap = true;
      }
    } else {
      appState.pendingGap = true;
    }
  }
}

async function startRecognition(options = {}) {
  const { resume = false, fromRestart = false } = options;

  if (!SpeechRecognition) {
    updateStatus('❌ このブラウザは音声認識に対応していません');
    return;
  }

  if (appState.recognizing) return;
  if (appState.starting) return;
  appState.starting = true;

  const permissionOk = await primeMicPermission();
  if (!permissionOk && !appState.permissionPrimed) {
    appState.starting = false;
    updateStatus('マイクが許可されていません');
    return;
  }

  appState.clearTimers();
  appState.shouldAutoRestart = true;
  appState.userStopRequested = false;

  ensureRecognizer();
  appState.recognizer.lang = appState.recLang;

  try {
    appState.recognizer.start();
  } catch (err) {
    appState.starting = false;
    console.error('Failed to start recognition:', err);
    appState.shouldAutoRestart = false;
    updateStatus('❌ 音声認識の開始に失敗しました');
  }
}

function stopRecognition() {
  appState.starting = false;
  appState.userStopRequested = true;
  appState.shouldAutoRestart = false;
  appState.clearTimers();

  if (appState.recognizer) {
    try {
      appState.recognizer.stop();
    } catch (e) {
      console.warn('Failed to stop recognizer:', e);
    }
  }

  appState.resetRecognitionState();
  resetConfidenceHistory();

  elements.btnMicStart.disabled = false;
  elements.btnMicStop.disabled = true;
  updateStatus('停止しました');
}

function updateStatus(text) {
  elements.recStatus.textContent = text;
}

// ===== Stage Management =====

function showInputStage() {
  appState.stage = 'input';
  elements.inputStage.classList.remove('hidden');
  elements.sessionStage.classList.add('hidden');
  stopRecognition();
  updateStatus('準備完了');
}

function showSessionStage() {
  const text = elements.textInput.value.trim();
  if (!text) {
    updateStatus('⚠️ テキストを入力してください');
    return;
  }

  tokenize(text);
  renderWords();

  appState.stage = 'session';
  elements.inputStage.classList.add('hidden');
  elements.sessionStage.classList.remove('hidden');
  updateStatus('準備完了');
}

// ===== Sample Text =====

const sampleText = `Teacher: Today's unit question is "How do we make decisions?"
Yuna: We make decisions every day—what to wear, what to eat, what to watch.
Teacher: Great. What kinds of factors affect our decisions?
Sophy: A big factor for me is my parents' opinions.
Teacher: Often other people influence our choices. What else?
Marcus: Sometimes we want to change or feel better about ourselves.`;

function loadSample() {
  elements.textInput.value = sampleText;
  updateContinueButton();
}

// ===== Event Handlers =====

function updateContinueButton() {
  elements.btnContinue.disabled = !elements.textInput.value.trim();
}

function handleMicStart() {
  if (elements.btnMicStart.disabled) return;

  const text = elements.textInput.value.trim();
  if (!text) {
    updateStatus('⚠️ テキストを入力してください');
    return;
  }

  // Re-tokenize if text changed
  if (text !== appState.lastSourceText || appState.tokens.length === 0) {
    tokenize(text);
    renderWords();
  }

  startRecognition();
}

function handleMicStop() {
  stopRecognition();
}

function handleRecLangChange() {
  appState.recLang = elements.recLangSelect.value;
}

function handleRecModeChange() {
  appState.recMode = elements.recModeSelect.value;
  appState.resetRecognitionState();
}

function handleScrollModeChange() {
  appState.autoScrollEnabled = elements.scrollModeSelect.value === 'auto';
}

// ===== Initialization =====

function initialize() {
  initializeElements();
  initTheme();

  // Event listeners
  elements.themeToggle.addEventListener('click', toggleTheme);
  elements.btnSample.addEventListener('click', loadSample);
  elements.btnReset.addEventListener('click', resetHighlight);
  elements.btnContinue.addEventListener('click', showSessionStage);
  elements.btnEditScript.addEventListener('click', showInputStage);
  elements.btnMicStart.addEventListener('click', handleMicStart);
  elements.btnMicStop.addEventListener('click', handleMicStop);
  elements.recLangSelect.addEventListener('change', handleRecLangChange);
  elements.recModeSelect.addEventListener('change', handleRecModeChange);
  elements.scrollModeSelect.addEventListener('change', handleScrollModeChange);
  elements.textInput.addEventListener('input', updateContinueButton);

  // Initial state
  updateContinueButton();
  updateStatus('準備完了');

  console.log('English Karaoke Application initialized');
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
