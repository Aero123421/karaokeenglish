/**
 * Confidence-Based Highlighting System
 * 信頼度ベースのハイライトシステム
 */

export class ConfidenceHighlighter {
  constructor() {
    this.confidenceLevels = {
      veryLow:    { min: 0.0,  max: 0.3,  opacity: 0.5,  color: '#888888' },
      low:        { min: 0.3,  max: 0.5,  opacity: 0.7,  color: '#999999' },
      medium:     { min: 0.5,  max: 0.7,  opacity: 0.85, color: '#ffaa00' },
      high:       { min: 0.7,  max: 0.9,  opacity: 0.95, color: '#00ff00' },
      veryHigh:   { min: 0.9,  max: 1.0,  opacity: 1.0,  color: '#00ff00' }
    };
  }

  /**
   * 信頼度レベルを取得
   * @param {number} confidence - 信頼度（0.0〜1.0）
   * @returns {Object} 信頼度レベルオブジェクト
   */
  getConfidenceLevel(confidence) {
    for (const [key, level] of Object.entries(this.confidenceLevels)) {
      if (confidence >= level.min && confidence < level.max) {
        return level;
      }
    }
    return this.confidenceLevels.veryHigh;
  }

  /**
   * 要素に信頼度スタイルを適用
   * @param {HTMLElement} element - スタイルを適用する要素
   * @param {number} confidence - 信頼度（0.0〜1.0）
   */
  applyConfidenceStyle(element, confidence) {
    const level = this.getConfidenceLevel(confidence);

    // GPU加速プロパティのみ使用（ぼかしなし）
    element.style.transform = 'translateZ(0)';
    element.style.willChange = 'opacity, transform';

    // CSSカスタムプロパティで動的更新（ぼかしを削除）
    element.style.setProperty('--confidence-opacity', level.opacity);
    element.style.setProperty('--confidence-color', level.color);

    // GPU加速されたトランジション
    element.style.transition = 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)';

    // データ属性で信頼度レベルを設定
    if (confidence < 0.5) {
      element.setAttribute('data-confidence', 'low');
    } else if (confidence >= 0.7) {
      element.setAttribute('data-confidence', 'high');
    } else {
      element.setAttribute('data-confidence', 'medium');
    }
  }
}
