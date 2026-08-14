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
  ImageRun,
} from 'docx';
import { marked } from 'marked';
import { DocumentTheme } from '../types';
import { getEffectiveMeta, parseFrontmatter, getHeadingText } from './markdownParser';
import { fetchImageBinary } from './tauriHelper';
import { getCoverTemplate } from '../themes/themeRegistry';

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
  const coverTemplate = getCoverTemplate(meta.coverStyle);
  const coverStyle = coverTemplate.id;
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
  const latinFontName = style.latinFontFamily || 'Times New Roman';
  const docxFont = { ascii: latinFontName, hAnsi: latinFontName, eastAsia: fontName };
  const noTableBorders = {
    top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  };

  const createImageRun = async (source: string, altText: string, width = 480, height = 270): Promise<ImageRun | null> => {
    try {
      const { data, contentType } = await fetchImageBinary(source);
      const imageType = contentType.includes('png') ? 'png' : contentType.includes('gif') ? 'gif' : contentType.includes('bmp') ? 'bmp' : 'jpg';
      return new ImageRun({
        type: imageType,
        data,
        transformation: { width, height },
        altText: { title: altText, description: altText, name: altText },
      });
    } catch (error) {
      console.warn('DOCX image export failed:', source, error);
      return null;
    }
  };

  const createInlineRuns = async (tokens: any[], options: { bold?: boolean; italics?: boolean; size?: number; color?: string } = {}): Promise<(TextRun | ImageRun)[]> => {
    const runs: (TextRun | ImageRun)[] = [];
    for (const inlineToken of tokens || []) {
      const inherited = { bold: options.bold, italics: options.italics, size: options.size || 22, color: options.color || textHex, font: docxFont };
      if (inlineToken.type === 'strong' || inlineToken.type === 'em' || inlineToken.type === 'del' || inlineToken.type === 'link') {
        runs.push(...await createInlineRuns(inlineToken.tokens, {
          ...options,
          bold: inlineToken.type === 'strong' || options.bold,
          italics: inlineToken.type === 'em' || options.italics,
        }));
      } else if (inlineToken.type === 'image') {
        const imageRun = await createImageRun(inlineToken.href, inlineToken.text || '图片');
        if (imageRun) {
          runs.push(imageRun);
        } else {
          runs.push(new TextRun({ text: inlineToken.text || '[图片]', ...inherited }));
        }
      } else if (inlineToken.tokens?.length) {
        runs.push(...await createInlineRuns(inlineToken.tokens, options));
      } else if (inlineToken.type === 'codespan') {
        runs.push(new TextRun({ text: inlineToken.text, ...inherited, font: 'Consolas', shading: { fill: 'F1F5F9', type: ShadingType.CLEAR } }));
      } else {
        runs.push(new TextRun({ text: inlineToken.text || inlineToken.raw || '', ...inherited }));
      }
    }
    return runs;
  };

  let imageCaptionCount = 0;
  const getImageTokens = (tokens: any[]): any[] => {
    return (tokens || []).flatMap((token) => token.type === 'image' ? [token] : getImageTokens(token.tokens || []));
  };
  const createImageCaptions = (tokens: any[]): Paragraph[] => {
    const imageConfig = style.imageConfig;
    if (imageConfig?.showCaption === false) return [];

    return getImageTokens(tokens).flatMap((imageToken) => {
      const caption = imageToken.text?.trim();
      if (!caption) return [];
      imageCaptionCount += 1;
      const captionText = imageConfig?.autoNumber === false
        ? caption
        : `${imageConfig?.numberPrefix || '图 '}${imageCaptionCount}: ${caption}`;
      const alignment = imageConfig?.captionAlign === 'left'
        ? AlignmentType.LEFT
        : imageConfig?.captionAlign === 'right'
        ? AlignmentType.RIGHT
        : AlignmentType.CENTER;
      return [new Paragraph({
        alignment,
        spacing: { before: 60, after: 160 },
        children: [new TextRun({ text: captionText, size: 18, color: '64748B', font: docxFont })],
      })];
    });
  };

  // Section children array
  const sectionsChildren: (Paragraph | Table | TableOfContents)[] = [];

  // 1. Cover Page
  if (meta.showCover) {
    const coverListItems = (meta.coverlist && meta.coverlist.length > 0)
      ? meta.coverlist
      : [
          { label: '撰写团队', value: meta.author },
          { label: '所属部门', value: meta.department },
        ].filter(item => !!item.value);

    sectionsChildren.push(...await coverTemplate.renderDocx({
      meta,
      style,
      coverListItems,
      primaryHex,
      accentHex,
      textHex,
      fontName,
      docxFont,
      createImageRun,
    }));

    if (false) {
    const logoSource = meta.logo || meta.logoUrl;
    if (logoSource) {
      const logoRun = await createImageRun(
        logoSource,
        '文档标志',
        coverStyle === 'academic' ? 180 : 480,
        coverStyle === 'academic' ? 100 : 270,
      );
      if (logoRun) {
        sectionsChildren.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: coverStyle === 'academic' ? 160 : 400 },
            children: [logoRun],
          })
        );
      }
    }

    if (coverStyle === 'academic') {
      sectionsChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 180 },
          children: [new TextRun({
            text: meta.organization || '某某大学',
            bold: true,
            size: 32,
            color: primaryHex,
            characterSpacing: 80,
            font: fontName,
          })],
        })
      );
    }

    // Title
    sectionsChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: coverStyle === 'academic' ? 1800 : 2400, after: 400 },
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
    if (coverStyle !== 'academic') {
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
    }

    // Meta Info Table in Cover Page
    if (coverListItems.length > 0) {
      const tableRows = coverListItems.map((item) => {
        const cleanLabel = item.label.includes(':') || item.label.includes('：') ? item.label : `${item.label}：`;
        return new TableRow({
          children: [
            new TableCell({
              width: { size: coverStyle === 'academic' ? 1800 : 2500, type: WidthType.DXA },
              borders: {
                top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              },
              children: [
                new Paragraph({
                  alignment: coverStyle === 'academic' ? AlignmentType.LEFT : AlignmentType.RIGHT,
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
              width: { size: coverStyle === 'academic' ? 4200 : 5500, type: WidthType.DXA },
              borders: {
                top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                bottom: { style: coverStyle === 'academic' ? BorderStyle.SINGLE : BorderStyle.NONE, size: coverStyle === 'academic' ? 4 : 0, color: primaryHex },
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
          width: { size: coverStyle === 'academic' ? 6000 : 8000, type: WidthType.DXA },
          alignment: AlignmentType.CENTER,
          borders: noTableBorders,
          rows: tableRows,
        })
      );
    }

    if (coverStyle === 'academic') {
      sectionsChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 1000, after: 0 },
          children: [new TextRun({ text: meta.date || '年    月    日', size: 22, color: textHex, font: docxFont })],
        })
      );
    }

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
  const headingCounters = [0, 0, 0, 0];

  for (const token of tokens) {
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
        } else if (level === 3) {
          headingLevel = HeadingLevel.HEADING_3;
          fontSize = 24; // 12pt
          color = textHex;
        } else {
          headingLevel = HeadingLevel.HEADING_4;
          fontSize = 22; // 11pt
          color = textHex;
        }

        const headingConfig = style.headingFonts?.[`h${Math.min(level, 4)}` as 'h1' | 'h2' | 'h3' | 'h4'];
        const headingPrefix = getHeadingText('', level, headingCounters, toc.headingNumbering).trim();

        sectionsChildren.push(
          new Paragraph({
            heading: headingLevel,
            spacing: { before: 400, after: 200 },
            children: [
              ...(headingPrefix ? [new TextRun({
                text: `${headingPrefix} `,
                bold: headingConfig?.bold ?? true,
                size: headingConfig?.fontSize ? headingConfig.fontSize * 2 : fontSize,
                color,
                font: docxFont,
              })] : []),
              ...(await createInlineRuns(token.tokens || [{ type: 'text', text: token.text }], {
                bold: headingConfig?.bold ?? true,
                size: headingConfig?.fontSize ? headingConfig.fontSize * 2 : fontSize,
                color,
              })),
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

        const paragraphTokens = token.tokens || [{ type: 'text', text: token.text }];
        sectionsChildren.push(
          new Paragraph({
            spacing: { before: 120, after: 120, line: 320 },
            indent: style.indentParagraph ? { firstLine: 480 } : undefined,
            children: await createInlineRuns(paragraphTokens),
          })
        );
        sectionsChildren.push(...createImageCaptions(paragraphTokens));
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
            children: await createInlineRuns(token.tokens || [{ type: 'text', text: token.text }], { italics: true, color: '475569' }),
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
        for (const [index, item] of token.items.entries()) {
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
                ...(await createInlineRuns(item.tokens || [{ type: 'text', text: item.text }])),
              ],
            })
          );
        }
        break;
      }

      case 'table': {
        const headerCells = await Promise.all(token.header.map(async (col: any) => {
          return new TableCell({
            shading: {
              fill: primaryHex,
              type: ShadingType.CLEAR,
            },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: await createInlineRuns(col.tokens || [{ type: 'text', text: col.text }], {
                  bold: true,
                  color: 'FFFFFF',
                  size: 20,
                }),
              }),
            ],
          });
        }));

        const tableRows = [
          new TableRow({
            children: headerCells,
            tableHeader: true,
          }),
        ];

        for (const [rowIndex, row] of token.rows.entries()) {
          const rowCells = await Promise.all(row.map(async (cell: any) => {
            return new TableCell({
              shading: {
                fill: rowIndex % 2 === 1 ? 'F8FAFC' : 'FFFFFF',
                type: ShadingType.CLEAR,
              },
              margins: { top: 100, bottom: 100, left: 160, right: 160 },
              children: [
                new Paragraph({
                  children: await createInlineRuns(cell.tokens || [{ type: 'text', text: cell.text }], {
                    color: textHex,
                    size: 20,
                  }),
                }),
              ],
            });
          }));
          tableRows.push(new TableRow({ children: rowCells }));
        }

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

      case 'html': {
        if (/<!--\s*pagebreak\s*-->/i.test(token.raw)) {
          sectionsChildren.push(new Paragraph({ children: [new PageBreak()] }));
        }
        break;
      }

      default:
        break;
    }
  }

  // 4. Headers and Footers Construction
  const headerChildren: (Paragraph | Table)[] = [];
  if (header.show) {
    const headerTextLeft = header.leftText || '';
    const headerTextCenter = header.centerText || '';
    const headerTextRight = header.rightText || meta.title || '';

    const headerLogoRun = header.logoUrl
      ? await createImageRun(header.logoUrl, '页眉标志', 100, header.logoHeight || 20)
      : null;
    headerChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: header.lineStyle !== 'none' ? {
          bottom: { color: accentHex, size: header.lineStyle === 'double' ? 18 : 12, style: BorderStyle.SINGLE },
          top: noTableBorders.top,
          left: noTableBorders.left,
          right: noTableBorders.right,
          insideHorizontal: noTableBorders.insideHorizontal,
          insideVertical: noTableBorders.insideVertical,
        } : noTableBorders,
        rows: [new TableRow({ children: [
          { text: headerTextLeft, alignment: AlignmentType.LEFT, logoRun: headerLogoRun },
          { text: headerTextCenter, alignment: AlignmentType.CENTER },
          { text: headerTextRight, alignment: AlignmentType.RIGHT },
        ].map((cell) => new TableCell({
          borders: noTableBorders,
          children: [new Paragraph({ alignment: cell.alignment, children: [
            ...(cell.logoRun ? [cell.logoRun] : []),
            new TextRun({ text: cell.text, size: 18, color: '64748B', font: docxFont }),
          ] })],
        })),
        })],
      })
    );
  }

  const footerChildren: (Paragraph | Table)[] = [];
  if (footer.show) {
    const leftFooter = footer.leftText || meta.organization || '';
    const pageNumberRuns = (): TextRun[] => {
      const run = (text?: string, children?: (typeof PageNumber)[keyof typeof PageNumber][]) => new TextRun({ text, children, size: 18, color: '64748B', font: docxFont });
      if (footer.pageNumberFormat === 'none') return [];
      if (footer.pageNumberFormat === 'simple') return [run(undefined, [PageNumber.CURRENT])];
      if (footer.pageNumberFormat === 'hyphen') return [run('- '), run(undefined, [PageNumber.CURRENT]), run(' -')];
      if (footer.pageNumberFormat === 'page') return [run('第 '), run(undefined, [PageNumber.CURRENT]), run(' 页')];
      return [run('第 '), run(undefined, [PageNumber.CURRENT]), run(' 页 / 共 '), run(undefined, [PageNumber.TOTAL_PAGES]), run(' 页')];
    };
    const footerCells = [
      { text: leftFooter, alignment: AlignmentType.LEFT, includePage: footer.pageNumberPosition === 'left' },
      { text: footer.centerText || '', alignment: AlignmentType.CENTER, includePage: footer.pageNumberPosition === 'center' },
      { text: footer.rightText || '', alignment: AlignmentType.RIGHT, includePage: footer.pageNumberPosition === 'right' },
    ];
    footerChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noTableBorders,
        rows: [new TableRow({ children: footerCells.map((cell) => new TableCell({
          borders: noTableBorders,
          children: [new Paragraph({ alignment: cell.alignment, children: [
            new TextRun({ text: cell.text, size: 18, color: '64748B', font: docxFont }),
            ...(cell.includePage ? pageNumberRuns() : []),
          ] })],
        })) })],
      })
    );
  }

  // Create docx Document
  const doc = new Document({
    features: { updateFields: true },
    sections: [
      {
        properties: {
                    titlePage: meta.showCover && (header.hideOnCover || footer.hideOnCover),
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
          first: new Header({ children: header.hideOnCover ? [] : headerChildren }),
          default: new Header({
            children: headerChildren,
          }),
        },
        footers: {
          first: new Footer({ children: footer.hideOnCover ? [] : footerChildren }),
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
  const outName = filename || `${meta.title || '交付文档'}.docx`;

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = outName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
