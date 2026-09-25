import { Layout, Settings2, RotateCcw, Image as ImageIcon, Stamp } from 'lucide-react';
import { StyleConfig, ImageStyleConfig, TableCaptionConfig } from '../../types';
import { resolveImageSrc } from '../../utils/tauriHelper';
import { DEFAULT_WATERMARK_CONFIG, WATERMARK_TEXT_PRESETS, WATERMARK_COLOR_PRESETS } from '../../utils/watermark';
import { PanelTabModel } from './shared';

export function OtherTab({ model }: { model: Pick<PanelTabModel, 'theme' | 'isDark' | 'sectionBorderClass' | 'labelClass' | 'textMainClass' | 'textMutedClass' | 'textSubClass' | 'cardBgClass' | 'subCardBgClass' | 'inputClass' | 'tabInactiveClass' | 'imageConfig' | 'tableCaptionConfig' | 'currentWatermark' | 'updateStyle' | 'updateWatermark' | 'openImagePicker'> }) {
  const { theme, isDark, sectionBorderClass, labelClass, textMainClass, textMutedClass, textSubClass, cardBgClass, subCardBgClass, inputClass, tabInactiveClass, imageConfig, tableCaptionConfig, currentWatermark, updateStyle, updateWatermark } = model;
  return <div className="space-y-4"><div className="space-y-3">
<section className="space-y-3">
                <div className={`flex items-center gap-1.5 pb-2 border-b ${sectionBorderClass}`}>
                  <Settings2 className="w-4 h-4 text-blue-500" />
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${labelClass}`}>内容与分页</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${labelClass}`}>分页方式</span>
                  <div role="group" aria-label="分页模式" className={`grid w-52 grid-cols-2 gap-1 rounded border p-1 ${sectionBorderClass}`}>
                    {(['auto', 'manual'] as const).map(mode => (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={(theme.style.paginationMode || 'auto') === mode}
                        onClick={() => updateStyle('paginationMode', mode)}
                        title={mode === 'manual' ? '<!-- pagebreak -->' : '自动分页'}
                        className={`rounded px-2 py-1.5 ${(theme.style.paginationMode || 'auto') === mode ? 'bg-blue-600 text-white' : tabInactiveClass}`}
                      >
                        {mode === 'auto' ? '自动分页' : '手动分页'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  <div className="min-w-0">
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>列表图标</label>
                    <select value={theme.style.bulletStyle} onChange={(e) => updateStyle('bulletStyle', e.target.value as StyleConfig['bulletStyle'])} className={`w-full min-w-0 rounded px-1.5 py-1.5 ${inputClass}`}>
                      <option value="square">方块 ■</option>
                      <option value="dot">圆点 •</option>
                      <option value="checkmark">对勾 ✓</option>
                      <option value="arrow">箭头 ▸</option>
                    </select>
                  </div>
                  <div className="min-w-0">
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>编号样式</label>
                    <select value={theme.style.numberStyle} onChange={(e) => updateStyle('numberStyle', e.target.value as StyleConfig['numberStyle'])} title="有序列表的编号样式" className={`w-full min-w-0 rounded px-1.5 py-1.5 ${inputClass}`}>
                      <option value="decimal">1. 2. 3.</option>
                      <option value="paren">(1) (2)</option>
                      <option value="chinese">一、二、</option>
                    </select>
                  </div>
                  <div className="min-w-0">
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>代码主题</label>
                    <select value={theme.style.codeTheme} onChange={(e) => updateStyle('codeTheme', e.target.value as StyleConfig['codeTheme'])} className={`w-full min-w-0 rounded px-1.5 py-1.5 ${inputClass}`}>
                      <option value="dark">深色</option>
                      <option value="light">浅色</option>
                    </select>
                  </div>
                  <div className="min-w-0">
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>表格样式</label>
                    <select value={theme.style.tableStyle} onChange={(e) => updateStyle('tableStyle', e.target.value as StyleConfig['tableStyle'])} className={`w-full min-w-0 rounded px-1.5 py-1.5 ${inputClass}`}>
                      <option value="striped">斑马纹</option>
                      <option value="bordered">全边框</option>
                      <option value="minimal">极简</option>
                    </select>
                  </div>
                </div>
              </section>
<>
              {/* 图片边框与题注配置 */}
              <section className="space-y-3 pt-1">
                <div className={`flex items-center gap-1.5 pb-2 border-b ${sectionBorderClass}`}>
                  <ImageIcon className="w-4 h-4 text-blue-500" />
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${labelClass}`}>图片与题注</span>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <div className="min-w-0">
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>图片边框样式</label>
                    <select
                      value={theme.style.imageConfig?.borderStyle || 'subtle'}
                      onChange={(e) => updateStyle('imageConfig', { ...imageConfig, borderStyle: e.target.value as ImageStyleConfig['borderStyle'] })}
                      title="图片边框样式，边框颜色在「配色」标签页设置"
                      className={`w-full min-w-0 rounded px-1.5 py-1.5 ${inputClass}`}
                    >
                      <option value="none">无边框</option>
                      <option value="subtle">微阴影</option>
                      <option value="solid">单实线</option>
                      <option value="shadow">深阴影</option>
                      <option value="card">卡片衬底</option>
                      <option value="rounded">大圆角</option>
                    </select>
                  </div>

                  <div className="min-w-0">
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>编号前缀</label>
                    <input
                      type="text"
                      value={theme.style.imageConfig?.numberPrefix ?? '图 '}
                      onChange={(e) => updateStyle('imageConfig', { ...imageConfig, numberPrefix: e.target.value })}
                      className={`w-full min-w-0 rounded px-1.5 py-1.5 ${inputClass}`}
                      placeholder="如图 "
                    />
                  </div>

                  <div className="min-w-0">
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>题注对齐</label>
                    <select
                      value={theme.style.imageConfig?.captionAlign || 'center'}
                      onChange={(e) => updateStyle('imageConfig', { ...imageConfig, captionAlign: e.target.value as ImageStyleConfig['captionAlign'] })}
                      className={`w-full min-w-0 rounded px-1.5 py-1.5 ${inputClass}`}
                    >
                      <option value="center">居中</option>
                      <option value="left">左对齐</option>
                      <option value="right">右对齐</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-1">
                  <label className={`flex items-center gap-1.5 cursor-pointer text-[11px] font-bold ${labelClass}`}>
                    <input
                      type="checkbox"
                      checked={theme.style.imageConfig?.showCaption !== false}
                      onChange={(e) => updateStyle('imageConfig', { ...imageConfig, showCaption: e.target.checked })}
                      className={`rounded text-blue-600 ${isDark ? 'bg-[#181818] border-[#2A2A2A]' : 'bg-white border-slate-300'}`}
                    />
                    <span>显示题注</span>
                  </label>

                  <label className={`flex items-center gap-1.5 cursor-pointer text-[11px] font-bold ${labelClass}`}>
                    <input
                      type="checkbox"
                      checked={theme.style.imageConfig?.autoNumber !== false}
                      onChange={(e) => updateStyle('imageConfig', { ...imageConfig, autoNumber: e.target.checked })}
                      className={`rounded text-blue-600 ${isDark ? 'bg-[#181818] border-[#2A2A2A]' : 'bg-white border-slate-300'}`}
                    />
                    <span>自动编号</span>
                  </label>
                </div>
              </section>

              {/* 表格题注配置 */}
              <section className="space-y-3 pt-1">
                <div className={`flex items-center gap-1.5 pb-2 border-b ${sectionBorderClass}`}>
                  <Layout className="w-4 h-4 text-blue-500" />
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${labelClass}`}>表格题注</span>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <div className="min-w-0">
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>题注位置</label>
                    <select
                      value={theme.style.tableCaptionConfig?.captionPosition || 'top'}
                      onChange={(e) => updateStyle('tableCaptionConfig', { ...tableCaptionConfig, captionPosition: e.target.value as TableCaptionConfig['captionPosition'] })}
                      className={`w-full min-w-0 rounded px-1.5 py-1.5 ${inputClass}`}
                    >
                      <option value="top">表格上方</option>
                      <option value="bottom">表格下方</option>
                    </select>
                  </div>

                  <div className="min-w-0">
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>编号前缀</label>
                    <input
                      type="text"
                      value={theme.style.tableCaptionConfig?.numberPrefix ?? '表 '}
                      onChange={(e) => updateStyle('tableCaptionConfig', { ...tableCaptionConfig, numberPrefix: e.target.value })}
                      className={`w-full min-w-0 rounded px-1.5 py-1.5 ${inputClass}`}
                      placeholder="如表 "
                    />
                  </div>

                  <div className="min-w-0">
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>题注对齐</label>
                    <select
                      value={theme.style.tableCaptionConfig?.captionAlign || 'center'}
                      onChange={(e) => updateStyle('tableCaptionConfig', { ...tableCaptionConfig, captionAlign: e.target.value as TableCaptionConfig['captionAlign'] })}
                      className={`w-full min-w-0 rounded px-1.5 py-1.5 ${inputClass}`}
                    >
                      <option value="center">居中</option>
                      <option value="left">左对齐</option>
                      <option value="right">右对齐</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-1">
                  <label className={`flex items-center gap-1.5 cursor-pointer text-[11px] font-bold ${labelClass}`}>
                    <input
                      type="checkbox"
                      checked={theme.style.tableCaptionConfig?.showCaption !== false}
                      onChange={(e) => updateStyle('tableCaptionConfig', { ...tableCaptionConfig, showCaption: e.target.checked })}
                      className={`rounded text-blue-600 ${isDark ? 'bg-[#181818] border-[#2A2A2A]' : 'bg-white border-slate-300'}`}
                    />
                    <span>显示题注</span>
                  </label>

                  <label className={`flex items-center gap-1.5 cursor-pointer text-[11px] font-bold ${labelClass}`}>
                    <input
                      type="checkbox"
                      checked={theme.style.tableCaptionConfig?.autoNumber !== false}
                      onChange={(e) => updateStyle('tableCaptionConfig', { ...tableCaptionConfig, autoNumber: e.target.checked })}
                      className={`rounded text-blue-600 ${isDark ? 'bg-[#181818] border-[#2A2A2A]' : 'bg-white border-slate-300'}`}
                    />
                    <span>自动编号</span>
                  </label>
                </div>
              </section>

              {/* 文档水印配置 */}
              <section className="space-y-3 pt-1">
                <div className={`flex items-center justify-between pb-2 border-b ${sectionBorderClass}`}>
                  <div className="flex items-center gap-1.5">
                    <Stamp className="w-4 h-4 text-blue-500" />
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${labelClass}`}>文档水印</span>
                  </div>
                  <label className={`flex items-center gap-1.5 cursor-pointer text-[11px] font-bold ${currentWatermark.show ? 'text-blue-500' : labelClass}`}>
                    <input
                      type="checkbox"
                      checked={currentWatermark.show}
                      onChange={(e) => updateWatermark('show', e.target.checked)}
                      className={`rounded text-blue-600 ${isDark ? 'bg-[#181818] border-[#2A2A2A]' : 'bg-white border-slate-300'}`}
                    />
                    <span>{currentWatermark.show ? '已开启' : '未开启'}</span>
                  </label>
                </div>

                {!currentWatermark.show ? (
                  <div className={`rounded border p-3 text-center ${cardBgClass}`}>
                    <p className={`text-xs ${textMutedClass}`}>开启后可在页面中叠加背景水印
                      <br />支持文本或图片，预览与导出 PDF 同步生效，不支持 Word</p>
                    <button
                      type="button"
                      onClick={() => updateWatermark('show', true)}
                      className="mt-2.5 inline-flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition"
                    >
                      <Stamp className="w-3.5 h-3.5" />
                      <span>启用水印</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* 水印类型切换 */}
                    <div>
                      <span className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>水印类型</span>
                      <div role="group" aria-label="水印类型" className={`grid grid-cols-2 gap-1 rounded border p-1 ${sectionBorderClass}`}>
                        <button
                          type="button"
                          aria-pressed={currentWatermark.type === 'text'}
                          onClick={() => updateWatermark('type', 'text')}
                          className={`rounded px-2 py-1.5 text-xs font-medium transition ${currentWatermark.type === 'text' ? 'bg-blue-600 text-white' : tabInactiveClass}`}
                        >
                          文本水印
                        </button>
                        <button
                          type="button"
                          aria-pressed={currentWatermark.type === 'image'}
                          onClick={() => updateWatermark('type', 'image')}
                          className={`rounded px-2 py-1.5 text-xs font-medium transition ${currentWatermark.type === 'image' ? 'bg-blue-600 text-white' : tabInactiveClass}`}
                        >
                          图片水印
                        </button>
                      </div>
                    </div>

                    {/* 文本水印参数 */}
                    {currentWatermark.type === 'text' && (
                      <div className="space-y-2.5">
                        <div>
                          <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>水印文本</label>
                          <input
                            type="text"
                            value={currentWatermark.text}
                            onChange={(e) => updateWatermark('text', e.target.value)}
                            placeholder="如: 内部资料 请勿外传"
                            className={`w-full rounded px-2.5 py-1.5 text-xs ${inputClass}`}
                          />
                        </div>

                        {/* 快捷预设短语 */}
                        <div>
                          <span className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${textMutedClass}`}>快捷预设文本</span>
                          <div className="flex flex-wrap gap-1">
                            {WATERMARK_TEXT_PRESETS.map((presetText) => {
                              const isSelected = currentWatermark.text === presetText;
                              return (
                                <button
                                  key={presetText}
                                  type="button"
                                  onClick={() => updateWatermark('text', presetText)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-medium border transition ${
                                    isSelected
                                      ? 'bg-blue-600 text-white border-blue-500 shadow-2xs'
                                      : `${subCardBgClass} ${textMutedClass} hover:${textMainClass}`
                                  }`}
                                >
                                  {presetText}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 字号与颜色 */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <label className={`text-[10px] font-bold uppercase tracking-widest ${labelClass}`}>字号 ({currentWatermark.fontSize}px)</label>
                            </div>
                            <input
                              type="range"
                              min={14}
                              max={64}
                              step={1}
                              value={currentWatermark.fontSize}
                              onChange={(e) => updateWatermark('fontSize', Number(e.target.value))}
                              className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                          </div>

                          <div>
                            <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>水印颜色</label>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="color"
                                value={currentWatermark.color}
                                onChange={(e) => updateWatermark('color', e.target.value)}
                                className="w-7 h-7 rounded border border-gray-600 bg-transparent cursor-pointer shrink-0"
                              />
                              <input
                                type="text"
                                value={currentWatermark.color}
                                onChange={(e) => updateWatermark('color', e.target.value)}
                                className={`w-full rounded px-2 py-1 text-xs font-mono uppercase ${inputClass}`}
                              />
                            </div>
                          </div>
                        </div>

                        {/* 常用色彩推荐 */}
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] ${textMutedClass}`}>推荐色:</span>
                          {WATERMARK_COLOR_PRESETS.map((preset) => (
                            <button
                              key={preset.value}
                              type="button"
                              title={preset.label}
                              onClick={() => updateWatermark('color', preset.value)}
                              className={`w-4 h-4 rounded-full border transition-transform ${
                                currentWatermark.color.toLowerCase() === preset.value.toLowerCase()
                                  ? 'scale-125 ring-2 ring-blue-500'
                                  : 'hover:scale-110'
                              }`}
                              style={{ backgroundColor: preset.value, borderColor: isDark ? '#444' : '#cbd5e1' }}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 图片水印参数 */}
                    {currentWatermark.type === 'image' && (
                      <div className="space-y-2.5">
                        <div>
                          <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>水印图片</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={currentWatermark.imageUrl || ''}
                              onChange={(e) => updateWatermark('imageUrl', e.target.value)}
                              placeholder="支持 asset://... 或网络图片链接"
                              className={`w-full rounded px-2.5 py-1.5 text-xs ${inputClass}`}
                            />
                            <button
                              type="button"
                              onClick={() => model.openImagePicker('watermark')}
                              className="shrink-0 rounded bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition"
                            >
                              素材库
                            </button>
                          </div>
                        </div>

                        {currentWatermark.imageUrl && (
                          <div className={`flex items-center justify-between p-2 rounded border ${cardBgClass}`}>
                            <div className="flex items-center gap-2 min-w-0">
                              <img
                                src={resolveImageSrc(currentWatermark.imageUrl)}
                                alt="Watermark Preview"
                                className="w-9 h-9 object-contain rounded border border-gray-700 bg-white/5"
                              />
                              <span className={`text-[11px] truncate ${textSubClass}`}>{currentWatermark.imageUrl}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => updateWatermark('imageUrl', '')}
                              className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
                            >
                              移除
                            </button>
                          </div>
                        )}

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className={`text-[10px] font-bold uppercase tracking-widest ${labelClass}`}>图片宽度 ({currentWatermark.imageWidth || 120}px)</label>
                          </div>
                          <input
                            type="range"
                            min={40}
                            max={280}
                            step={5}
                            value={currentWatermark.imageWidth || 120}
                            onChange={(e) => updateWatermark('imageWidth', Number(e.target.value))}
                            className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                        </div>
                      </div>
                    )}

                    {/* 排布方式 */}
                    <div>
                      <span className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>水印排布方式</span>
                      <div role="group" aria-label="水印排布方式" className={`grid grid-cols-2 gap-1 rounded border p-1 ${sectionBorderClass}`}>
                        <button
                          type="button"
                          aria-pressed={currentWatermark.layout === 'repeat'}
                          onClick={() => updateWatermark('layout', 'repeat')}
                          className={`rounded px-2 py-1.5 text-xs font-medium transition ${currentWatermark.layout === 'repeat' ? 'bg-blue-600 text-white' : tabInactiveClass}`}
                        >
                          全页平铺 (网格重复)
                        </button>
                        <button
                          type="button"
                          aria-pressed={currentWatermark.layout === 'single'}
                          onClick={() => updateWatermark('layout', 'single')}
                          className={`rounded px-2 py-1.5 text-xs font-medium transition ${currentWatermark.layout === 'single' ? 'bg-blue-600 text-white' : tabInactiveClass}`}
                        >
                          页面居中 (单个大标)
                        </button>
                      </div>
                    </div>

                    {/* 旋转角度与快速角度按钮组 */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className={`text-[10px] font-bold uppercase tracking-widest ${labelClass}`}>
                            旋转角度 ({currentWatermark.rotate}°)
                          </label>
                        </div>
                        <div className="flex items-center h-6">
                          <input
                            type="range"
                            min={-90}
                            max={90}
                            step={5}
                            value={currentWatermark.rotate}
                            onChange={(e) => updateWatermark('rotate', Number(e.target.value))}
                            className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${labelClass}`}>
                            快速角度
                          </span>
                        </div>
                        <div role="group" aria-label="快速角度预设" className={`inline-flex w-full h-6 rounded border overflow-hidden ${sectionBorderClass}`}>
                          {[-45, -30, 0, 30, 45].map((ang, idx) => (
                            <button
                              key={ang}
                              type="button"
                              onClick={() => updateWatermark('rotate', ang)}
                              className={`flex-1 flex items-center justify-center font-mono text-[10px] transition ${
                                idx > 0 ? (isDark ? 'border-l border-[#2A2A2A]' : 'border-l border-slate-200') : ''
                              } ${
                                currentWatermark.rotate === ang
                                  ? 'bg-blue-600 text-white font-bold'
                                  : `${subCardBgClass} ${textMutedClass} hover:${textMainClass}`
                              }`}
                            >
                              {ang}°
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* 平铺间距与不透明度 */}
                    <div className={currentWatermark.layout === 'repeat' ? 'grid grid-cols-2 gap-2' : ''}>
                      {currentWatermark.layout === 'repeat' && (
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className={`text-[10px] font-bold uppercase tracking-widest ${labelClass}`}>
                              平铺间距 ({currentWatermark.repeatGap}px)
                            </label>
                          </div>
                          <div className="flex items-center h-6">
                            <input
                              type="range"
                              min={70}
                              max={260}
                              step={5}
                              value={currentWatermark.repeatGap}
                              onChange={(e) => updateWatermark('repeatGap', Number(e.target.value))}
                              className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className={`text-[10px] font-bold uppercase tracking-widest ${labelClass}`}>
                            不透明度 ({Math.round(currentWatermark.opacity * 100)}%)
                          </label>
                        </div>
                        <div className="flex items-center h-6">
                          <input
                            type="range"
                            min={0.03}
                            max={0.7}
                            step={0.01}
                            value={currentWatermark.opacity}
                            onChange={(e) => updateWatermark('opacity', Number(e.target.value))}
                            className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 页面应用规则 */}
                    <div className="pt-1">
                      <label className={`flex items-center gap-1.5 cursor-pointer text-[11px] font-bold ${labelClass}`}>
                        <input
                          type="checkbox"
                          checked={currentWatermark.hideOnCover !== false}
                          onChange={(e) => updateWatermark('hideOnCover', e.target.checked)}
                          className={`rounded text-blue-600 ${isDark ? 'bg-[#181818] border-[#2A2A2A]' : 'bg-white border-slate-300'}`}
                        />
                        <span>封面页不显示水印</span>
                      </label>
                    </div>

                    {/* 效果微缩预览 */}
                    <div className="pt-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${labelClass}`}>微缩预览</span>
                        <button
                          type="button"
                          onClick={() => updateStyle('watermark', { ...DEFAULT_WATERMARK_CONFIG, show: true })}
                          className={`text-[10px] flex items-center gap-1 ${textMutedClass} hover:text-blue-500`}
                          title="恢复默认参数"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>恢复默认</span>
                        </button>
                      </div>

                      <div className={`w-full h-20 rounded border relative overflow-hidden flex items-center justify-center select-none ${isDark ? 'bg-[#181818] border-[#2A2A2A]' : 'bg-slate-100 border-slate-300'}`}>
                        {currentWatermark.layout === 'single' ? (
                          <div
                            style={{
                              transform: `rotate(${currentWatermark.rotate}deg)`,
                              opacity: currentWatermark.opacity,
                            }}
                          >
                            {currentWatermark.type === 'image' && currentWatermark.imageUrl ? (
                              <img
                                src={resolveImageSrc(currentWatermark.imageUrl)}
                                alt=""
                                className="h-10 w-auto object-contain"
                              />
                            ) : (
                              <span
                                style={{
                                  color: currentWatermark.color,
                                  fontSize: `${Math.max(14, Math.round(currentWatermark.fontSize * 0.7))}px`,
                                  fontWeight: 700,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {currentWatermark.text || '内部资料'}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div
                            className="absolute inset-0 flex items-center justify-center"
                            style={{
                              transform: `rotate(${currentWatermark.rotate}deg)`,
                              opacity: currentWatermark.opacity,
                            }}
                          >
                            {currentWatermark.type === 'image' && currentWatermark.imageUrl ? (
                              <img
                                src={resolveImageSrc(currentWatermark.imageUrl)}
                                alt=""
                                className="h-9 w-auto object-contain"
                              />
                            ) : (
                              <div className="flex flex-col items-center gap-2">
                                <span
                                  style={{
                                    color: currentWatermark.color,
                                    fontSize: `${Math.max(12, Math.round(currentWatermark.fontSize * 0.55))}px`,
                                    fontWeight: 700,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {currentWatermark.text || '内部资料'}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </section>
              </>
  </div></div>;
}
