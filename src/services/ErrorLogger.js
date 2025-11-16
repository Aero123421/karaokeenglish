/**
 * Error Logger Service
 * エラーログとユーザーフレンドリーなエラーメッセージ管理
 */

export class ErrorLogger {
  constructor() {
    this.maxLogSize = 50;
    this.debugMode = localStorage.getItem('debug') === 'true';
  }

  /**
   * エラーメッセージの定義
   */
  static ERROR_MESSAGES = {
    'NotAllowedError': {
      title: 'マイクの使用が拒否されました',
      message: 'ブラウザの設定でマイクへのアクセスを許可してください。',
      instructions: [
        '1. アドレスバー左側の鍵マークをクリック',
        '2. 「マイク」の設定を「許可」に変更',
        '3. ページを再読み込み'
      ]
    },
    'NotFoundError': {
      title: 'マイクが見つかりません',
      message: 'マイクが接続されているか確認してください。',
      instructions: [
        '1. マイクが正しく接続されているか確認',
        '2. デバイスの設定でマイクが有効になっているか確認',
        '3. 別のマイクで試す'
      ]
    },
    'NotSupportedError': {
      title: 'ブラウザが対応していません',
      message: 'このブラウザは音声認識に対応していません。Chrome または Edge をお使いください。',
      instructions: [
        'Chrome または Edge ブラウザをインストールしてください'
      ]
    },
    'AbortError': {
      title: '音声認識が中断されました',
      message: '音声認識が予期せず中断されました。もう一度お試しください。',
      instructions: []
    },
    'network': {
      title: 'ネットワークエラー',
      message: 'インターネット接続を確認してください。',
      instructions: [
        '1. インターネット接続を確認',
        '2. ページを再読み込み'
      ]
    },
    'audio-capture': {
      title: '音声の取得に失敗しました',
      message: 'マイクの音声を取得できませんでした。',
      instructions: [
        '1. マイクが正しく動作しているか確認',
        '2. 他のアプリケーションがマイクを使用していないか確認',
        '3. システムのマイク設定を確認'
      ]
    }
  };

  /**
   * エラーをログに記録
   * @param {Error} error - エラーオブジェクト
   * @param {string} context - エラーのコンテキスト
   */
  logError(error, context = '') {
    // コンソールに出力
    console.error(`[ERROR] ${context}:`, error);

    // デバッグモードの場合、詳細情報を出力
    if (this.debugMode) {
      console.debug('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        context
      });
    }

    // ローカルストレージに記録
    try {
      const errorLog = JSON.parse(localStorage.getItem('errorLog') || '[]');
      errorLog.push({
        timestamp: Date.now(),
        name: error.name,
        message: error.message,
        context
      });
      // 最新50件のみ保持
      const limitedLog = errorLog.slice(-this.maxLogSize);
      localStorage.setItem('errorLog', JSON.stringify(limitedLog));
    } catch (e) {
      console.warn('Failed to save error log:', e);
    }
  }

  /**
   * エラー情報を取得
   * @param {Error|string} error - エラーオブジェクトまたはエラー名
   * @returns {Object} エラー情報
   */
  getErrorInfo(error) {
    const errorName = typeof error === 'string' ? error : error.name;
    const errorInfo = ErrorLogger.ERROR_MESSAGES[errorName];

    if (errorInfo) {
      return errorInfo;
    }

    // デフォルトのエラー情報
    return {
      title: 'エラーが発生しました',
      message: typeof error === 'string' ? error : error.message || '不明なエラーが発生しました',
      instructions: []
    };
  }

  /**
   * ユーザーフレンドリーなエラーダイアログを表示
   * @param {Error|string} error - エラーオブジェクトまたはエラー名
   * @param {string} context - エラーのコンテキスト
   * @param {HTMLElement} statusElement - ステータス表示要素
   */
  showError(error, context = '', statusElement = null) {
    const errorInfo = this.getErrorInfo(error);

    // ステータス要素に表示
    if (statusElement) {
      statusElement.textContent = `❌ ${errorInfo.title}: ${errorInfo.message}`;
      statusElement.style.color = 'var(--color-accent-danger-text)';
    }

    // コンソールにログ
    if (typeof error !== 'string') {
      this.logError(error, context);
    }

    // アラートで詳細を表示（オプション）
    if (errorInfo.instructions && errorInfo.instructions.length > 0) {
      const instructionsText = errorInfo.instructions.join('\n');
      const fullMessage = `${errorInfo.title}\n\n${errorInfo.message}\n\n解決方法:\n${instructionsText}`;

      // デバッグモードの場合はアラートを表示
      if (this.debugMode) {
        alert(fullMessage);
      }
    }
  }

  /**
   * デバッグログを出力
   * @param {...any} args - ログに出力する引数
   */
  debug(...args) {
    if (this.debugMode) {
      console.log('[DEBUG]', ...args);
    }
  }

  /**
   * パフォーマンス計測開始
   * @param {string} label - 計測ラベル
   */
  startMeasure(label) {
    if (this.debugMode) {
      performance.mark(`${label}-start`);
    }
  }

  /**
   * パフォーマンス計測終了
   * @param {string} label - 計測ラベル
   */
  endMeasure(label) {
    if (this.debugMode) {
      performance.mark(`${label}-end`);
      try {
        performance.measure(label, `${label}-start`, `${label}-end`);
        const measure = performance.getEntriesByName(label)[0];
        console.log(`[PERFORMANCE] ${label}: ${measure.duration.toFixed(2)}ms`);
      } catch (e) {
        console.warn('Failed to measure performance:', e);
      }
    }
  }

  /**
   * エラーログを取得
   * @returns {Array} エラーログの配列
   */
  getErrorLog() {
    try {
      return JSON.parse(localStorage.getItem('errorLog') || '[]');
    } catch (e) {
      console.warn('Failed to retrieve error log:', e);
      return [];
    }
  }

  /**
   * エラーログをクリア
   */
  clearErrorLog() {
    try {
      localStorage.removeItem('errorLog');
      console.log('Error log cleared');
    } catch (e) {
      console.warn('Failed to clear error log:', e);
    }
  }

  /**
   * デバッグモードを切り替え
   * @param {boolean} enabled - デバッグモードを有効にするか
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
    localStorage.setItem('debug', enabled ? 'true' : 'false');
    console.log(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }
}
