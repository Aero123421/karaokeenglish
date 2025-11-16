/**
 * Speech Recognition Section Component
 * 音声認識セクションコンポーネント
 */
export function SpeechRecognitionSection({
  recLang,
  onRecLangChange,
  recMode,
  onRecModeChange,
  scrollMode,
  onScrollModeChange,
  recStatus,
  isMicStartDisabled,
  isMicStopDisabled,
  onMicStart,
  onMicStop,
  children
}) {
  const langOptions = [
    { value: 'en-US', label: 'EN-US' },
    { value: 'en-GB', label: 'EN-GB' },
    { value: 'ja-JP', label: 'JA-JP' },
    { value: 'ru-RU', label: 'RU-RU' },
    { value: 'vi-VN', label: 'VI-VN' }
  ];

  const modeOptions = [
    { value: 'precise', label: '正確モード' },
    { value: 'speed', label: '高速モード' }
  ];

  const scrollOptions = [
    { value: 'auto', label: '自動スクロール' },
    { value: 'manual', label: '手動スクロール' }
  ];

  return (
    <section className="session-card">
      <div className="session-card__controls">
        <div className="session-card__status" role="status" aria-live="polite">
          {recStatus}
        </div>
        <div className="session-card__mic">
          <button
            id="btnMicStart"
            className="primary"
            onClick={onMicStart}
            disabled={isMicStartDisabled}
          >
            再生開始
          </button>
          <button
            id="btnMicStop"
            className="quiet"
            onClick={onMicStop}
            disabled={isMicStopDisabled}
          >
            停止
          </button>
        </div>
      </div>

      <div className="session-card__options">
        <label>
          <span>言語</span>
          <select value={recLang} onChange={(e) => onRecLangChange(e.target.value)}>
            {langOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>モード</span>
          <select value={recMode} onChange={(e) => onRecModeChange(e.target.value)}>
            {modeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>スクロール</span>
          <select value={scrollMode} onChange={(e) => onScrollModeChange(e.target.value)}>
            {scrollOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="reader" id="reader" aria-live="polite">
        {children}
      </div>
    </section>
  );
}
