import { useState, useEffect, useRef, useCallback } from 'react';
import { TextInputSection } from './components/TextInputSection';
import { SpeechRecognitionSection } from './components/SpeechRecognitionSection';
import { WordRenderer } from './components/WordRenderer';
import { useAppState } from './hooks/useAppState';
import { useTheme } from './hooks/useTheme';
import { GPUAnimator } from './services/GPUAnimator';
import { ConfidenceHighlighter } from './services/ConfidenceHighlighter';
import { ConfidenceInterpolator } from './services/ConfidenceInterpolator';
import { ErrorLogger } from './services/ErrorLogger';
import { SpeechRecognitionService } from './services/SpeechRecognitionService';
import { normalizeForMatch } from './utils/stringMatching';
import './styles/style.css';

/**
 * Main Application Component
 * メインアプリケーションコンポーネント
 */
function App() {
  const [textValue, setTextValue] = useState('');
  const [recLang, setRecLang] = useState('en-US');
  const [recMode, setRecMode] = useState('precise');
  const [scrollMode, setScrollMode] = useState('auto');
  const [recStatus, setRecStatus] = useState('準備完了');
  const [isMicStartDisabled, setIsMicStartDisabled] = useState(false);
  const [isMicStopDisabled, setIsMicStopDisabled] = useState(true);

  const {
    tokens,
    normalizedWords,
    wordStates,
    currentWord,
    autoScrollEnabled,
    stateRef,
    setCurrentWord,
    setAutoScrollEnabled,
    setRecognitionMode,
    tokenize,
    updateWordState,
    updateWordStateRange,
    resetAllWordStates
  } = useAppState();

  const { theme, toggleTheme } = useTheme();

  // Services
  const servicesRef = useRef({
    gpuAnimator: new GPUAnimator(),
    confidenceHighlighter: new ConfidenceHighlighter(),
    confidenceInterpolator: new ConfidenceInterpolator(),
    errorLogger: new ErrorLogger()
  });

  const speechRecognitionRef = useRef(null);
  const readerRef = useRef(null);

  /**
   * ハイライトを巻き戻し
   */
  const rewindHighlight = useCallback((targetIndex, wordSpans) => {
    const clamped = Math.min(Math.max(targetIndex, -1), wordSpans.length - 1);

    const newStates = [...wordStates];
    for (let i = clamped + 1; i < newStates.length; i++) {
      newStates[i] = 'pending';
      const span = wordSpans[i];
      if (span) {
        span.classList.remove('word--matched', 'word--missed');
        span.classList.add('word--pending');
        span.classList.remove('word--active', 'active');
      }
    }

    if (currentWord >= 0 && currentWord < wordSpans.length) {
      wordSpans[currentWord].classList.remove('word--active', 'active');
    }

    setCurrentWord(clamped);
    stateRef.current.lastMicIndex = clamped;

    if (clamped >= 0) {
      wordSpans[clamped].classList.add('word--active', 'active');
      if (autoScrollEnabled) {
        wordSpans[clamped].scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }, [wordStates, currentWord, autoScrollEnabled, setCurrentWord, stateRef]);

  /**
   * ハイライト処理
   */
  const highlightTo = useCallback((index, options = {}) => {
    const { manual = false, outcome = 'match', markSkipped = true, confidence = 0.7, tentative = false } = options;

    if (!readerRef.current) return;
    const wordSpans = readerRef.current.querySelectorAll('.word');

    if (outcome === 'rollback' && !manual) {
      rewindHighlight(index, wordSpans);
      return;
    }

    if (index < 0 || index >= wordSpans.length) return;

    // 距離チェック：透明ハイライトが離れすぎている場合は適用しない
    if (tentative && currentWord >= 0) {
      const distance = index - currentWord;
      if (distance > 5 || distance < 1) {
        return;
      }
    }

    if (!manual && !tentative) {
      const prev = currentWord;
      if (outcome === 'match') {
        if (markSkipped) {
          const start = prev >= 0 ? prev + 1 : 0;
          if (index - start > 0) {
            updateWordStateRange(start, index - 1, 'missed');
          }
        }
        updateWordState(index, 'matched');

        // 信頼度に基づいたスタイルを適用
        servicesRef.current.confidenceHighlighter.applyConfidenceStyle(wordSpans[index], confidence);
      } else if (outcome === 'skip') {
        if (markSkipped) {
          const from = prev < index ? prev + 1 : index;
          updateWordStateRange(from, index, 'missed');
        }
      }
    }

    if (currentWord >= 0 && currentWord < wordSpans.length) {
      wordSpans[currentWord].classList.remove('word--active', 'active');
    }
    wordSpans[index].classList.add('word--active', 'active');

    if (!tentative) {
      setCurrentWord(index);
      stateRef.current.lastMicIndex = index;
      stateRef.current.pendingGap = false;
      stateRef.current.unmatchedCount = 0;
    }

    if (autoScrollEnabled) {
      wordSpans[index].scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [currentWord, autoScrollEnabled, updateWordState, updateWordStateRange, setCurrentWord, stateRef, rewindHighlight]);

  // Initialize speech recognition service
  useEffect(() => {
    const appStateForService = {
      normalizedWords,
      currentWord,
      lastMicIndex: stateRef.current.lastMicIndex,
      recognitionMode: recMode,
      lastResultKey: stateRef.current.lastResultKey,
      unmatchedCount: stateRef.current.unmatchedCount,
      pendingGap: stateRef.current.pendingGap,
      recognizer: null,
      recognizing: false,
      shouldAutoRestart: false,
      userStopRequested: false,
      permissionPrimed: false,
      lastTranscriptTimestamp: 0,
      recognitionSession: { resume: false, fromRestart: false },
      restartTimer: null,
      idleTimer: null,
      lastSpeedNorm: stateRef.current.lastSpeedNorm,
      speedState: stateRef.current.speedState,
      clearTimers: () => {
        if (appStateForService.restartTimer) {
          clearTimeout(appStateForService.restartTimer);
          appStateForService.restartTimer = null;
        }
        if (appStateForService.idleTimer) {
          clearTimeout(appStateForService.idleTimer);
          appStateForService.idleTimer = null;
        }
      }
    };

    speechRecognitionRef.current = new SpeechRecognitionService(
      appStateForService,
      servicesRef.current.confidenceInterpolator,
      servicesRef.current.errorLogger
    );

    // Set callbacks
    speechRecognitionRef.current.onStart = () => {
      setIsMicStartDisabled(true);
      setIsMicStopDisabled(false);
    };

    speechRecognitionRef.current.onEnd = () => {
      setIsMicStartDisabled(false);
      setIsMicStopDisabled(true);
    };

    speechRecognitionRef.current.onStatusUpdate = (text) => {
      setRecStatus(text);
    };

    speechRecognitionRef.current.onHighlight = (index, options) => {
      highlightTo(index, options);
    };

    return () => {
      if (appStateForService.recognizing) {
        speechRecognitionRef.current?.stop();
      }
    };
  }, [normalizedWords, recMode, highlightTo]);

  // スクロールモード変更
  useEffect(() => {
    setAutoScrollEnabled(scrollMode === 'auto');
  }, [scrollMode, setAutoScrollEnabled]);

  // 認識モード変更
  useEffect(() => {
    setRecognitionMode(recMode);
    stateRef.current.lastResultKey = '';
    stateRef.current.lastSpeedNorm = '';
    stateRef.current.unmatchedCount = 0;
    stateRef.current.pendingGap = false;
  }, [recMode, setRecognitionMode, stateRef]);

  /**
   * テキスト変更ハンドラ
   */
  const handleTextChange = useCallback((text) => {
    setTextValue(text);
  }, []);

  /**
   * サンプルロードハンドラ
   */
  const handleLoadSample = useCallback(() => {
    tokenize(textValue);
  }, [textValue, tokenize]);

  /**
   * ハイライトリセットハンドラ
   */
  const handleResetHighlight = useCallback(() => {
    if (!readerRef.current) return;
    const spans = readerRef.current.querySelectorAll('.word');
    spans.forEach(span => {
      span.classList.remove('word--active', 'active', 'word--matched', 'word--missed', 'word--pending');
      span.style.transform = '';
      span.style.willChange = '';
      span.style.opacity = '';
      span.style.transition = '';
      span.removeAttribute('data-confidence');
      span.style.removeProperty('--confidence-opacity');
      span.style.removeProperty('--confidence-color');
    });

    resetAllWordStates();
    stateRef.current.lastResultKey = '';
    stateRef.current.lastSpeedNorm = '';
    stateRef.current.unmatchedCount = 0;
    stateRef.current.pendingGap = false;
  }, [resetAllWordStates, stateRef]);

  /**
   * マイク開始ハンドラ
   */
  const handleMicStart = useCallback(async () => {
    // Prevent race condition - check if already starting/started
    if (isMicStartDisabled) {
      return;
    }

    const text = textValue.trim();
    if (!text) {
      setRecStatus('⚠️ テキストを入力してください');
      return;
    }

    // テキストが変更されている場合、トークン化
    if (text !== stateRef.current.lastSourceText || tokens.length === 0) {
      tokenize(text);
    }

    await speechRecognitionRef.current?.start({ lang: recLang });
  }, [textValue, tokens.length, tokenize, recLang, stateRef, isMicStartDisabled]);

  /**
   * マイク停止ハンドラ
   */
  const handleMicStop = useCallback(() => {
    speechRecognitionRef.current?.stop();
  }, []);

  /**
   * 単語クリックハンドラ
   */
  const handleWordClick = useCallback((index) => {
    highlightTo(index, { manual: true });
  }, [highlightTo]);

  return (
    <div className="wrapper">
      <header>
        <div>
          <h1>🎤 英語カラオケ</h1>
          <div className="sub">音声認識で英語学習</div>
        </div>
        <button className="theme-toggle" onClick={toggleTheme}>
          <span className="theme-toggle-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
          <span>{theme === 'dark' ? 'ライトモード' : 'ダークモード'}</span>
        </button>
      </header>

      <div className="layout">
        <TextInputSection
          textValue={textValue}
          onTextChange={handleTextChange}
          onLoadSample={handleLoadSample}
          onResetHighlight={handleResetHighlight}
        />

        <SpeechRecognitionSection
          recLang={recLang}
          onRecLangChange={setRecLang}
          recMode={recMode}
          onRecModeChange={setRecMode}
          scrollMode={scrollMode}
          onScrollModeChange={setScrollMode}
          recStatus={recStatus}
          isMicStartDisabled={isMicStartDisabled}
          isMicStopDisabled={isMicStopDisabled}
          onMicStart={handleMicStart}
          onMicStop={handleMicStop}
        >
          <div ref={readerRef}>
            <WordRenderer
              tokens={tokens}
              wordStates={wordStates}
              currentWord={currentWord}
              onWordClick={handleWordClick}
              gpuAnimator={servicesRef.current.gpuAnimator}
            />
          </div>
        </SpeechRecognitionSection>
      </div>

      <footer>
        <div>対応: Chrome / Edge（SpeechRecognition）。Safari 一部未対応。初回はマイク許可が必要です。</div>
      </footer>

      {/* SVG Filters */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
        <defs>
          <filter id="lensDistortion" x="-50%" y="-50%" width="200%" height="200%">
            <feTurbulence type="fractalNoise" baseFrequency="0.01 0.01" numOctaves="2" result="noise" seed="2" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
    </div>
  );
}

export default App;
