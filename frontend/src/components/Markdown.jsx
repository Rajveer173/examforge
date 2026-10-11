import { Fragment, memo, useMemo } from 'react';
import { CopyButton, cx } from './ui.jsx';

/*
 * A small, dependency-free Markdown renderer for AI replies.
 *
 * It parses into plain React elements — there is no dangerouslySetInnerHTML
 * anywhere, so raw HTML in a reply is shown as text, never executed. Links are
 * only rendered when their target is http(s), mailto or a relative path.
 *
 * Supported: ATX headings, paragraphs, bold / italic / bold-italic,
 * strikethrough, inline code, fenced code (``` and ~~~, with a language label
 * and a copy button), ordered / unordered / nested / task lists, GFM tables
 * with alignment rows, blockquotes, horizontal rules, links, autolinks, bare
 * URLs, backslash escapes and <br> inside table cells. Unclosed fences render
 * to the end of the text, so a half-received reply still looks sensible.
 */

/* ------------------------------------------------------------------ links */

function safeHref(raw) {
  const url = String(raw ?? '').trim();
  if (!url) return null;
  if (/^(https?:|mailto:)/i.test(url)) return url;
  // Protocol-relative URLs point off-site with an inherited scheme; refuse them.
  if (url.startsWith('//')) return null;
  // Anything else carrying a scheme (javascript:, data:, vbscript:, file:…) is refused.
  const colon = url.indexOf(':');
  const firstSep = url.search(/[/?#]/);
  if (colon !== -1 && (firstSep === -1 || colon < firstSep)) return null;
  return url;
}

function Link({ href, children }) {
  const safe = safeHref(href);
  if (!safe) return <span>{children}</span>;
  const external = /^https?:/i.test(safe);
  return (
    <a
      href={safe}
      className="font-medium text-accent-ink underline decoration-accent/40 underline-offset-2 transition-colors hover:decoration-accent"
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </a>
  );
}

/* ----------------------------------------------------------------- inline */

// Alternatives are tried left to right at the earliest matching position.
const INLINE_RE = new RegExp(
  [
    String.raw`\\([\\\x60*_{}\[\]()#+\-.!|~<>])`, // 1 backslash escape
    String.raw`(\x60+)([^\x60]|[\s\S]*?[^\x60])\2(?!\x60)`, // 2,3 code span
    String.raw`<br\s*\/?>`, // explicit line break (common inside table cells)
    String.raw`\*\*\*(?!\s)([\s\S]+?)(?<!\s)\*\*\*`, // 4 bold italic
    String.raw`\*\*(?!\s)([\s\S]+?)(?<!\s)\*\*`, // 5 bold
    String.raw`(?<![\w])__(?!\s)([\s\S]+?)(?<!\s)__(?![\w])`, // 6 bold
    String.raw`~~(?!\s)([\s\S]+?)(?<!\s)~~`, // 7 strikethrough
    String.raw`\*(?![\s*])([\s\S]+?)(?<![\s*])\*`, // 8 italic
    String.raw`(?<![\w])_(?![\s_])([\s\S]+?)(?<![\s_])_(?![\w])`, // 9 italic
    String.raw`!?\[((?:\\.|[^\]\\])*)\]\(\s*<?([^\s()<>]*(?:\([^\s()<>]*\)[^\s()<>]*)*)>?(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)`, // 10,11 link / image
    String.raw`<((?:https?:\/\/|mailto:)[^\s<>]+)>`, // 12 autolink
    String.raw`(?<![\w/])(https?:\/\/[^\s<>]*[^\s<>.,:;"'!?)\]*_~])`, // 13 bare URL
  ].join('|'),
  'g',
);

function parseInline(text, keyPrefix = 'i') {
  const out = [];
  let last = 0;
  let n = 0;
  const key = () => `${keyPrefix}-${n++}`;
  const re = new RegExp(INLINE_RE.source, 'g');
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = key();
    if (m[1] !== undefined) out.push(m[1]);
    else if (m[2] !== undefined) {
      // Per CommonMark, one leading and trailing space is stripped if both exist.
      let code = m[3].replace(/\n/g, ' ');
      if (/^ .* $/.test(code) && code.trim()) code = code.slice(1, -1);
      out.push(
        <code
          key={k}
          className="rounded-md bg-surface-sunken px-1.5 py-0.5 font-mono text-[0.85em] text-accent-ink ring-1 ring-inset ring-line"
        >
          {code}
        </code>,
      );
    } else if (m[0].startsWith('<br') || m[0].startsWith('<BR')) out.push(<br key={k} />);
    else if (m[4] !== undefined) {
      out.push(
        <strong key={k} className="font-semibold text-ink">
          <em>{parseInline(m[4], k)}</em>
        </strong>,
      );
    } else if (m[5] !== undefined || m[6] !== undefined) {
      out.push(
        <strong key={k} className="font-semibold text-ink">
          {parseInline(m[5] ?? m[6], k)}
        </strong>,
      );
    } else if (m[7] !== undefined) out.push(<del key={k} className="text-ink-muted">{parseInline(m[7], k)}</del>);
    else if (m[8] !== undefined || m[9] !== undefined) out.push(<em key={k}>{parseInline(m[8] ?? m[9], k)}</em>);
    else if (m[10] !== undefined) {
      // Images are rendered as links rather than fetched: nothing loads from a
      // URL the model invented unless the reader chooses to open it.
      const label = m[10] || m[11];
      out.push(
        <Link key={k} href={m[11]}>
          {m[0].startsWith('!') ? `🖼 ${label}` : parseInline(label, k)}
        </Link>,
      );
    } else if (m[12] !== undefined) out.push(<Link key={k} href={m[12]}>{m[12].replace(/^mailto:/i, '')}</Link>);
    else if (m[13] !== undefined) out.push(<Link key={k} href={m[13]}>{m[13]}</Link>);
    else out.push(m[0]);
    last = re.lastIndex;
    if (m[0].length === 0) re.lastIndex += 1;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Inline content where single newlines are kept as line breaks (chat-style). */
function InlineLines({ text, k }) {
  const lines = text.split('\n');
  return lines.map((line, i) => (
    <Fragment key={`${k}-l${i}`}>
      {i > 0 && <br />}
      {parseInline(line.replace(/(\\| {2,})$/, ''), `${k}-l${i}`)}
    </Fragment>
  ));
}

/* ----------------------------------------------------------------- blocks */

const FENCE_RE = /^( {0,3})(`{3,}|~{3,})\s*([^\s`]*)[^`]*$/;
const HEADING_RE = /^ {0,3}(#{1,6})(?:\s+(.*?))?(?:\s+#+)?\s*$/;
const HR_RE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const QUOTE_RE = /^ {0,3}> ?/;
const LIST_RE = /^( *)([-*+]|\d{1,9}[.)])(?:[ \t]+(.*))?$/;
const ALIGN_CELL_RE = /^:?-+:?$/;

function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells = [];
  let cur = '';
  let inCode = 0;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (ch === '\\' && s[i + 1] === '|') {
      cur += '|';
      i += 1;
    } else if (ch === '`') {
      let run = 1;
      while (s[i + run] === '`') run += 1;
      cur += '`'.repeat(run);
      if (inCode === 0) inCode = run;
      else if (inCode === run) inCode = 0;
      i += run - 1;
    } else if (ch === '|' && inCode === 0) {
      cells.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

function isAlignRow(line) {
  if (!line || !line.includes('-')) return false;
  const cells = splitRow(line);
  return cells.length > 0 && cells.every((c) => ALIGN_CELL_RE.test(c.replace(/\s+/g, '')));
}

function isTableStart(lines, i) {
  return lines[i]?.includes('|') && isAlignRow(lines[i + 1]) && (lines[i].trim().length > 1);
}

function startsBlock(lines, i) {
  const line = lines[i];
  return (
    FENCE_RE.test(line) ||
    HEADING_RE.test(line) ||
    HR_RE.test(line) ||
    QUOTE_RE.test(line) ||
    LIST_RE.test(line) ||
    isTableStart(lines, i)
  );
}

const leading = (line) => line.match(/^ */)[0].length;
const isBlank = (line) => line.trim() === '';

function parseList(lines, start) {
  const first = lines[start].match(LIST_RE);
  const baseIndent = first[1].length;
  const ordered = /\d/.test(first[2]);
  const startNum = ordered ? parseInt(first[2], 10) : 1;
  const items = [];
  let i = start;
  let loose = false;

  while (i < lines.length) {
    const m = lines[i].match(LIST_RE);
    if (!m || leading(lines[i]) > baseIndent + 1 || /\d/.test(m[2]) !== ordered) break;
    // Same-level item: the content column starts after the marker and its gap.
    const contentIndent = m[1].length + m[2].length + 1;
    const itemLines = [m[3] ?? ''];
    i += 1;
    let sawBlank = false;
    while (i < lines.length) {
      const line = lines[i];
      if (isBlank(line)) {
        sawBlank = true;
        itemLines.push('');
        i += 1;
        continue;
      }
      const ind = leading(line);
      if (ind > baseIndent) {
        itemLines.push(line.slice(Math.min(ind, contentIndent)));
        if (sawBlank) loose = true;
        sawBlank = false;
        i += 1;
        continue;
      }
      // Lazy continuation: an unindented line straight after paragraph text.
      if (!sawBlank && !startsBlock(lines, i)) {
        itemLines.push(line.trim());
        i += 1;
        continue;
      }
      break;
    }
    // Trailing blank lines belong between items, not inside this one.
    while (itemLines.length && isBlank(itemLines[itemLines.length - 1])) itemLines.pop();

    let checked = null;
    const task = itemLines[0].match(/^\[([ xX])\]\s+(.*)$/);
    if (task) {
      checked = task[1] !== ' ';
      itemLines[0] = task[2];
    }
    items.push({ blocks: parseBlocks(itemLines), checked });

    if (sawBlank) {
      const next = lines[i]?.match(LIST_RE);
      if (next && leading(lines[i]) <= baseIndent + 1 && /\d/.test(next[2]) === ordered) loose = true;
    }
  }
  return { node: { type: 'list', ordered, start: startNum, items, loose }, next: i };
}

function parseBlocks(lines) {
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) {
      i += 1;
      continue;
    }

    const fence = line.match(FENCE_RE);
    if (fence) {
      const [, indent, marker, lang] = fence;
      const body = [];
      i += 1;
      while (i < lines.length) {
        const close = lines[i].match(/^ {0,3}(`{3,}|~{3,})\s*$/);
        if (close && close[1][0] === marker[0] && close[1].length >= marker.length) {
          i += 1;
          break;
        }
        body.push(lines[i].replace(new RegExp(`^ {0,${indent.length}}`), ''));
        i += 1;
      }
      blocks.push({ type: 'code', lang: lang || '', code: body.join('\n') });
      continue;
    }

    const heading = line.match(HEADING_RE);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] ?? '' });
      i += 1;
      continue;
    }

    if (HR_RE.test(line)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    if (isTableStart(lines, i)) {
      const header = splitRow(line);
      const align = splitRow(lines[i + 1]).map((c) => {
        const s = c.replace(/\s+/g, '');
        if (s.startsWith(':') && s.endsWith(':')) return 'center';
        if (s.endsWith(':')) return 'right';
        if (s.startsWith(':')) return 'left';
        return null;
      });
      const rows = [];
      i += 2;
      while (i < lines.length && !isBlank(lines[i]) && lines[i].includes('|')) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      blocks.push({ type: 'table', header, align, rows });
      continue;
    }

    if (QUOTE_RE.test(line)) {
      const body = [];
      while (i < lines.length && QUOTE_RE.test(lines[i])) {
        body.push(lines[i].replace(QUOTE_RE, ''));
        i += 1;
      }
      blocks.push({ type: 'quote', blocks: parseBlocks(body) });
      continue;
    }

    if (LIST_RE.test(line)) {
      const { node, next } = parseList(lines, i);
      if (node.items.length) {
        blocks.push(node);
        i = next;
        continue;
      }
    }

    const para = [line.trim()];
    i += 1;
    while (i < lines.length && !isBlank(lines[i]) && !startsBlock(lines, i)) {
      para.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ type: 'paragraph', text: para.join('\n') });
  }
  return blocks;
}

/* --------------------------------------------------------------- renderers */

function CodeBlock({ lang, code }) {
  return (
    <div className="my-3 overflow-hidden rounded-xl border border-line bg-surface-sunken first:mt-0 last:mb-0">
      <div className="flex items-center justify-between gap-2 border-b border-line py-1 pl-3.5 pr-1">
        <span className="font-mono text-eyebrow uppercase text-ink-subtle">{lang || 'code'}</span>
        <CopyButton value={code} label="Copy" className="!h-7 !px-2.5 text-xs" />
      </div>
      <pre className="overflow-x-auto px-4 py-3 text-[0.8125rem] leading-relaxed">
        <code className="font-mono text-ink">{code}</code>
      </pre>
    </div>
  );
}

const HEADING_CLASSES = {
  1: 'text-lg font-bold',
  2: 'text-base font-bold',
  3: 'text-[0.9375rem] font-semibold',
  4: 'text-sm font-semibold',
  5: 'text-sm font-semibold text-ink-muted',
  6: 'text-eyebrow uppercase text-ink-muted',
};

function renderBlocks(blocks, k, { tight = false } = {}) {
  return blocks.map((b, idx) => {
    const key = `${k}-${idx}`;
    switch (b.type) {
      case 'heading': {
        const Tag = `h${b.level}`;
        return (
          <Tag key={key} className={cx('mb-2 mt-4 leading-snug text-ink first:mt-0', HEADING_CLASSES[b.level])}>
            {parseInline(b.text, key)}
          </Tag>
        );
      }
      case 'paragraph':
        return tight ? (
          <Fragment key={key}>
            <InlineLines text={b.text} k={key} />
          </Fragment>
        ) : (
          <p key={key} className="my-2 leading-relaxed first:mt-0 last:mb-0">
            <InlineLines text={b.text} k={key} />
          </p>
        );
      case 'code':
        return <CodeBlock key={key} lang={b.lang} code={b.code} />;
      case 'hr':
        return <hr key={key} className="my-4 border-line" />;
      case 'quote':
        return (
          <blockquote
            key={key}
            className="my-3 border-l-[3px] border-accent/40 bg-accent-soft/40 py-1.5 pl-3.5 pr-2 text-ink-muted first:mt-0 last:mb-0"
          >
            {renderBlocks(b.blocks, key)}
          </blockquote>
        );
      case 'list': {
        const Tag = b.ordered ? 'ol' : 'ul';
        const isTask = b.items.some((it) => it.checked !== null);
        return (
          <Tag
            key={key}
            start={b.ordered && b.start !== 1 ? b.start : undefined}
            className={cx(
              'my-2 space-y-1 first:mt-0 last:mb-0',
              isTask ? 'list-none pl-1' : 'pl-5',
              !isTask && (b.ordered ? 'list-decimal' : 'list-disc'),
              'marker:text-ink-subtle',
            )}
          >
            {b.items.map((it, j) => {
              const itemKey = `${key}-${j}`;
              const tightItem = !b.loose && it.blocks.length > 0 && it.blocks[0].type === 'paragraph';
              const [head, ...rest] = it.blocks;
              return (
                <li key={itemKey} className={cx('pl-0.5 leading-relaxed', it.checked !== null && 'flex gap-2')}>
                  {it.checked !== null && (
                    <input
                      type="checkbox"
                      checked={it.checked}
                      readOnly
                      disabled
                      aria-label={it.checked ? 'Done' : 'Not done'}
                      className="mt-1 h-3.5 w-3.5 shrink-0 accent-[rgb(var(--accent))]"
                    />
                  )}
                  <div className={it.checked !== null ? 'min-w-0 flex-1' : 'contents'}>
                    {tightItem ? (
                      <>
                        {renderBlocks([head], itemKey, { tight: true })}
                        {renderBlocks(rest, `${itemKey}r`)}
                      </>
                    ) : (
                      renderBlocks(it.blocks, itemKey)
                    )}
                  </div>
                </li>
              );
            })}
          </Tag>
        );
      }
      case 'table': {
        const cols = Math.max(b.header.length, ...b.rows.map((r) => r.length));
        const cellAlign = (c) => (b.align[c] ? { textAlign: b.align[c] } : undefined);
        return (
          <div
            key={key}
            className="my-3 max-w-full overflow-x-auto rounded-xl border border-line bg-surface first:mt-0 last:mb-0"
            role="region"
            aria-label="Table"
            tabIndex={0}
          >
            <table className="w-full border-collapse text-left text-[0.8125rem]">
              <thead className="bg-surface-sunken">
                <tr>
                  {Array.from({ length: cols }, (_, c) => (
                    <th
                      key={c}
                      scope="col"
                      style={cellAlign(c)}
                      className="whitespace-nowrap border-b border-line px-3 py-2 font-semibold text-ink"
                    >
                      {parseInline(b.header[c] ?? '', `${key}-h${c}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((row, r) => (
                  <tr key={r} className="border-t border-line first:border-t-0 even:bg-surface-sunken/40">
                    {Array.from({ length: cols }, (_, c) => (
                      <td key={c} style={cellAlign(c)} className="px-3 py-2 align-top text-ink">
                        {parseInline(row[c] ?? '', `${key}-${r}-${c}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      default:
        return null;
    }
  });
}

/** Parse Markdown text into a block tree. Exported for tests. */
export function parseMarkdown(text) {
  const lines = String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '    ')
    .split('\n');
  return parseBlocks(lines);
}

export const Markdown = memo(function Markdown({ children, className }) {
  const blocks = useMemo(() => parseMarkdown(children), [children]);
  return <div className={cx('min-w-0 break-words text-sm text-ink', className)}>{renderBlocks(blocks, 'md')}</div>;
});

export default Markdown;
