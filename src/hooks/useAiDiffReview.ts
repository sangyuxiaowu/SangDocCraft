import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { DiffHunk, DiffReviewSession } from '../types/ai';
import { modal } from '../utils/modalDialog';
import { acceptHunk, rejectHunk, acceptAllHunks, rejectAllHunks, reconstructFromHunks } from '../utils/diffUtils';
import type { DiffReviewResult } from '../utils/aiAssistantService';

export function useAiDiffReview(
  markdown: string,
  setMarkdown: Dispatch<SetStateAction<string>>,
  setIsDocumentDirty: Dispatch<SetStateAction<boolean>>,
) {
  const [diffReviewSession, setDiffReviewSession] = useState<DiffReviewSession | null>(null);
  const diffReviewResolverRef = useRef<((result: DiffReviewResult) => void) | null>(null);
  const diffReviewSessionRef = useRef<DiffReviewSession | null>(null);

  const updateHunks = (update: (hunks: DiffHunk[]) => DiffHunk[]) => {
    const session = diffReviewSessionRef.current;
    if (!session) return;
    const nextSession = { ...session, hunks: update(session.hunks) };
    diffReviewSessionRef.current = nextSession;
    setDiffReviewSession(nextSession);
  };

  const handleAcceptHunk = (hunkId: string) => updateHunks(hunks => acceptHunk(hunks, hunkId));
  const handleRejectHunk = (hunkId: string) => updateHunks(hunks => rejectHunk(hunks, hunkId));
  const handleAcceptAllHunks = () => updateHunks(acceptAllHunks);
  const handleRejectAllHunks = () => updateHunks(rejectAllHunks);

  const handleCancelReview = () => {
    const session = diffReviewSessionRef.current;
    const resolve = diffReviewResolverRef.current;
    if (!session || !resolve) return;
    diffReviewSessionRef.current = null;
    diffReviewResolverRef.current = null;
    setDiffReviewSession(null);
    resolve({
      markdown: session.originalText,
      acceptedCount: 0,
      rejectedCount: session.hunks.filter(hunk => hunk.type === 'change').length,
      cancelled: true
    });
  };

  const handleApplyResolution = async () => {
    const session = diffReviewSessionRef.current;
    if (!session) return;
    if (markdown !== session.originalText) {
      const ok = await modal.confirm({
        title: '文档已被修改',
        message: '审查开始后正文发生了变化（可能是手动编辑）。继续应用会用审查结果覆盖这些改动，是否继续？',
        confirmText: '仍然应用',
        cancelText: '放弃应用',
        variant: 'danger',
      });
      if (!ok) {
        handleCancelReview();
        return;
      }
    }
    const finalMarkdown = reconstructFromHunks(session.hunks);
    const changeHunks = session.hunks.filter(hunk => hunk.type === 'change');
    setMarkdown(finalMarkdown);
    setIsDocumentDirty(true);
    setDiffReviewSession(null);
    diffReviewSessionRef.current = null;
    diffReviewResolverRef.current?.({
      markdown: finalMarkdown,
      acceptedCount: changeHunks.filter(hunk => hunk.status !== 'rejected').length,
      rejectedCount: changeHunks.filter(hunk => hunk.status === 'rejected').length,
      cancelled: false
    });
    diffReviewResolverRef.current = null;
  };

  const startDiffReview = (session: DiffReviewSession) => new Promise<DiffReviewResult>(resolve => {
    diffReviewResolverRef.current = resolve;
    diffReviewSessionRef.current = session;
    setDiffReviewSession(session);
  });

  return {
    diffReviewSession, handleAcceptHunk, handleRejectHunk, handleAcceptAllHunks,
    handleRejectAllHunks, handleApplyResolution, handleCancelReview, startDiffReview,
  };
}