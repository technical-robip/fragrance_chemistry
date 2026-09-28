import { useEffect, useState } from 'react';
import {
  DEFAULT_LINE_SORT,
  LINE_SORT_KEYS,
  toggleLineSort,
  type LineSort,
  type LineSortKey,
  type SortDirection,
} from './formula-line-sort';

const SORT_KEY = 'fc.lineList.sort';
const FAMILY_KEY = 'fc.lineList.showFamily';

function isSortKey(value: string): value is LineSortKey {
  return (LINE_SORT_KEYS as readonly string[]).includes(value);
}

function isDirection(value: string): value is SortDirection {
  return value === 'asc' || value === 'desc';
}

export function readLineSort(): LineSort {
  if (typeof window === 'undefined') return DEFAULT_LINE_SORT;
  try {
    const raw = window.localStorage.getItem(SORT_KEY);
    if (!raw) return DEFAULT_LINE_SORT;
    const parsed = JSON.parse(raw) as { key?: string; direction?: string };
    if (!parsed.key || !isSortKey(parsed.key)) return DEFAULT_LINE_SORT;
    if (!parsed.direction || !isDirection(parsed.direction)) return DEFAULT_LINE_SORT;
    return { key: parsed.key, direction: parsed.direction };
  } catch {
    return DEFAULT_LINE_SORT;
  }
}

export function writeLineSort(sort: LineSort) {
  window.localStorage.setItem(SORT_KEY, JSON.stringify(sort));
}

/** Family labels stay hidden until the user turns them on. */
export function readShowFamily(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(FAMILY_KEY) === '1';
}

export function writeShowFamily(show: boolean) {
  window.localStorage.setItem(FAMILY_KEY, show ? '1' : '0');
}

const PREFS_EVENT = 'fc-line-list';

export function useLineListPrefs() {
  const [sort, setSort] = useState<LineSort>(() => readLineSort());
  const [showFamily, setShowFamily] = useState(() => readShowFamily());

  useEffect(() => {
    function sync() {
      setSort(readLineSort());
      setShowFamily(readShowFamily());
    }
    window.addEventListener(PREFS_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(PREFS_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  function chooseSort(key: LineSortKey) {
    const next = toggleLineSort(readLineSort(), key);
    writeLineSort(next);
    setSort(next);
    window.dispatchEvent(new Event(PREFS_EVENT));
  }

  function toggleFamily() {
    const next = !readShowFamily();
    writeShowFamily(next);
    setShowFamily(next);
    window.dispatchEvent(new Event(PREFS_EVENT));
  }

  return { sort, showFamily, chooseSort, toggleFamily };
}
