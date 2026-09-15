import { describe, expect, it } from 'vitest';
import { formatApplicationTitle } from './applicationTitle';

describe('application title', () => {
  it('formats the current document title', () => {
    expect(formatApplicationTitle('架构设计')).toBe('架构设计 - SangDocCraft');
  });

  it('uses an untitled fallback for empty names', () => {
    expect(formatApplicationTitle('  ')).toBe('未命名文档 - SangDocCraft');
  });
});