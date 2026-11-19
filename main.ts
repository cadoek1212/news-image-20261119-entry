// news-image-20261119 -- "The World Today": one image summing up the world
// news of Thursday 19 November 2026. Pure Node.js stdlib: a small software
// rasterizer (hand-drawn 5x7 bitmap font), a stylised world map, and a
// deterministic PNG encoder (zlib deflate + CRC32). No network, no external
// assets, no randomness: two runs write byte-identical files.
//
// Stories are PROVISIONAL (built ~01:20 UTC 19 Nov 2026, the day just begun
// in most time zones; Asia-Pacific already into the afternoon). Every label
// is a real event reported on 19 Nov 2026, or a 19-Nov event scheduled for
// later today (ICJ verdict, APEC trilateral, NASA briefing). Sources: AP,
// Reuters, BBC, NPR, The Hindu Business Line, NASA, IMD, Pew Research,
// Federal Reserve minutes, WIRED, CBS. Refresh after the day ends
// everywhere before submitting; v2 swaps in the full day's outcomes.

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette ---
const INK = [18, 18, 18];
const PAPER = [250, 246, 235];
const RED = [178, 40, 28];
const BLUE = [30, 76, 120];
const SEA = [230, 240, 247];
const LAND = [155, 188, 212];
const FRAME = [108, 148, 178];
const GREY = [92, 92, 92];
const WHITE = [255, 255, 255];
const GOLD = [172, 128, 28];

// ------------------------------------------------------------------- CRC32 ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

// Deterministic PNG: RGB, 8-bit, filter 0 on every scanline, zlib level 9.
function encodePNG(rgb, w, h) {
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0;
    rgb.copy(raw, y * (1 + w * 3) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ canvas ---
const buf = Buffer.alloc(W * H * 3);

function px(x, y, c) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
}

function fillRect(x, y, w, h, c) {
  for (let j = y; j < y + h; j++)
    for (let i = x; i < x + w; i++) px(i, j, c);
}

function hline(x, y, w, c, t) {
  for (let k = 0; k < (t || 1); k++) fillRect(x, y + k, w, 1, c);
}

function vline(x, y, h, c, t) {
  for (let k = 0; k < (t || 1); k++) fillRect(x + k, y, 1, h, c);
}

function line(x0, y0, x1, y1, c) {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    px(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

function fillCircle(cx, cy, r, c) {
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++)
      if (x * x + y * y <= r * r) px(cx + x, cy + y, c);
}

function ring(cx, cy, r, c) {
  for (let a = 0; a < 360; a++) {
    const t = (a * Math.PI) / 180;
    px(Math.round(cx + r * Math.cos(t)), Math.round(cy + r * Math.sin(t)), c);
  }
}

// ------------------------------------------------------- 5x7 bitmap font ---
// Each glyph: 7 rows of 5 bits (bit 4 = leftmost pixel). Hand-drawn.
const FONT = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0a],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
  "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ",": [0, 0, 0, 0, 0x0c, 0x04, 0x08],
  ":": [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
  ";": [0, 0x0c, 0x0c, 0, 0x0c, 0x04, 0x08],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  "-": [0, 0, 0, 0x0e, 0, 0, 0],
  "/": [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
  "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  "&": [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
  "%": [0x19, 0x1a, 0x02, 0x04, 0x08, 0x0b, 0x13],
  "+": [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0],
  "=": [0, 0, 0x1f, 0, 0x1f, 0, 0],
  "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  "?": [0x0e, 0x11, 0x01, 0x02, 0x04, 0, 0x04],
  $: [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04],
  "\u2022": [0, 0, 0x0c, 0x0c, 0x0c, 0, 0],
};

function textWidth(s, scale) {
  return s.length === 0 ? 0 : (s.length * 6 - 1) * scale;
}

// Draw one line of upper-case text. bold adds a 1px x-offset copy.
function drawText(s, x, y, scale, c, bold) {
  const up = s.toUpperCase();
  for (let ci = 0; ci < up.length; ci++) {
    const g = FONT[up[ci]] || FONT["?"];
    const ox = x + ci * 6 * scale;
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r] & (1 << (4 - col))) {
          fillRect(ox + col * scale, y + r * scale, scale, scale, c);
          if (bold) fillRect(ox + col * scale + 1, y + r * scale, scale, scale, c);
        }
      }
    }
  }
}

function drawTextCentered(s, cx, y, scale, c, bold) {
  drawText(s, cx - Math.floor(textWidth(s, scale) / 2), y, scale, c, bold);
}

// Greedy word wrap: lines that fit maxWidth px at the given scale.
function wrapText(s, scale, maxWidth) {
  const words = s.toUpperCase().split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? cur + " " + w : w;
    if (textWidth(trial, scale) <= maxWidth || cur === "") cur = trial;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ------------------------------------------------------------ world map ----
// Hand-sketched equirectangular landmask: 96 cols (lon -180..180) x 44 rows
// (lat ~78..-54). Each row lists inclusive [start,end] land column runs.
// Stylised newspaper map, recognisable at a glance.
const MAP_ROWS = [
  [[14, 18], [36, 40], [55, 56], [62, 64], [72, 74]],
  [[12, 20], [33, 42], [58, 66], [70, 78], [84, 92]],
  [[3, 22], [33, 41], [56, 95]],
  [[3, 30], [34, 40], [52, 95]],
  [[4, 31], [35, 39], [51, 94]],
  [[5, 32], [36, 38], [50, 94]],
  [[6, 33], [37, 38], [50, 93]],
  [[8, 33], [45, 47], [51, 92]],
  [[13, 32], [45, 47], [48, 92]],
  [[14, 31], [46, 91]],
  [[15, 30], [46, 90]],
  [[15, 30], [46, 88]],
  [[15, 30], [46, 58], [60, 86]],
  [[16, 29], [46, 56], [60, 85]],
  [[17, 29], [46, 82]],
  [[18, 28], [44, 82]],
  [[18, 27], [44, 82]],
  [[19, 26], [44, 83]],
  [[20, 25], [44, 63], [67, 70], [73, 80]],
  [[21, 25], [44, 62], [67, 70], [73, 78]],
  [[23, 26], [44, 62], [68, 69], [74, 77]],
  [[24, 27], [29, 33], [44, 61], [68, 68], [74, 76]],
  [[25, 27], [28, 35], [44, 59], [73, 80]],
  [[26, 37], [45, 58], [73, 82]],
  [[28, 38], [45, 57], [74, 83]],
  [[28, 38], [46, 56], [75, 84]],
  [[28, 38], [46, 55], [76, 85]],
  [[28, 38], [47, 54], [78, 86]],
  [[28, 37], [47, 53], [82, 86]],
  [[28, 37], [48, 53], [80, 87]],
  [[29, 36], [48, 53], [79, 88]],
  [[29, 36], [49, 53], [79, 88]],
  [[29, 36], [49, 53], [79, 88]],
  [[30, 35], [50, 53], [80, 88]],
  [[30, 35], [50, 53], [80, 87]],
  [[30, 34], [51, 53], [80, 86]],
  [[31, 34], [51, 53], [81, 85], [93, 94]],
  [[31, 34], [52, 52], [82, 84], [93, 93]],
  [[31, 33], [93, 93]],
  [[31, 33]],
  [[31, 33]],
  [[32, 33]],
  [[32, 33]],
  [[32, 32]],
];

// ---------------------------------------------------------------- stories ---
// Fields: n = story number, region, headline (<= ~48 chars, 2 lines),
// pin = [mapCol, mapRow] or null, sub = lead-band sub-line (leads only).
// All 30 verified against live reporting on 19 Nov 2026 (see header).
const STORIES = [
  { n: 1, region: "GLOBAL", headline: "GTA VI LAUNCHES WORLDWIDE AFTER 13 YEARS", pin: [27, 16], sub: "MIDNIGHT ROLLOUT, PS5 AND XBOX, $79.99" },
  { n: 2, region: "ASIA", headline: "TRUMP, XI AND PUTIN MEET IN SHENZHEN", pin: [80, 15], sub: "FIRST TRILATERAL, NUCLEAR ARMS ON TABLE" },
  { n: 3, region: "EUROPE", headline: "WORLD COURT RULES ON MYANMAR GENOCIDE CASE", pin: [48, 7], sub: "ROHINGYA CASE, VERDICT DUE TODAY AT THE HAGUE" },
  { n: 4, region: "N AMERICA", headline: "DEMOCRATS NOMINATE JEFFRIES FOR SPEAKER", pin: [24, 11], sub: "" },
  { n: 5, region: "N AMERICA", headline: "FED MINUTES: MORE RATE HIKES LIKELY", pin: [31, 12], sub: "" },
  { n: 6, region: "MIDEAST", headline: "US AND IRAN TRADE FIRE ACROSS THE GULF", pin: [63, 16], sub: "" },
  { n: 7, region: "MIDEAST", headline: "ISRAEL LAUNCHES GROUND RAID IN CENTRAL GAZA", pin: [59, 15], sub: "" },
  { n: 8, region: "EUROPE", headline: "CRIMEA BRIDGE ATTACKED AGAIN, TRAFFIC HALTED", pin: [58, 10], sub: "" },
  { n: 9, region: "EUROPE", headline: "EU PROPOSES EUR 45BN LOAN FOR UKRAINE", pin: [52, 9], sub: "" },
  { n: 10, region: "OCEANIA", headline: "AUSTRALIA SANCTIONS ISRAELI SETTLERS", pin: [84, 30], sub: "" },
  { n: 11, region: "ASIA", headline: "CYCLONE AKVAN NEARS INDIA COAST", pin: [71, 21], sub: "" },
  { n: 12, region: "ASIA", headline: "MODI MEETS PRINCE AND PRINCESS OF WALES", pin: [70, 17], sub: "" },
  { n: 13, region: "ASIA", headline: "INDIA AND JAPAN REVIEW DEFENCE TIES", pin: [84, 14], sub: "" },
  { n: 14, region: "N AMERICA", headline: "CANADA RETHINKS CHINA TIES, EYES US DEAL", pin: [20, 9], sub: "" },
  { n: 15, region: "N AMERICA", headline: "US SENATORS WARN AI CYBER THREATS GROW", pin: [25, 14], sub: "" },
  { n: 16, region: "N AMERICA", headline: "HOUSE DEMOCRATS ORDER RECORDS PRESERVED", pin: [29, 14], sub: "" },
  { n: 17, region: "N AMERICA", headline: "PELTOLA WINS ALASKA SENATE SEAT", pin: [12, 8], sub: "" },
  { n: 18, region: "N AMERICA", headline: "US PLANS TOUGHER GREEN CARD RULES", pin: [26, 15], sub: "" },
  { n: 19, region: "SCIENCE", headline: "NASA BRIEFS WORLD ON VOYAGER LIGHT-DAY", pin: [18, 13], sub: "" },
  { n: 20, region: "WORLD", headline: "PEW: ISLAM TO PASS CHRISTIANITY BY 2035", pin: null, sub: "" },
  { n: 21, region: "SCIENCE", headline: "SCIENTISTS MAY SOLVE EARTH'S LOST EON", pin: null, sub: "" },
  { n: 22, region: "TECH", headline: "NVIDIA INTERIM CHIEF PROMISES EARLIER PAY RISES", pin: null, sub: "" },
  { n: 23, region: "TECH", headline: "MICROSOFT IN AI TALKS WITH BYTEDANCE", pin: null, sub: "" },
  { n: 24, region: "MARKETS", headline: "OIL FALLS AS MIDDLE EAST FEARS EASE", pin: null, sub: "" },
  { n: 25, region: "AFRICA", headline: "MIGRANT BOAT CAPSIZES OFF SENEGAL", pin: [44, 20], sub: "" },
  { n: 26, region: "MIDEAST", headline: "SAUDI ARABIA SAYS DANGER PASSED IN SOUTH", pin: [60, 19], sub: "" },
  { n: 27, region: "AFRICA", headline: "LIBYA SEIZES COCAINE AND MILLIONS OF PILLS", pin: [49, 15], sub: "" },
  { n: 28, region: "EUROPE", headline: "FRENCH MINISTER: MELENCHON COULD WIN", pin: [46, 10], sub: "" },
  { n: 29, region: "SPORT", headline: "DUCKETT HITS 133 AS ENGLAND LEAD ODI", pin: [45, 8], sub: "" },
  { n: 30, region: "OCEANIA", headline: "SYDNEY GUNMAN ARRESTED AFTER LOCKDOWN", pin: [88, 29], sub: "" },
];

// ------------------------------------------------------------------ icons ---
// Tiny flat pictograms for the three lead stories, drawn with primitives.
function iconGamepad(x, y, s) {
  fillRect(x, y + 8 * s, 24 * s, 10 * s, BLUE);
  fillCircle(x + 4 * s, y + 12 * s, 4 * s, BLUE);
  fillCircle(x + 20 * s, y + 12 * s, 4 * s, BLUE);
  fillRect(x + 6 * s, y + 10 * s, 4 * s, 2 * s, WHITE);
  fillRect(x + 14 * s, y + 10 * s, 2 * s, 2 * s, WHITE);
  fillRect(x + 17 * s, y + 10 * s, 2 * s, 2 * s, WHITE);
  fillRect(x + 14 * s, y + 13 * s, 2 * s, 2 * s, WHITE);
  fillRect(x + 17 * s, y + 13 * s, 2 * s, 2 * s, WHITE);
}
function iconSummit(x, y, s) {
  // three flags on one pole row: US, China, Russia colours
  vline(x + 2, y, 20 * s, INK, 2);
  vline(x + 12, y, 20 * s, INK, 2);
  vline(x + 22, y, 20 * s, INK, 2);
  fillRect(x + 4, y + 1, 7, 6, RED);
  fillRect(x + 14, y + 1, 7, 6, RED);
  fillRect(x + 14, y + 7, 7, 2, GOLD);
  fillRect(x + 24, y + 1, 7, 2, WHITE);
  fillRect(x + 24, y + 3, 7, 2, BLUE);
  fillRect(x + 24, y + 5, 7, 2, RED);
}
function iconScales(x, y, s) {
  vline(x + 12 * s, y, 20 * s, INK, 2);
  line(x + 2 * s, y + 2 * s, x + 22 * s, y + 2 * s, INK);
  line(x + 4 * s, y + 2 * s, x + 2 * s, y + 12 * s, GOLD);
  line(x + 4 * s, y + 2 * s, x + 6 * s, y + 12 * s, GOLD);
  line(x + 20 * s, y + 2 * s, x + 18 * s, y + 12 * s, GOLD);
  line(x + 20 * s, y + 2 * s, x + 22 * s, y + 12 * s, GOLD);
  fillRect(x, y + 12 * s, 8 * s, 2 * s, GOLD);
  fillRect(x + 16 * s, y + 12 * s, 8 * s, 2 * s, GOLD);
  fillRect(x + 10 * s, y + 20 * s, 4 * s, 2 * s, INK);
}

// ----------------------------------------------------------------- layout ---
function drawMasthead() {
  drawTextCentered("THE WORLD TODAY", 512, 26, 5, INK, true);
  hline(24, 72, 976, INK, 2);
  drawTextCentered("THURSDAY 19 NOVEMBER 2026", 512, 82, 3, RED, true);
  drawTextCentered("30 STORIES - 6 REGIONS - ONE DAY", 512, 110, 2, GREY, false);
  hline(24, 134, 976, INK, 2);
}

function drawLeads() {
  const icons = [iconGamepad, iconSummit, iconScales];
  const colX = [24, 352, 680];
  for (let i = 0; i < 3; i++) {
    const s = STORIES[i];
    const x = colX[i];
    const y = 146;
    fillCircle(x + 14, y + 14, 13, RED);
    ring(x + 14, y + 14, 13, WHITE);
    const num = String(s.n);
    drawText(num, x + 14 - Math.floor(textWidth(num, 2) / 2), y + 7, 2, WHITE, false);
    drawText(s.region, x + 34, y + 8, 1, RED, true);
    icons[i](x + 284, y + 2, 1);
    const lines = wrapText(s.headline, 2, 296);
    for (let li = 0; li < lines.length; li++)
      drawText(lines[li], x, y + 32 + li * 16, 2, INK, true);
    const subLines = wrapText(s.sub, 1, 296);
    const sy = y + 32 + lines.length * 16 + 6;
    for (let li = 0; li < subLines.length; li++)
      drawText(subLines[li], x, sy + li * 9, 1, GREY, false);
    if (i < 2) vline(x + 320, y, 112, INK, 1);
  }
  hline(24, 264, 976, INK, 2);
}

function drawMap() {
  drawText("THE WORLD AT A GLANCE - 12 STORIES PINNED", 24, 276, 2, INK, true);
  const mx = 32;
  const my = 298;
  const cw = 10;
  const ch = 5;
  fillRect(mx, my, 960, 220, SEA);
  for (let r = 0; r < MAP_ROWS.length; r++) {
    for (const run of MAP_ROWS[r]) {
      for (let c = run[0]; c <= run[1]; c++)
        fillRect(mx + c * cw, my + r * ch, cw, ch, LAND);
    }
  }
  hline(mx, my, 960, FRAME, 1);
  hline(mx, my + 219, 960, FRAME, 1);
  vline(mx, my, 220, FRAME, 1);
  vline(mx + 959, my, 220, FRAME, 1);
  for (const s of STORIES) {
    if (!s.pin) continue;
    const px = mx + s.pin[0] * cw + 5;
    const py = my + s.pin[1] * ch + 2;
    fillCircle(px, py, 9, RED);
    ring(px, py, 9, WHITE);
    const num = String(s.n);
    const sc = s.n < 10 ? 2 : 1;
    drawText(num, px - Math.floor(textWidth(num, sc) / 2), py - (sc === 2 ? 7 : 3), sc, WHITE, false);
  }
  drawText("PINS 1-12 MARK THE TOP STORIES - SEE THE INDEX BELOW", 24, 526, 1, GREY, false);
  hline(24, 542, 976, INK, 2);
}

function drawIndex() {
  drawText("THE DAY IN 30 STORIES", 24, 552, 2, INK, true);
  const colX = [24, 352, 680];
  const y0 = 576;
  const rowH = 41;
  for (let i = 0; i < STORIES.length; i++) {
    const s = STORIES[i];
    const col = Math.floor(i / 10);
    const row = i % 10;
    const x = colX[col];
    const y = y0 + row * rowH;
    fillRect(x, y + 4, 18, 18, RED);
    const num = String(s.n);
    drawText(num, x + 9 - Math.floor(textWidth(num, 1) / 2), y + 9, 1, WHITE, false);
    const lines = wrapText(s.headline, 2, 296).slice(0, 2);
    for (let li = 0; li < lines.length; li++)
      drawText(lines[li], x + 24, y + li * 15, 2, INK, false);
    drawText(s.region, x + 24, y + 31, 1, RED, true);
    if (col < 2) vline(x + 320, y, rowH - 4, GREY, 1);
  }
  hline(24, 994, 976, INK, 2);
  drawTextCentered(
    "AS REPORTED ON 19 NOVEMBER 2026 - AP - REUTERS - BBC - NPR - NASA - PEW - IMD",
    512, 1002, 1, GREY, false
  );
}

// -------------------------------------------------------------------- main ---
function main() {
  fillRect(0, 0, W, H, PAPER);
  hline(8, 8, 1008, INK, 2);
  hline(8, 1014, 1008, INK, 2);
  vline(8, 8, 1008, INK, 2);
  vline(1014, 8, 1008, INK, 2);
  drawMasthead();
  drawLeads();
  drawMap();
  drawIndex();
  const png = encodePNG(buf, W, H);
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "entry.png"), png);
}

main();
