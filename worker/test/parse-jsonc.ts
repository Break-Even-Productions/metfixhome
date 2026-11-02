/** Strip `//` / `/*` JSONC comments without eating `https://` inside strings. */
export function stripJsonc(input: string): string {
  let out = "";
  let i = 0;
  let inString = false;
  let quote: '"' | "'" | null = null;
  let escape = false;
  while (i < input.length) {
    const c = input[i]!;
    const n = input[i + 1];
    if (inString) {
      out += c;
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === quote) inString = false;
      i += 1;
      continue;
    }
    if (c === '"' || c === "'") {
      inString = true;
      quote = c;
      out += c;
      i += 1;
      continue;
    }
    if (c === "/" && n === "/") {
      while (i < input.length && input[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && n === "*") {
      i += 2;
      while (i < input.length && !(input[i] === "*" && input[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

export function parseJsonc(raw: string): unknown {
  return JSON.parse(stripJsonc(raw));
}
