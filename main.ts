// news-image-20261119 — "The World in One Day"
// A from-scratch Node 22 (stdlib only, no network) renderer.
// Draws a 1024x1024 newspaper front page summarising world news of
// Thursday 19 November 2026: 3 lead stories, a stylised world map with
// pins, and a 30-story index across 6 regions. Deterministic output.
// Writes to $MAKEFUN_OUTPUT_DIR/entry.png (default /output/entry.png).

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { createHash } from "node:crypto";

const W = 1024;
const H = 1024;

type RGB = [number, number, number];

// ---------------------------------------------------------------- palette
const INK: RGB = [244, 241, 232]; // warm white text
const MUTED: RGB = [159, 176, 200]; // cool grey text
const BG: RGB = [13, 21, 38]; // deep navy page
const PANEL: RGB = [22, 35, 60]; // panel navy
const PANEL2: RGB = [28, 44, 74]; // lighter panel
const GOLD: RGB = [242, 183, 5]; // headline gold
const LAND: RGB = [44, 74, 107]; // map land
const LINE: RGB = [58, 84, 120]; // hairlines
const DARK: RGB = [10, 16, 28]; // lead card bg

const REGION_COLOR: Record<string, RGB> = {
  NA: [88, 166, 255],
  SA: [63, 185, 127],
  EU: [199, 146, 234],
  ME: [255, 138, 92],
  AF: [255, 209, 102],
  AP: [255, 107, 157],
};
const REGION_NAME: Record<string, string> = {
  NA: "N AMERICA",
  SA: "S AMERICA",
  EU: "EUROPE",
  ME: "M EAST",
  AF: "AFRICA",
  AP: "ASIA-PACIFIC",
};

// ---------------------------------------------------------------- 5x7 font
// Each glyph is 7 rows of 5 cells. Written from scratch for this entry.
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "+": ["00000", "00100", "00100", "01110", "00100", "00100", "00000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
};

// ---------------------------------------------------------------- canvas
const px = new Uint8Array(W * H * 3);

function setPixel(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy++) {
    for (let xx = Math.max(0, x); xx < Math.min(W, x + w); xx++) {
      setPixel(xx, yy, c);
    }
  }
}

function hline(x0: number, x1: number, y: number, c: RGB): void {
  if (y < 0 || y >= H) return;
  const a = Math.max(0, Math.min(x0, x1));
  const b = Math.min(W - 1, Math.max(x0, x1));
  for (let x = a; x <= b; x++) setPixel(x, y, c);
}

function frame(x: number, y: number, w: number, h: number, c: RGB): void {
  fillRect(x, y, w, 1, c);
  fillRect(x, y + h - 1, w, 1, c);
  fillRect(x, y, 1, h, c);
  fillRect(x + w - 1, y, 1, h, c);
}

function disc(cx: number, cy: number, r: number, c: RGB): void {
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(r * r - dy * dy));
    hline(cx - dx, cx + dx, cy + dy, c);
  }
}

function ring(cx: number, cy: number, r: number, c: RGB): void {
  for (let a = 0; a < 360; a += 2) {
    const t = (a * Math.PI) / 180;
    setPixel(Math.round(cx + r * Math.cos(t)), Math.round(cy + r * Math.sin(t)), c);
  }
}

// Scanline polygon fill (even-odd).
function fillPoly(pts: Array<[number, number]>, c: RGB): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of pts) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      hline(Math.ceil(xs[k]), Math.floor(xs[k + 1]), y, c);
    }
  }
}

function textWidth(s: string, sc: number): number {
  if (s.length === 0) return 0;
  return s.length * 6 * sc - sc;
}

function drawText(s: string, x: number, y: number, sc: number, c: RGB): void {
  const up = s.toUpperCase();
  let cx = x;
  for (const ch of up) {
    const g = FONT[ch] ?? FONT["?"];
    for (let r = 0; r < 7; r++) {
      const row = g[r];
      for (let col = 0; col < 5; col++) {
        if (row[col] === "1") fillRect(cx + col * sc, y + r * sc, sc, sc, c);
      }
    }
    cx += 6 * sc;
  }
}

function drawCentered(s: string, y: number, sc: number, c: RGB): void {
  drawText(s, Math.round((W - textWidth(s, sc)) / 2), y, sc, c);
}

// Greedy word wrap; returns lines that fit maxW at scale sc.
function wrap(s: string, maxW: number, sc: number): string[] {
  const words = s.toUpperCase().split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const cand = cur === "" ? w : cur + " " + w;
    if (textWidth(cand, sc) <= maxW || cur === "") {
      cur = cand;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------- stories
// All 30 stories were first reported on 19 November 2026 (checked against
// BBC, NYT, Reuters, The Hindu, NDTV, AP and Pew Research wires as of
// ~01:30 UTC, while the day was still under way in late time zones —
// hence the PROVISIONAL flag in the footer). 6 regions.
interface Story {
  n: number;
  region: string;
  title: string;
}
const STORIES: Story[] = [
  { n: 1, region: "AP", title: "Trump, Xi, Putin issue peace declaration" },
  { n: 2, region: "ME", title: "Israeli tanks cross Gaza ceasefire line" },
  { n: 3, region: "NA", title: "GTA VI launches after 13-year wait" },
  { n: 4, region: "NA", title: "Jeffries set to be first Black US Speaker" },
  { n: 5, region: "ME", title: "Iran strikes US base in Kuwait" },
  { n: 6, region: "AP", title: "Cyclone Akvan nears India's east coast" },
  { n: 7, region: "EU", title: "Crimean Bridge hit for third time in week" },
  { n: 8, region: "EU", title: "Van Gogh sells for record $190.4 million" },
  { n: 9, region: "NA", title: "NASA confirms Voyager 1 past one light-day" },
  { n: 10, region: "NA", title: "Anthropic eyes $1.4 trillion stock debut" },
  { n: 11, region: "EU", title: "EU proposes 45bn euro loan for Ukraine" },
  { n: 12, region: "AP", title: "Mongolia accepts president resignation" },
  { n: 13, region: "ME", title: "Hormuz tankers hit, crew missing" },
  { n: 14, region: "AP", title: "ICJ: Myanmar committed Rohingya genocide" },
  { n: 15, region: "EU", title: "UniCredit, Germany agree Commerzbank deal" },
  { n: 16, region: "NA", title: "Fed minutes point to more rate rises" },
  { n: 17, region: "NA", title: "Nvidia halts H-series chip sales to China" },
  { n: 18, region: "ME", title: "Iraq deal ends militia standoff" },
  { n: 19, region: "AP", title: "Pakistan kills 22 militants in raids" },
  { n: 20, region: "EU", title: "Serbia elects new parliament speaker" },
  { n: 21, region: "EU", title: "UK, Norway fund Ukraine naval craft" },
  { n: 22, region: "AP", title: "Fifteen nations back settler sanctions" },
  { n: 23, region: "ME", title: "Saudi forces launch major Yemen attack" },
  { n: 24, region: "AF", title: "Ethiopia, Eritrea mass troops at border" },
  { n: 25, region: "AP", title: "Bangladesh sends troops over Hasina return" },
  { n: 26, region: "SA", title: "US, Venezuela sign deal on military ties" },
  { n: 27, region: "SA", title: "Lula shields Raoni Amazon homeland" },
  { n: 28, region: "NA", title: "Pew: Islam to pass Christianity by 2035" },
  { n: 29, region: "AF", title: "Somalia expels UAE ambassador" },
  { n: 30, region: "AP", title: "Japan to drill missiles on India ranges" },
];

const LEADS: Array<{ n: number; deck: string }> = [
  { n: 1, deck: "Four-point deal after 90-minute talks" },
  { n: 2, deck: "Rare ground push beyond Yellow Line" },
  { n: 3, deck: "Vice City returns as rollout begins" },
];

// ---------------------------------------------------------------- world map
// Coarse continent outlines in [lon, lat], drawn stylised on purpose.
const CONTINENTS: Array<Array<[number, number]>> = [
  [ // North America
    [-168, 66], [-140, 70], [-120, 72], [-95, 80], [-80, 73], [-60, 60],
    [-55, 47], [-70, 42], [-75, 35], [-80, 26], [-90, 21], [-97, 16],
    [-105, 20], [-117, 33], [-125, 40], [-125, 49], [-140, 60], [-165, 60],
  ],
  [ // South America
    [-80, 10], [-60, 8], [-50, 0], [-35, -8], [-40, -20], [-48, -28],
    [-58, -35], [-65, -41], [-70, -52], [-73, -40], [-70, -20], [-77, -12], [-80, -3],
  ],
  [ // Europe
    [-10, 36], [-9, 43], [0, 44], [3, 43], [8, 44], [12, 45], [19, 42],
    [23, 40], [28, 41], [30, 46], [28, 55], [21, 55], [18, 56], [12, 57],
    [8, 58], [5, 60], [5, 62], [10, 64], [18, 69], [25, 71], [30, 70],
    [35, 68], [40, 66], [40, 60], [30, 55], [24, 50], [15, 48], [8, 47],
    [0, 46], [-2, 44], [-10, 43],
  ],
  [ // Africa
    [-17, 15], [-15, 27], [-10, 31], [-5, 35], [10, 37], [20, 32],
    [30, 31], [35, 28], [40, 15], [43, 11], [48, 10], [51, 12], [44, 5],
    [40, -5], [35, -15], [32, -26], [28, -33], [20, -35], [16, -28],
    [12, -18], [12, -5], [9, 4], [4, 6], [-8, 4], [-13, 8], [-17, 12],
  ],
  [ // Asia
    [40, 68], [60, 70], [80, 73], [100, 76], [120, 73], [140, 72],
    [160, 70], [178, 66], [170, 60], [160, 55], [150, 60], [140, 45],
    [135, 43], [127, 40], [122, 38], [120, 32], [110, 20], [105, 10],
    [100, 8], [95, 15], [90, 22], [85, 19], [80, 13], [75, 8], [70, 20],
    [65, 25], [60, 25], [55, 27], [50, 29], [48, 30], [44, 29], [40, 32],
    [35, 36], [30, 36], [27, 40], [30, 45], [35, 50], [40, 55], [45, 60], [40, 65],
  ],
  [ // Oceania
    [113, -22], [120, -14], [130, -12], [137, -12], [142, -11], [146, -19],
    [150, -23], [153, -27], [150, -37], [144, -38], [140, -38], [135, -35],
    [130, -32], [124, -33], [118, -35], [113, -26],
  ],
];

// Map panel geometry.
const MAP_X = 24;
const MAP_Y = 266;
const MAP_W = 976;
const MAP_H = 134;
const lonToX = (lon: number): number =>
  Math.round(MAP_X + ((lon + 180) / 360) * MAP_W);
const latToY = (lat: number): number =>
  Math.round(MAP_Y + ((72 - lat) / 127) * MAP_H);

// Pins: [story number, lon, lat].
const PINS: Array<[number, number, number]> = [
  [1, 114, 22.5],
  [2, 34.5, 31.4],
  [3, -80, 25.8],
  [4, -77, 38.9],
  [6, 86, 19.8],
  [7, 34, 45],
  [14, 96, 21],
  [24, 38.7, 9],
  [26, -66.9, 10.5],
  [29, 51.4, 2.0],
];

// ---------------------------------------------------------------- PNG encode
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- draw page
function drawPage(): void {
  fillRect(0, 0, W, H, BG);

  // Header.
  drawCentered("The world in one day", 12, 3, INK);
  drawCentered("19 November 2026", 46, 5, GOLD);
  drawCentered("Thursday", 88, 1, MUTED);
  fillRect(24, 106, W - 48, 2, GOLD);

  // Lead stories: three cards.
  const leadY = 118;
  const leadH = 116;
  for (let i = 0; i < 3; i++) {
    const x = 24 + i * 328;
    const st = STORIES[LEADS[i].n - 1];
    fillRect(x, leadY, 320, leadH, DARK);
    frame(x, leadY, 320, leadH, LINE);
    fillRect(x, leadY, 320, 4, REGION_COLOR[st.region]);
    disc(x + 24, leadY + 30, 13, GOLD);
    drawText(String(st.n), x + 24 - (st.n < 10 ? 3 : 6), leadY + 24, 1, DARK);
    drawText(st.region, x + 46, leadY + 24, 1, REGION_COLOR[st.region]);
    const lines = wrap(st.title, 320 - 24, 2);
    lines.slice(0, 2).forEach((ln, li) => {
      drawText(ln, x + 12, leadY + 52 + li * 17, 2, INK);
    });
    drawText(LEADS[i].deck, x + 12, leadY + 52 + 2 * 17 + 6, 1, MUTED);
  }

  // World map panel.
  const mapPanelY = 240;
  fillRect(24, mapPanelY, 976, 164, PANEL);
  frame(24, mapPanelY, 976, 164, LINE);
  drawText("Where the news happened", 36, mapPanelY + 10, 2, INK);
  drawText("Stylised map - numbers match the stories below", 640, mapPanelY + 13, 1, MUTED);
  for (const poly of CONTINENTS) {
    fillPoly(
      poly.map(([lon, lat]) => [lonToX(lon), latToY(lat)] as [number, number]),
      LAND,
    );
  }
  for (const [n, lon, lat] of PINS) {
    const cx = lonToX(lon);
    const cy = latToY(lat);
    ring(cx, cy, 11, INK);
    disc(cx, cy, 9, GOLD);
    drawText(String(n), cx - (n < 10 ? 3 : 6), cy - 3, 1, DARK);
  }

  // Stories index header + region legend.
  drawText("30 stories from 6 regions", 24, 412, 2, INK);
  let lx = 560;
  for (const code of ["NA", "SA", "EU", "ME", "AF", "AP"]) {
    fillRect(lx, 414, 10, 10, REGION_COLOR[code]);
    drawText(code, lx + 14, 413, 1, MUTED);
    lx += 14 + textWidth(code, 1) + 16;
  }

  // Stories grid: 3 columns x 10 rows.
  const gridY = 434;
  const cellW = 320;
  const cellH = 50;
  for (let idx = 0; idx < STORIES.length; idx++) {
    const st = STORIES[idx];
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const x = 24 + col * 328;
    const y = gridY + row * cellH;
    fillRect(x, y, cellW, cellH - 4, PANEL2);
    fillRect(x, y, 4, cellH - 4, REGION_COLOR[st.region]);
    disc(x + 18, y + 14, 10, st.n <= 3 ? GOLD : PANEL);
    if (st.n > 3) ring(x + 18, y + 14, 10, MUTED);
    drawText(
      String(st.n),
      x + 18 - (st.n < 10 ? 3 : 6),
      y + 11,
      1,
      st.n <= 3 ? DARK : INK,
    );
    drawText(st.region, x + cellW - 20, y + 37, 1, REGION_COLOR[st.region]);
    const lines = wrap(st.title, cellW - 40, 2);
    lines.slice(0, 2).forEach((ln, li) => {
      drawText(ln, x + 34, y + 5 + li * 17, 2, INK);
    });
  }

  // Footer.
  fillRect(24, 950, W - 48, 2, GOLD);
  drawCentered(
    "Full day: 19 November 2026, all time zones.",
    962,
    1,
    MUTED,
  );
  drawCentered(
    "All stories dated 19 November 2026. Sources: BBC, NYT, Reuters, The Hindu, NDTV, AP, Pew Research.",
    978,
    1,
    MUTED,
  );
  drawCentered("30 stories - 6 regions - Thursday 19 November 2026", 994, 1, GOLD);
}

// ---------------------------------------------------------------- main
function main(): void {
  drawPage();
  const png = encodePNG();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "entry.png");
  writeFileSync(outPath, png);
  const sha = createHash("sha256").update(png).digest("hex");
  console.log(
    JSON.stringify({
      file: outPath,
      bytes: png.length,
      sha256: sha,
      width: W,
      height: H,
      stories: STORIES.length,
      regions: 6,
    }),
  );
}

main();
