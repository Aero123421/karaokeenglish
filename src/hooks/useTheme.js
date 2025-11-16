import { useState, useEffect, useCallback } from 'react';

/**
 * Theme Hook
 * テーマ管理Hook
 */
export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    // トランジション無効化で瞬時に切り替え
    document.documentElement.classList.add('theme-switching');

    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    localStorage.setItem('theme', theme);

    // 次フレームでトランジション再有効化
    requestAnimationFrame(() => {
      document.documentElement.classList.remove('theme-switching');
    });
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  return { theme, toggleTheme };
}
