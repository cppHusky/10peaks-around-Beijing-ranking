const textDecoder = new TextDecoder("utf-8");

function readUint16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new DecompressionStream("deflate-raw");
  const writer = stream.writable.getWriter();
  const chunk = new Uint8Array(bytes.byteLength);
  chunk.set(bytes);
  const inflated = new Response(stream.readable).arrayBuffer();
  await writer.write(chunk.buffer);
  await writer.close();
  return new Uint8Array(await inflated);
}

export async function unzip(buffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const bytes = new Uint8Array(buffer);
  let endOffset = -1;
  const minOffset = Math.max(0, bytes.length - 0xffff - 22);

  for (let offset = bytes.length - 22; offset >= minOffset; offset--) {
    if (readUint32(bytes, offset) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }

  if (endOffset === -1) {
    throw new Error("不是有效的 xlsx/zip 文件");
  }

  const totalEntries = readUint16(bytes, endOffset + 10);
  const centralDirectoryOffset = readUint32(bytes, endOffset + 16);
  const files = new Map<string, Uint8Array>();
  let offset = centralDirectoryOffset;

  for (let index = 0; index < totalEntries; index++) {
    if (readUint32(bytes, offset) !== 0x02014b50) {
      throw new Error("xlsx 中央目录损坏");
    }

    const method = readUint16(bytes, offset + 10);
    const compressedSize = readUint32(bytes, offset + 20);
    const nameLength = readUint16(bytes, offset + 28);
    const extraLength = readUint16(bytes, offset + 30);
    const commentLength = readUint16(bytes, offset + 32);
    const localHeaderOffset = readUint32(bytes, offset + 42);
    const name = textDecoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength));

    if (readUint32(bytes, localHeaderOffset) !== 0x04034b50) {
      throw new Error(`xlsx 文件项损坏：${name}`);
    }

    const localNameLength = readUint16(bytes, localHeaderOffset + 26);
    const localExtraLength = readUint16(bytes, localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);

    if (method === 0) {
      files.set(name, compressed);
    } else if (method === 8) {
      files.set(name, await inflateRaw(compressed));
    } else {
      throw new Error(`不支持的 xlsx 压缩方式：${method}`);
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return files;
}

export function decodeText(bytes: Uint8Array | undefined, path: string): string {
  if (!bytes) {
    throw new Error(`xlsx 缺少必要文件：${path}`);
  }
  return textDecoder.decode(bytes);
}
