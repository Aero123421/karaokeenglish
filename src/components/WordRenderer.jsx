import { useEffect, useRef } from 'react';

/**
 * Word Renderer Component
 * 単語レンダリングコンポーネント
 */
export function WordRenderer({ tokens, wordStates, currentWord, onWordClick, gpuAnimator }) {
  const readerRef = useRef(null);

  useEffect(() => {
    if (!readerRef.current || !gpuAnimator) return;

    // GPU最適化を全単語に適用
    const wordSpans = readerRef.current.querySelectorAll('.word');
    wordSpans.forEach(span => {
      gpuAnimator.forceGPULayer(span);
    });
  }, [tokens, gpuAnimator]);

  useEffect(() => {
    if (!readerRef.current) return;

    const wordSpans = readerRef.current.querySelectorAll('.word');
    wordSpans.forEach((span, idx) => {
      const state = wordStates[idx] || 'pending';
      span.className = 'word';
      span.classList.toggle('word--matched', state === 'matched');
      span.classList.toggle('word--missed', state === 'missed');
      span.classList.toggle('word--pending', state === 'pending');
      span.classList.toggle('word--active', idx === currentWord);
      span.classList.toggle('active', idx === currentWord);
    });
  }, [wordStates, currentWord]);

  const getWordIndex = (tokenIndex) => {
    let count = 0;
    for (let i = 0; i <= tokenIndex; i++) {
      if (tokens[i]?.type === 'word') count++;
    }
    return count - 1;
  };

  return (
    <div ref={readerRef}>
      {tokens.map((token, idx) => {
        if (token.type === 'word') {
          const wordIdx = getWordIndex(idx);
          const state = wordStates[wordIdx] || 'pending';
          const isActive = wordIdx === currentWord;

          return (
            <span
              key={idx}
              className={`word ${state === 'matched' ? 'word--matched' : ''} ${state === 'missed' ? 'word--missed' : ''} ${state === 'pending' ? 'word--pending' : ''} ${isActive ? 'word--active active' : ''}`}
              data-i={wordIdx}
              onClick={() => onWordClick(wordIdx)}
            >
              {token.text}
            </span>
          );
        } else {
          return <span key={idx}>{token.text}</span>;
        }
      })}
    </div>
  );
}
