import { FileText, Palette, List, Check, Trash2, Plus, RotateCcw, ArrowUp, ArrowDown, Image as ImageIcon } from 'lucide-react';
import { CoverStyle } from '../../types';
import { getCoverTemplate, getCoverTemplates } from '../../themes/themeRegistry';
import { resolveImageSrc } from '../../utils/tauriHelper';
import { PanelTabModel, DynamicFieldInput } from './shared';

export function CoverTab({ model }: { model: Pick<PanelTabModel, 'theme' | 'meta' | 'isDark' | 'sectionBorderClass' | 'labelClass' | 'textMutedClass' | 'textSubClass' | 'subCardBgClass' | 'inputClass' | 'buttonDashedClass' | 'tabInactiveClass' | 'currentCoverList' | 'updateMeta' | 'updateCover' | 'handleAddCoverListItem' | 'handleEditCoverListItem' | 'handleRemoveCoverListItem' | 'handleMoveCoverListItem' | 'openThemePicker' | 'openImagePicker'> }) {
  const { theme, meta, isDark, sectionBorderClass, labelClass, textMutedClass, textSubClass, subCardBgClass, inputClass, buttonDashedClass, tabInactiveClass, currentCoverList, updateMeta, updateCover, handleAddCoverListItem, handleEditCoverListItem, handleRemoveCoverListItem, handleMoveCoverListItem } = model;
  return <>
<div className="space-y-4">
            <div className={`flex items-center justify-between gap-2 pb-2 border-b ${sectionBorderClass}`}>
              <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${labelClass}`}>
                <FileText className="w-4 h-4 text-blue-500" />
                文档元数据
              </span>
              <button type="button" onClick={() => model.openThemePicker()}
                className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold transition ${isDark ? 'text-blue-400 hover:bg-zinc-800' : 'text-blue-600 hover:bg-blue-50'}`}>
                <Palette className="w-3.5 h-3.5" />更换主题
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="grid grid-cols-1 gap-3">
                <div><label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>文档标题</label><input type="text" value={meta.title} onChange={(e) => updateMeta('title', e.target.value)} className={`w-full rounded px-2.5 py-1.5 ${inputClass}`} /></div>
                <div><label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>副标题</label><input type="text" value={meta.subtitle} onChange={(e) => updateMeta('subtitle', e.target.value)} className={`w-full rounded px-2.5 py-1.5 ${inputClass}`} /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>文档编号</label><input type="text" value={meta.number || ''} onChange={(e) => updateMeta('number', e.target.value)} className={`w-full rounded px-2.5 py-1.5 font-mono text-[11px] ${inputClass}`} /></div>
                <div><label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>版本</label><input type="text" value={meta.version || ''} onChange={(e) => updateMeta('version', e.target.value)} className={`w-full rounded px-2.5 py-1.5 font-mono text-[11px] ${inputClass}`} /></div>
                <div><label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>日期</label><input type="text" value={meta.date} onChange={(e) => updateMeta('date', e.target.value)} className={`w-full rounded px-2.5 py-1.5 ${inputClass}`} /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>作者</label><input type="text" value={meta.author} onChange={(e) => updateMeta('author', e.target.value)} className={`w-full rounded px-2.5 py-1.5 ${inputClass}`} /></div>
                <div><label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>所属机构 / 公司</label><input type="text" value={meta.organization} onChange={(e) => updateMeta('organization', e.target.value)} className={`w-full rounded px-2.5 py-1.5 ${inputClass}`} /></div>
                <div><label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>部门 / 团队</label><input type="text" value={meta.department} onChange={(e) => updateMeta('department', e.target.value)} className={`w-full rounded px-2.5 py-1.5 ${inputClass}`} /></div>
              </div>
            </div>
          </div>
<div className="space-y-4">
            <div className={`flex items-center justify-between pb-2 border-b ${sectionBorderClass}`}>
              <span className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${labelClass}`}>
                <FileText className="w-4 h-4 text-blue-500" />
                标准封面布局设置
              </span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={theme.cover.showCover}
                  onChange={(e) => updateCover('showCover', e.target.checked)}
                  className={`rounded text-blue-600 focus:ring-blue-500 ${isDark ? 'bg-[#0A0A0A] border-[#2A2A2A]' : 'bg-white border-slate-300'}`}
                />
                <span className={`font-bold text-[11px] ${textSubClass}`}>生成首页封面</span>
              </label>
            </div>

            {theme.cover.showCover && (
              <div className="space-y-4">
                {/* Visual Cover Style Picker */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className={`text-[10px] font-bold uppercase tracking-widest ${labelClass}`}>
                      封面视觉模版
                    </label>
                    <span className="text-[10px] text-blue-400 font-medium">点击效果卡片实时预览</span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {getCoverTemplates().map((template) => {
                      const opt = { ...template, desc: template.description };
                      const isSelected = theme.cover.coverStyle === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => updateCover('coverStyle', opt.id as CoverStyle)}
                          title={`${opt.name}：${opt.desc}`}
                          className={`group min-w-0 flex flex-col p-1 rounded-lg border-2 text-left transition-all relative overflow-hidden ${
                            isSelected
                              ? 'border-2 border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/10 shadow-md'
                              : isDark
                              ? 'border-[#2A2A2A] bg-[#0D0D0D] hover:border-zinc-500 hover:bg-[#141414]'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-2xs'
                          }`}
                        >
                          {/* Selected Checkmark Badge */}
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center z-10 shadow-xs">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </div>
                          )}

                          <div className="w-full aspect-[3/4] bg-white rounded border border-slate-200 shadow-xs p-0.5 flex flex-col justify-between overflow-hidden relative mb-1 select-none group-hover:scale-[1.02] transition-transform">
                            {template.renderThumbnail({ meta, cover: theme.cover, style: theme.style, coverListItems: currentCoverList })}
                          </div>

                          {/* Option Details */}
                          <div className="w-full">
                            <div className={`text-[10px] leading-4 min-h-4 text-center font-bold whitespace-normal break-words ${
                              isSelected 
                                ? 'text-emerald-500 font-extrabold' 
                                : textSubClass
                            }`}>
                              {opt.name}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className={`grid grid-cols-1 gap-3 pt-3 border-t ${sectionBorderClass}`}>

                  {/* Document Logo Management */}
                  <section className="space-y-3 pt-1">
                    <div className={`flex items-center justify-between pb-2 border-b ${sectionBorderClass}`}>
                      <div className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${labelClass}`}>
                        <ImageIcon className="w-4 h-4 text-blue-500" />
                        文档标志 Logo
                      </div>
                      {theme.cover.logoUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            updateCover('logoUrl', '');
                          }}
                          className="text-[10px] text-red-500 hover:text-red-600 font-medium flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          清除 Logo
                        </button>
                      )}
                    </div>

                    <div className={`flex items-center gap-3 p-2 rounded border ${subCardBgClass}`}>
                      {theme.cover.logoUrl ? (
                        <>
                        <img
                          src={resolveImageSrc(theme.cover.logoUrl)}
                          alt="Logo Preview"
                          className="h-8 max-w-[120px] object-contain bg-slate-100/50 p-1 rounded"
                        />
                        <span className="text-[10px] text-emerald-600 font-bold truncate font-mono">已加载 Logo 图片</span>
                        </>
                      ) : <span className={`text-[10px] ${textMutedClass}`}>未选择图片</span>}
                      <button type="button" onClick={() => model.openImagePicker('cover')} className="ml-auto p-2 rounded border border-inherit hover:border-blue-500 hover:text-blue-500" title="从图片库选择封面 Logo">
                        <ImageIcon className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="pt-1">
                      <input
                        type="text"
                        value={theme.cover.logoUrl || ''}
                        onChange={(e) => updateCover('logoUrl', e.target.value)}
                        placeholder="输入图片 URL 或本地相对路径 (如: ./assets/logo.png)"
                        className={`w-full rounded px-2.5 py-1.5 text-[11px] ${inputClass}`}
                      />
                    </div>
                    {theme.cover.logoUrl && (
                      <div className="space-y-2 pt-2">
                        <div className={`flex items-center justify-between gap-2 text-[10px] ${labelClass}`}>
                          <label htmlFor="document-logo-height">Logo 高度 (px)</label>
                          <div className="flex items-center gap-2">
                            <span>{theme.cover.logoHeight === undefined ? '封面预置' : `${theme.cover.logoHeight}px`}</span>
                            <button
                              type="button"
                              title="恢复封面预置大小"
                              aria-label="恢复封面预置大小"
                              disabled={theme.cover.logoHeight === undefined}
                              onClick={() => updateCover('logoHeight', undefined)}
                              className="p-1 hover:text-blue-500 disabled:opacity-30 disabled:cursor-default"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <input
                          id="document-logo-height"
                          type="range"
                          min="20"
                          max="120"
                          step="1"
                          value={theme.cover.logoHeight ?? getCoverTemplate(theme.cover.coverStyle).defaultLogoHeight ?? 40}
                          onChange={(e) => updateCover('logoHeight', Number(e.target.value))}
                          className="w-full accent-blue-500"
                        />
                      </div>
                    )}
                    </section>

                  {/* Custom Cover List Editor */}
                    <section className="space-y-3 pt-1">
                    <div className={`flex items-center justify-between pb-2 border-b ${sectionBorderClass}`}>
                      <div className="flex items-center gap-1.5">
                          <List className="w-4 h-4 text-blue-500" />
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${labelClass}`}>
                          封面属性字段列表
                        </span>
                      </div>
                    </div>

                    {getCoverTemplate(theme.cover.coverStyle).defaultCoverListColumns !== undefined && (
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[11px] ${textSubClass}`}>排列方式</span>
                        <div role="group" aria-label="封面属性排列方式" className={`inline-flex rounded border p-0.5 ${sectionBorderClass}`}>
                          {([1, 2] as const).map((columns) => {
                            const selected = (theme.cover.coverListColumns ?? getCoverTemplate(theme.cover.coverStyle).defaultCoverListColumns) === columns;
                            return (
                              <button 
                                key={columns} 
                                type="button" 
                                aria-pressed={selected} 
                                onClick={() => updateCover('coverListColumns', columns)} 
                                className={`px-3 py-1 rounded text-[11px] transition ${
                                  selected 
                                    ? 'bg-blue-600 text-white shadow-xs font-semibold' 
                                    : tabInactiveClass
                                }`}
                              >
                                {columns === 1 ? '单栏' : '双栏'}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                      {currentCoverList.length === 0 ? (
                        <div className={`text-center py-4 text-[11px] ${textMutedClass}`}>
                          暂无属性字段，点击下方按钮添加
                        </div>
                      ) : (
                        currentCoverList.map((item, idx) => (
                          <div key={idx} className={`flex items-center gap-2 p-1.5 rounded border ${subCardBgClass}`}>
                            <input
                              type="text"
                              value={item.label}
                              onChange={(e) => handleEditCoverListItem(idx, 'label', e.target.value)}
                              placeholder="标签 (如: 项目名称)"
                              className={`flex-1 min-w-0 rounded px-2 py-1 text-[11px] font-medium ${inputClass}`}
                            />
                            <span className={`${textMutedClass} shrink-0 font-bold`}>:</span>
                            <DynamicFieldInput
                              label={`${item.label}的值`}
                              value={item.value}
                              onChange={(value) => handleEditCoverListItem(idx, 'value', value)}
                              className="w-32 sm:w-36 shrink-0"
                              inputClass={`text-[11px] ${inputClass}`}
                            />
                            <button
                              type="button"
                              onClick={() => handleMoveCoverListItem(idx, -1)}
                              disabled={idx === 0}
                              className={`p-1.5 transition shrink-0 rounded hover:bg-blue-500/10 ${textMutedClass} hover:text-blue-500 disabled:opacity-30 disabled:pointer-events-none`}
                              title="上移"
                              aria-label={`上移${item.label || '此字段'}`}
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveCoverListItem(idx, 1)}
                              disabled={idx === currentCoverList.length - 1}
                              className={`p-1.5 transition shrink-0 rounded hover:bg-blue-500/10 ${textMutedClass} hover:text-blue-500 disabled:opacity-30 disabled:pointer-events-none`}
                              title="下移"
                              aria-label={`下移${item.label || '此字段'}`}
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveCoverListItem(idx)}
                              className={`p-1.5 transition shrink-0 rounded hover:bg-red-500/10 ${textMutedClass} hover:text-red-500`}
                              title="删除此行"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleAddCoverListItem}
                      className={`w-full flex items-center justify-center gap-1.5 py-1.5 border border-dashed rounded font-medium text-[11px] transition ${buttonDashedClass}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      添加自定义属性行
                    </button>
                  </section>
                </div>
              </div>
            )}
          </div>
  </>;
}
