import { AiToolDefinition } from '../types/ai';
import {
  FOOTER_FIELDS,
  HEADER_FIELDS,
  HEADING_FONT_FIELDS,
  IMAGE_CONFIG_FIELDS,
  MERMAID_COLOR_FIELDS,
  MERMAID_FIELDS,
  META_FIELDS,
  STYLE_FIELDS,
  TABLE_CAPTION_FIELDS,
  TOC_FIELDS,
  TOC_LEVEL_FONT_FIELDS,
  WATERMARK_FIELDS,
  type FieldConstraint,
  type ScalarFieldSpec,
  type SubFieldSpecs
} from './aiToolFieldSpecs';

/** 由字段规格表生成单个属性的 JSON Schema，避免 schema 与写入/校验逻辑各维护一份清单 */
function describeField(constraint: FieldConstraint, description?: string): Record<string, unknown> {
  const property: Record<string, unknown> = {};
  if (constraint.kind === 'enum') {
    property.type = typeof constraint.values?.[0] === 'number' ? 'number' : 'string';
    property.enum = [...(constraint.values ?? [])];
  } else {
    property.type = constraint.kind;
    if (constraint.pattern) property.pattern = constraint.pattern;
    if (constraint.min !== undefined) property.minimum = constraint.min;
    if (constraint.max !== undefined) property.maximum = constraint.max;
  }
  if (description) property.description = description;
  return property;
}

function buildProperties(specs: readonly ScalarFieldSpec[]): Record<string, unknown> {
  return Object.fromEntries(specs.map(spec => [spec.argument, describeField(spec, spec.description)]));
}

function buildSubProperties(specs: SubFieldSpecs): Record<string, unknown> {
  return Object.fromEntries(Object.entries(specs).map(([key, spec]) => [key, describeField(spec, spec.description)]));
}

/** AI 工具名，同时作为 AI_TOOL_DEFINITIONS 的键 */
export type AiToolName =
  | 'get_document_config'
  | 'get_document_summary'
  | 'get_image_library'
  | 'get_markdown_content'
  | 'edit_markdown_content'
  | 'replace_markdown_section'
  | 'update_document_meta'
  | 'update_document_style'
  | 'update_header_footer_config'
  | 'update_toc_config';

/**
 * AI 工具的静态定义（JSON Schema）。
 *
 * 这些定义不依赖任何运行时状态，在模块加载时构建一次后被所有请求共享，
 * 避免每次 buildAiTools 都重建整套 schema；新增或调整字段只需改这里。
 */
export const AI_TOOL_DEFINITIONS: Record<AiToolName, AiToolDefinition> = {
  get_document_config: {
    type: 'function',
    function: {
      name: 'get_document_config',
      description: '获取当前交付文档的配置信息。可按类型读取文档元数据、封面、页眉、页脚、目录、配色、排版样式、Mermaid 图表或水印；省略 types 或提供 all 时返回全部配置。',
      parameters: {
        type: 'object',
        properties: {
          types: {
            type: 'array',
            description: '要获取的配置类型。可选 meta、cover、header、footer、toc、color、style、mermaid、watermark；传入 all 或不传时返回全部配置。',
            items: {
              type: 'string',
              enum: ['all', 'meta', 'cover', 'header', 'footer', 'toc', 'color', 'style', 'mermaid', 'watermark']
            },
            minItems: 1
          }
        }
      }
    }
  },
  get_document_summary: {
    type: 'function',
    function: {
      name: 'get_document_summary',
      description: '获取当前正文统计长度、总行数、历史记录开关、章节大纲和文档元数据，用于在正文修改完成后快速确认最新文档结构。',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  get_image_library: {
    type: 'function',
    function: {
      name: 'get_image_library',
      description: '获取当前文档图片及永久图片库的图片信息和可用于 Markdown 的引用，不返回图片二进制内容。',
      parameters: {
        type: 'object',
        properties: {
          scope: {
            type: 'string',
            enum: ['all', 'document', 'library'],
            description: '图片作用域，默认 all；document 为当前文档图片，library 为永久图片库。'
          }
        }
      }
    }
  },
  get_markdown_content: {
    type: 'function',
    function: {
      name: 'get_markdown_content',
      description: '获取 Markdown 正文。可读取全文、指定 1-based 行区间，或按标题读取完整章节。heading 与 offset/limit 不可同时使用。',
      parameters: {
        type: 'object',
        properties: {
          offset: { type: 'integer', minimum: 1, description: '起始行，1-based，默认 1。' },
          limit: { type: 'integer', minimum: 1, description: '读取行数，缺省时读到末尾。' },
          heading: { type: 'string', description: '标题文本，读取该标题及其下属内容，直到下一个同级或更高级标题。' },
          includeLineNumbers: { type: 'boolean', description: '是否在每行内容前添加物理行号。' }
        }
      }
    }
  },
  edit_markdown_content: {
    type: 'function',
    function: {
      name: 'edit_markdown_content',
      description: '原子批量编辑 Markdown 正文，一次调用只触发一次审查。所有 replace 区间都基于批次开始时的原文行号且不可重叠；append 在 replace 完成后按 operations 顺序追加；full 只能单独使用。同一批 toolCalls 仅允许调用一次本工具。仅用于大段重写，零散文本替换请优先用 replace_markdown_section。',
      parameters: {
        type: 'object',
        properties: {
          operations: {
            type: 'array',
            minItems: 1,
            description: '要原子执行的编辑操作。replace 区间均以批次开始前的原文为基准。',
            items: {
              type: 'object',
              properties: {
                op: {
                  type: 'string',
                  enum: ['append', 'replace', 'full'],
                  description: '编辑操作。'
                },
                content: {
                  type: 'string',
                  description: '要追加、替换或作为全文写入的 Markdown 内容。'
                },
                range: {
                  type: 'object',
                  description: 'replace 操作必填的 1-based 闭区间。',
                  properties: {
                    startLine: { type: 'integer', minimum: 1 },
                    endLine: { type: 'integer', minimum: 1 }
                  },
                  required: ['startLine', 'endLine']
                }
              },
              required: ['op', 'content']
            }
          },
          description: {
            type: 'string',
            description: '本次正文修改的简要描述，例如“润色第一章并补充技术指标表格题注”。'
          }
        },
        required: ['operations']
      }
    }
  },
  replace_markdown_section: {
    type: 'function',
    function: {
      name: 'replace_markdown_section',
      description: '精确替换 Markdown 正文片段：默认要求 oldText 唯一（匹配多处时报错并给出候选位置），需要全局替换时显式设置 replaceAll=true；useRegex=true 时 oldText 按正则处理。零散文本改动优先用本工具，大段重写才用 edit_markdown_content。',
      parameters: {
        type: 'object',
        properties: {
          oldText: { type: 'string', minLength: 1, description: '要匹配的原始文本；useRegex=true 时为正则表达式（不能匹配空字符串）。' },
          newText: { type: 'string', description: '替换后的文本；正则模式下可用 $1…$9 与 $& 反向引用，要输出字面 $ 写 $$。' },
          useRegex: { type: 'boolean', description: '把 oldText 当作正则表达式处理，默认 false（按纯文本精确匹配）。' },
          replaceAll: { type: 'boolean', description: '显式声明替换所有匹配项，默认 false。' },
          description: { type: 'string', description: '本次修改的简要描述。' }
        },
        required: ['oldText', 'newText']
      }
    }
  },
  update_document_meta: {
    type: 'function',
    function: {
      name: 'update_document_meta',
      description: '调整文档的封面元信息，如文档标题、副标题、作者、部门、机构、日期、版本号、编号、是否显示封面等。',
      parameters: {
        type: 'object',
        properties: {
          ...buildProperties(META_FIELDS),
          coverlist: {
            type: 'array',
            description: '封面自定义属性字段列表，文档信息元数据，会展示在封面上',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string', description: '字段名称' },
                value: { type: 'string', description: '字段内容' }
              },
              required: ['label', 'value']
            }
          }
        }
      }
    }
  },
  update_document_style: {
    type: 'function',
    function: {
      name: 'update_document_style',
      description: '调整排版与视觉风格，包括字体、标题、图片、水印和文档默认 Mermaid 图表主题及 custom 配色。',
      parameters: {
        type: 'object',
        properties: {
          ...buildProperties(STYLE_FIELDS),
          headingFonts: {
            type: 'object',
            description: 'H1-H4 标题详细字体设置，可仅提供需要修改的级别和字段',
            properties: Object.fromEntries(['h1', 'h2', 'h3', 'h4'].map(level => [level, {
              type: 'object',
              properties: buildSubProperties(HEADING_FONT_FIELDS)
            }]))
          },
          imageConfig: {
            type: 'object',
            description: '图片边框和题注配置',
            properties: buildSubProperties(IMAGE_CONFIG_FIELDS)
          },
          tableCaptionConfig: {
            type: 'object',
            description: '表格题注配置',
            properties: buildSubProperties(TABLE_CAPTION_FIELDS)
          },
          watermark: {
            type: 'object',
            description: '文档水印配置',
            properties: buildSubProperties(WATERMARK_FIELDS)
          },
          mermaid: {
            type: 'object',
            description: '文档默认 Mermaid 图表主题与 custom 配色；仅填写需要修改的字段，单图围栏可单独覆盖主题',
            properties: {
              ...buildSubProperties(MERMAID_FIELDS),
              customColors: {
                type: 'object',
                description: '仅在 theme=custom 时用于图表的自定义色彩，也可单独预设配色',
                properties: buildSubProperties(MERMAID_COLOR_FIELDS)
              }
            }
          }
        }
      }
    }
  },
  update_header_footer_config: {
    type: 'function',
    function: {
      name: 'update_header_footer_config',
      description: '配置 A4 页面的页眉与页脚内容及格式（如左右文本、页码格式、分割线样式等）。',
      parameters: {
        type: 'object',
        properties: {
          ...buildProperties(HEADER_FIELDS),
          ...buildProperties(FOOTER_FIELDS)
        }
      }
    }
  },
  update_toc_config: {
    type: 'function',
    function: {
      name: 'update_toc_config',
      description: '配置交付文档的独立目录页参数（是否展示目录、标题文本与字体、1~4 级目录项字体与样式、最大深度、引导线样式、目录后分页等）。',
      parameters: {
        type: 'object',
        properties: {
          ...buildProperties(TOC_FIELDS),
          titleFont: {
            type: 'object',
            description: '目录页标题的字体、字号、字形与段前段后，可仅提供需要修改的字段',
            properties: buildSubProperties(HEADING_FONT_FIELDS)
          },
          levelStyles: {
            type: 'array',
            description: '1~4 级目录项的字体与样式，数组第 0~3 项分别对应 1~4 级目录项，可仅提供需要修改的级别与字段',
            items: {
              type: 'object',
              properties: buildSubProperties(TOC_LEVEL_FONT_FIELDS)
            }
          }
        }
      }
    }
  }
};
