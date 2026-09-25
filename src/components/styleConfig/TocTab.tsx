import React from 'react';
import { Type, BookOpen } from 'lucide-react';
import { TocConfig } from '../../types';
import { getTocLevelStyles, getTocTitleFont } from '../../utils/documentStructure';
import { PanelTabModel } from './shared';

export function TocTab({ model }: { model: Pick<PanelTabModel, 'theme' | 'isDark' | 'sectionBorderClass' | 'labelClass' | 'textSubClass' | 'inputClass' | 'updateToc' | 'updateTocTitleFont' | 'updateTocLevelStyle' | 'renderTocFontDetails'> }) {
  const { theme, isDark, sectionBorderClass, labelClass, textSubClass, inputClass, updateToc, updateTocTitleFont, updateTocLevelStyle, renderTocFontDetails } = model;
  return <>
<div className="space-y-4">
            <div className={`flex items-center justify-between pb-2 border-b ${sectionBorderClass}`}>
              <span className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${labelClass}`}>
                <BookOpen className="w-4 h-4 text-blue-500" />
                自动生成目录页
              </span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={theme.toc.show}
                  onChange={(e) => updateToc('show', e.target.checked)}
                  className={`rounded text-blue-600 ${isDark ? 'bg-[#0A0A0A] border-[#2A2A2A]' : 'bg-white border-slate-300'}`}
                />
                <span className={`font-bold text-[11px] ${textSubClass}`}>生成目录页</span>
              </label>
            </div>

            {theme.toc.show && (
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className={`block text-[10px] font-bold uppercase tracking-widest ${labelClass}`}>目录页标题</label>
                    <label className={`flex items-center gap-1.5 cursor-pointer font-bold text-[11px] ${textSubClass}`}>
                      <input
                        type="checkbox"
                        checked={theme.toc.titleCenter === true}
                        onChange={(e) => updateToc('titleCenter', e.target.checked)}
                        className={`rounded text-blue-600 ${isDark ? 'bg-[#0A0A0A] border-[#2A2A2A]' : 'bg-white border-slate-300'}`}
                      />
                      <span>标题居中</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={theme.toc.title}
                    onChange={(e) => updateToc('title', e.target.value)}
                    className={`w-full rounded px-2.5 py-1.5 ${inputClass}`}
                  />
                </div>

                <div>
                  <label htmlFor="toc-title-style" className={`block text-[10px] font-bold mb-1 ${labelClass}`}>目录标题表达形式</label>
                  <select
                    id="toc-title-style"
                    value={theme.toc.titleStyle ?? 'underline'}
                    onChange={(e) => updateToc('titleStyle', e.target.value as TocConfig['titleStyle'])}
                    className={`w-full rounded px-2.5 py-1.5 ${inputClass}`}
                  >
                    <option value="underline">底部下划线</option>
                    <option value="accent-block">左侧色块</option>
                    <option value="badge">背景徽章</option>
                    <option value="minimal">极简标题</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>提取标题深度</label>
                    <select
                      value={theme.toc.maxDepth}
                      onChange={(e) => updateToc('maxDepth', Number(e.target.value) as TocConfig['maxDepth'])}
                      className={`w-full rounded px-2.5 py-1.5 ${inputClass}`}
                    >
                      <option value={1}>仅一级标题 H1</option>
                      <option value={2}>一、二级标题 H1-H2</option>
                      <option value={3}>一、二、三级标题 H1-H3</option>
                      <option value={4}>一至四级标题 H1-H4</option>
                    </select>
                  </div>

                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>目录引导线样式</label>
                    <select
                      value={theme.toc.leaderStyle}
                      onChange={(e) => updateToc('leaderStyle', e.target.value as TocConfig['leaderStyle'])}
                      className={`w-full rounded px-2.5 py-1.5 ${inputClass}`}
                    >
                      <option value="dots">点线 . . . . . . . .</option>
                      <option value="dashes">虚线 - - - - - - -</option>
                      <option value="line">实线 ——————</option>
                      <option value="none">无引导线</option>
                    </select>
                  </div>
                </div>

                <div className={`pt-2 border-t ${sectionBorderClass} space-y-2`}>
                  <label className={`flex items-center gap-2 cursor-pointer font-bold text-[11px] ${textSubClass}`}>
                    <input
                      type="checkbox"
                      checked={theme.toc.showPageNumbers}
                      onChange={(e) => updateToc('showPageNumbers', e.target.checked)}
                      className={`rounded text-blue-600 ${isDark ? 'bg-[#0A0A0A] border-[#2A2A2A]' : 'bg-white border-slate-300'}`}
                    />
                    <span>显示目录页码</span>
                  </label>
                  <label className={`flex items-center gap-2 cursor-pointer font-bold text-[11px] ${textSubClass}`}>
                    <input
                      type="checkbox"
                      checked={theme.toc.pageBreakAfter}
                      onChange={(e) => updateToc('pageBreakAfter', e.target.checked)}
                      className={`rounded text-blue-600 ${isDark ? 'bg-[#0A0A0A] border-[#2A2A2A]' : 'bg-white border-slate-300'}`}
                    />
                    <span>目录后强行独占分页</span>
                  </label>
                  <label className={`flex items-center gap-2 cursor-pointer font-bold text-[11px] ${textSubClass}`}>
                    <input
                      type="checkbox"
                      checked={theme.toc.titleOnEveryPage === true}
                      onChange={(e) => updateToc('titleOnEveryPage', e.target.checked)}
                      className={`rounded text-blue-600 ${isDark ? 'bg-[#0A0A0A] border-[#2A2A2A]' : 'bg-white border-slate-300'}`}
                    />
                    <span>目录分页后显示标题</span>
                  </label>
                </div>

                <section className="space-y-2 pt-1">
                  <div className={`flex items-center gap-1.5 pb-2 border-b ${sectionBorderClass}`}>
                    <Type className="w-4 h-4 text-blue-500" />
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${labelClass}`}>目录字体与层级样式</span>
                  </div>
                  {renderTocFontDetails('目录页标题', getTocTitleFont(theme.toc), updateTocTitleFont)}
                  {getTocLevelStyles(theme.toc).slice(0, theme.toc.maxDepth).map((level, index) => (
                    <React.Fragment key={`toc-level-${index}`}>
                      {renderTocFontDetails(
                        `${index + 1} 级目录项`,
                        level,
                        (field, value) => updateTocLevelStyle(index, field, value),
                        { value: level.paddingLeft, onChange: (value) => updateTocLevelStyle(index, 'paddingLeft', value) },
                      )}
                    </React.Fragment>
                  ))}
                </section>
              </div>
            )}
          </div>
  </>;
}
