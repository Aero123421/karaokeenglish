import { ToggleSlider } from './ToggleSlider';

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
    { value: 'precise', label: '正確' },
    { value: 'speed', label: '高速' }
  ];

  const scrollOptions = [
    { value: 'auto', label: '自動' },
    { value: 'manual', label: '手動' }
  ];

  return (
    <section className="card card--reader">
      <div className="head">
        <h2>音声認識</h2>
        <div className="controls controls--options">
          <div className="control control--lang">
            <span className="control-title">言語:</span>
            <div className="control-body control-body--lang" role="presentation">
              <ToggleSlider
                options={langOptions}
                value={recLang}
                onChange={onRecLangChange}
                name="recLang"
                className="lang-toggle"
                sliderClassName="lang-toggle__slider"
                optionClassName="lang-toggle__option"
              />
            </div>
          </div>
          <div className="control">
            <span className="control-title">モード:</span>
            <div className="control-body control-body--segment">
              <ToggleSlider
                options={modeOptions}
                value={recMode}
                onChange={onRecModeChange}
                name="recMode"
                className="mode-toggle"
                sliderClassName="mode-toggle__slider"
                optionClassName="mode-toggle__option"
                offsetVar="--mode-slider-offset"
                widthVar="--mode-slider-width"
              />
            </div>
          </div>
          <div className="control">
            <span className="control-title">スクロール:</span>
            <div className="control-body control-body--scroll">
              <ToggleSlider
                options={scrollOptions}
                value={scrollMode}
                onChange={onScrollModeChange}
                name="scrollMode"
                className="scroll-toggle"
                sliderClassName="scroll-toggle__slider"
                optionClassName="scroll-toggle__option"
                offsetVar="--scroll-slider-offset"
                widthVar="--scroll-slider-width"
              />
            </div>
          </div>
        </div>
      </div>
      <div className="body">
        <div className="session-status">
          <span className="session-status__text" id="recStatus">{recStatus}</span>
        </div>
        <div className="controls controls--mic">
          <button id="btnMicStart" onClick={onMicStart} disabled={isMicStartDisabled}>
            🎤 開始
          </button>
          <button id="btnMicStop" onClick={onMicStop} disabled={isMicStopDisabled}>
            ■ 停止
          </button>
        </div>
        <div id="reader" className="reader" aria-live="polite">
          {children}
        </div>
        <div className="hint">単語をタップして位置を移動できます</div>
      </div>
    </section>
  );
}
