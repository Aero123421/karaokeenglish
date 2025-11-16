import { useEffect, useRef } from 'react';

/**
 * Toggle Slider Component
 * トグルスライダーコンポーネント
 */
export function ToggleSlider({
  options,
  value,
  onChange,
  name,
  className = 'lang-toggle',
  sliderClassName = 'lang-toggle__slider',
  optionClassName = 'lang-toggle__option',
  offsetVar = '--slider-offset',
  widthVar = '--slider-width'
}) {
  const toggleRef = useRef(null);
  const sliderRef = useRef(null);
  const metricsRef = useRef({ valid: false, cached: null });

  const getMetrics = () => {
    if (metricsRef.current.valid && metricsRef.current.cached) {
      return metricsRef.current.cached;
    }

    const rect = toggleRef.current.getBoundingClientRect();
    const styles = getComputedStyle(toggleRef.current);
    metricsRef.current.cached = {
      rect,
      paddingLeft: parseFloat(styles.paddingLeft) || 0,
      paddingRight: parseFloat(styles.paddingRight) || 0,
      borderLeft: parseFloat(styles.borderLeftWidth) || 0,
      borderRight: parseFloat(styles.borderRightWidth) || 0
    };
    metricsRef.current.valid = true;
    return metricsRef.current.cached;
  };

  const updateSlider = () => {
    if (!toggleRef.current) return;

    const activeLabel = toggleRef.current.querySelector(`label[for="${name}-${value}"]`);
    if (!activeLabel) return;

    const { rect, paddingLeft, borderLeft } = getMetrics();
    const labelRect = activeLabel.getBoundingClientRect();
    if (!labelRect.width) return;

    const offset = labelRect.left - rect.left - borderLeft - paddingLeft;
    toggleRef.current.style.setProperty(offsetVar, `${offset}px`);
    toggleRef.current.style.setProperty(widthVar, `${labelRect.width}px`);
  };

  useEffect(() => {
    const handleResize = () => {
      metricsRef.current.valid = false;
      requestAnimationFrame(updateSlider);
    };

    window.addEventListener('resize', handleResize);
    requestAnimationFrame(updateSlider);

    return () => window.removeEventListener('resize', handleResize);
  }, [value]);

  const handleKeyDown = (e, currentValue, currentIndex) => {
    let targetIndex = -1;

    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        targetIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
        e.preventDefault();
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        targetIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
        e.preventDefault();
        break;
      case 'Home':
        targetIndex = 0;
        e.preventDefault();
        break;
      case 'End':
        targetIndex = options.length - 1;
        e.preventDefault();
        break;
    }

    if (targetIndex !== -1) {
      onChange(options[targetIndex].value);
      requestAnimationFrame(updateSlider);
    }
  };

  return (
    <div
      className={className}
      role="radiogroup"
      aria-label="Options"
      ref={toggleRef}
    >
      <span className={sliderClassName} ref={sliderRef} aria-hidden="true"></span>
      {options.map((option, index) => (
        <div key={option.value}>
          <input
            type="radio"
            id={`${name}-${option.value}`}
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            onKeyDown={(e) => handleKeyDown(e, option.value, index)}
          />
          <label
            className={optionClassName}
            htmlFor={`${name}-${option.value}`}
          >
            {option.label}
          </label>
        </div>
      ))}
    </div>
  );
}
