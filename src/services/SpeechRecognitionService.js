/**
 * Speech Recognition Service
 * 音声認識サービス
 */

import { normalizeForMatch, scoreWordMatch, MATCH_CONSTANTS } from '../utils/stringMatching.js';

export class SpeechRecognitionService {
  constructor(appState, confidenceInterpolator, errorLogger) {
    this.appState = appState;
    this.confidenceInterpolator = confidenceInterpolator;
    this.errorLogger = errorLogger;

    // Speech Recognition API
    this.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    // Callbacks
    this.onStart = null;
    this.onEnd = null;
    this.onError = null;
    this.onResult = null;
    this.onStatusUpdate = null;
    this.onHighlight = null;
  }

  /**
   * マイク許可をプライミング
   * @returns {Promise<boolean>} 許可が得られたかどうか
   */
  async primeMicPermission() {
    if (this.appState.permissionPrimed) return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      this.appState.permissionPrimed = true;
      return true;
    } catch (err) {
      this.errorLogger.showError(err, 'microphone-permission');
      return false;
    }
  }

  /**
   * 次の単語インデックスを検索（ローカル検索）
   * @param {string[]} parts - 認識された単語の配列
   * @param {number} baseIndex - 基準インデックス
   * @param {number} lookAhead - 先読み数
   * @returns {number} 見つかった単語のインデックス
   */
  findNextWordIndex(parts, baseIndex, lookAhead) {
    const maxContext = Math.min(4, parts.length);
    const backtrack = 3;

    // 単一単語マッチングを優先（context=1から試す）
    for (let context = 1; context <= maxContext; context++) {
      const slice = parts.slice(-context);
      const start = Math.max(0, baseIndex + 1 - backtrack);
      const end = Math.min(this.appState.normalizedWords.length - context + 1, baseIndex + 1 + lookAhead);
      if (end <= start) continue;

      let bestScore = -100;
      let bestIdx = -1;

      for (let i = start; i < end; i++) {
        let score = 0;
        let matchedWords = 0;

        for (let j = 0; j < context; j++) {
          const candidate = this.appState.normalizedWords[i + j];
          const wordScore = scoreWordMatch(candidate, slice[j]);
          if (wordScore < 0) {
            score = -100;
            break;
          }
          score += wordScore;
          if (wordScore >= 1.5) matchedWords++;
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

      // より寛容な閾値：単語数が少ないほど低い閾値
      const minScore = context === 1
        ? MATCH_CONSTANTS.MIN_SCORE_SINGLE
        : context * MATCH_CONSTANTS.MIN_SCORE_MULTI;

      if (bestIdx !== -1 && bestScore >= minScore) {
        return bestIdx;
      }
    }

    return -1;
  }

  /**
   * グローバル検索（全テキスト検索）
   * @param {string[]} parts - 認識された単語の配列
   * @param {number} baseIndex - 基準インデックス
   * @returns {number} 見つかった単語のインデックス
   */
  findBestGlobalMatch(parts, baseIndex) {
    if (this.appState.normalizedWords.length === 0) return -1;

    const maxContext = Math.min(4, parts.length);
    const start = Math.max(0, baseIndex + 1);
    let bestIdx = -1;
    let bestScore = -100;

    // 単一単語優先
    for (let context = 1; context <= maxContext; context++) {
      const slice = parts.slice(-context);
      const end = this.appState.normalizedWords.length - context + 1;
      if (end <= start) continue;

      for (let i = start; i < end; i++) {
        let score = 0;

        for (let j = 0; j < context; j++) {
          const candidate = this.appState.normalizedWords[i + j];
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

      // より寛容な閾値
      const minScore = context === 1
        ? MATCH_CONSTANTS.GLOBAL_MIN_SCORE_SINGLE
        : context * MATCH_CONSTANTS.GLOBAL_MIN_SCORE_MULTI;

      if (bestIdx !== -1 && bestScore >= minScore) {
        return bestIdx;
      }
    }

    return bestScore >= MATCH_CONSTANTS.GLOBAL_MIN_THRESHOLD ? bestIdx : -1;
  }

  /**
   * アイドルガードをスケジュール
   */
  scheduleIdleGuard() {
    this.appState.clearTimers();

    this.appState.idleTimer = setTimeout(() => {
      if (!this.appState.recognizing || !this.appState.shouldAutoRestart || !this.appState.recognizer) return;

      const elapsed = Date.now() - this.appState.lastTranscriptTimestamp;
      if (elapsed >= 9000) {
        this.appState.pendingGap = true;
        this.appState.recognizer.stop();
      } else {
        this.scheduleIdleGuard();
      }
    }, 4000);
  }

  /**
   * 認識器を初期化
   */
  ensureRecognizer() {
    if (this.appState.recognizer) return;

    this.appState.recognizer = new this.SpeechRecognition();
    this.appState.recognizer.continuous = true;
    this.appState.recognizer.interimResults = true;

    // Store handler references for cleanup
    this.handlers = {
      start: () => this.handleRecognizerStart(),
      end: () => this.handleRecognizerEnd(),
      error: (ev) => this.handleRecognizerError(ev),
      result: (ev) => this.handleRecognizerResult(ev)
    };

    this.appState.recognizer.onstart = this.handlers.start;
    this.appState.recognizer.onend = this.handlers.end;
    this.appState.recognizer.onerror = this.handlers.error;
    this.appState.recognizer.onresult = this.handlers.result;
  }

  /**
   * 認識開始ハンドラ
   */
  handleRecognizerStart() {
    this.appState.starting = false;
    this.appState.recognizing = true;
    this.appState.pendingGap = false;
    this.appState.unmatchedCount = 0;
    this.appState.resetSpeedState();
    this.appState.speedState.lastReliable = this.appState.currentWord;
    this.appState.speedState.anchor = this.appState.currentWord;
    this.appState.lastTranscriptTimestamp = Date.now();
    this.scheduleIdleGuard();

    const modePrefix = this.appState.recognitionMode === 'speed' ? '【高速】' : '【正確】';
    let statusText = '';

    if (this.appState.recognitionSession.fromRestart) {
      statusText = `${modePrefix}再開しました。続けて話してください`;
    } else if (!this.appState.recognitionSession.resume) {
      statusText = `${modePrefix}取得中… 話し始めてください`;
    } else {
      statusText = `${modePrefix}再接続しました`;
    }

    if (this.onStart) this.onStart();
    if (this.onStatusUpdate) this.onStatusUpdate(statusText);
  }

  /**
   * 認識終了ハンドラ
   */
  handleRecognizerEnd() {
    this.appState.starting = false;
    this.appState.recognizing = false;
    this.appState.clearTimers();

    if (this.appState.userStopRequested || !this.appState.shouldAutoRestart) {
      this.appState.lastResultKey = '';
      this.appState.lastSpeedNorm = '';
      this.appState.pendingGap = false;
      this.appState.unmatchedCount = 0;

      const statusText = this.appState.userStopRequested ? '停止しました' : '待機中';
      this.appState.userStopRequested = false;
      this.appState.shouldAutoRestart = false;

      if (this.onEnd) this.onEnd();
      if (this.onStatusUpdate) this.onStatusUpdate(statusText);
      return;
    }

    if (this.onStatusUpdate) {
      this.onStatusUpdate('⏳ 無音が続いたため再接続しています…');
    }

    // Clear any existing restart timer before setting a new one
    if (this.appState.restartTimer) {
      clearTimeout(this.appState.restartTimer);
    }
    this.appState.restartTimer = setTimeout(() => {
      this.appState.restartTimer = null;
      if (this.appState.starting) return;
      this.start({ resume: true, fromRestart: true });
    }, 180);
  }

  /**
   * 認識エラーハンドラ
   * @param {Event} ev - エラーイベント
   */
  handleRecognizerError(ev) {
    this.appState.starting = false;
    this.errorLogger.showError(ev.error, 'speech-recognition');

    if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
      this.appState.shouldAutoRestart = false;
    }

    if (this.onError) this.onError(ev);
  }

  /**
   * 認識結果を処理
   * @param {number} targetIndex - ターゲット単語のインデックス
   * @param {string} parts - 認識された単語
   * @param {number} smoothedConfidence - 平滑化された信頼度
   * @param {boolean} hasFinal - 最終結果かどうか
   */
  processRecognitionMatch(targetIndex, parts, smoothedConfidence, hasFinal) {
    if (targetIndex !== -1 && (targetIndex >= this.appState.currentWord || hasFinal || this.appState.currentWord === -1)) {
      if (this.onHighlight) {
        this.onHighlight(targetIndex, { outcome: 'match', confidence: smoothedConfidence });
      }
    } else {
      this.appState.unmatchedCount++;
      const needsRecovery = hasFinal || this.appState.unmatchedCount >= 2 || this.appState.pendingGap;

      if (needsRecovery) {
        const globalIndex = this.findBestGlobalMatch(parts, Math.max(this.appState.currentWord, this.appState.lastMicIndex));

        if (globalIndex !== -1 && (globalIndex >= this.appState.currentWord || this.appState.currentWord === -1)) {
          if (this.onHighlight) {
            this.onHighlight(globalIndex, { outcome: 'match', confidence: smoothedConfidence });
          }
        } else if (hasFinal && this.appState.normalizedWords.length) {
          const softAdvance = Math.min(
            (this.appState.currentWord === -1 ? 0 : this.appState.currentWord + 1),
            this.appState.normalizedWords.length - 1
          );

          if (softAdvance > this.appState.currentWord) {
            if (this.onHighlight) {
              this.onHighlight(softAdvance, { outcome: 'skip', markSkipped: false, confidence: smoothedConfidence });
            }
          } else {
            this.appState.pendingGap = true;
          }
        } else {
          this.appState.pendingGap = true;
        }
      } else {
        this.appState.pendingGap = true;
      }
    }
  }

  /**
   * 認識結果ハンドラ
   * @param {Event} ev - 認識結果イベント
   */
  handleRecognizerResult(ev) {
    this.appState.lastTranscriptTimestamp = Date.now();
    this.scheduleIdleGuard();

    let transcript = '';
    let hasFinal = false;
    let totalConfidence = 0;
    let confidenceCount = 0;

    // 信頼度を取得
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      transcript += ev.results[i][0].transcript;
      if (ev.results[i].isFinal) hasFinal = true;

      // confidence値を収集
      if (ev.results[i][0].confidence !== undefined) {
        totalConfidence += ev.results[i][0].confidence;
        confidenceCount++;
      }
    }

    // 平均信頼度を計算
    const rawConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0.5;

    // 信頼度補間システムで平滑化
    const smoothedConfidence = this.confidenceInterpolator.smoothConfidence(rawConfidence);

    const norm = normalizeForMatch(transcript);
    if (!norm) {
      if (this.onStatusUpdate) {
        this.onStatusUpdate(`聞き取り中: ${transcript} (信頼度: ${(smoothedConfidence * 100).toFixed(0)}%)`);
      }
      return;
    }

    const parts = norm.split(' ').filter(Boolean);
    if (parts.length === 0) {
      if (this.onStatusUpdate) {
        this.onStatusUpdate(`聞き取り中: ${transcript} (信頼度: ${(smoothedConfidence * 100).toFixed(0)}%)`);
      }
      return;
    }

    // 高速モード・正確モード共通処理
    const isSpeedMode = this.appState.recognitionMode === 'speed';
    const lastNorm = isSpeedMode ? this.appState.lastSpeedNorm : this.appState.lastResultKey;

    if (norm === lastNorm && !hasFinal) {
      const prefix = isSpeedMode ? '高速処理中' : '聞き取り中';
      if (this.onStatusUpdate) {
        this.onStatusUpdate(`${prefix}: ${transcript}`);
      }
      return;
    }

    if (isSpeedMode) {
      this.appState.lastSpeedNorm = norm;
    } else {
      this.appState.lastResultKey = norm;
    }

    if (this.appState.normalizedWords.length === 0) {
      if (this.onStatusUpdate) {
        this.onStatusUpdate(`${isSpeedMode ? '高速' : '正確'}モード: テキストがありません`);
      }
      return;
    }

    let baseIndex = Math.max(this.appState.currentWord, this.appState.lastMicIndex);
    if (baseIndex < -1) baseIndex = -1;

    const lookAhead = hasFinal ? 22 : 14;
    const targetIndex = this.findNextWordIndex(parts, baseIndex, lookAhead);

    this.processRecognitionMatch(targetIndex, parts, smoothedConfidence, hasFinal);

    const statusPrefix = hasFinal
      ? (isSpeedMode ? '高速認識' : '認識')
      : (isSpeedMode ? '高速処理中' : '聞き取り中');

    if (this.onStatusUpdate) {
      this.onStatusUpdate(`${statusPrefix}: ${transcript} (信頼度: ${(smoothedConfidence * 100).toFixed(0)}%)`);
    }

    if (this.onResult) this.onResult(transcript, smoothedConfidence);
  }

  /**
   * 音声認識を開始
   * @param {Object} options - オプション
   * @param {boolean} options.resume - 再開するかどうか
   * @param {boolean} options.fromRestart - 自動再起動からの開始かどうか
   * @param {string} options.lang - 認識言語
   */
  async start(options = {}) {
    const { resume = false, fromRestart = false, lang = 'en-US' } = options;

    if (!this.SpeechRecognition) {
      this.errorLogger.showError('NotSupportedError', 'speech-recognition-init');
      return;
    }

    if (this.appState.recognizing) return;
    if (this.appState.starting) return;
    this.appState.starting = true;

    const permissionOk = await this.primeMicPermission();
    if (!permissionOk && !this.appState.permissionPrimed) {
      this.appState.starting = false;
      if (this.onStatusUpdate) {
        this.onStatusUpdate('マイクが許可されていません');
      }
      return;
    }

    this.appState.clearTimers();
    this.appState.shouldAutoRestart = true;
    this.appState.userStopRequested = false;
    this.appState.recognitionSession = { resume, fromRestart };

    this.ensureRecognizer();
    this.appState.recognizer.lang = lang;

    try {
      this.appState.recognizer.start();
    } catch (err) {
      this.appState.starting = false;
      this.errorLogger.showError(err, 'speech-recognition-start');
      this.appState.shouldAutoRestart = false;

      if (this.onError) this.onError(err);
    }
  }

  /**
   * 音声認識を停止
   */
  stop() {
    this.appState.starting = false;
    this.appState.userStopRequested = true;
    this.appState.shouldAutoRestart = false;
    this.appState.clearTimers();

    if (this.appState.recognizer) {
      try {
        this.appState.recognizer.stop();
      } catch (e) {
        console.warn('Failed to stop recognizer:', e);
      }
    }

    this.appState.lastResultKey = '';
    this.appState.lastSpeedNorm = '';
    this.appState.pendingGap = false;
    this.appState.unmatchedCount = 0;
    this.confidenceInterpolator.reset();
    this.appState.resetSpeedState();

    if (this.onEnd) this.onEnd();
  }

  /**
   * Cleanup recognizer and event listeners
   */
  destroy() {
    this.stop();

    // Clean up event listeners
    if (this.appState.recognizer && this.handlers) {
      this.appState.recognizer.onstart = null;
      this.appState.recognizer.onend = null;
      this.appState.recognizer.onerror = null;
      this.appState.recognizer.onresult = null;
    }

    this.appState.recognizer = null;
    this.handlers = null;
  }
}
