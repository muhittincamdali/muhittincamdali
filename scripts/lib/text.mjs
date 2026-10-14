// Text is drawn as glyph outlines, so every viewer sees the same typeface
// (fonts cannot be loaded from inside an SVG that GitHub serves as <img>).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

const FONT_DIR = fileURLToPath(new URL('../../assets-src/fonts/', import.meta.url));

const FONT_FILES = {
  regular: 'Inter-Regular.otf',
  medium: 'Inter-Medium.otf',
  semibold: 'Inter-SemiBold.otf',
  display: 'InterDisplay-Bold.otf',
};

const loaded = new Map();

function font(weight) {
  if (!FONT_FILES[weight]) throw new Error(`Unknown font weight "${weight}"`);
  if (!loaded.has(weight)) {
    const buffer = readFileSync(FONT_DIR + FONT_FILES[weight]);
    loaded.set(weight, opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)));
  }
  return loaded.get(weight);
}

function layout(text, weight, size, letterSpacing) {
  const face = font(weight);
  const glyphs = face.stringToGlyphs(text);
  const scale = size / face.unitsPerEm;
  const placed = [];
  let penX = 0;
  glyphs.forEach((glyph, index) => {
    if (glyph.index === 0 && text[index] && text[index] !== ' ') {
      throw new Error(`Font "${weight}" has no glyph for "${text[index]}" in "${text}"`);
    }
    placed.push({ glyph, x: penX });
    penX += glyph.advanceWidth;
    const next = glyphs[index + 1];
    if (next) penX += face.getKerningValue(glyph, next) + letterSpacing / scale;
  });
  return { face, placed, width: penX * scale, scale };
}

export function measure(text, { weight = 'regular', size = 14, letterSpacing = 0 } = {}) {
  return layout(text, weight, size, letterSpacing).width;
}

const round = (value) => Math.round(value * 100) / 100;

// One GlyphSet per SVG file: each glyph outline is stored once in <defs>
// and every occurrence is a <use>, which keeps text-heavy files small.
export class GlyphSet {
  constructor(prefix = 'g') {
    this.prefix = prefix;
    this.paths = new Map();
  }

  glyphId(weight, glyph) {
    const id = `${this.prefix}${weight[0]}${glyph.index}`;
    if (!this.paths.has(id)) {
      const face = font(weight);
      const d = glyph.getPath(0, 0, face.unitsPerEm).toPathData(0);
      this.paths.set(id, d);
    }
    return id;
  }

  // anchor: start | middle | end. Returns { svg, width }.
  text(content, { x = 0, y = 0, weight = 'regular', size = 14, fill = 'currentColor', anchor = 'start', letterSpacing = 0, attrs = '' } = {}) {
    const { placed, width, scale } = layout(content, weight, size, letterSpacing);
    const startX = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
    const uses = placed
      .filter(({ glyph }) => glyph.path && glyph.path.commands && glyph.path.commands.length)
      .map(({ glyph, x: offset }) => `<use href="#${this.glyphId(weight, glyph)}" x="${Math.round(offset)}"/>`)
      .join('');
    const svg = `<g fill="${fill}" transform="translate(${round(startX)} ${round(y)}) scale(${round(scale * 10000) / 10000})"${attrs ? ' ' + attrs : ''}>${uses}</g>`;
    return { svg, width };
  }

  defs() {
    return [...this.paths].map(([id, d]) => `<path id="${id}" d="${d}"/>`).join('');
  }
}
