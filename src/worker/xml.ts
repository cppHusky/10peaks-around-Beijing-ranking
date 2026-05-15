export function decodeXml(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (_match, entity: string) => {
    if (entity === "amp") return "&";
    if (entity === "lt") return "<";
    if (entity === "gt") return ">";
    if (entity === "quot") return '"';
    if (entity === "apos") return "'";
    if (entity.startsWith("#x")) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith("#")) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return entity;
  });
}

export function parseAttrs(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /([A-Za-z_][\w:.-]*)="([^"]*)"/g;
  let match: RegExpExecArray | null;

  while ((match = attrRegex.exec(source))) {
    attrs[match[1]] = decodeXml(match[2]);
  }

  return attrs;
}

export function parseSharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];

  const strings: string[] = [];
  const stringRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let match: RegExpExecArray | null;

  while ((match = stringRegex.exec(xml))) {
    const textParts = [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((textMatch) => {
      return decodeXml(textMatch[1]);
    });
    strings.push(textParts.join(""));
  }

  return strings;
}

export function columnToIndex(column: string): number {
  let index = 0;
  for (const char of column) {
    index = index * 26 + char.charCodeAt(0) - 64;
  }
  return index;
}

export function indexToColumn(index: number): string {
  let column = "";
  let value = index;
  while (value > 0) {
    const modulo = (value - 1) % 26;
    column = String.fromCharCode(65 + modulo) + column;
    value = Math.floor((value - modulo) / 26);
  }
  return column;
}

export function parseAddress(address: string): { column: number; row: number } | null {
  const match = /^([A-Z]+)(\d+)$/.exec(address);
  if (!match) return null;
  return { column: columnToIndex(match[1]), row: Number.parseInt(match[2], 10) };
}

export function getTagContent(xml: string, tag: string): string | undefined {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`).exec(xml);
  return match?.[1];
}
