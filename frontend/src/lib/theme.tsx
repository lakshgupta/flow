import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  actualTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const lightTheme = {
  '--background': '#ffffff',
  '--foreground': '#1f1f1f',
  '--card': '#f8f8f8',
  '--card-foreground': '#1f1f1f',
  '--popover': '#ffffff',
  '--popover-foreground': '#1f1f1f',
  '--primary': '#0078d4',
  '--primary-foreground': '#ffffff',
  '--secondary': '#f3f3f3',
  '--secondary-foreground': '#3c3c3c',
  '--muted': '#f3f3f3',
  '--muted-foreground': '#717171',
  '--accent': '#e8e8e8',
  '--accent-foreground': '#1f1f1f',
  '--destructive': 'hsl(0 72% 51%)',
  '--destructive-foreground': '#ffffff',
  '--border': '#e5e5e5',
  '--input': '#e5e5e5',
  '--ring': '#0078d4',
  '--radius': '0.5rem',
  '--chart-1': 'hsl(12 76% 61%)',
  '--chart-2': 'hsl(173 58% 39%)',
  '--chart-3': 'hsl(197 37% 24%)',
  '--chart-4': 'hsl(43 74% 66%)',
  '--chart-5': 'hsl(27 87% 67%)',
  '--bg-paper': '#ffffff',
  '--bg-panel': '#f8f8f8',
  '--bg-rail': 'rgba(0, 0, 0, 0.04)',
  '--bg-accent': '#e8e8e8',
  '--line-strong': 'rgba(0, 0, 0, 0.12)',
  '--ds-shadow': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  '--ds-shadow-soft': '0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  'color-scheme': 'light',
};

const darkTheme = {
  '--background': '#1e1e1e',
  '--foreground': '#d4d4d4',
  '--card': '#252526',
  '--card-foreground': '#d4d4d4',
  '--popover': '#2d2d2d',
  '--popover-foreground': '#d4d4d4',
  '--primary': '#569cd6',
  '--primary-foreground': '#ffffff',
  '--secondary': '#2d2d2d',
  '--secondary-foreground': '#cccccc',
  '--muted': '#2d2d2d',
  '--muted-foreground': '#8a8a8a',
  '--accent': '#2a2d2e',
  '--accent-foreground': '#d4d4d4',
  '--destructive': 'hsl(0 70% 50%)',
  '--destructive-foreground': '#ffffff',
  '--border': '#3c3c3c',
  '--input': '#3c3c3c',
  '--ring': '#007acc',
  '--chart-1': 'hsl(220 70% 50%)',
  '--chart-2': 'hsl(160 60% 45%)',
  '--chart-3': 'hsl(30 80% 55%)',
  '--chart-4': 'hsl(280 65% 60%)',
  '--chart-5': 'hsl(340 75% 55%)',
  '--bg-paper': '#1e1e1e',
  '--bg-panel': '#252526',
  '--bg-rail': 'rgba(255, 255, 255, 0.04)',
  '--bg-accent': '#2d2d2d',
  '--line-strong': 'rgba(255, 255, 255, 0.1)',
  '--ds-shadow': '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
  '--ds-shadow-soft': '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px 0 rgba(0, 0, 0, 0.25)',
  'color-scheme': 'dark',
};

function applyTheme(theme: 'light' | 'dark') {
  const root = document.documentElement;
  const themeVars = theme === 'light' ? lightTheme : darkTheme;

  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  Object.entries(themeVars).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });
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