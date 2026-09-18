import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { 
  Heading1, 
  Heading2, 
  Heading3, 
  Heading4,
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Quote, 
  Code, 
  Table, 
  Minus, 
  FilePlus, 
  FileCode,
  Type,
  Image as ImageIcon,
  Sparkles,
  GitPullRequest
} from 'lucide-react';
import { getPageBreakInsertion } from '../utils/pageBreaks';
import type { DocumentAsset } from '../types';
import { ImagePicker } from './ImagePicker';
import { formatImageDimensionSuffix } from '../utils/imageDimensions';
import { createDocumentAsset } from '../utils/documentPackage';
import { putDocumentAsset } from '../utils/imageRepository';
import { registerAssetUrl } from '../utils/assetUrlRegistry';
import { DiffReviewSession } from '../types/ai';
import { AiDiffReviewPanel } from './ai/AiDiffReviewPanel';

interface EditorProps {
  value: string;
  onChange: (val: string) => void;
  onNavigateToPreview?: (position: number) => void;
  assets: DocumentAsset[];
  uiMode?: 'dark' | 'light';
  documentId: string;
  onAssetsChanged: () => Promise<void>;
  saveStatus: 'saved' | 'saving' | 'unsaved';
  lastSavedAt: string | null;
  reviewSession?: DiffReviewSession | null;
  onAcceptHunk?: (hunkId: string) => void;
  onRejectHunk?: (hunkId: string) => void;
  onAcceptAllHunks?: () => void;
  onRejectAllHunks?: () => void;
  onApplyResolution?: () => void;
  onCancelReview?: () => void;
  onOpenAiAssistant?: () => void;
}

export interface EditorHandle {
  insertAtSelection: (text: string) => void;
}

export const Editor = forwardRef<EditorHandle, EditorProps>(({ 
  value, 
  onChange, 
  onNavigateToPreview, 
  assets, 
  uiMode = 'dark', 
  documentId, 
  onAssetsChanged, 
  saveStatus, 
  lastSavedAt,
  reviewSession,
  onAcceptHunk,
  onRejectHunk,
  onAcceptAllHunks,
  onRejectAllHunks,
  onApplyResolution,
  onCancelReview,
  onOpenAiAssistant
}, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [isPastingImage, setIsPastingImage] = useState(false);
  const isDark = uiMode === 'dark';

  // Insert helper for formatting buttons
  const insertText = (before: string, after: string = '', defaultText: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const scrollTop = textarea.scrollTop;

    const selectedText = value.substring(start, end);
    const insertContent = selectedText || defaultText;
    const replacement = `${before}${insertContent}${after}`;

    const newValue = value.substring(0, start) + replacement + value.substring(end);
    onChange(newValue);

    let selectStart: number;
    let selectEnd: number;

    if (selectedText) {
      selectStart = start + before.length;
      selectEnd = start + before.length + selectedText.length;
    } else if (defaultText) {
      selectStart = start + before.length;
      selectEnd = start + before.length + defaultText.length;
    } else {
      selectStart = start + before.length;
      selectEnd = start + before.length;
    }

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(selectStart, selectEnd);
        textareaRef.current.scrollTop = scrollTop;
      }
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const scrollTop = textarea.scrollTop;
    const beforeSelection = value.substring(0, start);
    const afterSelection = value.substring(end);

    if (start !== end) {
      const lineStart = beforeSelection.lastIndexOf('\n') + 1;
      const lines = value.substring(lineStart, end).split('\n');
      let selectionLengthChange = 0;
      const modifiedLines = lines.map((line) => {
        if (!event.shiftKey) {
          selectionLengthChange += 2;
          return `  ${line}`;
        }
        if (line.startsWith('  ')) {
          selectionLengthChange -= 2;
          return line.slice(2);
        }
        if (line.startsWith(' ') || line.startsWith('\t')) {
          selectionLengthChange -= 1;
          return line.slice(1);
        }
        return line;
      });
      onChange(value.substring(0, lineStart) + modifiedLines.join('\n') + afterSelection);

      requestAnimationFrame(() => {
        if (!textareaRef.current) return;
        const nextStart = Math.max(lineStart, start + (event.shiftKey ? -2 : 2));
        const nextEnd = Math.max(nextStart, end + selectionLengthChange);
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(nextStart, nextEnd);
        textareaRef.current.scrollTop = scrollTop;
      });
      return;
    }

    if (!event.shiftKey) {
      onChange(`${beforeSelection}  ${afterSelection}`);
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(start + 2, start + 2);
        if (textareaRef.current) textareaRef.current.scrollTop = scrollTop;
      });
      return;
    }

    const lineStart = beforeSelection.lastIndexOf('\n') + 1;
    const currentLinePrefix = value.substring(lineStart, start);
    const removedLength = currentLinePrefix.startsWith('  ')
      ? 2
      : currentLinePrefix.startsWith(' ') || currentLinePrefix.startsWith('\t') ? 1 : 0;
    if (removedLength === 0) return;
    onChange(value.substring(0, lineStart) + value.substring(lineStart + removedLength));
    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      const nextPosition = Math.max(lineStart, start - removedLength);
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(nextPosition, nextPosition);
      textareaRef.current.scrollTop = scrollTop;
    });
  };

  const handlePaste = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;
    event.preventDefault();

    const file = imageItem.getAsFile();
    if (!file) return;
    const selectionStart = event.currentTarget.selectionStart;
    const selectionEnd = event.currentTarget.selectionEnd;
    const scrollTop = event.currentTarget.scrollTop;

    setIsPastingImage(true);
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      const now = new Date();
      const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
      const asset = await createDocumentAsset(data, {
        fileName: `screenshot_${timestamp}.png`,
        description: '剪贴板截图',
        mediaType: file.type || 'image/png',
        scope: 'document',
      });

      await putDocumentAsset(documentId, asset);
      registerAssetUrl(asset);
      await onAssetsChanged();

      const imageMarkdown = `\n\n![截图_${timestamp.slice(-4)}](@images/${asset.id})\n\n`;
      const currentValue = textareaRef.current?.value ?? value;
      onChange(currentValue.substring(0, selectionStart) + imageMarkdown + currentValue.substring(selectionEnd));
      requestAnimationFrame(() => {
        if (!textareaRef.current) return;
        const cursorPosition = selectionStart + imageMarkdown.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(cursorPosition, cursorPosition);
        textareaRef.current.scrollTop = scrollTop;
      });
    } catch (error) {
      console.error('Failed to process pasted screenshot:', error);
    } finally {
      setIsPastingImage(false);
    }
  };

  const insertTable = () => {
    const tableTemplate = `\n\n<!-- caption: 题注内容 -->\n| 表头1 | 表头2 | 表头3 |\n| :--- | :---: | ---: |\n| 内容数据A | 中心对齐 | 右对齐 |\n| 内容数据B | 中心对齐 | 右对齐 |\n\n`;
    insertText(tableTemplate, '', '');
  };

  const insertPageBreak = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const insertion = getPageBreakInsertion(value, textarea.selectionStart);
    textarea.setSelectionRange(insertion.position, insertion.position);
    insertText(insertion.text);
  };

  useImperativeHandle(ref, () => ({
    insertAtSelection: (text: string) => insertText(text),
  }));

  const lineCount = value.split('\n').length;
  const wordCount = value.length;

  const btnHoverClass = isDark
    ? 'hover:bg-[#2A2A2A] text-zinc-300 hover:text-white'
    : 'hover:bg-slate-200 text-slate-700 hover:text-slate-900';

  const dividerClass = isDark ? 'bg-[#2A2A2A]' : 'bg-slate-200';

  return (
    <div className={`flex flex-col h-full ${isDark ? 'bg-[#181818] text-white' : 'bg-white text-slate-900'} transition-colors duration-200`}>
      
      {/* Format Toolbar */}
      <div className={`${isDark ? 'bg-[#121212] border-[#2A2A2A] text-zinc-300' : 'bg-slate-50 border-slate-200 text-slate-700'} border-b px-3 py-2 flex items-center gap-1 flex-wrap text-xs transition-colors duration-200`}>
        
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insertText('# ', '', '')}
          className={`p-1.5 rounded transition font-bold ${btnHoverClass}`}
          title="一级标题 H1"
        >
          <Heading1 className="w-4 h-4" />
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insertText('## ', '', '')}
          className={`p-1.5 rounded transition font-bold ${btnHoverClass}`}
          title="二级标题 H2"
        >
          <Heading2 className="w-4 h-4" />
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insertText('### ', '', '')}
          className={`p-1.5 rounded transition font-bold ${btnHoverClass}`}
          title="三级标题 H3"
        >
          <Heading3 className="w-4 h-4" />
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insertText('#### ', '', '')}
          className={`p-1.5 rounded transition font-bold ${btnHoverClass}`}
          title="四级标题 H4"
        >
          <Heading4 className="w-4 h-4" />
        </button>

        <div className={`w-px h-4 mx-1 ${dividerClass}`} />

        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insertText('**', '**', '加粗文本')}
          className={`p-1.5 rounded transition ${btnHoverClass}`}
          title="粗体"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insertText('*', '*', '斜体文本')}
          className={`p-1.5 rounded transition ${btnHoverClass}`}
          title="斜体"
        >
          <Italic className="w-4 h-4" />
        </button>

        <div className={`w-px h-4 mx-1 ${dividerClass}`} />

        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insertText('* ', '', '')}
          className={`p-1.5 rounded transition ${btnHoverClass}`}
          title="无序列表"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insertText('1. ', '', '')}
          className={`p-1.5 rounded transition ${btnHoverClass}`}
          title="有序列表"
        >
          <ListOrdered className="w-4 h-4" />
        </button>

        <div className={`w-px h-4 mx-1 ${dividerClass}`} />

        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insertText('> ', '', '')}
          className={`p-1.5 rounded transition ${btnHoverClass}`}
          title="引用块"
        >
          <Quote className="w-4 h-4" />
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insertText('```json\n', '\n```', '// 代码内容')}
          className={`p-1.5 rounded transition ${btnHoverClass}`}
          title="代码块"
        >
          <Code className="w-4 h-4" />
        </button>

        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={insertTable}
          className={`p-1.5 rounded transition flex items-center gap-1 ${btnHoverClass}`}
          title="插入格式化表格"
        >
          <Table className="w-4 h-4 text-blue-500" />
        </button>

        <button
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setShowImagePicker(true)}
          className={`p-1.5 rounded transition ${btnHoverClass}`}
          title="从图片库插入图片"
        >
          <ImageIcon className="w-4 h-4 text-blue-500" />
        </button>

        <div className={`w-px h-4 mx-1 ${dividerClass}`} />

        {/* Page Break Tag Insert */}
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={insertPageBreak}
          className={`p-1.5 rounded transition ${btnHoverClass}`}
          title="插入强行分页标志 <!-- pagebreak -->"
        >
          <FilePlus className="w-4 h-4" />
        </button>

        {/* AI Assistant Quick Trigger */}
        {onOpenAiAssistant && (
          <>
            <div className={`w-px h-4 mx-1 ${dividerClass}`} />
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={onOpenAiAssistant}
              className={`p-1.5 rounded transition flex items-center gap-1.5 text-blue-500 hover:bg-blue-500/10 font-medium ${
                reviewSession ? 'bg-blue-500/10 ring-1 ring-blue-500/30' : ''
              }`}
              title="打开 AI 辅助写作浮窗"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="text-xs hidden sm:inline">AI 辅助</span>
            </button>
          </>
        )}

        {reviewSession && (
          <div className="ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[11px] font-semibold">
            <GitPullRequest className="w-3 h-3" />
            <span>对比审查中</span>
          </div>
        )}

      </div>

      {/* Editor Content Area */}
      <div className={`flex-1 relative flex overflow-hidden ${isDark ? 'bg-[#0A0A0A]' : 'bg-white'}`}>
        {reviewSession ? (
          <AiDiffReviewPanel
            sessionId={reviewSession.id}
            hunks={reviewSession.hunks}
            onAcceptHunk={onAcceptHunk || (() => {})}
            onRejectHunk={onRejectHunk || (() => {})}
            onAcceptAll={onAcceptAllHunks || (() => {})}
            onRejectAll={onRejectAllHunks || (() => {})}
            onApplyResolution={onApplyResolution || (() => {})}
            onCancelReview={onCancelReview || (() => {})}
            isDark={isDark}
            description={reviewSession.description}
          />
        ) : (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onDoubleClick={(event) => onNavigateToPreview?.(event.currentTarget.selectionStart)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="在此处输入或粘贴您的 Markdown 文档内容..."
            className={`w-full h-full p-4 font-mono text-xs leading-relaxed resize-none focus:outline-none border-none select-text transition-colors duration-200 ${
              isDark 
                ? 'bg-[#0A0A0A] text-blue-400/90 selection:bg-blue-600 selection:text-white' 
                : 'bg-white text-slate-800 selection:bg-blue-200 selection:text-blue-900'
            }`}
            spellCheck={false}
          />
        )}
      </div>

      {/* Editor Footer Status */}
      <div className={`h-8 shrink-0 ${isDark ? 'bg-[#121212] border-[#2A2A2A] text-zinc-500' : 'bg-slate-50 border-slate-200 text-slate-600'} border-t px-3 md:px-4 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest transition-colors duration-200`}>
        <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
          <span>行数: <strong className={isDark ? 'text-zinc-200' : 'text-slate-800'}>{lineCount}</strong></span>
          <span>字符数: <strong className={isDark ? 'text-zinc-200' : 'text-slate-800'}>{wordCount}</strong></span>
          {isPastingImage && <span className="text-indigo-500 normal-case tracking-normal animate-pulse">正在转存粘贴截图...</span>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {saveStatus === 'saving' && <span className="text-blue-500 normal-case tracking-normal animate-pulse">正在保存草稿...</span>}
          {saveStatus === 'unsaved' && <span className="text-amber-500 normal-case tracking-normal">有未保存修改</span>}
          {saveStatus === 'saved' && (
            <span className="text-emerald-500 normal-case tracking-normal">
              已保存{lastSavedAt ? ` ${lastSavedAt}` : ''}
            </span>
          )}
          <div className={`w-px h-3 ${isDark ? 'bg-[#2A2A2A]' : 'bg-slate-200'}`} />
          <FileCode className="w-3.5 h-3.5 text-blue-500" />
        </div>
      </div>

      <ImagePicker
        isOpen={showImagePicker}
        assets={assets}
        isDark={isDark}
        showDimensions
        onClose={() => setShowImagePicker(false)}
        onSelect={(reference, asset, dimensions) => {
          const altText = (asset.description || asset.fileName).replace(/[[\]]/g, '');
          insertText(`\n\n![${altText}](${reference})${formatImageDimensionSuffix(dimensions)}\n\n`);
          setShowImagePicker(false);
        }}
      />

    </div>
  );
});

Editor.displayName = 'Editor';
