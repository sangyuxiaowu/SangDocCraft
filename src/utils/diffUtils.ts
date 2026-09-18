import { DiffHunk, DiffLine } from '../types/ai';

/**
 * Standard line-by-line diff algorithm using Longest Common Subsequence (LCS)
 */
export function computeLineDiff(originalText: string, modifiedText: string): DiffLine[] {
  const normA = originalText.replace(/\r\n/g, '\n');
  const normB = modifiedText.replace(/\r\n/g, '\n');

  // Handle empty strings
  if (!normA && !normB) return [];
  if (!normA) {
    return normB.split('\n').map((line, idx) => ({
      type: 'added',
      content: line,
      newLineNumber: idx + 1,
    }));
  }
  if (!normB) {
    return normA.split('\n').map((line, idx) => ({
      type: 'removed',
      content: line,
      oldLineNumber: idx + 1,
    }));
  }

  const linesA = normA.split('\n');
  const linesB = normB.split('\n');
  const m = linesA.length;
  const n = linesB.length;

  // For very large texts, optimize LCS or simple diff
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1) as unknown as number[]);

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (linesA[i] === linesB[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // Backtrack to find diff
  let i = m;
  let j = n;
  const reversedDiff: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      reversedDiff.push({
        type: 'same',
        content: linesA[i - 1],
        oldLineNumber: i,
        newLineNumber: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      reversedDiff.push({
        type: 'added',
        content: linesB[j - 1],
        newLineNumber: j,
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      reversedDiff.push({
        type: 'removed',
        content: linesA[i - 1],
        oldLineNumber: i,
      });
      i--;
    }
  }

  return reversedDiff.reverse();
}

/**
 * Group raw diff lines into meaningful Git / VS Code style hunks
 */
export function createDiffHunks(originalText: string, modifiedText: string): DiffHunk[] {
  const diffLines = computeLineDiff(originalText, modifiedText);
  if (diffLines.length === 0) return [];

  const hunks: DiffHunk[] = [];
  let currentGroup: DiffLine[] = [];
  let isCurrentChange = false;
  let hunkCounter = 1;

  let curOldLine = 1;
  let curNewLine = 1;

  const flushGroup = () => {
    if (currentGroup.length === 0) return;

    const originalLines: string[] = [];
    const modifiedLines: string[] = [];

    let oldStart = curOldLine;
    let newStart = curNewLine;

    // Find the first line numbers for this hunk
    for (const line of currentGroup) {
      if (line.oldLineNumber && oldStart === curOldLine) oldStart = line.oldLineNumber;
      if (line.newLineNumber && newStart === curNewLine) newStart = line.newLineNumber;

      if (line.type === 'same') {
        originalLines.push(line.content);
        modifiedLines.push(line.content);
      } else if (line.type === 'removed') {
        originalLines.push(line.content);
      } else if (line.type === 'added') {
        modifiedLines.push(line.content);
      }
    }

    hunks.push({
      id: `hunk-${hunkCounter++}`,
      type: isCurrentChange ? 'change' : 'unchanged',
      lines: [...currentGroup],
      originalLines,
      modifiedLines,
      oldStartLine: oldStart,
      newStartLine: newStart,
      status: 'pending',
    });

    currentGroup = [];
  };

  for (const line of diffLines) {
    const isChange = line.type === 'added' || line.type === 'removed';

    if (currentGroup.length === 0) {
      isCurrentChange = isChange;
      currentGroup.push(line);
    } else if (isChange === isCurrentChange) {
      currentGroup.push(line);
    } else {
      flushGroup();
      isCurrentChange = isChange;
      currentGroup.push(line);
    }

    if (line.oldLineNumber) curOldLine = line.oldLineNumber;
    if (line.newLineNumber) curNewLine = line.newLineNumber;
  }

  flushGroup();
  return hunks;
}

/**
 * Reconstruct document text from hunks according to their accepted/rejected statuses
 */
export function reconstructFromHunks(
  hunks: DiffHunk[],
  treatPendingAs: 'modified' | 'original' = 'modified'
): string {
  const resultLines: string[] = [];

  for (const hunk of hunks) {
    if (hunk.type === 'unchanged') {
      resultLines.push(...hunk.originalLines);
    } else {
      if (hunk.status === 'accepted') {
        resultLines.push(...hunk.modifiedLines);
      } else if (hunk.status === 'rejected') {
        resultLines.push(...hunk.originalLines);
      } else {
        // Pending
        resultLines.push(...(treatPendingAs === 'modified' ? hunk.modifiedLines : hunk.originalLines));
      }
    }
  }

  return resultLines.join('\n');
}

/**
 * Accept a specific change hunk
 */
export function acceptHunk(hunks: DiffHunk[], hunkId: string): DiffHunk[] {
  return hunks.map((hunk) => (hunk.id === hunkId ? { ...hunk, status: 'accepted' as const } : hunk));
}

/**
 * Reject / Revert a specific change hunk
 */
export function rejectHunk(hunks: DiffHunk[], hunkId: string): DiffHunk[] {
  return hunks.map((hunk) => (hunk.id === hunkId ? { ...hunk, status: 'rejected' as const } : hunk));
}

/**
 * Accept all remaining change hunks
 */
export function acceptAllHunks(hunks: DiffHunk[]): DiffHunk[] {
  return hunks.map((hunk) => (hunk.type === 'change' ? { ...hunk, status: 'accepted' as const } : hunk));
}

/**
 * Reject all change hunks (revert all changes)
 */
export function rejectAllHunks(hunks: DiffHunk[]): DiffHunk[] {
  return hunks.map((hunk) => (hunk.type === 'change' ? { ...hunk, status: 'rejected' as const } : hunk));
}

export function getDiffSummary(hunks: DiffHunk[]) {
  const changeHunks = hunks.filter((h) => h.type === 'change');
  const pendingCount = changeHunks.filter((h) => h.status === 'pending').length;
  const acceptedCount = changeHunks.filter((h) => h.status === 'accepted').length;
  const rejectedCount = changeHunks.filter((h) => h.status === 'rejected').length;

  let addedCount = 0;
  let removedCount = 0;

  for (const hunk of changeHunks) {
    for (const line of hunk.lines) {
      if (line.type === 'added') addedCount++;
      if (line.type === 'removed') removedCount++;
    }
  }

  return {
    totalChanges: changeHunks.length,
    pendingCount,
    acceptedCount,
    rejectedCount,
    addedCount,
    removedCount,
    isAllResolved: changeHunks.length > 0 && pendingCount === 0,
    hasChanges: changeHunks.length > 0,
  };
}
