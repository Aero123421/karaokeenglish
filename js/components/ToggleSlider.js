/**
 * Toggle Slider Component
 * トグルスライダーコンポーネント（キーボードナビゲーション対応）
 */

import { debounce, throttle } from '../utils/performance.js';

export class ToggleSlider {
  constructor(toggleEl, sliderEl, offsetVar, widthVar) {
    this.toggleEl = toggleEl;
    this.sliderEl = sliderEl;
    this.offsetVar = offsetVar;
    this.widthVar = widthVar;

    // Cache for computed styles to avoid repeated calculations
    this.cachedMetrics = null;
    this.metricsValid = false;

    this.init();
  }

  invalidateMetrics() {
    this.metricsValid = false;
  }

  getMetrics() {
    if (this.metricsValid && this.cachedMetrics) return this.cachedMetrics;
    const rect = this.toggleEl.getBoundingClientRect();
    const styles = getComputedStyle(this.toggleEl);
    this.cachedMetrics = {
      rect,
      paddingLeft: parseFloat(styles.paddingLeft) || 0,
      paddingRight: parseFloat(styles.paddingRight) || 0,
      borderLeft: parseFloat(styles.borderLeftWidth) || 0,
      borderRight: parseFloat(styles.borderRightWidth) || 0
    };
    this.metricsValid = true;
    return this.cachedMetrics;
  }

  updateSlider() {
    const activeInput = this.toggleEl.querySelector('input[type="radio"]:checked');
    if (!activeInput) return;
    const activeLabel = this.toggleEl.querySelector(`label[for="${activeInput.id}"]`);
    if (!activeLabel) return;

    const { rect, paddingLeft, borderLeft } = this.getMetrics();
    const labelRect = activeLabel.getBoundingClientRect();
    if (!labelRect.width) return;

    const offset = labelRect.left - rect.left - borderLeft - paddingLeft;
    this.toggleEl.style.setProperty(this.offsetVar, `${offset}px`);
    this.toggleEl.style.setProperty(this.widthVar, `${labelRect.width}px`);
  }

  scheduleUpdate() {
    requestAnimationFrame(() => this.updateSlider());
  }

  init() {
    if (!this.toggleEl || !this.sliderEl) return;

    // Invalidate cache on resize
    const handleResize = debounce(() => {
      this.invalidateMetrics();
      this.scheduleUpdate();
    }, 100);

    window.addEventListener('resize', handleResize);

    // Initial update
    this.scheduleUpdate();

    // Store cleanup function
    this.cleanup = () => {
      window.removeEventListener('resize', handleResize);
    };
  }

  /**
   * キーボードナビゲーションを追加
   * @param {HTMLInputElement[]} radioInputs - ラジオボタンの配列
   */
  addKeyboardNavigation(radioInputs) {
    if (!radioInputs || radioInputs.length === 0) return;

    radioInputs.forEach((input, index) => {
      // キーボードイベントリスナー
      input.addEventListener('keydown', (e) => {
        let targetIndex = -1;

        switch(e.key) {
          case 'ArrowLeft':
          case 'ArrowUp':
            // 前の選択肢に移動
            targetIndex = index > 0 ? index - 1 : radioInputs.length - 1;
            e.preventDefault();
            break;
          case 'ArrowRight':
          case 'ArrowDown':
            // 次の選択肢に移動
            targetIndex = index < radioInputs.length - 1 ? index + 1 : 0;
            e.preventDefault();
            break;
          case 'Home':
            // 最初の選択肢に移動
            targetIndex = 0;
            e.preventDefault();
            break;
          case 'End':
            // 最後の選択肢に移動
            targetIndex = radioInputs.length - 1;
            e.preventDefault();
            break;
        }

        if (targetIndex !== -1) {
          radioInputs[targetIndex].checked = true;
          radioInputs[targetIndex].focus();
          radioInputs[targetIndex].dispatchEvent(new Event('change', { bubbles: true }));
          this.scheduleUpdate();
        }
      });

      // change イベントでスライダーを更新
      input.addEventListener('change', () => this.scheduleUpdate());
      input.addEventListener('focus', () => this.scheduleUpdate());
    });
  }

  /**
   * ドラッグ可能機能を追加
   * @param {HTMLElement[]} options - オプション要素の配列
   * @param {HTMLInputElement[]} radioInputs - ラジオボタンの配列
   */
  addDraggable(options, radioInputs) {
    if (!this.toggleEl || !this.sliderEl) return;

    const dragState = {
      active: false,
      pointerId: null,
      rect: null,
      paddingLeft: 0,
      paddingRight: 0,
      borderLeft: 0,
      borderRight: 0,
      hover: null
    };

    const ensureMetrics = () => {
      dragState.rect = this.toggleEl.getBoundingClientRect();
      const styles = getComputedStyle(this.toggleEl);
      dragState.paddingLeft = parseFloat(styles.paddingLeft) || 0;
      dragState.paddingRight = parseFloat(styles.paddingRight) || 0;
      dragState.borderLeft = parseFloat(styles.borderLeftWidth) || 0;
      dragState.borderRight = parseFloat(styles.borderRightWidth) || 0;
    };

    const commitOption = (label) => {
      if (!label) return;
      const id = label.getAttribute('for');
      if (!id) return;
      const input = this.toggleEl.querySelector(`#${id}`);
      if (input && !input.checked) {
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };

    const updateDragVisual = (clientX, commit = false) => {
      if (!dragState.rect) ensureMetrics();
      const { rect, paddingLeft, paddingRight, borderLeft, borderRight } = dragState;
      if (!rect) return;
      const innerWidth = rect.width - paddingLeft - paddingRight - borderLeft - borderRight;
      if (innerWidth <= 0) return;

      let x = clientX - rect.left - borderLeft - paddingLeft;
      x = Math.max(0, Math.min(innerWidth, x));

      let closestLabel = null;
      let minDist = Infinity;
      options.forEach(label => {
        const optionRect = label.getBoundingClientRect();
        const center = optionRect.left - rect.left - borderLeft - paddingLeft + optionRect.width / 2;
        const dist = Math.abs(center - x);
        if (dist < minDist) {
          minDist = dist;
          closestLabel = label;
        }
      });

      if (!closestLabel) return;
      if (dragState.hover && dragState.hover !== closestLabel) {
        dragState.hover.classList.remove('is-hovered');
      }
      closestLabel.classList.add('is-hovered');
      dragState.hover = closestLabel;

      const optionRect = closestLabel.getBoundingClientRect();
      const sliderWidth = optionRect.width;
      const maxOffset = Math.max(0, innerWidth - sliderWidth);
      const offset = Math.max(0, Math.min(x - sliderWidth / 2, maxOffset));
      this.toggleEl.style.setProperty(this.widthVar, `${sliderWidth}px`);
      this.toggleEl.style.setProperty(this.offsetVar, `${offset}px`);

      if (commit) {
        commitOption(closestLabel);
        requestAnimationFrame(() => this.updateSlider());
      }
    };

    const finishDrag = () => {
      if (dragState.pointerId !== null) {
        try {
          this.toggleEl.releasePointerCapture(dragState.pointerId);
        } catch (err) {
          console.warn('Failed to release pointer capture:', err);
        }
      }
      dragState.pointerId = null;
      dragState.active = false;
      this.toggleEl.classList.remove(`${this.toggleEl.classList[0]}--dragging`);
      if (dragState.hover) {
        dragState.hover.classList.remove('is-hovered');
        dragState.hover = null;
      }
      dragState.rect = null;
      requestAnimationFrame(() => this.updateSlider());
    };

    let swipeStart = 0;
    const handlePointerMove = throttle((ev) => {
      if (!dragState.active || (dragState.pointerId !== null && ev.pointerId !== dragState.pointerId)) return;
      updateDragVisual(ev.clientX, false);

      // Track swipe for navigation
      if (radioInputs) {
        const delta = ev.clientX - swipeStart;
        if (Math.abs(delta) > 50) {
          const currentIndex = radioInputs.findIndex(r => r.checked);
          if (delta > 0 && currentIndex > 0) {
            radioInputs[currentIndex - 1].checked = true;
            radioInputs[currentIndex - 1].dispatchEvent(new Event('change', { bubbles: true }));
            swipeStart = ev.clientX;
          } else if (delta < 0 && currentIndex < radioInputs.length - 1) {
            radioInputs[currentIndex + 1].checked = true;
            radioInputs[currentIndex + 1].dispatchEvent(new Event('change', { bubbles: true }));
            swipeStart = ev.clientX;
          }
        }
      }
    }, 16); // ~60fps

    const handlePointerUp = (ev) => {
      if (!dragState.active || (dragState.pointerId !== null && ev.pointerId !== dragState.pointerId)) return;
      updateDragVisual(ev.clientX, true);
      if (this.sliderEl) {
        this.sliderEl.style.transform = '';
      }
      finishDrag();
    };

    this.toggleEl.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      const optionLabel = ev.target.closest('label');
      if (ev.pointerType === 'mouse' && optionLabel && this.toggleEl.contains(optionLabel)) {
        return;
      }
      ensureMetrics();
      dragState.active = true;
      dragState.pointerId = ev.pointerId;
      swipeStart = ev.clientX;
      this.toggleEl.classList.add(`${this.toggleEl.classList[0]}--dragging`);
      try {
        this.toggleEl.setPointerCapture(ev.pointerId);
      } catch (err) {
        console.warn('Failed to set pointer capture:', err);
      }
      updateDragVisual(ev.clientX, false);
      if (ev.pointerType !== 'mouse') {
        ev.preventDefault();
      }
    });

    this.toggleEl.addEventListener('pointermove', handlePointerMove);
    this.toggleEl.addEventListener('pointerup', handlePointerUp);
    this.toggleEl.addEventListener('pointercancel', handlePointerUp);
    this.toggleEl.addEventListener('lostpointercapture', finishDrag);
  }

  /**
   * クリーンアップ
   */
  destroy() {
    if (this.cleanup) {
      this.cleanup();
    }
  }
}
