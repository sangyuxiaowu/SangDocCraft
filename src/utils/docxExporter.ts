import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  Header,
  Footer,
  PageNumber,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
  PageBreak,
  TableOfContents,
} from 'docx';
import { marked } from 'marked';
import { DocumentTheme } from '../types';
import { getEffectiveMeta, parseFrontmatter } from './markdownParser';

/**
 * Converts Hex color string (#RRGGBB) to pure Hex string without '#'
 */
function cleanHex(hex: string): string {
  if (!hex) return '000000';
  return hex.replace('#', '').trim();
}

/**
 * Main export function to generate and download a standard Microsoft Word .docx file
 */
export async function exportToDocx(markdownText: string, theme: DocumentTheme, filename?: string): Promise<void> {
  const { header, footer, toc, style } = theme;
  const meta = getEffectiveMeta(theme.meta, markdownText);
  const parsedMarkdown = parseFrontmatter(markdownText);
  const bodyText = parsedMarkdown.body || markdownText;

  const primaryHex = cleanHex(style.primaryColor);
  const accentHex = cleanHex(style.accentColor);
  const textHex = cleanHex(style.textColor);
  const coverBgHex = cleanHex(style.coverBgColor);

  const fontName = style.fontFamily === 'serif' ? 'SimSun' :
                   style.fontFamily === 'kaiti' ? 'KaiTi' :
                   style.fontFamily === 'heiti' ? 'SimHei' :
                   style.fontFamily === 'mono' ? 'Consolas' : 'Microsoft YaHei';

  // Section children array
  const sectionsChildren: (Paragraph | Table | TableOfContents)[] = [];

  // 1. Cover Page
  if (meta.showCover) {
    // Title
    sectionsChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 2400, after: 400 },
        children: [
          new TextRun({
            text: meta.title || '设计交付文档',
            bold: true,
            size: 52, // 26pt
            color: primaryHex,
            font: fontName,
          }),
        ],
      })
    );

    // Subtitle
    if (meta.subtitle) {
      sectionsChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 1200 },
          children: [
            new TextRun({
              text: meta.subtitle,
              size: 28, // 14pt
              color: accentHex,
              font: fontName,
            }),
          ],
        })
      );
    }

    // Divider line
    sectionsChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 1600 },
        children: [
          new TextRun({
            text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
            color: accentHex,
            size: 20,
          }),
        ],
      })
    );

    // Meta Info Table in Cover Page
    const coverListItems = (meta.coverlist && meta.coverlist.length > 0)
      ? meta.coverlist
      : [
          { label: '项目名称', value: meta.projectName },
          { label: '文档版本', value: meta.version },
          { label: '撰写团队', value: meta.author },
          { label: '所属部门', value: meta.department },
          { label: '所属机构', value: meta.organization },
          { label: '交付日期', value: meta.date },
        ].filter(item => !!item.value);

    if (coverListItems.length > 0) {
      const tableRows = coverListItems.map((item) => {
        const cleanLabel = item.label.includes(':') || item.label.includes('：') ? item.label : `${item.label}：`;
        return new TableRow({
          children: [
            new TableCell({
              width: { size: 2500, type: WidthType.DXA },
              borders: {
                top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: cleanLabel,
                      bold: true,
                      size: 22,
                      color: primaryHex,
                      font: fontName,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 5500, type: WidthType.DXA },
              borders: {
                top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              },
              children: [
                new Paragraph({
                  alignment: AlignmentType.LEFT,
                  children: [
                    new TextRun({
                      text: item.value,
                      size: 22,
                      color: textHex,
                      font: fontName,
                    }),
                  ],
                }),
              ],
            }),
          ],
        });
      });

      sectionsChildren.push(
        new Table({
          width: { size: 8000, type: WidthType.DXA },
          alignment: AlignmentType.CENTER,
          rows: tableRows,
        })
      );
    }

    // Cover Page Break
    sectionsChildren.push(
      new Paragraph({
        children: [new PageBreak()],
      })
    );
  }

  // 2. Table of Contents Page
  if (toc.show) {
    sectionsChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 400 },
        children: [
          new TextRun({
            text: toc.title || '目 录',
            bold: true,
            size: 36,
            color: primaryHex,
            font: fontName,
          }),
        ],
      })
    );

    sectionsChildren.push(
      new TableOfContents('目录概览', {
        hyperlink: true,
        headingStyleRange: `1-${toc.maxDepth}`,
      })
    );

    if (toc.pageBreakAfter) {
      sectionsChildren.push(
        new Paragraph({
          children: [new PageBreak()],
        })
      );
    }
  }

  // 3. Parse Markdown Tokens
  const tokens = marked.lexer(bodyText);

  tokens.forEach((token) => {
    switch (token.type) {
      case 'heading': {
        const level = token.depth;
        let headingLevel: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1;
        let fontSize = 32; // 16pt
        let color = primaryHex;

        if (level === 1) {
          if (style.h1PageBreak && sectionsChildren.length > 0) {
            sectionsChildren.push(
              new Paragraph({
                children: [new PageBreak()],
              })
            );
          }
          headingLevel = HeadingLevel.HEADING_1;
          fontSize = 36; // 18pt
          color = primaryHex;
        } else if (level === 2) {
          headingLevel = HeadingLevel.HEADING_2;
          fontSize = 28; // 14pt
          color = accentHex;
        } else {
          headingLevel = HeadingLevel.HEADING_3;
          fontSize = 24; // 12pt
          color = textHex;
        }

        sectionsChildren.push(
          new Paragraph({
            heading: headingLevel,
            spacing: { before: 400, after: 200 },
            children: [
              new TextRun({
                text: token.text,
                bold: true,
                size: fontSize,
                color: color,
                font: fontName,
              }),
            ],
          })
        );
        break;
      }

      case 'paragraph': {
        // Check for page break token <!-- pagebreak -->
        if (token.raw.includes('<!-- pagebreak -->') || token.text.includes('<!-- pagebreak -->')) {
          sectionsChildren.push(
            new Paragraph({
              children: [new PageBreak()],
            })
          );
          break;
        }

        sectionsChildren.push(
          new Paragraph({
            spacing: { before: 120, after: 120, line: 320 },
            indent: style.indentParagraph ? { firstLine: 480 } : undefined,
            children: [
              new TextRun({
                text: token.text,
                size: 22, // 11pt
                color: textHex,
                font: fontName,
              }),
            ],
          })
        );
        break;
      }

      case 'blockquote': {
        sectionsChildren.push(
          new Paragraph({
            indent: { left: 720 }, // 0.5 in
            spacing: { before: 200, after: 200, line: 300 },
            border: {
              left: {
                color: accentHex,
                space: 12,
                style: BorderStyle.SINGLE,
                size: 24, // 3pt
              },
            },
            children: [
              new TextRun({
                text: token.text,
                italics: true,
                size: 22,
                color: '475569', // Slate 600
                font: fontName,
              }),
            ],
          })
        );
        break;
      }

      case 'code': {
        const lines = token.text.split('\n');
        lines.forEach((line) => {
          sectionsChildren.push(
            new Paragraph({
              spacing: { before: 40, after: 40 },
              shading: {
                fill: 'F1F5F9', // Slate 100
                type: ShadingType.CLEAR,
              },
              indent: { left: 360, right: 360 },
              children: [
                new TextRun({
                  text: line,
                  size: 20, // 10pt
                  font: 'Consolas',
                  color: '0F172A',
                }),
              ],
            })
          );
        });
        break;
      }

      case 'list': {
        token.items.forEach((item, index) => {
          const prefix = token.ordered ? `${index + 1}. ` : '• ';
          sectionsChildren.push(
            new Paragraph({
              indent: { left: 480 },
              spacing: { before: 80, after: 80 },
              children: [
                new TextRun({
                  text: prefix,
                  bold: true,
                  color: accentHex,
                  size: 22,
                  font: fontName,
                }),
                new TextRun({
                  text: item.text,
                  size: 22,
                  color: textHex,
                  font: fontName,
                }),
              ],
            })
          );
        });
        break;
      }

      case 'table': {
        const headerCells = token.header.map((col) => {
          return new TableCell({
            shading: {
              fill: primaryHex,
              type: ShadingType.CLEAR,
            },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [
                  new TextRun({
                    text: col.text,
                    bold: true,
                    color: 'FFFFFF',
                    size: 20,
                    font: fontName,
                  }),
                ],
              }),
            ],
          });
        });

        const tableRows = [
          new TableRow({
            children: headerCells,
            tableHeader: true,
          }),
        ];

        token.rows.forEach((row, rowIndex) => {
          const rowCells = row.map((cell) => {
            return new TableCell({
              shading: {
                fill: rowIndex % 2 === 1 ? 'F8FAFC' : 'FFFFFF',
                type: ShadingType.CLEAR,
              },
              margins: { top: 100, bottom: 100, left: 160, right: 160 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: cell.text,
                      color: textHex,
                      size: 20,
                      font: fontName,
                    }),
                  ],
                }),
              ],
            });
          });
          tableRows.push(new TableRow({ children: rowCells }));
        });

        sectionsChildren.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
          })
        );
        // Add spacing after table
        sectionsChildren.push(new Paragraph({ spacing: { after: 200 } }));
        break;
      }

      case 'hr': {
        sectionsChildren.push(
          new Paragraph({
            spacing: { before: 300, after: 300 },
            border: {
              bottom: { color: 'CBD5E1', size: 6, style: BorderStyle.SINGLE },
            },
          })
        );
        break;
      }

      default:
        break;
    }
  });

  // 4. Headers and Footers Construction
  const headerChildren: Paragraph[] = [];
  if (header.show) {
    const headerTextLeft = header.leftText || meta.projectName || '';
    const headerTextRight = header.rightText || meta.title || '';

    headerChildren.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        border: header.lineStyle !== 'none' ? {
          bottom: {
            color: accentHex,
            size: header.lineStyle === 'double' ? 18 : 12,
            style: BorderStyle.SINGLE,
          },
        } : undefined,
        children: [
          new TextRun({
            text: `${headerTextLeft}${headerTextLeft && headerTextRight ? '  |  ' : ''}${headerTextRight}`,
            size: 18, // 9pt
            color: '64748B',
            font: fontName,
          }),
        ],
      })
    );
  }

  const footerChildren: Paragraph[] = [];
  if (footer.show) {
    const leftFooter = footer.leftText || meta.organization || '';
    footerChildren.push(
      new Paragraph({
        alignment: footer.pageNumberPosition === 'center' ? AlignmentType.CENTER : AlignmentType.RIGHT,
        children: [
          new TextRun({
            text: leftFooter ? `${leftFooter}    ` : '',
            size: 18,
            color: '64748B',
            font: fontName,
          }),
          new TextRun({
            text: '第 ',
            size: 18,
            color: '64748B',
            font: fontName,
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            size: 18,
            color: '64748B',
            font: fontName,
          }),
          new TextRun({
            text: ' 页 / 共 ',
            size: 18,
            color: '64748B',
            font: fontName,
          }),
          new TextRun({
            children: [PageNumber.TOTAL_PAGES],
            size: 18,
            color: '64748B',
            font: fontName,
          }),
          new TextRun({
            text: ' 页',
            size: 18,
            color: '64748B',
            font: fontName,
          }),
        ],
      })
    );
  }

  // Create docx Document
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              bottom: 1440,
              left: 1440,
              right: 1440,
            },
          },
        },
        headers: {
          default: new Header({
            children: headerChildren,
          }),
        },
        footers: {
          default: new Footer({
            children: footerChildren,
          }),
        },
        children: sectionsChildren,
      },
    ],
  });

  // Pack to blob and download
  const blob = await Packer.toBlob(doc);
  const outName = filename || `${meta.title || '交付文档'}_${meta.version || 'v1.0'}.docx`;

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = outName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
