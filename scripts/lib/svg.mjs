import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

export const palette = JSON.parse(readFileSync(new URL('../../assets/palette.json', import.meta.url)));
export const profile = JSON.parse(readFileSync(new URL('../../assets-src/profile.json', import.meta.url)));
export const THEMES = ['light', 'dark'];
export const OUTPUT_DIR = 'dist';

// GitHub's profile README column is 846 px wide on a wide desktop window. Every graphic is drawn
// for that width with its frame flush with the column, in line with the text and chips, and
// scales down with the column (766 px at a 1200 px window, 590 px at 1024 px, ~310 px on a phone).
export const COLUMN = 846;

export function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
}

export const REDUCED_MOTION = '@media (prefers-reduced-motion: reduce){*{animation:none!important}}';

// Wraps body markup in a standalone, accessible SVG document.
export function svgDocument({ width, height, title, style = '', defs = '', body }) {
  const css = style ? `<style>${style}${REDUCED_MOTION}</style>` : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="t">` +
    `<title id="t">${escapeXml(title)}</title>${css}<defs>${defs}</defs>${body}</svg>\n`
  );
}

export function writeAsset(name, content) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(`${OUTPUT_DIR}/${name}`, content);
  return name;
}

export function hexToRgb(hex) {
  const value = parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function relativeLuminance(hex) {
  return hexToRgb(hex)
    .map((channel) => channel / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, index) => sum + c * [0.2126, 0.7152, 0.0722][index], 0);
}

// WCAG contrast ratio between two #RRGGBB colours.
export function contrast(a, b) {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

function toLab(hex) {
  const [r, g, b] = hexToRgb(hex)
    .map((channel) => channel / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const xyz = [(r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, r * 0.2126 + g * 0.7152 + b * 0.0722, (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883];
  const [fx, fy, fz] = xyz.map((t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116));
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

// CIE76 colour difference: unlike contrast it also separates colours of similar lightness but different hue.
export function colourDistance(a, b) {
  const [labA, labB] = [toLab(a), toLab(b)];
  return Math.hypot(labA[0] - labB[0], labA[1] - labB[1], labA[2] - labB[2]);
}

export function withAlpha(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatDate(iso) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso));
}
