import { useState, useCallback, useRef } from 'react';
import { normalizeForMatch } from '../utils/stringMatching';

/**
 * Application State Hook
 * アプリケーション状態管理Hook
 */
export function useAppState() {
  const [tokens, setTokens] = useState([]);
  const [normalizedWords, setNormalizedWords] = useState([]);
  const [wordStates, setWordStates] = useState([]);
  const [currentWord, setCurrentWord] = useState(-1);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [recognitionMode, setRecognitionMode] = useState('precise');

  const stateRef = useRef({
    lastMicIndex: -1,
    lastResultKey: '',
    unmatchedCount: 0,
    pendingGap: false,
    lastSourceText: '',
    lastSpeedNorm: '',
    speedState: {
      history: [],
      map: [],
      lastReliable: -1,
      anchor: -1,
      missCount: 0,
      stability: 0,
      lastInputTs: 0,
      lastEmitTs: 0
    }
  });

  /**
   * テキストをトークン化
   */
  const tokenize = useCallback((text) => {
    // Validate input
    if (text == null || typeof text !== 'string') {
      console.error('Invalid text provided to tokenize:', text);
      return;
    }

    try {
      const newTokens = [];
      const wordStarts = [];

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
          const wordText = text.slice(i, j);
          newTokens.push({ text: wordText, type: 'word', start: i });
          wordStarts.push(i);
          i = j;
        }
      }

      setTokens(newTokens);

      const normalized = newTokens
        .filter(t => t.type === 'word')
        .map(t => normalizeForMatch(t.text));

      setNormalizedWords(normalized);
      setWordStates(new Array(normalized.length).fill('pending'));
      setCurrentWord(-1);

      stateRef.current.lastSourceText = text;
      stateRef.current.lastResultKey = '';
      stateRef.current.unmatchedCount = 0;
      stateRef.current.pendingGap = false;
      stateRef.current.lastMicIndex = -1;
    } catch (error) {
      console.error('Error during tokenization:', error);
      // Reset to safe state on error
      setTokens([]);
      setNormalizedWords([]);
      setWordStates([]);
      setCurrentWord(-1);
    }
  }, []);

  /**
   * 単語の状態を更新
   */
  const updateWordState = useCallback((index, state) => {
    setWordStates(prev => {
      if (index >= 0 && index < prev.length) {
        const newStates = [...prev];
        newStates[index] = state;
        return newStates;
      }
      return prev;
    });
  }, []);

  /**
   * 単語の状態を範囲で更新
   */
  const updateWordStateRange = useCallback((from, to, state) => {
    setWordStates(prev => {
      if (prev.length === 0) return prev;
      const start = Math.max(0, from);
      const end = Math.min(prev.length - 1, to);
      if (end < start) return prev;

      const newStates = [...prev];
      for (let i = start; i <= end; i++) {
        newStates[i] = state;
      }
      return newStates;
    });
  }, []);

  /**
   * すべての単語の状態をリセット
   */
  const resetAllWordStates = useCallback(() => {
    setWordStates(prev => new Array(prev.length).fill('pending'));
    setCurrentWord(-1);
    stateRef.current.lastMicIndex = -1;
  }, []);

  /**
   * Speed stateをリセット
   */
  const resetSpeedState = useCallback(() => {
    stateRef.current.speedState = {
      history: [],
      map: [],
      lastReliable: -1,
      anchor: -1,
      missCount: 0,
      stability: 0,
      lastInputTs: 0,
      lastEmitTs: 0
    };
  }, []);

  return {
    tokens,
    normalizedWords,
    wordStates,
    currentWord,
    autoScrollEnabled,
    recognitionMode,
    stateRef,
    setTokens,
    setNormalizedWords,
    setWordStates,
    setCurrentWord,
    setAutoScrollEnabled,
    setRecognitionMode,
    tokenize,
    updateWordState,
    updateWordStateRange,
    resetAllWordStates,
    resetSpeedState
  };
}
