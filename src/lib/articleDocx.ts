import {
  Document,
  ExternalHyperlink,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
  type ParagraphChild,
} from "docx";
import { parseDocument } from "htmlparser2";

// "Preview naar klant": the article as a Word file, text only (no image),
// with headings, bold/italic, lists and clickable links, so the customer can
// read and approve it before it goes online.

type Node = {
  type: string;
  name?: string;
  data?: string;
  attribs?: Record<string, string>;
  children?: Node[];
};

type Style = { bold?: boolean; italics?: boolean; underline?: boolean; strike?: boolean };

const FONT = "Calibri";
const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

function runs(nodes: Node[] = [], style: Style = {}): ParagraphChild[] {
  const out: ParagraphChild[] = [];
  for (const node of nodes) {
    if (node.type === "text") {
      const text = decode(node.data ?? "").replace(/\s+/g, " ");
      if (text) out.push(new TextRun({ text, font: FONT, ...runStyle(style) }));
      continue;
    }
    if (node.type !== "tag") continue;
    const name = node.name;
    if (name === "br") {
      out.push(new TextRun({ text: "", break: 1 }));
    } else if (name === "a" && node.attribs?.href && /^https?:\/\//i.test(node.attribs.href)) {
      const text = decode(textOf(node)).replace(/\s+/g, " ").trim() || node.attribs.href;
      out.push(
        new ExternalHyperlink({
          link: node.attribs.href,
          children: [new TextRun({ text, font: FONT, style: "Hyperlink", ...runStyle(style) })],
        })
      );
    } else {
      const next: Style = {
        ...style,
        ...(name === "strong" || name === "b" ? { bold: true } : {}),
        ...(name === "em" || name === "i" ? { italics: true } : {}),
        ...(name === "u" ? { underline: true } : {}),
        ...(name === "s" ? { strike: true } : {}),
      };
      out.push(...runs(node.children, next));
    }
  }
  return out;
}

const runStyle = (s: Style) => ({
  bold: s.bold,
  italics: s.italics,
  strike: s.strike,
  underline: s.underline ? {} : undefined,
});

function textOf(node: Node): string {
  if (node.type === "text") return node.data ?? "";
  return (node.children ?? []).map(textOf).join("");
}

const BLOCK = new Set(["p", "h1", "h2", "h3", "ul", "ol", "li", "blockquote", "table", "div", "hr"]);

function blocks(nodes: Node[] = []): Paragraph[] {
  const out: Paragraph[] = [];
  let loose: Node[] = [];
  const flush = () => {
    if (loose.some((n) => textOf(n).trim())) out.push(new Paragraph({ children: runs(loose), spacing: { after: 160 } }));
    loose = [];
  };
  for (const node of nodes) {
    if (node.type !== "tag" || !BLOCK.has(node.name ?? "")) {
      loose.push(node);
      continue;
    }
    flush();
    switch (node.name) {
      case "h1":
      case "h2":
      case "h3":
        out.push(
          new Paragraph({
            heading: node.name === "h3" ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_2,
            children: runs(node.children),
            spacing: { before: 240, after: 120 },
          })
        );
        break;
      case "ul":
      case "ol":
        for (const li of (node.children ?? []).filter((c) => c.type === "tag" && c.name === "li")) {
          out.push(
            new Paragraph({
              children: runs(li.children),
              ...(node.name === "ol" ? { numbering: { reference: "numbers", level: 0 } } : { bullet: { level: 0 } }),
            })
          );
        }
        break;
      case "blockquote":
        out.push(new Paragraph({ children: runs(node.children, { italics: true }), indent: { left: 567 } }));
        break;
      case "table":
        // Rows as lines of text, cells separated by a tab: readable, no grid.
        for (const row of findAll(node, "tr")) {
          const cells = findAll(row, "td").concat(findAll(row, "th"));
          out.push(new Paragraph({ children: [new TextRun({ text: cells.map((c) => decode(textOf(c)).trim()).join("\t"), font: FONT })] }));
        }
        break;
      case "hr":
        break;
      default:
        out.push(new Paragraph({ children: runs(node.children), spacing: { after: 160 } }));
    }
  }
  flush();
  return out;
}

function findAll(node: Node, name: string): Node[] {
  return (node.children ?? []).flatMap((c) => (c.type === "tag" && c.name === name ? [c] : findAll(c, name)));
}

export async function articleToDocx({
  title,
  html,
  note,
}: {
  title: string;
  html: string;
  // A small grey line above the title: for whom, which site, which version.
  note?: string;
}): Promise<Buffer> {
  const dom = parseDocument(html) as unknown as { children: Node[] };
  const doc = new Document({
    creator: "Nugevonden",
    title,
    styles: {
      default: { document: { run: { font: FONT, size: 22 } } },
      paragraphStyles: [
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", run: { size: 28, bold: true, color: "2F5496" } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", run: { size: 24, bold: true, color: "2F5496" } },
      ],
    },
    numbering: {
      config: [
        {
          reference: "numbers",
          levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", style: { paragraph: { indent: { left: 567, hanging: 283 } } } }],
        },
      ],
    },
    sections: [
      {
        children: [
          ...(note ? [new Paragraph({ children: [new TextRun({ text: note, size: 18, color: "808080", font: FONT })], spacing: { after: 240 } })] : []),
          new Paragraph({
            children: [new TextRun({ text: title, bold: true, size: 40, color: "1F3864", font: FONT })],
            spacing: { after: 240 },
          }),
          ...blocks(dom.children),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}
