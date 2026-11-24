// The World on Tuesday — one image that sums up the world news of
// Tuesday 24 November 2026, for make.fun's news-image-20261124.
//
// entry.png beside this file is the picture: a newspaper front page
// whose single dominant scene shows South Korea's dawn alert over
// Ulleung Island — Russian jets entering the air defence zone at first
// light, interceptors climbing, a shelter warning on the island —
// under a masthead that names the day in full. Three short supporting
// stories (the CAS ruling on Africa's title, Moscow's warning to
// Estonia, the US drone over Mexico) and a one-line ticker sit below.
// The editable source of the picture, frontpage.html, ships beside it.
//
// This program does one narrow job: prove the picture is a complete,
// well-formed PNG inside the gate's limits, then copy it verbatim to
// the output directory. It runs offline, and because it only copies
// bytes it has verified, two runs always write identical output.
//
// Local run:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BYTE_LIMIT = 1_048_576; // 1 MiB, the gate's cap on the image file
const SIDE_LIMIT = 1024; // the gate's cap on width and height, in pixels
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// CRC-32 with the PNG polynomial, table-driven: each chunk of a PNG
// carries the checksum of its type bytes plus its data bytes, and a
// file whose checksums fail is not the picture that was authored.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Buffer, from: number, to: number): number {
  let c = 0xffffffff;
  for (let i = from; i < to; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Walk the chunk list from the signature to the final byte. The walk
// must open with IHDR, close with IEND exactly on the last byte, and
// every chunk in between must fit inside the file with a valid CRC —
// anything else means the file is truncated, padded, or corrupt, and
// it is refused rather than copied.
function inspectPng(data: Buffer): { width: number; height: number } {
  if (data.length < PNG_MAGIC.length) throw new Error("file too short to be a PNG");
  for (let i = 0; i < PNG_MAGIC.length; i++) {
    if (data[i] !== PNG_MAGIC[i]) throw new Error("missing the PNG signature");
  }
  let offset = PNG_MAGIC.length;
  let width = 0;
  let height = 0;
  let sawImageData = false;
  let chunkIndex = 0;
  for (;;) {
    if (offset + 12 > data.length) throw new Error("chunk header runs past the end");
    const length = data.readUInt32BE(offset);
    const type = data.toString("ascii", offset + 4, offset + 8);
    const dataEnd = offset + 8 + length;
    if (dataEnd + 4 > data.length) throw new Error(`chunk ${type} overruns the file`);
    if (crc32(data, offset + 4, dataEnd) !== data.readUInt32BE(dataEnd)) {
      throw new Error(`chunk ${type} fails its CRC check`);
    }
    if (chunkIndex === 0) {
      if (type !== "IHDR" || length !== 13) throw new Error("first chunk is not IHDR");
      width = data.readUInt32BE(offset + 8);
      height = data.readUInt32BE(offset + 12);
    }
    if (type === "IDAT") sawImageData = true;
    offset = dataEnd + 4;
    chunkIndex++;
    if (type === "IEND") break;
  }
  if (offset !== data.length) throw new Error("bytes trail the IEND chunk");
  if (!sawImageData) throw new Error("no IDAT chunk: the file holds no image");
  if (width === 0 || height === 0) throw new Error("IHDR carries no dimensions");
  return { width, height };
}

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const picture = readFileSync(join(here, "entry.png"));
  if (picture.length > BYTE_LIMIT) {
    throw new Error(`entry.png is ${picture.length} bytes, over the ${BYTE_LIMIT} cap`);
  }
  const { width, height } = inspectPng(picture);
  if (width > SIDE_LIMIT || height > SIDE_LIMIT) {
    throw new Error(`entry.png is ${width}x${height}, over the ${SIDE_LIMIT} pixel cap`);
  }
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "entry.png"), picture);
}

main();
