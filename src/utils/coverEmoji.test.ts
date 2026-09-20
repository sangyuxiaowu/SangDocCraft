import { describe, expect, it } from 'vitest';
import { splitLeadingEmoji } from './coverEmoji';

// 该测试是「卡片式封面 emoji 独立成列」功能的回归保护：
describe('splitLeadingEmoji', () => {
  it('拆出 label 开头的 emoji，并去掉紧随的空格', () => {
    expect(splitLeadingEmoji('🎨 设计')).toEqual({ emoji: '🎨', label: '设计' });
  });

  it('emoji 与文字之间没有空格时同样能拆开', () => {
    expect(splitLeadingEmoji('📅发布日期')).toEqual({ emoji: '📅', label: '发布日期' });
  });

  it('保留变体选择符（U+FE0F），避免 emoji 退化成黑白字形', () => {
    expect(splitLeadingEmoji('⚙️ 参数')).toEqual({ emoji: '⚙️', label: '参数' });
  });

  it('保留 ZWJ（U+200D）组合序列，避免组合 emoji 被拆散', () => {
    expect(splitLeadingEmoji('👨‍👩‍👧‍👦 家庭')).toEqual({ emoji: '👨‍👩‍👧‍👦', label: '家庭' });
  });

  it('保留肤色修饰符，避免其残留在 label 中', () => {
    expect(splitLeadingEmoji('👍🏽 审核人')).toEqual({ emoji: '👍🏽', label: '审核人' });
    expect(splitLeadingEmoji('👩🏽‍💻 工程师')).toEqual({ emoji: '👩🏽‍💻', label: '工程师' });
  });

  it('将连续的首 emoji 簇完整保留在 emoji 列中', () => {
    expect(splitLeadingEmoji('🎨❤️ 设计')).toEqual({ emoji: '🎨❤️', label: '设计' });
  });

  it('label 不以 emoji 开头时原样返回', () => {
    expect(splitLeadingEmoji('撰写团队')).toEqual({ emoji: null, label: '撰写团队' });
  });

  it('label 只有 emoji 时剩余文本为空串（调用方不要回退成原 label，否则会重复渲染）', () => {
    expect(splitLeadingEmoji('🎨')).toEqual({ emoji: '🎨', label: '' });
  });

  it('只拆开头，中间的 emoji 保留在 label 内', () => {
    expect(splitLeadingEmoji('团队 🎨 信息')).toEqual({ emoji: null, label: '团队 🎨 信息' });
  });

  it('已知盲点：数字 keycap 与区域指示符旗帜不会被拆出（如需支持请扩展正则并更新这里的期望值）', () => {
    expect(splitLeadingEmoji('1️⃣ 第一章')).toEqual({ emoji: null, label: '1️⃣ 第一章' });
    expect(splitLeadingEmoji('🇨🇳 中国')).toEqual({ emoji: null, label: '🇨🇳 中国' });
  });
});
