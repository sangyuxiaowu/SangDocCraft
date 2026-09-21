import { AiToolDefinition } from '../types/ai';

/** AI 工具名，同时作为 AI_TOOL_DEFINITIONS 的键 */
export type AiToolName =
  | 'get_document_state'
  | 'get_document_summary'
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
  get_document_state: {
    type: 'function',
    function: {
      name: 'get_document_state',
      description: '获取当前交付文档的总体配置状态：正文撰写情况（正文统计长度、总行数、历史记录开关和章节大纲）、文档元数据（标题/副标题/作者/部门/机构/日期/版本/编号）、封面配置信息、header、footer、toc、color（配色）、style（字体/字号/行高/标题与列表样式/图片与表格题注等排版项）、watermark',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  get_document_summary: {
    type: 'function',
    function: {
      name: 'get_document_summary',
      description: '获取当前正文统计长度、总行数、历史记录开关和章节大纲，用于在正文修改完成后快速确认最新文档结构。本工具是 get_document_state 的子集',
      parameters: {
        type: 'object',
        properties: {}
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
      description: '原子批量编辑 Markdown 正文，一次调用只触发一次审查。所有 replace 区间都基于批次开始时的原文行号且不可重叠；append 在 replace 完成后按 operations 顺序追加；full 只能单独使用。同一批 toolCalls 仅允许调用一次本工具。',
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
      description: '精确替换 Markdown 中的字符串。默认要求 oldText 唯一；需要全局替换时必须显式设置 replaceAll=true。',
      parameters: {
        type: 'object',
        properties: {
          oldText: { type: 'string', minLength: 1, description: '要精确匹配的原始文本。' },
          newText: { type: 'string', description: '替换后的文本。' },
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
          title: { type: 'string', description: '主标题' },
          subtitle: { type: 'string', description: '副标题' },
          author: { type: 'string', description: '作者姓名' },
          department: { type: 'string', description: '所属部门' },
          organization: { type: 'string', description: '机构/公司名称' },
          date: { type: 'string', description: '日期 (如 2025-05-20)' },
          version: { type: 'string', description: '版本号 (如 v1.0.0)' },
          number: { type: 'string', description: '文档编号 (如 DOC-2025-001)' },
          showCover: { type: 'boolean', description: '是否展示独立封面页' },
          coverStyle: { type: 'string', description: '封面样式风格，值应来自当前可用封面模板 ID' },
          logoUrl: { type: 'string', description: '封面 Logo 的图片 URL 或 @images/@library 引用，空字符串表示清除' },
          logoHeight: { type: 'number', description: '封面 Logo 高度，单位 px，范围 20-120' },
          coverListColumns: { type: 'number', enum: [1, 2], description: '封面属性列表列数' },
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
      description: '调整排版设计与视觉风格参数，如主色、强调色、文字字号、行高、正文字体、一级标题样式、首行缩进、一级标题独立换页等。',
      parameters: {
        type: 'object',
        properties: {
          primaryColor: { type: 'string', description: '主色调 hex (如 #1e293b, #0369a1)' },
          accentColor: { type: 'string', description: '强调色 hex (如 #2563eb, #0ea5e9)' },
          textColor: { type: 'string', description: '正文文字颜色 hex (如 #0f172a, #334155)' },
          fontSize: { type: 'number', description: '正文基础字号，单位 px (如 13, 14, 15)' },
          lineHeight: { type: 'number', description: '行高比例 (如 1.6, 1.8)' },
          paragraphMarginBefore: { type: 'number', description: '正文段前间距，单位 px，默认 0' },
          paragraphMarginAfter: { type: 'number', description: '正文段后间距，单位 px，默认 6' },
          backgroundColor: { type: 'string', description: '正文页面背景色 hex' },
          coverBgColor: { type: 'string', description: '封面背景色 hex' },
          fontFamily: { 
            type: 'string', 
            enum: ['sans', 'serif', 'kaiti', 'heiti', 'mono'],
            description: '正文字体类型' 
          },
          h1Style: {
            type: 'string',
            enum: ['underline', 'accent-block', 'badge', 'minimal'],
            description: '一级标题外观风格'
          },
          h2Style: {
            type: 'string',
            enum: ['border-left', 'number-prefix', 'underline-subtle', 'plain'],
            description: '二级标题外观风格'
          },
          h3Style: {
            type: 'string',
            enum: ['bullet', 'bold', 'plain'],
            description: '三级标题外观风格'
          },
          latinFontFamily: { type: 'string', description: '英文与数字字体名称，如 Times New Roman' },
          bodyFontFamily: { type: 'string', description: '正文字体 CSS font-family，inherit 表示跟随文档字体' },
          indentParagraph: { type: 'boolean', description: '正文首行缩进 2 字符' },
          h1PageBreak: { type: 'boolean', description: '一级标题自动另起一页' },
          h1Center: { type: 'boolean', description: '一级标题居中' },
          paginationMode: { type: 'string', enum: ['auto', 'manual'], description: '自动分页或仅按 pagebreak 手动分页' },
          bulletStyle: { type: 'string', enum: ['dot', 'square', 'checkmark', 'arrow'], description: '无序列表图标样式' },
          numberStyle: { type: 'string', enum: ['decimal', 'paren', 'chinese'], description: '有序列表编号样式' },
          codeTheme: { type: 'string', enum: ['dark', 'light', 'github'], description: '代码块主题' },
          tableStyle: { type: 'string', enum: ['striped', 'bordered', 'minimal'], description: '表格样式' },
          headingFonts: {
            type: 'object',
            description: 'H1-H4 标题详细字体设置，可仅提供需要修改的级别和字段',
            properties: Object.fromEntries(['h1', 'h2', 'h3', 'h4'].map(level => [level, {
              type: 'object',
              properties: {
                fontFamily: { type: 'string' },
                fontSize: { type: 'number' },
                bold: { type: 'boolean' },
                italic: { type: 'boolean' },
                underline: { type: 'boolean' },
                marginBefore: { type: 'number' },
                marginAfter: { type: 'number' }
              }
            }]))
          },
          imageConfig: {
            type: 'object',
            description: '图片边框和题注配置',
            properties: {
              borderStyle: { type: 'string', enum: ['none', 'solid', 'subtle', 'shadow', 'card', 'rounded'] },
              borderColor: { type: 'string' },
              showCaption: { type: 'boolean' },
              autoNumber: { type: 'boolean' },
              numberPrefix: { type: 'string' },
              captionAlign: { type: 'string', enum: ['center', 'left', 'right'] }
            }
          },
          tableCaptionConfig: {
            type: 'object',
            description: '表格题注配置',
            properties: {
              showCaption: { type: 'boolean' },
              autoNumber: { type: 'boolean' },
              numberPrefix: { type: 'string' },
              captionPosition: { type: 'string', enum: ['top', 'bottom'] },
              captionAlign: { type: 'string', enum: ['center', 'left', 'right'] }
            }
          },
          watermark: {
            type: 'object',
            description: '文档水印配置',
            properties: {
              show: { type: 'boolean' },
              type: { type: 'string', enum: ['text', 'image'] },
              text: { type: 'string' },
              fontSize: { type: 'number' },
              color: { type: 'string' },
              opacity: { type: 'number' },
              rotate: { type: 'number' },
              layout: { type: 'string', enum: ['single', 'repeat'] },
              repeatGap: { type: 'number' },
              hideOnCover: { type: 'boolean' },
              imageUrl: { type: 'string' },
              imageWidth: { type: 'number' }
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
          headerShow: { type: 'boolean', description: '是否展示页眉' },
          headerLeftText: { type: 'string', description: '页眉左侧文本' },
          headerCenterText: { type: 'string', description: '页眉居中文本' },
          headerRightText: { type: 'string', description: '页眉右侧文本' },
          headerLineStyle: { type: 'string', enum: ['solid', 'accent', 'double', 'none'], description: '页眉分隔线样式' },
          headerHideOnCover: { type: 'boolean', description: '封面是否隐藏页眉' },
          headerLogoUrl: { type: 'string', description: '页眉 Logo 的图片 URL 或 @images/@library 引用，空字符串表示清除' },
          headerLogoHeight: { type: 'number', description: '页眉 Logo 高度，单位 px，范围 10-70' },
          headerLogoOpacity: { type: 'number', description: '页眉 Logo 透明度，范围 0-1' },
          headerLeftTextOffset: { type: 'number', description: '页眉左侧文本水平偏移，单位 px' },
          headerLogoTopOffset: { type: 'number', description: '页眉 Logo 顶部偏移，单位 px' },
          footerShow: { type: 'boolean', description: '是否展示页脚' },
          footerLeftText: { type: 'string', description: '页脚左侧文本' },
          footerCenterText: { type: 'string', description: '页脚居中文本' },
          footerRightText: { type: 'string', description: '页脚右侧文本' },
          footerHideOnCover: { type: 'boolean', description: '封面是否隐藏页脚' },
          pageNumberFormat: {
            type: 'string',
            enum: ['page', 'pageOfTotal', 'hyphen', 'simple', 'none'],
            description: '页码显示格式 (page: "第 X 页", pageOfTotal: "第 X 页 / 共 Y 页", hyphen: "- X -", simple: "X / Y", none: "无")'
          },
          pageNumberPosition: {
            type: 'string',
            enum: ['left', 'center', 'right'],
            description: '页码位置'
          }
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
          show: { type: 'boolean', description: '是否生成并展示文档目录' },
          title: { type: 'string', description: '目录标题文本 (如 "目 录")' },
          titleCenter: { type: 'boolean', description: '目录标题是否居中' },
          titleStyle: {
            type: 'string',
            enum: ['underline', 'accent-block', 'badge', 'minimal'],
            description: '目录标题表达形式'
          },
          titleFont: {
            type: 'object',
            description: '目录页标题的字体、字号、字形与段前段后，可仅提供需要修改的字段',
            properties: {
              fontFamily: { type: 'string', description: '字体名称，inherit 表示跟随文档字体' },
              fontSize: { type: 'number', description: '字号 px' },
              bold: { type: 'boolean', description: '是否加粗' },
              italic: { type: 'boolean', description: '是否倾斜' },
              underline: { type: 'boolean', description: '是否加下划线' },
              marginBefore: { type: 'number', description: '段前间距 px' },
              marginAfter: { type: 'number', description: '段后间距 px' }
            }
          },
          levelStyles: {
            type: 'array',
            description: '1~4 级目录项的字体与样式，数组第 0~3 项分别对应 1~4 级目录项，可仅提供需要修改的级别与字段',
            items: {
              type: 'object',
              properties: {
                fontFamily: { type: 'string', description: '字体名称，inherit 表示跟随文档字体' },
                fontSize: { type: 'number', description: '字号 px' },
                bold: { type: 'boolean', description: '是否加粗' },
                italic: { type: 'boolean', description: '是否倾斜' },
                underline: { type: 'boolean', description: '是否加下划线' },
                marginBefore: { type: 'number', description: '段前间距 px' },
                marginAfter: { type: 'number', description: '段后间距 px' },
                paddingLeft: { type: 'number', description: '左缩进 px' }
              }
            }
          },
          maxDepth: { type: 'number', enum: [1, 2, 3, 4], description: '目录提取的最大标题深度' },
          headingNumbering: {
            type: 'string',
            enum: ['none', 'decimal', 'chinese', 'decimal-skip-h1'],
            description: '目录和标题的自动编号方式'
          },
          leaderStyle: {
            type: 'string',
            enum: ['dots', 'dashes', 'line', 'none'],
            description: '目录项与页码之间的连接引导线样式'
          },
          showPageNumbers: { type: 'boolean', description: '是否显示目录项页码' },
          pageBreakAfter: { type: 'boolean', description: '目录页结束后是否强制分页另起一页' },
          titleOnEveryPage: { type: 'boolean', description: '目录分成多页时是否每页都显示目录标题（默认 false，仅第一页显示）' }
        }
      }
    }
  }
};
