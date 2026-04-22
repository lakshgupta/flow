import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider, useTheme } from "./theme";

function TestComponent() {
  const { theme, setTheme, actualTheme } = useTheme();
  return (
    <div>
      <div data-testid="current-theme">{theme}</div>
      <div data-testid="actual-theme">{actualTheme}</div>
      <button onClick={() => setTheme('light')}>Set Light</button>
      <button onClick={() => setTheme('dark')}>Set Dark</button>
      <button onClick={() => setTheme('system')}>Set System</button>
    </div>
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();

    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("provides theme context to child components", () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId("current-theme")).toHaveTextContent("system");
    expect(screen.getByTestId("actual-theme")).toHaveTextContent("light");
  });

  it("applies light theme CSS variables", () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    const root = document.documentElement;
    expect(root.classList.contains('dark')).toBe(false);
    expect(root.dataset.theme).toBe('light');
    expect(root.style.getPropertyValue('color-scheme')).toBe('light');
  });

  it("switches to dark theme when setTheme is called", async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Set Dark' }));

    expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
    expect(screen.getByTestId("actual-theme")).toHaveTextContent("dark");

    const root = document.documentElement;
    expect(root.classList.contains('dark')).toBe(true);
    expect(root.dataset.theme).toBe('dark');
    expect(root.style.getPropertyValue('color-scheme')).toBe('dark');
  });

  it("persists theme preference in localStorage", async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Set Dark' }));

    expect(localStorage.getItem('flow-theme')).toBe('dark');
  });

  it("loads theme from localStorage on initialization", () => {
    localStorage.setItem('flow-theme', 'dark');

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
    expect(screen.getByTestId("actual-theme")).toHaveTextContent("dark");
  });

  it("responds to system theme changes when theme is system", () => {
    // Mock system dark mode
    const mockMatchMedia = vi.fn().mockImplementation(query => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia,
    });

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId("actual-theme")).toHaveTextContent("dark");
  });

  it("throws error when useTheme is used outside provider", () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<TestComponent />)).toThrow(
      'useTheme must be used within a ThemeProvider'
    );

    consoleSpy.mockRestore();
  });
});