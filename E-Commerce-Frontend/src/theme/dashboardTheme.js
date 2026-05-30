import { useEffect, useState } from 'react';

/* Brand-accent colors stay identical between themes so charts/status pills
   keep their meaning. Only the "chrome" (bg/card/text/line/sidebar) flips. */
const ACCENTS = {
  accent: '#f97316',
  blue:   '#3b82f6',
  green:  '#22c55e',
  yellow: '#eab308',
  purple: '#8b5cf6',
  red:    '#ef4444',
  cyan:   '#06b6d4',
  pink:   '#ec4899',
};

const DARK = {
  ...ACCENTS,
  mute:    '#6b7280',
  sub:     '#9ca3af',
  line:    '#252b3b',
  border:  '#252b3b',
  card:    '#161a22',
  card2:   '#1b2030',
  text:    '#e8eaf2',
  bg:      '#0d0f14',
  surf:    '#0d0f14',
  surface: '#111318',
  sidebar: '#111318',
  active:  '#1e2535',
};

const LIGHT = {
  ...ACCENTS,
  mute:    '#6b7280',
  sub:     '#4b5563',
  line:    '#e5e7eb',
  border:  '#e5e7eb',
  card:    '#ffffff',
  card2:   '#f9fafb',
  text:    '#111827',
  bg:      '#f3f4f6',
  surf:    '#f3f4f6',
  surface: '#ffffff',
  sidebar: '#ffffff',
  active:  '#e5e7eb',
};

const PALETTES = { dark: DARK, light: LIGHT };
const STORAGE_KEY = 'dashboardTheme';

function readInitial() {
  if (typeof window === 'undefined') return 'dark';
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === 'light' ? 'light' : 'dark';
}

let currentTheme = readInitial();
let currentPalette = PALETTES[currentTheme];
const listeners = new Set();

export function getDashboardTheme() {
  return currentTheme;
}

export function setDashboardTheme(next) {
  const t = next === 'light' ? 'light' : 'dark';
  if (t === currentTheme) return;
  currentTheme = t;
  currentPalette = PALETTES[t];
  try { window.localStorage.setItem(STORAGE_KEY, t); } catch {}
  listeners.forEach((l) => l());
}

/* Proxy palette — every `C.bg`, `C.text`, etc. resolves against the active
   palette at read time, so we don't have to touch existing call sites. */
export const C = new Proxy({}, {
  get(_target, key) {
    return currentPalette[key];
  },
  has(_target, key) {
    return key in currentPalette;
  },
  ownKeys() {
    return Reflect.ownKeys(currentPalette);
  },
  getOwnPropertyDescriptor(_target, key) {
    return { enumerable: true, configurable: true, value: currentPalette[key] };
  },
});

/* Subscribe a React component to theme changes. Returns the current theme
   and a setter; the component re-renders whenever theme flips, which causes
   all its `C.*` reads (through the Proxy) to pick up the new palette. */
export function useDashboardTheme() {
  const [theme, setTheme] = useState(currentTheme);
  useEffect(() => {
    const l = () => setTheme(currentTheme);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return {
    theme,
    isLight: theme === 'light',
    setTheme: setDashboardTheme,
    toggle: () => setDashboardTheme(currentTheme === 'light' ? 'dark' : 'light'),
  };
}
