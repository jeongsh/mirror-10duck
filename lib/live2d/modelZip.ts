import JSZip from "jszip";

type DecodeFileName = NonNullable<JSZip.JSZipLoadOptions["decodeFileName"]>;
type FileNameBytes = Parameters<DecodeFileName>[0];

const japaneseZipDecoder = new TextDecoder("shift_jis");
const simplifiedChineseZipDecoder = new TextDecoder("gb18030");
const utf8Decoder = new TextDecoder("utf-8");

export interface LoadedModelZipEntry {
  path: string;
  entry: JSZip.JSZipObject;
}

export interface LoadedModelZip {
  zip: JSZip;
  entries: LoadedModelZipEntry[];
}

function toUint8Array(bytes: FileNameBytes): Uint8Array {
  if (bytes instanceof Uint8Array) return bytes;
  return Uint8Array.from(bytes, (byte) =>
    typeof byte === "string" ? byte.charCodeAt(0) : byte
  );
}

function decodeJapaneseFileName(bytes: FileNameBytes): string {
  return japaneseZipDecoder.decode(toUint8Array(bytes));
}

function decodeSimplifiedChineseFileName(bytes: FileNameBytes): string {
  return simplifiedChineseZipDecoder.decode(toUint8Array(bytes));
}

function collectFileEntries(zip: JSZip): JSZip.JSZipObject[] {
  const entries: JSZip.JSZipObject[] = [];
  zip.forEach((_, entry) => {
    if (!entry.dir) entries.push(entry);
  });
  return entries;
}

function scoreZipPaths(paths: string[]): number {
  const joined = paths.join("\n");
  const hasModelJson = paths.some((path) => /\.model3\.json$/i.test(path));
  const replacementChars = (joined.match(/\uFFFD/g) ?? []).length;
  const cjkChars = (joined.match(/[\u3400-\u9FFF]/g) ?? []).length;
  const kanaChars = (joined.match(/[\u3040-\u30FF]/g) ?? []).length;
  const hangulChars = (joined.match(/[\uAC00-\uD7AF]/g) ?? []).length;
  const halfWidthKanaChars = (joined.match(/[\uFF61-\uFF9F]/g) ?? []).length;
  const controlChars = (joined.match(/[\u0000-\u001F\u007F]/g) ?? []).length;

  return (
    (hasModelJson ? 1000 : 0) +
    cjkChars * 4 +
    kanaChars * 3 +
    hangulChars * 3 -
    halfWidthKanaChars * 6 -
    replacementChars * 50 -
    controlChars * 50
  );
}

function readUint16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function readUint32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

function findEndOfCentralDirectory(view: DataView): number {
  const minOffset = Math.max(0, view.byteLength - 0xffff - 22);
  for (let offset = view.byteLength - 22; offset >= minOffset; offset--) {
    if (readUint32(view, offset) === 0x06054b50) return offset;
  }
  return -1;
}

function decodeUnicodePathExtra(extra: Uint8Array): string | null {
  let offset = 0;
  while (offset + 4 <= extra.length) {
    const id = extra[offset] | (extra[offset + 1] << 8);
    const size = extra[offset + 2] | (extra[offset + 3] << 8);
    const dataOffset = offset + 4;
    const nextOffset = dataOffset + size;
    if (nextOffset > extra.length) break;
    if (id === 0x7075 && size >= 5 && extra[dataOffset] === 1) {
      return utf8Decoder.decode(extra.slice(dataOffset + 5, nextOffset));
    }
    offset = nextOffset;
  }
  return null;
}

function parseCentralDirectoryPaths(
  buffer: ArrayBuffer,
  decodeLegacyName: (bytes: Uint8Array) => string
): string[] {
  const view = new DataView(buffer);
  const eocdOffset = findEndOfCentralDirectory(view);
  if (eocdOffset < 0) return [];

  const entryCount = readUint16(view, eocdOffset + 10);
  const centralDirectoryOffset = readUint32(view, eocdOffset + 16);
  const paths: string[] = [];
  let offset = centralDirectoryOffset;

  for (let i = 0; i < entryCount && offset + 46 <= view.byteLength; i++) {
    if (readUint32(view, offset) !== 0x02014b50) break;

    const flags = readUint16(view, offset + 8);
    const fileNameLength = readUint16(view, offset + 28);
    const extraLength = readUint16(view, offset + 30);
    const commentLength = readUint16(view, offset + 32);
    const nameOffset = offset + 46;
    const extraOffset = nameOffset + fileNameLength;
    const nextOffset = extraOffset + extraLength + commentLength;
    if (nextOffset > view.byteLength) break;

    const nameBytes = new Uint8Array(buffer, nameOffset, fileNameLength);
    const extraBytes = new Uint8Array(buffer, extraOffset, extraLength);
    const unicodePath = decodeUnicodePathExtra(extraBytes);
    const path =
      unicodePath ??
      ((flags & 0x0800) !== 0 ? utf8Decoder.decode(nameBytes) : decodeLegacyName(nameBytes));

    if (!path.endsWith("/")) paths.push(path);
    offset = nextOffset;
  }

  return paths;
}

function buildEntries(zip: JSZip, paths: string[]): LoadedModelZipEntry[] {
  const fileEntries = collectFileEntries(zip);
  return fileEntries.map((entry, index) => ({
    path: paths[index] ?? entry.name,
    entry,
  }));
}

/**
 * Loads Live2D model ZIPs with fallbacks for East Asian Windows archives.
 *
 * JSZip defaults to UTF-8 for non-Unicode ZIP names. Many Windows-made model
 * ZIPs store names as CP932/Shift_JIS or GBK/GB18030 instead, which breaks path
 * matching against the UTF-8 strings inside model3.json.
 */
export async function loadModelZip(file: File): Promise<JSZip> {
  return (await loadModelZipEntries(file)).zip;
}

export async function loadModelZipEntries(file: File): Promise<LoadedModelZip> {
  const buffer = await file.arrayBuffer();
  const utf8Zip = await JSZip.loadAsync(buffer);
  const jszipPaths = collectFileEntries(utf8Zip).map((entry) => entry.name);

  const centralUtf8Paths = parseCentralDirectoryPaths(buffer, (bytes) =>
    utf8Decoder.decode(bytes)
  );
  const centralJapanesePaths = parseCentralDirectoryPaths(buffer, (bytes) =>
    japaneseZipDecoder.decode(bytes)
  );
  const centralSimplifiedChinesePaths = parseCentralDirectoryPaths(buffer, (bytes) =>
    simplifiedChineseZipDecoder.decode(bytes)
  );

  let bestPaths = jszipPaths;
  for (const paths of [
    centralUtf8Paths,
    centralJapanesePaths,
    centralSimplifiedChinesePaths,
  ]) {
    if (paths.length !== jszipPaths.length) continue;
    if (scoreZipPaths(paths) > scoreZipPaths(bestPaths)) {
      bestPaths = paths;
    }
  }

  let japaneseZip: JSZip | null = null;
  try {
    japaneseZip = await JSZip.loadAsync(buffer, {
      decodeFileName: decodeJapaneseFileName,
    });
  } catch {
    japaneseZip = null;
  }

  let simplifiedChineseZip: JSZip | null = null;
  try {
    simplifiedChineseZip = await JSZip.loadAsync(buffer, {
      decodeFileName: decodeSimplifiedChineseFileName,
    });
  } catch {
    simplifiedChineseZip = null;
  }

  if (japaneseZip) {
    const japanesePaths = collectFileEntries(japaneseZip).map((entry) => entry.name);
    if (scoreZipPaths(japanesePaths) > scoreZipPaths(bestPaths)) {
      return { zip: japaneseZip, entries: buildEntries(japaneseZip, japanesePaths) };
    }
  }

  if (simplifiedChineseZip) {
    const simplifiedChinesePaths = collectFileEntries(simplifiedChineseZip).map(
      (entry) => entry.name
    );
    if (scoreZipPaths(simplifiedChinesePaths) > scoreZipPaths(bestPaths)) {
      return {
        zip: simplifiedChineseZip,
        entries: buildEntries(simplifiedChineseZip, simplifiedChinesePaths),
      };
    }
  }

  return { zip: utf8Zip, entries: buildEntries(utf8Zip, bestPaths) };
}
