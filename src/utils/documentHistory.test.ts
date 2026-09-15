import { describe, expect, it } from 'vitest';
import { getRegisteredThemes } from '../themes/themeRegistry';
import { appendUniqueHistory, createHistoryEntry } from './documentHistory';

describe('document history', () => {
  it('does not duplicate unchanged snapshots', async () => {
    const theme = getRegisteredThemes()[0];
    const first = await createHistoryEntry('# 文档', theme, 'idle');
    const second = await createHistoryEntry('# 文档', theme, 'manual');
    expect(appendUniqueHistory([first], second)).toEqual([first]);
  });

  it('keeps the newest snapshots within the limit', async () => {
    const theme = getRegisteredThemes()[0];
    const entries = await Promise.all(['a', 'b', 'c'].map((text) => createHistoryEntry(text, theme, 'idle')));
    expect(entries.reduce((history, entry) => appendUniqueHistory(history, entry, 2), [])).toEqual(entries.slice(1));
  });
});