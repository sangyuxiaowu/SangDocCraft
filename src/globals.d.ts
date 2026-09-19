declare const __APP_VERSION__: string;

/** Vite 原始文本导入：模板正文以 .md 文件维护，通过 ?raw 载入 */
declare module '*.md?raw' {
  const content: string;
  export default content;
}