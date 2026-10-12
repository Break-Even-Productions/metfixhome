/**
 * Minimal HTMLRewriter polyfill for Node vitest unit tests.
 * Production + pool-workers tests use workerd's real HTMLRewriter.
 *
 * Inserted/replaced HTML is not re-tokenized (matches workerd).
 */

type Handler = {
  element?: (element: PolyElement) => void;
};

type Mutation =
  | { kind: "remove"; start: number; end: number }
  | { kind: "replace"; start: number; end: number; content: string }
  | { kind: "append"; at: number; content: string };

class PolyElement {
  private action: Mutation | null = null;
  constructor(
    private readonly start: number,
    private readonly end: number,
    private readonly appendAt: number | null,
  ) {}

  remove() {
    this.action = { kind: "remove", start: this.start, end: this.end };
  }

  replace(content: string, _opts?: { html?: boolean }) {
    this.action = { kind: "replace", start: this.start, end: this.end, content };
  }

  append(content: string, _opts?: { html?: boolean }) {
    if (this.appendAt == null) return;
    this.action = { kind: "append", at: this.appendAt, content };
  }

  take(): Mutation | null {
    return this.action;
  }
}

function attrsOf(openTag: string): Map<string, string> {
  const attrs = new Map<string, string>();
  const re = /([a-zA-Z_:][-a-zA-Z0-9_.:]*)\s*=\s*(["'])(.*?)\2/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(openTag))) attrs.set(m[1]!, m[3]!);
  return attrs;
}

function matchSelector(tag: string, attrs: Map<string, string>, selector: string): boolean {
  if (selector === "title" || selector === "body") return tag === selector;
  const m = selector.match(/^([a-z0-9]+)(?:\[([^\]]+)\])?$/i);
  if (!m || m[1]!.toLowerCase() !== tag) return false;
  const attrPart = m[2];
  if (!attrPart) return true;
  const am = attrPart.match(/^([^=\]]+)(?:=["']([^"']*)["'])?$/);
  if (!am) return false;
  const actual = attrs.get(am[1]!);
  return am[2] === undefined ? actual != null : actual === am[2];
}

function transformHtml(html: string, rules: Array<{ selector: string; handler: Handler }>): string {
  const muts: Mutation[] = [];

  const paired = /<(title|body)(\s[^>]*)?>[\s\S]*?<\/\1\s*>/gi;
  let pm: RegExpExecArray | null;
  while ((pm = paired.exec(html))) {
    const full = pm[0]!;
    const start = pm.index;
    const end = start + full.length;
    const open = full.match(/^<[^>]+>/)![0]!;
    const tag = open.match(/^<\s*([a-zA-Z0-9]+)/)![1]!.toLowerCase();
    const attrs = attrsOf(open);
    const closeAt = full.toLowerCase().lastIndexOf(`</${tag}`);
    const appendAt = tag === "body" ? start + closeAt : null;
    for (const rule of rules) {
      if (!matchSelector(tag, attrs, rule.selector) || !rule.handler.element) continue;
      const el = new PolyElement(start, end, appendAt);
      rule.handler.element(el);
      const action = el.take();
      if (action) muts.push(action);
    }
  }

  const voids = /<(meta|link)(\s[^>]*)?\/?>/gi;
  let vm: RegExpExecArray | null;
  while ((vm = voids.exec(html))) {
    const full = vm[0]!;
    const start = vm.index;
    const end = start + full.length;
    const tag = full.match(/^<\s*([a-zA-Z0-9]+)/)![1]!.toLowerCase();
    const attrs = attrsOf(full);
    for (const rule of rules) {
      if (!matchSelector(tag, attrs, rule.selector) || !rule.handler.element) continue;
      const el = new PolyElement(start, end, null);
      rule.handler.element(el);
      const action = el.take();
      if (action) muts.push(action);
    }
  }

  // Apply from end → start so indices stay valid. Appends at the same point
  // are concatenated in recorded order.
  muts.sort((a, b) => {
    const aPos = a.kind === "append" ? a.at : a.start;
    const bPos = b.kind === "append" ? b.at : b.start;
    if (aPos !== bPos) return bPos - aPos;
    if (a.kind === "append" && b.kind === "append") return 0;
    return 0;
  });

  let out = html;
  for (const m of muts) {
    if (m.kind === "remove") {
      out = out.slice(0, m.start) + out.slice(m.end);
    } else if (m.kind === "replace") {
      out = out.slice(0, m.start) + m.content + out.slice(m.end);
    } else {
      out = out.slice(0, m.at) + m.content + out.slice(m.at);
    }
  }
  return out;
}

class PolyHTMLRewriter {
  private rules: Array<{ selector: string; handler: Handler }> = [];

  on(selector: string, handler: Handler) {
    this.rules.push({ selector, handler });
    return this;
  }

  transform(response: Response): Response {
    const rules = this.rules;
    const status = response.status;
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const html = transformHtml(await response.text(), rules);
        controller.enqueue(new TextEncoder().encode(html));
        controller.close();
      },
    });
    return new Response(stream, { status, headers });
  }
}

export function installHtmlRewriterPolyfill() {
  const g = globalThis as unknown as { HTMLRewriter?: typeof PolyHTMLRewriter };
  if (typeof g.HTMLRewriter === "undefined") {
    g.HTMLRewriter = PolyHTMLRewriter;
  }
}
