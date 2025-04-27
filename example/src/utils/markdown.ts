import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'

// 创建并导出共享的markdown实例
const md = (() => {
  const instance = new MarkdownIt({
    linkify: true,
    breaks: true,
    html: false,
    highlight: function (str: string, lang: string): string {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return '<pre class="hljs"><code>' +
                hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
                '</code></pre>';
        } catch (__) {}
      }
      
      return '<pre class="hljs"><code>' + instance.utils.escapeHtml(str) + '</code></pre>';
    }
  });
  return instance;
})();

// 渲染Markdown的工具函数
export function renderMarkdown(text: string): string {
  return md.render(text || '')
}

export default md 