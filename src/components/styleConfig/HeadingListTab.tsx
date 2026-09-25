import { FileText, Type, AlignLeft } from 'lucide-react';
import { TocConfig, StyleConfig, FontChoice } from '../../types';
import { PanelTabModel } from './shared';

export function HeadingListTab({ model }: { model: Pick<PanelTabModel, 'theme' | 'isDark' | 'sectionBorderClass' | 'labelClass' | 'textSubClass' | 'inputClass' | 'updateToc' | 'updateStyle' | 'renderHeadingDetails'> }) {
  const { theme, isDark, sectionBorderClass, labelClass, textSubClass, inputClass, updateToc, updateStyle, renderHeadingDetails } = model;
  return <div className="space-y-4"><div className="space-y-3">
<section className="space-y-3">
                  <div className={`flex items-center gap-1.5 pb-2 border-b ${sectionBorderClass}`}>
                    <Type className="w-4 h-4 text-blue-500" />
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${labelClass}`}>全局排版</span>
                  </div>
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>文档字体簇</label>
                    <select
                      value={theme.style.fontFamily}
                      onChange={(e) => updateStyle('fontFamily', e.target.value as FontChoice)}
                      className={`w-full rounded px-2.5 py-1.5 ${inputClass}`}
                    >
                      <option value="sans">无衬线黑体 (Sans-serif - 现代化/清晰)</option>
                      <option value="serif">衬线宋体 (Songti - 规范公文/书籍)</option>
                      <option value="kaiti">典雅楷体 (KaiTi - 传统公文/书法)</option>
                      <option value="heiti">重黑体 (HeiTi - 高强对比/醒目)</option>
                      <option value="mono">等宽技术体 (Monospace - 极客/研发)</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="min-w-0">
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>英文字体</label>
                      <input
                        type="text"
                        value={theme.style.latinFontFamily || 'Times New Roman'}
                        onChange={(e) => updateStyle('latinFontFamily', e.target.value)}
                        placeholder="Times New Roman"
                        className={`w-full min-w-0 rounded px-2.5 py-1.5 ${inputClass}`}
                      />
                    </div>
                    <div className="min-w-0">
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>标题编号</label>
                      <select
                        value={theme.toc.headingNumbering ?? 'none'}
                        onChange={(e) => updateToc('headingNumbering', e.target.value as TocConfig['headingNumbering'])}
                        className={`w-full min-w-0 rounded px-2.5 py-1.5 ${inputClass}`}
                      >
                        <option value="none">无</option>
                        <option value="decimal">数字编号 (1. / 1.1.)</option>
                        <option value="decimal-skip-h1">数字编号 (一级不编号，二级 1.1)</option>
                        <option value="chinese">中文编号</option>
                      </select>
                    </div>
                  </div>
                </section>
<section className="space-y-3 pt-1">
                  <div className={`flex items-center gap-1.5 pb-2 border-b ${sectionBorderClass}`}>
                    <AlignLeft className="w-4 h-4 text-blue-500" />
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${labelClass}`}>标题样式</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="min-w-0">
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>一级标题形式</label>
                      <select
                        value={theme.style.h1Style}
                        onChange={(e) => updateStyle('h1Style', e.target.value as StyleConfig['h1Style'])}
                        className={`w-full min-w-0 rounded px-2 py-1.5 ${inputClass}`}
                      >
                        <option value="underline">底部粗线条</option>
                        <option value="accent-block">左侧色块</option>
                        <option value="badge">背景徽章</option>
                        <option value="minimal">极简粗体</option>
                      </select>
                    </div>
                    <div className="min-w-0">
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>二级标题形式</label>
                      <select
                        value={theme.style.h2Style}
                        onChange={(e) => updateStyle('h2Style', e.target.value as StyleConfig['h2Style'])}
                        className={`w-full min-w-0 rounded px-2 py-1.5 ${inputClass}`}
                      >
                        <option value="border-left">左侧竖线</option>
                        <option value="underline-subtle">细下划线</option>
                        <option value="plain">普通文字</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className={`flex items-center gap-2 cursor-pointer font-bold text-[11px] ${textSubClass}`}>
                      <input
                        type="checkbox"
                        checked={theme.style.h1PageBreak === true}
                        disabled={theme.style.paginationMode === 'manual'}
                        onChange={(e) => updateStyle('h1PageBreak', e.target.checked)}
                        className={`rounded text-blue-600 ${isDark ? 'bg-[#0A0A0A] border-[#2A2A2A]' : 'bg-white border-slate-300'}`}
                      />
                      <span>一级标题另起一页</span>
                    </label>
                    <label className={`flex items-center gap-2 cursor-pointer font-bold text-[11px] ${textSubClass}`}>
                      <input
                        type="checkbox"
                        checked={theme.style.h1Center === true}
                        onChange={(e) => updateStyle('h1Center', e.target.checked)}
                        className={`rounded text-blue-600 ${isDark ? 'bg-[#0A0A0A] border-[#2A2A2A]' : 'bg-white border-slate-300'}`}
                      />
                      <span>一级标题居中</span>
                    </label>
                  </div>

                  <div className={`text-[10px] font-bold uppercase tracking-widest pt-1 ${labelClass}`}>详细参数</div>
                  {renderHeadingDetails('h1', '一级标题')}
                  {renderHeadingDetails('h2', '二级标题')}
                  {renderHeadingDetails('h3', '三级标题')}
                  {renderHeadingDetails('h4', '四级标题')}
                </section>
<section className="space-y-3 pt-1">
                  <div className={`flex items-center gap-1.5 pb-2 border-b ${sectionBorderClass}`}>
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${labelClass}`}>正文排版</span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className={`block text-[10px] font-bold mb-1 ${labelClass}`}>正文字体</label>
                      <input
                        type="text"
                        value={theme.style.bodyFontFamily || 'inherit'}
                        onChange={(e) => updateStyle('bodyFontFamily', e.target.value)}
                        placeholder="inherit"
                        className={`w-full rounded px-2.5 py-1.5 ${inputClass}`}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={`block text-[10px] font-bold mb-1 ${labelClass}`}>正文字号 (px)</label>
                        <input
                          type="number"
                          min={12}
                          max={18}
                          value={theme.style.fontSize}
                          onChange={(e) => updateStyle('fontSize', Number(e.target.value))}
                          className={`w-full rounded px-2 py-1 ${inputClass}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-[10px] font-bold mb-1 ${labelClass}`}>行高倍数</label>
                        <input
                          type="number"
                          step={0.1}
                          min={1.2}
                          max={2.2}
                          value={theme.style.lineHeight}
                          onChange={(e) => updateStyle('lineHeight', Number(e.target.value))}
                          className={`w-full rounded px-2 py-1 ${inputClass}`}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={`block text-[10px] font-bold mb-1 ${labelClass}`}>段前 (px)</label>
                        <input
                          type="number"
                          min={0}
                          max={120}
                          value={theme.style.paragraphMarginBefore ?? 0}
                          onChange={(e) => updateStyle('paragraphMarginBefore', Number(e.target.value))}
                          className={`w-full rounded px-2 py-1 ${inputClass}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-[10px] font-bold mb-1 ${labelClass}`}>段后 (px)</label>
                        <input
                          type="number"
                          min={0}
                          max={120}
                          value={theme.style.paragraphMarginAfter ?? 6}
                          onChange={(e) => updateStyle('paragraphMarginAfter', Number(e.target.value))}
                          className={`w-full rounded px-2 py-1 ${inputClass}`}
                        />
                      </div>
                    </div>
                    <label className={`flex items-center gap-2 cursor-pointer font-bold text-[11px] ${textSubClass}`}>
                      <input
                        type="checkbox"
                        checked={theme.style.indentParagraph === true}
                        onChange={(e) => updateStyle('indentParagraph', e.target.checked)}
                        className={`rounded text-blue-600 ${isDark ? 'bg-[#0A0A0A] border-[#2A2A2A]' : 'bg-white border-slate-300'}`}
                      />
                      <span>正文段落首行缩进 2 字符</span>
                    </label>
                  </div>
                </section>
  </div></div>;
}
