/**
 * Minimal Markdown to blocks for the file preview panel (headings, paragraphs, lists, tables,
 * quotes, code). Every block carries its HTML (escaped, so replayed file text can never inject
 * markup) and its plain text (used to find a block to zoom on).
 */
'use strict';

(function (root) {
  const escapeHtml = (s) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function inline(text) {
    return escapeHtml(text)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }

  const plain = (text) => text.replace(/`/g, '').replace(/\*\*/g, '');

  function splitRow(line) {
    return line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim());
  }

  /** @returns {Array<{type:string,html:string,text:string}>} */
  function parseMarkdown(source) {
    const lines = source.replace(/\r/g, '').split('\n');
    const blocks = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim() || /^<!--.*-->\s*$/.test(line)) {
        i += 1;
        continue;
      }
      const heading = /^(#{1,4})\s+(.*)$/.exec(line);
      if (heading) {
        const level = heading[1].length;
        blocks.push({
          type: `h${level}`,
          html: `<h${level}>${inline(heading[2])}</h${level}>`,
          text: plain(heading[2]),
        });
        i += 1;
        continue;
      }
      if (/^---+\s*$/.test(line)) {
        blocks.push({ type: 'hr', html: '<hr>', text: '' });
        i += 1;
        continue;
      }
      if (line.startsWith('```')) {
        const body = [];
        i += 1;
        while (i < lines.length && !lines[i].startsWith('```')) body.push(lines[i++]);
        i += 1;
        blocks.push({
          type: 'code',
          html: `<pre>${escapeHtml(body.join('\n'))}</pre>`,
          text: body.join('\n'),
        });
        continue;
      }
      if (line.startsWith('>')) {
        const body = [];
        while (i < lines.length && lines[i].startsWith('>'))
          body.push(lines[i++].replace(/^>\s?/, ''));
        const text = body.join(' ');
        blocks.push({
          type: 'quote',
          html: `<blockquote>${inline(text)}</blockquote>`,
          text: plain(text),
        });
        continue;
      }
      if (line.trim().startsWith('|') && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] || '')) {
        const head = splitRow(line);
        i += 2;
        const body = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) body.push(splitRow(lines[i++]));
        const th = head.map((cell) => `<th>${inline(cell)}</th>`).join('');
        const tr = body
          .map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`)
          .join('');
        blocks.push({
          type: 'table',
          html: `<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`,
          text: [head, ...body].map((row) => row.join(' ')).join(' '),
        });
        continue;
      }
      const item = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(line);
      if (item) {
        let text = item[3];
        i += 1;
        while (
          i < lines.length &&
          /^\s{2,}\S/.test(lines[i]) &&
          !/^\s*([-*]|\d+\.)\s/.test(lines[i])
        ) {
          text += ' ' + lines[i++].trim();
        }
        blocks.push({
          type: 'li',
          html: `<div class="li"><span class="dot"></span><span>${inline(text)}</span></div>`,
          text: plain(text),
        });
        continue;
      }
      const body = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^(#{1,4}\s|>|```|---+\s*$)/.test(lines[i]) &&
        !/^<!--.*-->\s*$/.test(lines[i])
      ) {
        body.push(lines[i++].trim());
      }
      blocks.push({
        type: 'p',
        html: `<p>${body.map(inline).join('<br>')}</p>`,
        text: plain(body.join(' ')),
      });
    }
    return blocks;
  }

  /** JSON as one block per line, with keys, strings and numbers coloured. */
  function parseJsonLines(source) {
    return source
      .replace(/\r/g, '')
      .replace(/\n+$/, '')
      .split('\n')
      .map((line) => {
        const html = escapeHtml(line)
          .replace(/^(\s*)(&quot;[^&]*?&quot;)(:)/, '$1<span class="jk">$2</span>$3')
          .replace(/(: |\[|, )(&quot;.*?&quot;)/g, '$1<span class="js">$2</span>')
          .replace(/(: )(-?\d+(?:\.\d+)?|true|false|null)/g, '$1<span class="jn">$2</span>');
        return { type: 'codeline', html: `<div class="cl">${html || '&nbsp;'}</div>`, text: line };
      });
  }

  const api = { parseMarkdown, parseJsonLines, escapeHtml };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.SC = root.SC || {}).markdown = api;
})(globalThis);
