import { describe, it, expect } from 'vitest';
import {
  computeLineDiff,
  createDiffHunks,
  reconstructFromHunks,
  acceptHunk,
  rejectHunk,
  acceptAllHunks,
  rejectAllHunks,
  getDiffSummary
} from './diffUtils';

describe('diffUtils', () => {
  it('should return empty diff when both strings are empty', () => {
    expect(computeLineDiff('', '')).toEqual([]);
    expect(createDiffHunks('', '')).toEqual([]);
  });

  it('should identify additions when original is empty', () => {
    const diff = computeLineDiff('', 'line1\nline2');
    expect(diff.length).toBe(2);
    expect(diff[0].type).toBe('added');
    expect(diff[1].type).toBe('added');
  });

  it('should identify removals when modified is empty', () => {
    const diff = computeLineDiff('line1\nline2', '');
    expect(diff.length).toBe(2);
    expect(diff[0].type).toBe('removed');
    expect(diff[1].type).toBe('removed');
  });

  it('should compute hunks and support individual accept and reject', () => {
    const original = `Line 1
Line 2
Line 3
Line 4
Line 5`;

    const modified = `Line 1
Line 2 (updated)
Line 3
Line 4 (changed)
Line 5`;

    const hunks = createDiffHunks(original, modified);
    expect(hunks.length).toBeGreaterThanOrEqual(3);

    const summary = getDiffSummary(hunks);
    expect(summary.totalChanges).toBe(2);
    expect(summary.pendingCount).toBe(2);

    // Accept first change, reject second change
    const changeHunks = hunks.filter(h => h.type === 'change');
    const firstChangeId = changeHunks[0].id;
    const secondChangeId = changeHunks[1].id;

    let updatedHunks = acceptHunk(hunks, firstChangeId);
    updatedHunks = rejectHunk(updatedHunks, secondChangeId);

    const finalSummary = getDiffSummary(updatedHunks);
    expect(finalSummary.pendingCount).toBe(0);
    expect(finalSummary.acceptedCount).toBe(1);
    expect(finalSummary.rejectedCount).toBe(1);
    expect(finalSummary.isAllResolved).toBe(true);

    const result = reconstructFromHunks(updatedHunks);
    expect(result).toContain('Line 2 (updated)');
    expect(result).toContain('Line 4');
    expect(result).not.toContain('Line 4 (changed)');
  });

  it('should support acceptAll and rejectAll', () => {
    const original = `A\nB\nC`;
    const modified = `A\nB modified\nC`;

    const hunks = createDiffHunks(original, modified);
    const accepted = acceptAllHunks(hunks);
    expect(reconstructFromHunks(accepted)).toBe(modified);

    const rejected = rejectAllHunks(hunks);
    expect(reconstructFromHunks(rejected)).toBe(original);
  });
});
