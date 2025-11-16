/**
 * GPU Optimized Animator
 * GPU最適化アニメーター
 */

export class GPUAnimator {
  constructor() {
    // No initialization needed
  }

  /**
   * コンポジットレイヤーを強制的に作成
   * @param {HTMLElement} element - GPU加速を適用する要素
   */
  forceGPULayer(element) {
    element.style.transform = 'translateZ(0)';
    element.style.willChange = 'transform, opacity';
    element.style.backfaceVisibility = 'hidden';
  }

  /**
   * バッチ処理でリフローを最小化
   * @param {HTMLElement[]} elements - 更新する要素の配列
   * @param {Object[]} updates - 更新内容の配列
   */
  batchUpdate(elements, updates) {
    // すべての読み取り操作を先に実行
    const measurements = elements.map(el => ({
      element: el,
      rect: el.getBoundingClientRect(),
      computed: window.getComputedStyle(el)
    }));

    // FastDOMパターン: 書き込みをrAFでバッチ化
    requestAnimationFrame(() => {
      measurements.forEach((item, index) => {
        const update = updates[index];
        if (!update) return;
        // transformとopacityのみ変更（リフロー回避）
        if (update.transform) item.element.style.transform = update.transform;
        if (update.opacity !== undefined) item.element.style.opacity = update.opacity;
      });
    });
  }
}
