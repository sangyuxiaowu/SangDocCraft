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
import { getHeadingText, getTocLevelStyles, getTocTitleFont } from './documentStructure';
import { fetchImageBinary } from './tauriHelper';
import { getCoverTemplate } from '../themes/themeRegistry';
import { renderMermaidPng } from './mermaidRenderer';
import { registerMathExtensions, renderMathPng } from './mathRenderer';
import { splitExplicitPages } from './pageBreaks';
import { extractImageDimensionSuffix } from './imageDimensions';

// 公式需要先注册 marked 扩展，才能在此链路中拿到 mathInline / mathBlock token
registerMathExtensions();

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
  const meta = theme.meta;
  const coverTemplate = getCoverTemplate(meta.coverStyle);
  const bodyText = markdownText;

  const primaryHex = cleanHex(style.primaryColor);
  const accentHex = cleanHex(style.accentColor);
  const textHex = cleanHex(style.textColor);

  const fontName = style.fontFamily === 'serif' ? 'SimSun' :
                   style.fontFamily === 'kaiti' ? 'KaiTi' :
                   style.fontFamily === 'heiti' ? 'SimHei' :
                   style.fontFamily === 'mono' ? 'Consolas' : 'Microsoft YaHei';
  const latinFontName = style.latinFontFamily || 'Times New Roman';
  const docxFont = { ascii: latinFontName, hAnsi: latinFontName, eastAsia: fontName };
  const bodyFont = !style.bodyFontFamily || style.bodyFontFamily === 'inherit' ? undefined : style.bodyFontFamily;
  const noTableBorders = {
    top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  };

  const createImageRun = async (source: string, altText: string, width?: number, height?: number): Promise<ImageRun | null> => {
    try {
      const { data, contentType } = await fetchImageBinary(source);
      const imageType = contentType.includes('png') ? 'png' : contentType.includes('gif') ? 'gif' : contentType.includes('bmp') ? 'bmp' : 'jpg';
      let imageWidth = width ?? 480;
      let imageHeight = height ?? 270;
      if ((width === undefined) !== (height === undefined)) {
        const bitmap = await createImageBitmap(new Blob([data], { type: contentType }));
        if (width === undefined) {
          imageWidth = imageHeight * bitmap.width / bitmap.height;
        } else {
          imageHeight = imageWidth * bitmap.height / bitmap.width;
        }
        bitmap.close();
      }
      return new ImageRun({
        type: imageType,
        data,
        transformation: { width: imageWidth, height: imageHeight },
        altText: { title: altText, description: altText, name: altText },
      });
    } catch (error) {
      console.warn('DOCX image export failed:', source, error);
      return null;
    }
  };

  // Word 无法直接嵌入 SVG/MathML，公式统一栅格化为 PNG 后插入
  const createMathImageRun = async (latex: string, display: boolean, sizeHalfPoints = 22): Promise<ImageRun | null> => {
    try {
      const formula = await renderMathPng(latex, display, { fontSizePx: (sizeHalfPoints * 2) / 3 });
      const altText = (display ? `公式：${latex}` : latex).slice(0, 120);
      return new ImageRun({
        type: 'png',
        data: formula.data,
        transformation: { width: formula.width, height: formula.height },
        altText: { title: '公式', description: altText, name: '公式' },
      });
    } catch (error) {
      console.warn('DOCX formula rendering failed:', latex, error);
      return null;
    }
  };

  const createInlineRuns = async (tokens: any[], options: { bold?: boolean; italics?: boolean; underline?: boolean; size?: number; color?: string; font?: string } = {}): Promise<(TextRun | ImageRun)[]> => {
    const runs: (TextRun | ImageRun)[] = [];
    const inlineTokens = (tokens || []).map((token: any) => ({ ...token }));
    for (let index = 0; index < inlineTokens.length; index++) {
      const inlineToken = inlineTokens[index];
      const inherited = { bold: options.bold, italics: options.italics, underline: options.underline ? {} : undefined, size: options.size || 22, color: options.color || textHex, font: options.font || docxFont };
      if (inlineToken.type === 'strong' || inlineToken.type === 'em' || inlineToken.type === 'del' || inlineToken.type === 'link') {
        runs.push(...await createInlineRuns(inlineToken.tokens, {
          ...options,
          bold: inlineToken.type === 'strong' || options.bold,
          italics: inlineToken.type === 'em' || options.italics,
        }));
      } else if (inlineToken.type === 'image') {
        const nextToken = inlineTokens[index + 1];
        const nextText = nextToken?.type === 'text' ? nextToken.text || nextToken.raw || '' : '';
        const dimensionSuffix = extractImageDimensionSuffix(nextText);
        if (dimensionSuffix) {
          const remainingText = nextText.slice(dimensionSuffix.length);
          nextToken.text = remainingText;
          nextToken.raw = remainingText;
        }
        const imageRun = await createImageRun(
          inlineToken.href,
          inlineToken.text || '图片',
          dimensionSuffix?.dimensions.width,
          dimensionSuffix?.dimensions.height
        );
        if (imageRun) {
          runs.push(imageRun);
        } else {
          runs.push(new TextRun({ text: inlineToken.text || '[图片]', ...inherited }));
        }
      } else if (inlineToken.type === 'mathInline') {
        const mathRun = await createMathImageRun(inlineToken.text || '', Boolean(inlineToken.display), inherited.size);
        runs.push(mathRun || new TextRun({
          text: `$${inlineToken.text || ''}$`,
          size: inherited.size,
          font: 'Consolas',
          color: inherited.color,
        }));
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

  const appendListParagraphs = async (listToken: any, level = 0): Promise<void> => {
    const start = typeof listToken.start === 'number' ? listToken.start : 1;
    for (const [index, item] of (listToken.items || []).entries()) {
      const itemTokens = item.tokens || [];
      const inlineTokens = itemTokens.filter((itemToken: any) => itemToken.type !== 'list');
      const nestedLists = itemTokens.filter((itemToken: any) => itemToken.type === 'list');
      const prefix = listToken.ordered ? `${start + index}. ` : '• ';

      sectionsChildren.push(
        new Paragraph({
          indent: { left: 480 + level * 360 },
          spacing: { before: 80, after: 80 },
          children: [
            new TextRun({
              text: prefix,
              bold: true,
              color: accentHex,
              size: 22,
              font: bodyFont || docxFont,
            }),
            ...(await createInlineRuns(inlineTokens.length > 0 ? inlineTokens : [{ type: 'text', text: item.text }], { font: bodyFont })),
          ],
        })
      );

      for (const nestedList of nestedLists) {
        await appendListParagraphs(nestedList, level + 1);
      }
    }
  };

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

    // Cover Page Break
    sectionsChildren.push(
      new Paragraph({
        children: [new PageBreak()],
      })
    );
  }

  // 2. Table of Contents Page
  if (toc.show) {
    const titleStyle = toc.titleStyle ?? 'underline';
    const titleFont = getTocTitleFont(toc);
    sectionsChildren.push(
      new Paragraph({
        alignment: toc.titleCenter ? AlignmentType.CENTER : undefined,
        spacing: { before: titleFont.marginBefore * 15, after: titleFont.marginAfter * 15 },
        border: titleStyle === 'underline'
          ? { bottom: { color: accentHex, style: BorderStyle.SINGLE, size: 12, space: 6 } }
          : titleStyle === 'accent-block'
          ? { left: { color: accentHex, style: BorderStyle.SINGLE, size: 30, space: 8 } }
          : undefined,
        shading: titleStyle === 'badge' ? { type: ShadingType.PERCENT_10, color: accentHex, fill: 'FFFFFF' } : undefined,
        children: [
          new TextRun({
            text: toc.title || '目 录',
            bold: titleFont.bold,
            italics: titleFont.italic,
            underline: titleFont.underline ? {} : undefined,
            size: titleFont.fontSize * 2,
            color: primaryHex,
            font: titleFont.fontFamily && titleFont.fontFamily !== 'inherit' ? titleFont.fontFamily : fontName,
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
  const tokens = splitExplicitPages(bodyText).flatMap((page, index) => [
    ...(index > 0 ? [{ type: 'pagebreak', raw: '' }] : []),
    ...marked.lexer(page),
  ]);
  const headingCounters = [0, 0, 0, 0];

  for (const token of tokens) {
    switch (token.type) {
      case 'pagebreak': {
        sectionsChildren.push(new Paragraph({ children: [new PageBreak()] }));
        break;
      }
      case 'heading': {
        const level = token.depth;
        let headingLevel: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1;
        let fontSize = 32; // 16pt
        let color = primaryHex;

        if (level === 1) {
          if (style.paginationMode !== 'manual' && style.h1PageBreak && sectionsChildren.length > 0) {
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

        const headingConfig = style.headingFonts[`h${Math.min(level, 4)}` as 'h1' | 'h2' | 'h3' | 'h4'];
        const headingFont = headingConfig.fontFamily === 'inherit' ? undefined : headingConfig.fontFamily;
        const headingPrefix = getHeadingText('', level, headingCounters, toc.headingNumbering).trim();

        sectionsChildren.push(
          new Paragraph({
            heading: headingLevel,
            alignment: (level === 1 && style.h1Center) ? AlignmentType.CENTER : undefined,
            spacing: { before: headingConfig.marginBefore * 15, after: headingConfig.marginAfter * 15 },
            children: [
              ...(headingPrefix ? [new TextRun({
                text: `${headingPrefix} `,
                bold: headingConfig.bold,
                italics: headingConfig.italic,
                underline: headingConfig.underline ? {} : undefined,
                size: headingConfig.fontSize * 2,
                color,
                font: headingFont || docxFont,
              })] : []),
              ...(await createInlineRuns(token.tokens || [{ type: 'text', text: token.text }], {
                bold: headingConfig.bold,
                italics: headingConfig.italic,
                underline: headingConfig.underline,
                size: headingConfig.fontSize * 2,
                color,
                font: headingFont,
              })),
            ],
          })
        );
        break;
      }

      case 'paragraph': {
        const paragraphTokens = token.tokens || [{ type: 'text', text: token.text }];
        sectionsChildren.push(
          new Paragraph({
            spacing: { before: 120, after: 120, line: 320 },
            indent: style.indentParagraph ? { firstLine: 480 } : undefined,
            children: await createInlineRuns(paragraphTokens, { font: bodyFont }),
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
            children: await createInlineRuns(token.tokens || [{ type: 'text', text: token.text }], { italics: true, color: '475569', font: bodyFont }),
          })
        );
        break;
      }

      case 'code': {
        if (token.lang?.toLowerCase() === 'mermaid') {
          try {
            const diagram = await renderMermaidPng(token.text);
            sectionsChildren.push(new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 160, after: 160 },
              children: [new ImageRun({
                type: 'png',
                data: diagram.data,
                transformation: { width: diagram.width, height: diagram.height },
                altText: { title: 'Mermaid 图表', description: 'Mermaid 图表', name: 'Mermaid 图表' },
              })],
            }));
            break;
          } catch (error) {
            console.warn('DOCX Mermaid rendering failed:', error);
          }
        }

        const lines = token.text.split('\n');
        lines.forEach((line: string) => {
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

      case 'mathBlock': {
        const mathRun = await createMathImageRun(token.text || '', true, 22);
        if (mathRun) {
          sectionsChildren.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 160, after: 160 },
              children: [mathRun],
            })
          );
        } else {
          sectionsChildren.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 160, after: 160 },
              children: [new TextRun({ text: `$$${token.text || ''}$$`, size: 20, font: 'Consolas', color: textHex })],
            })
          );
        }
        break;
      }

      case 'list': {
        await appendListParagraphs(token);
        break;
      }

      case 'table': {
        const minimalTable = style.tableStyle === 'minimal';
        const borderedTable = style.tableStyle === 'bordered';
        const minimalHeaderBorders = {
          top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: primaryHex },
          left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
          right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        };
        const minimalTableBorders = {
          top: { style: BorderStyle.SINGLE, size: 4, color: primaryHex },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: primaryHex },
          left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
          right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
          insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
          insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        };
        const headerCells = await Promise.all(token.header.map(async (col: any) => {
          return new TableCell({
            shading: minimalTable ? undefined : {
              fill: primaryHex,
              type: ShadingType.CLEAR,
            },
            borders: minimalTable ? minimalHeaderBorders : undefined,
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            children: [
              new Paragraph({
                alignment: minimalTable ? AlignmentType.CENTER : AlignmentType.LEFT,
                children: await createInlineRuns(col.tokens || [{ type: 'text', text: col.text }], {
                  bold: !minimalTable,
                  color: minimalTable ? primaryHex : 'FFFFFF',
                  size: 20,
                  font: bodyFont,
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
                fill: style.tableStyle === 'striped' && rowIndex % 2 === 1 ? 'F8FAFC' : 'FFFFFF',
                type: ShadingType.CLEAR,
              },
              borders: minimalTable ? noTableBorders : undefined,
              margins: { top: 100, bottom: 100, left: 160, right: 160 },
              children: [
                new Paragraph({
                  alignment: minimalTable ? AlignmentType.CENTER : AlignmentType.LEFT,
                  children: await createInlineRuns(cell.tokens || [{ type: 'text', text: cell.text }], {
                    color: textHex,
                    size: 20,
                    font: bodyFont,
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
            borders: borderedTable ? undefined : minimalTable ? minimalTableBorders : undefined,
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

  const tocStyles = getTocLevelStyles(toc).map((level, index) => ({
    id: `TOC${index + 1}`,
    name: `TOC ${index + 1}`,
    basedOn: 'Normal',
    next: 'Normal',
    quickFormat: true,
    paragraph: {
      spacing: { before: level.marginBefore * 15, after: level.marginAfter * 15 },
      indent: { left: level.paddingLeft * 15 },
    },
    run: {
      bold: level.bold,
      italics: level.italic,
      underline: level.underline ? {} : undefined,
      size: level.fontSize * 2,
      font: level.fontFamily && level.fontFamily !== 'inherit' ? level.fontFamily : fontName,
    },
  }));

  // Create docx Document
  const doc = new Document({
    features: { updateFields: true },
    styles: { paragraphStyles: tocStyles },
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
