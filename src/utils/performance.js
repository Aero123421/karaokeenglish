/**
 * Performance Utilities
 * デバウンス・スロットリング関数
 */

/**
 * 関数の実行を遅延させるデバウンス
 * @param {Function} fn - 実行する関数
 * @param {number} delay - 遅延時間（ミリ秒）
 * @returns {Function} デバウンスされた関数
 */
export const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

/**
 * 関数の実行頻度を制限するスロットリング
 * @param {Function} fn - 実行する関数
 * @param {number} limit - 制限時間（ミリ秒）
 * @returns {Function} スロットリングされた関数
 */
export const throttle = (fn, limit) => {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};
