import { useState, useEffect } from 'react';

/**
 * Like useState but auto-saves to sessionStorage.
 * Data survives tab navigation but is wiped on full page refresh.
 * Call clearDraft() on successful submit to clear saved data.
 *
 * @param {string} key - unique sessionStorage key
 * @param {any}    initialState - default value when no draft exists
 * @param {boolean} enabled - set false to skip persistence (e.g. edit mode)
 */
export function useFormDraft(key, initialState, enabled = true) {
  const [value, setValue] = useState(() => {
    if (!enabled) return initialState;
    try {
      const saved = sessionStorage.getItem(key);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        // Merge objects so new fields added to initialState still appear
        if (
          parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) &&
          initialState !== null && typeof initialState === 'object' && !Array.isArray(initialState)
        ) {
          return { ...initialState, ...parsed };
        }
        return parsed;
      }
    } catch {}
    return initialState;
  });

  useEffect(() => {
    if (!enabled) return;
    try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value, enabled]);

  const clearDraft = () => {
    sessionStorage.removeItem(key);
    setValue(initialState);
  };

  return [value, setValue, clearDraft];
}
