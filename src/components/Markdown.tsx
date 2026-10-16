// Minimal Markdown for the legal pages: headings, paragraphs, bullet lists,
// tables, **bold**, *italic*, `code` and [links](https://…). Builds React
// elements (no raw HTML), so the text can't inject markup. HTML comments are
// dropped. Links are limited to https:, mailto: and site-relative paths.

import type { ReactNode } from "react";

type Block =
  | { type: "h"; level: 1 | 2 | 3; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "table"; head: string[]; rows: string[][] };

const cells = (line: string) => line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/<!--[\s\S]*?-->/g, "").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => { if (para.length) { blocks.push({ type: "p", text: para.join(" ") }); para = []; } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (!line.trim() || /^---+$/.test(line.trim())) { flush(); continue; }
    if (h) { flush(); blocks.push({ type: "h", level: h[1].length as 1 | 2 | 3, text: h[2] }); continue; }
    if (/^\s*[-*]\s+/.test(line)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, "").trim());
      i--;
      blocks.push({ type: "ul", items });
      continue;
    }
    if (line.trim().startsWith("|") && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1] ?? "") && (lines[i + 1] ?? "").includes("-")) {
      flush();
      const head = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(cells(lines[i++]));
      i--;
      blocks.push({ type: "table", head, rows });
      continue;
    }
    para.push(line.trim());
  }
  flush();
  return blocks;
}

export function safeHref(url: string): string | null {
  return /^(https:\/\/|mailto:|\/(?!\/))/i.test(url) ? url : null;
}

const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

export function renderInline(text: string): ReactNode[] {
  return text.split(INLINE).filter(Boolean).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i}>{part.slice(1, -1)}</code>;
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      const href = safeHref(link[2]);
      return href ? <a key={i} href={href} className="text-accent underline underline-offset-4">{link[1]}</a> : <span key={i}>{link[1]}</span>;
    }
    if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

export function Markdown({ source }: { source: string }) {
  return (
    <div className="space-y-4 text-[15px] leading-relaxed text-ink">
      {parseMarkdown(source).map((b, i) => {
        switch (b.type) {
          case "h":
            return b.level === 1 ? <h1 key={i} className="font-display text-3xl leading-tight sm:text-4xl">{renderInline(b.text)}</h1>
              : b.level === 2 ? <h2 key={i} className="pt-4 font-display text-xl">{renderInline(b.text)}</h2>
              : <h3 key={i} className="pt-2 font-semibold">{renderInline(b.text)}</h3>;
          case "p":
            return <p key={i}>{renderInline(b.text)}</p>;
          case "ul":
            return <ul key={i} className="list-disc space-y-1.5 pl-5">{b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}</ul>;
          case "table":
            return (
              <div key={i} className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead><tr>{b.head.map((c, j) => <th key={j} className="border-b border-line-strong px-2 py-2 font-semibold">{renderInline(c)}</th>)}</tr></thead>
                  <tbody>{b.rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k} className="border-b border-line px-2 py-2 align-top">{renderInline(c)}</td>)}</tr>)}</tbody>
                </table>
              </div>
            );
        }
      })}
    </div>
  );
}
