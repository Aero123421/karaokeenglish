/**
 * String Matching Utilities
 * 文字列マッチングアルゴリズム
 */

/**
 * マッチング用に文字列を正規化
 * @param {string} str - 正規化する文字列
 * @returns {string} 正規化された文字列
 */
export function normalizeForMatch(str) {
  try {
    // 大文字小文字を区別しない（toLowerCase）
    return str.toLowerCase().replace(/[\u2019\u2018]/g, "'")
      .replace(/[^\p{L}\p{N}'\s]+/gu, ' ').replace(/\s+/g, ' ').trim();
  } catch(e) {
    return str.toLowerCase().replace(/[^a-z0-9'\s]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

/**
 * Levenshtein距離を計算（編集距離）
 * @param {string} a - 比較する文字列1
 * @param {string} b - 比較する文字列2
 * @returns {number} 編集距離
 */
export function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      if (a[i-1] === b[j-1]) dp[j] = prev;
      else dp[j] = Math.min(prev, dp[j-1], dp[j]) + 1;
      prev = temp;
    }
  }
  return dp[n];
}

/**
 * Jaro-Winkler類似度を計算（軽量・高精度）
 * @param {string} s1 - 比較する文字列1
 * @param {string} s2 - 比較する文字列2
 * @returns {number} 類似度（0.0〜1.0）
 */
export function jaroWinkler(s1, s2) {
  if (s1 === s2) return 1.0;
  const len1 = s1.length, len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0;

  const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);
  let matches = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

  // Winklerボーナス（プレフィックス一致）
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
    if (s1[i] === s2[i]) prefix++; else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * 単語マッチングのスコアを計算
 * @param {string} a - 比較する単語1
 * @param {string} b - 比較する単語2
 * @returns {number} マッチングスコア
 */
export function scoreWordMatch(a, b) {
  if (!a || !b) return -100;
  if (a === b) return 3;

  // プレフィックス一致（高速）
  if (a.startsWith(b) || b.startsWith(a)) return 2;

  // Levenshtein距離（メイン判定）
  const dist = levenshtein(a, b);
  const minLen = Math.min(a.length, b.length);
  const maxLen = Math.max(a.length, b.length);

  if (dist === 1) return 2;
  if (dist === 2 && minLen > 4) return 1.5;
  if (dist === 2 && minLen > 3) return 1.2;  // 短い単語でも距離2を許容
  if (dist <= Math.ceil(minLen / 2) && minLen >= 5) return 1;  // 6→5に緩和

  // Jaro-Winkler（補助判定・閾値をさらに緩和）
  if (maxLen >= 4) {
    const similarity = jaroWinkler(a, b);
    // 閾値をさらに緩和：認識とハイライトの不一致を最小化
    if (similarity >= 0.75) return 1.2;  // 75%以上
    if (similarity >= 0.7) return 0.9;   // 70%以上
    if (similarity >= 0.65) return 0.7;  // 65%以上
    if (similarity >= 0.6) return 0.5;   // 60%以上で微弱一致
  }

  return -100;
}

// マッチングアルゴリズムの定数
export const MATCH_CONSTANTS = {
  PENALTY_WEIGHT_LOG: 0.8,
  PENALTY_WEIGHT_LINEAR: 0.3,
  GLOBAL_PENALTY_LOG: 1.2,
  GLOBAL_PENALTY_LINEAR: 0.4,
  MIN_SCORE_SINGLE: 0.8,
  MIN_SCORE_MULTI: 1.0,
  GLOBAL_MIN_SCORE_SINGLE: 0.6,
  GLOBAL_MIN_SCORE_MULTI: 0.8,
  GLOBAL_MIN_THRESHOLD: 0.6,
};
