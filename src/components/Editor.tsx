import React, { forwardRef, useImperativeHandle, useRef } from 'react';
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
  Type
} from 'lucide-react';
import { getPageBreakInsertion } from '../utils/pageBreaks';

interface EditorProps {
  value: string;
  onChange: (val: string) => void;
  uiMode?: 'dark' | 'light';
}

export interface EditorHandle {
  insertAtSelection: (text: string) => void;
}

export const Editor = forwardRef<EditorHandle, EditorProps>(({ value, onChange, uiMode = 'dark' }, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

      </div>

      {/* Editor Content Area */}
      <div className={`flex-1 relative flex ${isDark ? 'bg-[#0A0A0A]' : 'bg-white'}`}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="在此处输入或粘贴您的 Markdown 文档内容..."
          className={`w-full h-full p-4 font-mono text-xs leading-relaxed resize-none focus:outline-none border-none select-text transition-colors duration-200 ${
            isDark 
              ? 'bg-[#0A0A0A] text-blue-400/90 selection:bg-blue-600 selection:text-white' 
              : 'bg-white text-slate-800 selection:bg-blue-200 selection:text-blue-900'
          }`}
          spellCheck={false}
        />
      </div>

      {/* Editor Footer Status */}
      <div className={`h-8 shrink-0 ${isDark ? 'bg-[#121212] border-[#2A2A2A] text-zinc-500' : 'bg-slate-50 border-slate-200 text-slate-600'} border-t px-3 md:px-4 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest transition-colors duration-200`}>
        <div className="flex items-center gap-4">
          <span>行数: <strong className={isDark ? 'text-zinc-200' : 'text-slate-800'}>{lineCount}</strong></span>
          <span>字符数: <strong className={isDark ? 'text-zinc-200' : 'text-slate-800'}>{wordCount}</strong></span>
        </div>
        <div className="flex items-center gap-1">
          <FileCode className="w-3.5 h-3.5 text-blue-500" />
        </div>
      </div>

    </div>
  );
});

Editor.displayName = 'Editor';
