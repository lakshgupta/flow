import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  actualTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyTheme(theme: 'light' | 'dark') {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.dataset.theme = theme;
  root.style.setProperty('color-scheme', theme);
}

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Load theme from localStorage or default to system
    const stored = localStorage.getItem('flow-theme') as Theme;
    return stored || 'system';
  });

  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('flow-theme') as Theme;
    if (stored === 'system') {
      return getSystemTheme();
    }
    return stored === 'dark' ? 'dark' : 'light';
  });

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('flow-theme', newTheme);

    const resolvedTheme = newTheme === 'system' ? getSystemTheme() : newTheme;
    setActualTheme(resolvedTheme);
    applyTheme(resolvedTheme);
  };

  useEffect(() => {
    // Apply initial theme
    const resolvedTheme = theme === 'system' ? getSystemTheme() : theme;
    setActualTheme(resolvedTheme);
    applyTheme(resolvedTheme);

    // Listen for system theme changes when theme is 'system'
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        const newSystemTheme = getSystemTheme();
        setActualTheme(newSystemTheme);
        applyTheme(newSystemTheme);
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, actualTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}