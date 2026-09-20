/**
 * 封面元信息（coverlist）「首 emoji 拆分」工具。
 *
 * 匹配 label **开头** 的 emoji 簇。
 *
 * - 捕获组 1：emoji 簇
 *   - `\p{Extended_Pictographic}+` 一个或多个象形文字类码点；
 *   - `(?:\uFE0F|\u200D\p{Extended_Pictographic}+)*` 继续吃掉组合序列：
 *     · `\uFE0F` 变体选择符（如 ⚙️ / ❤️，丢了会退化成黑白字形）；
 *     · `\u200D` ZWJ 连接（如 👨‍👩‍👧‍👦 / 🧑‍💻，丢了会被拆成多个 emoji）。
 * - 捕获组 2：`\s*` 吃掉 emoji 与文字间的空格后，剩余的 label 文本。
 *
 * 【已知盲点】（如需支持请在此扩展并补测试，不要在别处另写一份）
 * - 只识别 label 开头的 emoji，中间的（`团队 🎨`）不拆；
 * - 数字 keycap `1️⃣`（由 U+20E3 组合）与区域指示符旗帜 `🇨🇳`
 *   （属 Regional_Indicator）都不属于 Extended_Pictographic，不会被拆出。
 */
const LEADING_EMOJI_PATTERN = /^(\p{Extended_Pictographic}+(?:\uFE0F|\u200D\p{Extended_Pictographic}+)*)\s*(.*)/u;

export interface LeadingEmojiSplit {
  /** 拆出的 emoji 簇；label 不以 emoji 开头时为 null。 */
  emoji: string | null;
  /** 去掉 emoji 与紧随空格后的 label；无 emoji 时原样返回 label。 */
  label: string;
}

/**
 * 把 label 开头的 emoji 与剩余文本拆开，供卡片式封面渲染。
 *
 * 注意：返回的 label 可能是空串（label 本身只有 emoji），
 * 调用方不要用 `label || 原label` 回退，否则会把 emoji 重复渲染一次。
 */
export function splitLeadingEmoji(label: string): LeadingEmojiSplit {
  const match = label.match(LEADING_EMOJI_PATTERN);
  if (!match) {
    return { emoji: null, label };
  }
  return { emoji: match[1], label: match[2] };
}
