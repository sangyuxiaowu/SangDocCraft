import { Layout, AlignLeft, Trash2, Image as ImageIcon } from 'lucide-react';
import { HeaderConfig, FooterConfig } from '../../types';
import { resolveImageSrc } from '../../utils/tauriHelper';
import { PanelTabModel, DynamicFieldInput } from './shared';

export function HeaderFooterTab({ model }: { model: Pick<PanelTabModel, 'theme' | 'isDark' | 'sectionBorderClass' | 'labelClass' | 'textMutedClass' | 'textSubClass' | 'subCardBgClass' | 'inputClass' | 'updateHeader' | 'updateFooter' | 'openImagePicker'> }) {
  const { theme, isDark, sectionBorderClass, labelClass, textMutedClass, textSubClass, subCardBgClass, inputClass, updateHeader, updateFooter } = model;
  return <>
<div className="space-y-5">
            {/* Header Settings */}
            <section className="space-y-3">
              <div className={`flex items-center justify-between pb-2 border-b ${sectionBorderClass}`}>
                <span className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${labelClass}`}>
                  <AlignLeft className="w-4 h-4 text-blue-500" />
                  页眉内容与分隔线
                </span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={theme.header.show}
                    onChange={(e) => updateHeader('show', e.target.checked)}
                    className={`rounded text-blue-600 ${isDark ? 'bg-[#181818] border-[#2A2A2A]' : 'bg-white border-slate-300'}`}
                  />
                  <span className={`font-bold text-[11px] ${textSubClass}`}>显示页眉</span>
                </label>
              </div>

              {theme.header.show && (
                <div className="space-y-2.5 pt-1">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="min-w-0">
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>左侧</label>
                      <DynamicFieldInput
                        label="页眉左侧"
                        section
                        value={theme.header.leftText}
                        onChange={(value) => updateHeader('leftText', value)}
                        inputClass={inputClass}
                      />
                    </div>
                    <div className="min-w-0">
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>中间</label>
                      <DynamicFieldInput
                        label="页眉中间"
                        section
                        value={theme.header.centerText}
                        onChange={(value) => updateHeader('centerText', value)}
                        inputClass={inputClass}
                      />
                    </div>
                    <div className="min-w-0">
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>右侧</label>
                      <DynamicFieldInput
                        label="页眉右侧"
                        section
                        value={theme.header.rightText}
                        onChange={(value) => updateHeader('rightText', value)}
                        inputClass={inputClass}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>页眉分隔线</label>
                      <select
                        value={theme.header.lineStyle}
                        onChange={(e) => updateHeader('lineStyle', e.target.value as HeaderConfig['lineStyle'])}
                        className={`w-full rounded px-2.5 py-1.5 ${inputClass}`}
                      >
                        <option value="solid">单实线 (Solid)</option>
                        <option value="accent">主题高亮线 (Accent)</option>
                        <option value="double">双重公文线 (Double)</option>
                        <option value="none">无分割线</option>
                      </select>
                    </div>
                    <div className="flex items-end pb-1">
                      <label className={`flex items-center gap-1.5 cursor-pointer text-[11px] font-bold ${labelClass}`}>
                        <input
                          type="checkbox"
                          checked={theme.header.hideOnCover}
                          onChange={(e) => updateHeader('hideOnCover', e.target.checked)}
                          className={`rounded text-blue-600 ${isDark ? 'bg-[#181818] border-[#2A2A2A]' : 'bg-white border-slate-300'}`}
                        />
                        <span>封面隐藏页眉</span>
                      </label>
                    </div>
                  </div>

                  <section className="space-y-3 pt-1">
                    <div className={`flex items-center justify-between pb-2 border-b ${sectionBorderClass}`}>
                      <div className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${labelClass}`}>
                        <ImageIcon className="w-4 h-4 text-blue-500" />
                        页眉标志 Logo
                      </div>
                      {theme.header.logoUrl && (
                        <button
                          type="button"
                          onClick={() => updateHeader('logoUrl', '')}
                          className="text-[10px] text-red-500 hover:text-red-600 font-medium flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          清除 Logo
                        </button>
                      )}
                    </div>
                    <div className={`flex items-center gap-3 p-2 rounded border ${subCardBgClass}`}>
                      {theme.header.logoUrl ? (
                        <>
                        <img
                          src={resolveImageSrc(theme.header.logoUrl)}
                          alt="Header Logo Preview"
                          className="h-8 w-auto object-contain bg-slate-100/50 p-1 rounded"
                        />
                        <span className="text-[10px] text-emerald-600 font-bold truncate font-mono">已加载 Logo 图片</span>
                        </>
                      ) : <span className={`text-[10px] ${textMutedClass}`}>未选择图片</span>}
                      <button type="button" onClick={() => model.openImagePicker('header')} className="ml-auto p-2 rounded border border-inherit hover:border-blue-500 hover:text-blue-500" title="从图片库选择页眉 Logo">
                        <ImageIcon className="w-4 h-4" />
                      </button>
                    </div>
                    <div>
                      <input
                        type="text"
                        value={theme.header.logoUrl || ''}
                        onChange={(e) => updateHeader('logoUrl', e.target.value)}
                        placeholder="输入图片 URL 或本地相对路径 (如: ./assets/logo.png)"
                        className={`w-full rounded px-2.5 py-1.5 ${inputClass}`}
                      />
                    </div>
                    {theme.header.logoUrl && (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-1">
                        <div>
                          <div className={`flex justify-between text-[10px] font-bold mb-1 ${labelClass}`}>
                            <span>Logo 高度 (px)</span>
                            <span>{theme.header.logoHeight ?? 20}px</span>
                          </div>
                          <input
                            type="range"
                            min={10}
                            max={70}
                            value={theme.header.logoHeight ?? 20}
                            onChange={(e) => updateHeader('logoHeight', Number(e.target.value))}
                            className="w-full accent-blue-600"
                          />
                        </div>
                        <div>
                          <div className={`flex justify-between text-[10px] font-bold mb-1 ${labelClass}`}>
                            <span>Logo 透明度 (%)</span>
                            <span>{Math.round((theme.header.logoOpacity ?? 1) * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min={10}
                            max={100}
                            value={Math.round((theme.header.logoOpacity ?? 1) * 100)}
                            onChange={(e) => updateHeader('logoOpacity', Math.min(1, Math.max(0, Number(e.target.value) / 100)))}
                            className="w-full accent-blue-600"
                          />
                        </div>
                        <div>
                          <div className={`flex justify-between text-[10px] font-bold mb-1 ${labelClass}`}>
                            <span>左侧文本偏移 (px)</span>
                            <span>{theme.header.leftTextOffset ?? 0}px</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={400}
                            value={theme.header.leftTextOffset ?? 0}
                            onChange={(e) => updateHeader('leftTextOffset', Number(e.target.value))}
                            className="w-full accent-blue-600"
                          />
                        </div>
                        <div>
                          <div className={`flex justify-between text-[10px] font-bold mb-1 ${labelClass}`}>
                            <span>Logo 顶部距离 (px)</span>
                            <span>{theme.header.logoTopOffset ?? 15}px</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={120}
                            value={theme.header.logoTopOffset ?? 15}
                            onChange={(e) => updateHeader('logoTopOffset', Number(e.target.value))}
                            className="w-full accent-blue-600"
                          />
                        </div>
                      </div>
                    )}
                  </section>
                </div>
              )}
            </section>

            {/* Footer & Page Number Settings */}
            <section className="space-y-3">
              <div className={`flex items-center justify-between pb-2 border-b ${sectionBorderClass}`}>
                <span className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${labelClass}`}>
                  <Layout className="w-4 h-4 text-blue-500" />
                  页脚内容与页码
                </span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={theme.footer.show}
                    onChange={(e) => updateFooter('show', e.target.checked)}
                    className={`rounded text-blue-600 ${isDark ? 'bg-[#181818] border-[#2A2A2A]' : 'bg-white border-slate-300'}`}
                  />
                  <span className={`font-bold text-[11px] ${textSubClass}`}>显示页脚</span>
                </label>
              </div>

              {theme.footer.show && (
                <div className="space-y-2.5 pt-1">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="min-w-0">
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>左侧</label>
                      <DynamicFieldInput
                        label="页脚左侧"
                        section
                        value={theme.footer.leftText}
                        onChange={(value) => updateFooter('leftText', value)}
                        inputClass={inputClass}
                      />
                    </div>
                    <div className="min-w-0">
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>中间</label>
                      <DynamicFieldInput
                        label="页脚中间"
                        section
                        value={theme.footer.centerText}
                        onChange={(value) => updateFooter('centerText', value)}
                        inputClass={inputClass}
                      />
                    </div>
                    <div className="min-w-0">
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>右侧</label>
                      <DynamicFieldInput
                        label="页脚右侧"
                        section
                        value={theme.footer.rightText}
                        onChange={(value) => updateFooter('rightText', value)}
                        inputClass={inputClass}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>页码格式</label>
                      <select
                        value={theme.footer.pageNumberFormat}
                        onChange={(e) => updateFooter('pageNumberFormat', e.target.value as FooterConfig['pageNumberFormat'])}
                        className={`w-full rounded px-2.5 py-1.5 ${inputClass}`}
                      >
                        <option value="pageOfTotal">第 X 页 / 共 Y 页</option>
                        <option value="page">第 X 页</option>
                        <option value="hyphen">- X -</option>
                        <option value="simple">X / Y</option>
                        <option value="none">不显示页码 (无)</option>
                      </select>
                    </div>
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>页码位置</label>
                      <select
                        value={theme.footer.pageNumberPosition}
                        onChange={(e) => updateFooter('pageNumberPosition', e.target.value as FooterConfig['pageNumberPosition'])}
                        className={`w-full rounded px-2.5 py-1.5 ${inputClass}`}
                      >
                        <option value="right">右对齐</option>
                        <option value="center">居中对齐</option>
                        <option value="left">左对齐</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-1 flex items-center justify-between border-t border-dashed border-slate-200/50 mt-2">
                    <label className={`flex items-center gap-1.5 cursor-pointer text-[11px] font-bold ${labelClass}`}>
                      <input
                        type="checkbox"
                        checked={theme.footer.hideOnCover !== false}
                        onChange={(e) => updateFooter('hideOnCover', e.target.checked)}
                        className={`rounded text-blue-600 ${isDark ? 'bg-[#181818] border-[#2A2A2A]' : 'bg-white border-slate-300'}`}
                      />
                      <span>封面隐藏页脚</span>
                    </label>
                  </div>
                </div>
              )}
            </section>
          </div>
  </>;
}
