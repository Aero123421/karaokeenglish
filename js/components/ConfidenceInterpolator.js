/**
 * Confidence Interpolator
 * 信頼度補間システム
 */

export class ConfidenceInterpolator {
  constructor() {
    this.history = [];
    this.maxHistorySize = 10;
  }

  /**
   * 移動平均で信頼度を平滑化
   * @param {number} currentConfidence - 現在の信頼度
   * @returns {number} 平滑化された信頼度
   */
  smoothConfidence(currentConfidence) {
    this.history.push(currentConfidence);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    const avg = this.history.reduce((a, b) => a + b, 0) / this.history.length;
    return avg;
  }

  /**
   * カルマンフィルタで予測
   * @param {number[]} observations - 観測値の配列
   * @returns {number} 予測された信頼度
   */
  predictNextConfidence(observations) {
    if (!observations || observations.length === 0) return 0.5;

    let estimate = observations[0];
    let uncertainty = 1.0;
    const processNoise = 0.01;
    const measurementNoise = 0.1;

    for (const observation of observations) {
      // 予測ステップ
      uncertainty += processNoise;

      // 更新ステップ
      const gain = uncertainty / (uncertainty + measurementNoise);
      estimate = estimate + gain * (observation - estimate);
      uncertainty = (1 - gain) * uncertainty;
    }

    return estimate;
  }

  /**
   * 視覚的に違和感のない補間
   * @param {Object} prevState - 前の状態
   * @param {Object} currentState - 現在の状態
   * @param {number} confidence - 信頼度
   * @returns {Object} 補間された状態
   */
  interpolateVisualFeedback(prevState, currentState, confidence) {
    const interpolationFactor = Math.min(confidence, 0.8);

    return {
      opacity: this.lerp(prevState.opacity, currentState.opacity, interpolationFactor),
      scale: this.lerp(prevState.scale, currentState.scale, interpolationFactor),
      blur: this.lerp(prevState.blur, currentState.blur, interpolationFactor)
    };
  }

  /**
   * 線形補間
   * @param {number} start - 開始値
   * @param {number} end - 終了値
   * @param {number} factor - 補間係数（0.0〜1.0）
   * @returns {number} 補間された値
   */
  lerp(start, end, factor) {
    return start + (end - start) * factor;
  }

  /**
   * 履歴をリセット
   */
  reset() {
    this.history = [];
  }
}
