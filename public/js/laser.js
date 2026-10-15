// Laser-cut keyring tags as SVG, modelled on the bamboo prototype tag:
// arch top with a keyring hole, title, QR code, optional typed code, footer.
//
// Everything is plain vector geometry in millimetres (no fonts, no images):
//   * engrave = solid black fills   (QR modules and text outlines)
//   * cut     = red 0.1 mm hairlines (tag outline and keyring hole)
// LightBurn, RDWorks, xTool and Glowforge all map those colours to layers.
import { FONT } from './laser-glyphs.js';

const ENGRAVE = '#000000';
const CUT = '#FF0000';

// Reference design is 33 × 50 mm; other widths scale it uniformly.
const BASE_W = 33;
const BASE_H = 50;

export const DEFAULTS = {
  tagWidth: 33,     // mm; height follows the 33:50 shape
  bedWidth: 300,    // mm, usable laser area
  bedHeight: 200,
  margin: 5,        // mm around the sheet edge
  gap: 2,           // mm between tags
  showCode: true,   // small typed code under the QR as a fallback
  title: ['SUMMER READING', 'CHALLENGE', 'PERSONAL LOGIN'],
  footer: ['POWERED BY KĀPITI COAST', 'DISTRICT COUNCIL'],
};

const n = (v) => Number(v.toFixed(3));

/* ---------- text as outlines ---------- */

function textWidth(text, capMM) {
  const k = capMM / FONT.capHeight;
  let w = 0;
  [...text].forEach((ch, i) => {
    const g = FONT.glyphs[ch] ?? FONT.glyphs[' '];
    w += g.adv + (FONT.kern[ch + (text[i + 1] ?? '')] ?? 0);
  });
  return w * k;
}

// Centred single line; shrinks to fit maxWidth. Returns path data.
function textPath(text, cx, baseline, capMM, maxWidth) {
  text = text.toUpperCase();
  let cap = capMM;
  const width = textWidth(text, cap);
  if (width > maxWidth) cap *= maxWidth / width;
  const k = cap / FONT.capHeight;
  let x = cx - textWidth(text, cap) / 2;
  const parts = [];
  [...text].forEach((ch, i) => {
    const g = FONT.glyphs[ch] ?? FONT.glyphs[' '];
    const X = (u) => n(x + u * k);
    const Y = (u) => n(baseline - u * k);
    for (const [t, ...p] of g.cmds) {
      if (t === 'M' || t === 'L') parts.push(`${t}${X(p[0])} ${Y(p[1])}`);
      else if (t === 'Q') parts.push(`Q${X(p[0])} ${Y(p[1])} ${X(p[2])} ${Y(p[3])}`);
      else if (t === 'C') parts.push(`C${X(p[0])} ${Y(p[1])} ${X(p[2])} ${Y(p[3])} ${X(p[4])} ${Y(p[5])}`);
      else parts.push('Z');
    }
    x += (g.adv + (FONT.kern[ch + (text[i + 1] ?? '')] ?? 0)) * k;
  });
  return parts.join('');
}

/* ---------- QR as merged rectangles ---------- */

function qrPath(url, x0, y0, size) {
  const qr = qrcode(0, 'M');  // global from qrcode-generator
  qr.addData(url);
  qr.make();
  const count = qr.getModuleCount();
  const m = size / count;
  const parts = [];
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (!qr.isDark(r, c)) continue;
      let run = 1;
      while (c + run < count && qr.isDark(r, c + run)) run++;
      parts.push(`M${n(x0 + c * m)} ${n(y0 + r * m)}h${n(run * m)}v${n(m)}h${n(-run * m)}Z`);
      c += run - 1;
    }
  }
  return { d: parts.join(''), modules: count, moduleMM: m };
}

/* ---------- one tag ---------- */

export function tagSize(opts = DEFAULTS) {
  const w = Number(opts.tagWidth);
  return { w, h: w * (BASE_H / BASE_W), s: w / BASE_W };
}

function tagElements(code, url, x0, y0, opts) {
  const { w, h, s } = tagSize(opts);
  const cx = x0 + w / 2;
  const at = (mm) => y0 + mm * s;     // vertical position on the reference design
  const rt = 12.5 * s;                // arch radius
  const rb = 2 * s;                   // bottom corner radius

  const outline = `M${n(x0)} ${n(y0 + rt)}A${n(rt)} ${n(rt)} 0 0 1 ${n(x0 + rt)} ${n(y0)}`
    + `L${n(x0 + w - rt)} ${n(y0)}A${n(rt)} ${n(rt)} 0 0 1 ${n(x0 + w)} ${n(y0 + rt)}`
    + `L${n(x0 + w)} ${n(y0 + h - rb)}A${n(rb)} ${n(rb)} 0 0 1 ${n(x0 + w - rb)} ${n(y0 + h)}`
    + `L${n(x0 + rb)} ${n(y0 + h)}A${n(rb)} ${n(rb)} 0 0 1 ${n(x0)} ${n(y0 + h - rb)}Z`;

  const qrSize = 20 * s;
  const qr = qrPath(url, cx - qrSize / 2, at(18.5), qrSize);
  const textMax = w - 6 * s;

  const engrave = [
    ...opts.title.map((line, i) => textPath(line, cx, at(10.1 + i * 2.5), 1.75 * s, textMax)),
    qr.d,
    opts.showCode ? textPath(code.match(/.{1,4}/g).join('-'), cx, at(40.9), 1.15 * s, textMax) : '',
    ...opts.footer.map((line, i) => textPath(line, cx, at(44.6 + i * 1.9), 1.3 * s, textMax)),
  ].join('');

  return {
    // Hole first so laser software that keeps file order cuts inner shapes first.
    cut: `<circle cx="${n(cx)}" cy="${n(at(3.6))}" r="${n(2 * s)}"/><path d="${outline}"/>`,
    engrave: `<path d="${engrave}"/>`,
    qr,
  };
}

/* ---------- sheets ---------- */

export function layout(opts = DEFAULTS) {
  const { w, h } = tagSize(opts);
  const cols = Math.floor((opts.bedWidth - 2 * opts.margin + opts.gap) / (w + opts.gap));
  const rows = Math.floor((opts.bedHeight - 2 * opts.margin + opts.gap) / (h + opts.gap));
  return { cols: Math.max(cols, 0), rows: Math.max(rows, 0), perSheet: Math.max(cols, 0) * Math.max(rows, 0) };
}

// codes: array of plain codes; urlFor: code -> login URL.
// Returns one SVG string per laser sheet.
export function buildSheets(codes, urlFor, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const { w, h } = tagSize(opts);
  const { cols, perSheet } = layout(opts);
  if (!perSheet) throw new Error('Tags are bigger than the laser bed — check the sizes.');

  const sheets = [];
  let qrInfo = null;
  for (let start = 0; start < codes.length; start += perSheet) {
    const batch = codes.slice(start, start + perSheet);
    const cut = [];
    const engrave = [];
    batch.forEach((code, i) => {
      const x = opts.margin + (i % cols) * (w + opts.gap);
      const y = opts.margin + Math.floor(i / cols) * (h + opts.gap);
      const tag = tagElements(code, urlFor(code), x, y, opts);
      cut.push(tag.cut);
      engrave.push(tag.engrave);
      qrInfo ??= tag.qr;
    });
    sheets.push(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${opts.bedWidth}mm" height="${opts.bedHeight}mm" viewBox="0 0 ${opts.bedWidth} ${opts.bedHeight}">
  <!-- Summer Reading Challenge tags: ${batch.length} on this sheet. Black fill = engrave, red hairline = cut. Units: mm. -->
  <g id="engrave" fill="${ENGRAVE}" stroke="none">${engrave.join('')}</g>
  <g id="cut" fill="none" stroke="${CUT}" stroke-width="0.1">${cut.join('')}</g>
</svg>`);
  }
  return { sheets, qr: qrInfo, size: { w, h }, perSheet };
}
