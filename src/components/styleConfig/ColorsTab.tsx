import { Palette, Check, RotateCcw, Info, GitFork } from 'lucide-react';
import { DEFAULT_MERMAID_CUSTOM_COLORS } from '../../utils/mermaidRenderer';
import { PanelTabModel, ColorPickerInput } from './shared';

export function ColorsTab({ model }: { model: Pick<PanelTabModel, 'theme' | 'isDark' | 'sectionBorderClass' | 'labelClass' | 'textMutedClass' | 'textSubClass' | 'subCardBgClass' | 'inputClass' | 'imageConfig' | 'mermaidConfig' | 'updateStyle' | 'updateMermaid' | 'updateCustomColor' | 'onChange'> }) {
  const { theme, isDark, sectionBorderClass, labelClass, textMutedClass, textSubClass, subCardBgClass, inputClass, imageConfig, mermaidConfig, updateStyle, updateMermaid, updateCustomColor } = model;
  return <>
<div className="space-y-4">
            <div className={`pb-2 border-b text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${sectionBorderClass} ${labelClass}`}>
              <Palette className="w-4 h-4 text-blue-500" />
              文档配色设定
            </div>

            {/* Quick Color Presets in Visual Card Grid */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={`block text-[10px] font-bold uppercase tracking-widest ${labelClass}`}>
                  配色方案
                </label>
                <span className={`text-[10px] ${textMutedClass}`}>选择预设主题色彩</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { name: '深蓝商务', primary: '#0f172a', accent: '#2563eb', bg: '#f8fafc' },
                  { name: '科技蔚蓝', primary: '#0369a1', accent: '#0284c7', bg: '#f0f9ff' },
                  { name: '政企朱红', primary: '#881337', accent: '#e11d48', bg: '#fff1f2' },
                  { name: '极简暗黑', primary: '#18181b', accent: '#52525b', bg: '#f4f4f5' },
                  { name: '典雅紫罗兰', primary: '#4c1d95', accent: '#7c3aed', bg: '#f5f3ff' },
                  { name: '生机翡翠', primary: '#064e3b', accent: '#059669', bg: '#ecfdf5' },
                  { name: '暖调琥珀', primary: '#451a03', accent: '#d97706', bg: '#fffbeb' },
                  { name: '静谧黛青', primary: '#134e4a', accent: '#0d9488', bg: '#f0fdfa' },
                  { name: '现代高雅', primary: '#1c1917', accent: '#ea580c', bg: '#fafaf9' },
                ].map((c) => {
                  const isSelected = 
                    theme.style.primaryColor.toLowerCase() === c.primary.toLowerCase() &&
                    theme.style.accentColor.toLowerCase() === c.accent.toLowerCase();
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => {
                        model.onChange({
                          ...theme,
                          style: {
                            ...theme.style,
                            primaryColor: c.primary,
                            accentColor: c.accent,
                          },
                        });
                      }}
                      className={`group flex flex-col p-1.5 rounded-lg text-left transition relative border ${
                        isSelected
                          ? 'border-2 border-blue-500 ring-2 ring-blue-500/30 bg-blue-500/10 shadow-sm'
                          : isDark
                          ? 'border-[#2A2A2A] bg-[#0A0A0A] hover:border-zinc-500'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-2xs'
                      }`}
                    >
                      {/* Selected Check Indicator */}
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center z-10 shadow-sm">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}

                      {/* Mini Preview Box matching attachment screenshot */}
                      <div className="w-full h-12 bg-slate-100 rounded border border-slate-200/80 flex overflow-hidden relative mb-1 select-none">
                        {/* Left Primary Color Bar */}
                        <div className="w-1/3 h-full flex flex-col justify-between p-0.5" style={{ backgroundColor: c.primary }}>
                          <div className="w-full h-1 rounded-xs bg-white/40" />
                          <div className="w-2/3 h-0.5 rounded-xs bg-white/30" />
                        </div>
                        {/* Right Content Area with Accent Bar */}
                        <div className="w-2/3 h-full p-1 flex flex-col justify-between" style={{ backgroundColor: c.bg }}>
                          <div className="w-full h-1.5 rounded-xs" style={{ backgroundColor: c.accent }} />
                          <div className="space-y-0.5">
                            <div className="w-full h-0.5 bg-slate-300 rounded-xs" />
                            <div className="w-3/4 h-0.5 bg-slate-300 rounded-xs" />
                          </div>
                        </div>
                      </div>

                      <span className={`text-[10px] font-bold truncate text-center w-full ${
                        isSelected ? 'text-blue-500 font-extrabold' : textSubClass
                      }`}>
                        {c.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 主色调与辅色调 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>主色调</label>
                <ColorPickerInput
                  value={theme.style.primaryColor}
                  onChange={(val) => updateStyle('primaryColor', val)}
                  inputClass={inputClass}
                />
              </div>

              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>辅色调</label>
                <ColorPickerInput
                  value={theme.style.accentColor}
                  onChange={(val) => updateStyle('accentColor', val)}
                  inputClass={inputClass}
                />
              </div>
            </div>

            {/* 正文文字颜色与图片边框颜色 一行并排 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <label className={`text-[10px] font-bold uppercase tracking-widest ${labelClass}`}>正文文字颜色</label>
                  <div className="relative group inline-flex items-center cursor-help" tabIndex={0} aria-label="正文文字颜色说明">
                    <Info className="w-3.5 h-3.5 text-slate-400 hover:text-blue-500 transition-colors" />
                    <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover:block group-focus:block z-50 w-64 p-2.5 text-[11px] leading-relaxed rounded-md shadow-xl bg-slate-900 text-slate-100 dark:bg-zinc-800 dark:text-zinc-100 border border-slate-700/60 dark:border-zinc-700 pointer-events-none transition-opacity">
                      仅作用于正文内容（段落、列表、表格、引用）的文字颜色，预览、HTML 与 Word 导出同步生效；各级标题颜色由主色调控制，页眉页脚使用固定灰阶，均不跟随此项。
                    </div>
                  </div>
                </div>
                <ColorPickerInput
                  value={theme.style.textColor}
                  onChange={(val) => updateStyle('textColor', val)}
                  inputClass={inputClass}
                />
              </div>

              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <label className={`text-[10px] font-bold uppercase tracking-widest ${labelClass}`}>图片边框颜色</label>
                  <div className="relative group inline-flex items-center cursor-help" tabIndex={0} aria-label="图片边框颜色说明">
                    <Info className="w-3.5 h-3.5 text-slate-400 hover:text-blue-500 transition-colors" />
                    <div className="absolute right-0 bottom-full mb-1.5 hidden group-hover:block group-focus:block z-50 w-56 p-2.5 text-[11px] leading-relaxed rounded-md shadow-xl bg-slate-900 text-slate-100 dark:bg-zinc-800 dark:text-zinc-100 border border-slate-700/60 dark:border-zinc-700 pointer-events-none transition-opacity">
                      仅作用于「单实线 / 精致微阴影 / 浅色卡片 / 大圆边框」图片样式。
                    </div>
                  </div>
                </div>
                <ColorPickerInput
                  value={theme.style.imageConfig?.borderColor || '#cbd5e1'}
                  onChange={(val) => updateStyle('imageConfig', { ...imageConfig, borderColor: val })}
                  inputClass={inputClass}
                />
              </div>
            </div>

            {/* Mermaid 配色设置 */}
            <div className={`pt-3.5 border-t space-y-3 ${sectionBorderClass}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <GitFork className="w-4 h-4 text-blue-500" />
                  <label className={`text-[10px] font-bold uppercase tracking-widest ${labelClass}`}>
                    Mermaid 图表配色
                  </label>
                  <div className="relative group inline-flex items-center cursor-help" tabIndex={0} aria-label="Mermaid图表配色说明">
                    <Info className="w-3.5 h-3.5 text-slate-400 hover:text-blue-500 transition-colors" />
                    <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover:block group-focus:block z-50 w-64 p-2.5 text-[11px] leading-relaxed rounded-md shadow-xl bg-slate-900 text-slate-100 dark:bg-zinc-800 dark:text-zinc-100 border border-slate-700/60 dark:border-zinc-700 pointer-events-none transition-opacity">
                      设定文档内所有 Mermaid 流程图、时序图与架构图的默认配色风格。单张图表亦可在代码围栏中自定义（例如：```mermaid &#123;theme=dark&#125;）。
                    </div>
                  </div>
                </div>
                <span className={`text-[10px] ${textMutedClass}`}>全局图表主题</span>
              </div>

              {/* 主题选择器：3个一行 */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'neutral' as const, name: '标准中性', badge: '默认推荐', dot: '#64748b' },
                  { key: 'default' as const, name: '淡紫雾蓝', badge: '浅雾默认', dot: '#ececff' },
                  { key: 'dark' as const, name: '暗夜墨蓝', badge: '夜间深色', dot: '#0f172a' },
                  { key: 'forest' as const, name: '嫩芽浅绿', badge: '自然清新', dot: '#cde498' },
                  { key: 'base' as const, name: '奶油米白', badge: '暖米基础', dot: '#fff4dd' },
                  { key: 'custom' as const, name: '自定义配色', badge: '自选主辅色', dot: mermaidConfig.customColors?.primaryColor || '#8b5cf6' },
                ].map((item) => {
                  const isSelected = mermaidConfig.theme === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => updateMermaid({ theme: item.key })}
                      aria-pressed={isSelected}
                      className={`p-2 rounded-lg border text-left flex items-center gap-1.5 transition-all relative ${
                        isSelected
                          ? 'border-2 border-blue-500 ring-2 ring-blue-500/30 bg-blue-500/10 shadow-sm'
                          : `${subCardBgClass} hover:border-slate-400 dark:hover:border-zinc-600`
                      }`}
                    >
                      {isSelected && (
                        <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center z-10 shadow-sm">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                      )}
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/15 dark:border-white/15 shadow-xs"
                        style={{ backgroundColor: item.dot }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold leading-tight truncate">{item.name}</div>
                        <div className={`text-[10px] ${textMutedClass} leading-tight mt-0.5 truncate`}>{item.badge}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* 当选择自定义 custom 时，展示详细颜色修改项 */}
              {mermaidConfig.theme === 'custom' && (
                <div className={`p-3 rounded-lg border space-y-3 ${subCardBgClass} ${sectionBorderClass}`}>
                  <div className="flex items-center justify-between pb-1 border-b border-slate-200/60 dark:border-zinc-700/60">
                    <span className={`text-[11px] font-bold ${textSubClass}`}>自定义图表色彩</span>
                    <button
                      type="button"
                      onClick={() => updateMermaid({ customColors: { ...DEFAULT_MERMAID_CUSTOM_COLORS } })}
                      className="text-[10px] text-blue-500 hover:text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      恢复默认
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>主节点背景</label>
                      <ColorPickerInput
                        value={mermaidConfig.customColors?.primaryColor || DEFAULT_MERMAID_CUSTOM_COLORS.primaryColor}
                        onChange={(val) => updateCustomColor('primaryColor', val)}
                        inputClass={inputClass}
                      />
                    </div>

                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>主节点文字</label>
                      <ColorPickerInput
                        value={mermaidConfig.customColors?.primaryTextColor || DEFAULT_MERMAID_CUSTOM_COLORS.primaryTextColor}
                        onChange={(val) => updateCustomColor('primaryTextColor', val)}
                        inputClass={inputClass}
                      />
                    </div>

                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>节点边框</label>
                      <ColorPickerInput
                        value={mermaidConfig.customColors?.primaryBorderColor || DEFAULT_MERMAID_CUSTOM_COLORS.primaryBorderColor}
                        onChange={(val) => updateCustomColor('primaryBorderColor', val)}
                        inputClass={inputClass}
                      />
                    </div>

                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>连线与箭头</label>
                      <ColorPickerInput
                        value={mermaidConfig.customColors?.lineColor || DEFAULT_MERMAID_CUSTOM_COLORS.lineColor}
                        onChange={(val) => updateCustomColor('lineColor', val)}
                        inputClass={inputClass}
                      />
                    </div>

                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>次级节点背景</label>
                      <ColorPickerInput
                        value={mermaidConfig.customColors?.secondaryColor || DEFAULT_MERMAID_CUSTOM_COLORS.secondaryColor || '#f1f5f9'}
                        onChange={(val) => updateCustomColor('secondaryColor', val)}
                        inputClass={inputClass}
                      />
                    </div>

                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>图表底板背景</label>
                      <ColorPickerInput
                        value={mermaidConfig.customColors?.background || DEFAULT_MERMAID_CUSTOM_COLORS.background || '#ffffff'}
                        onChange={(val) => updateCustomColor('background', val)}
                        inputClass={inputClass}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
  </>;
}
