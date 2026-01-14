/**
 * Keyboard Shortcuts Hook
 * Centralized keyboard shortcut management
 */

import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: () => void;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]): void {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl === undefined || event.ctrlKey === shortcut.ctrl;
        const shiftMatch = shortcut.shift === undefined || event.shiftKey === shortcut.shift;
        const altMatch = shortcut.alt === undefined || event.altKey === shortcut.alt;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          event.preventDefault();
          shortcut.action();
          break;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}

/**
 * Format shortcut for display
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];
  if (shortcut.ctrl) parts.push('Ctrl');
  if (shortcut.shift) parts.push('Shift');
  if (shortcut.alt) parts.push('Alt');
  parts.push(shortcut.key.toUpperCase());
  return parts.join('+');
}

/**
 * Default application shortcuts
 */
export const DEFAULT_SHORTCUTS = {
  SEARCH: { key: 'f', ctrl: true, description: 'Focus search' },
  SAVE: { key: 's', ctrl: true, description: 'Export graph' },
  CLEAR: { key: 'Escape', description: 'Clear selection' },
  ZOOM_IN: { key: '=', ctrl: true, description: 'Zoom in' },
  ZOOM_OUT: { key: '-', ctrl: true, description: 'Zoom out' },
  ZOOM_FIT: { key: '0', ctrl: true, description: 'Fit to view' },
  TOGGLE_PANEL: { key: ' ', description: 'Toggle side panel' },
  VALIDATE: { key: 'v', ctrl: true, shift: true, description: 'Validate IFC' },
  HELP: { key: '?', shift: true, description: 'Show keyboard shortcuts' },
} as const;
