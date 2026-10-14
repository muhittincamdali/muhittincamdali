// Stack chips and the email button. Chips are a quiet tint with one light and one dark file, so
// the 24 of them do not outweigh the banner; the email button is the only solid blue element.
// The chip prefix is an official logo (simple-icons) or, for items without one, a drawn glyph for
// what the item does (never a look-alike logo), always in the text colour and in the same 14 px slot.
import * as simpleIcons from 'simple-icons';
import { GlyphSet, measure } from '../lib/text.mjs';
import { palette, profile, svgDocument } from '../lib/svg.mjs';

const CHIP = { height: 28, radius: 8, pad: 11, icon: 14, glyphStroke: 1.8, gap: 6, size: 13, baseline: 18.6 };
const BUTTON = { height: 44, radius: 12, pad: 18, icon: 18, gap: 10, size: 15, baseline: 27.5 };
const MAX_VISIBLE_CHIPS = 24;
const MAX_CHIPS_PER_GROUP = 6;

const MAIL_ICON = '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M4 7l8 6 8-6"/>';

// Line glyphs on a 24 px grid for items without an official logo in simple-icons.
const GLYPHS = {
  // Objective-C: the square brackets of its message syntax.
  brackets: '<path d="M9 3H5v18h4M15 3h4v18h-4"/>',
  // SwiftUI: stacked view layers.
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 12.5l9 5 9-5"/><path d="M3 16.5l9 5 9-5"/>',
  // UIKit: a phone screen.
  window: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10.5 18h3"/>',
  // Combine: two streams merging into one.
  merge: '<path d="M3 5c7 0 6 7 13 7h5M3 19c7 0 6-7 13-7"/><path d="M17.5 8.5L21 12l-3.5 3.5"/>',
  // Core Data: a store.
  database: '<ellipse cx="12" cy="5.5" rx="7.5" ry="3"/><path d="M4.5 5.5v13c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-13M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3"/>',
  // RAG: searching documents.
  retrieve: '<path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h4M8 8h7M8 12h3"/><circle cx="15.5" cy="15.5" r="4"/><path d="M18.5 18.5L22 22"/>',
  // Foundation Models: an on-device model, drawn as a spark.
  sparkle: '<path d="M12 3l2.1 6.9L21 12l-6.9 2.1L12 21l-2.1-6.9L3 12l6.9-2.1z"/>',
  // AI agents: one step handing work to the next.
  flow: '<rect x="3" y="3.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13" width="7.5" height="7.5" rx="2"/><path d="M10.5 7.25h3.75a3 3 0 013 3V13"/>',
  // Core ML: a small neural network.
  network: '<path d="M5 6l7 6-7 6M12 12l7-6M12 12l7 6M5 6v12"/><circle cx="5" cy="6" r="2.2"/><circle cx="5" cy="18" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="19" cy="6" r="2.2"/><circle cx="19" cy="18" r="2.2"/>',
};

export function slugify(label) {
  return label
    .toLowerCase()
    .replace(/\+/g, 'plus')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function brandIcon(slug) {
  const key = `si${slug[0].toUpperCase()}${slug.slice(1)}`;
  const icon = simpleIcons[key];
  if (!icon) throw new Error(`simple-icons has no icon "${slug}"`);
  return icon;
}

// Chip fill: a flat tint with a hairline edge in the theme's colours.
function chipSurface(width, colors) {
  return (
    `<rect width="${width}" height="${CHIP.height}" rx="${CHIP.radius}" fill="${colors.bg}"/>` +
    `<rect x=".5" y=".5" width="${width - 1}" height="${CHIP.height - 1}" rx="${CHIP.radius - 0.5}" fill="none" stroke="${colors.border}"/>`
  );
}

// Button fill: brand gradient, a soft top highlight and a hairline inner edge.
function buttonSurface(width, height, radius) {
  const { from, to } = palette.chip.button;
  const defs =
    `<linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>` +
    `<linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
  const body =
    `<rect width="${width}" height="${height}" rx="${radius}" fill="url(#f)"/>` +
    `<rect width="${width}" height="${height}" rx="${radius}" fill="url(#s)"/>` +
    `<rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="${radius - 0.5}" fill="none" stroke="#fff" stroke-opacity=".16"/>`;
  return { defs, body };
}

// Brand logos are filled shapes; glyphs are strokes drawn at a weight that matches them.
function chipMark({ label, icon, glyph }, fg) {
  const origin = `translate(${CHIP.pad} ${(CHIP.height - CHIP.icon) / 2})`;
  const place = `${origin} scale(${CHIP.icon / 24})`;
  if (icon) return `<g transform="${place}"><path d="${brandIcon(icon).path}" fill="${fg}"/></g>`;
  if (!GLYPHS[glyph]) throw new Error(`Stack item "${label}" needs an "icon" (simple-icons slug) or a known "glyph"`);
  const stroke = (CHIP.glyphStroke * 24) / CHIP.icon;
  return `<g transform="${place}" fill="none" stroke="${fg}" stroke-width="${stroke.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[glyph]}</g>`;
}

export function renderChip(chip, theme) {
  const { label } = chip;
  const colors = palette.chip[theme];
  const fg = colors.fg;
  const glyphs = new GlyphSet('c');
  const iconSpace = CHIP.icon + CHIP.gap;
  const textWidth = measure(label, { weight: 'medium', size: CHIP.size });
  const width = Math.ceil(CHIP.pad * 2 + iconSpace + textWidth);
  const text = glyphs.text(label, { x: CHIP.pad + iconSpace, y: CHIP.baseline, weight: 'medium', size: CHIP.size, fill: fg }).svg;
  const iconSvg = chipMark(chip, fg);
  return svgDocument({ width, height: CHIP.height, title: label, defs: glyphs.defs(), body: chipSurface(width, colors) + iconSvg + text });
}

export function renderEmailButton(address) {
  const fg = palette.chip.button.fg;
  const glyphs = new GlyphSet('b');
  const textWidth = measure(address, { weight: 'semibold', size: BUTTON.size });
  const width = Math.ceil(BUTTON.pad * 2 + BUTTON.icon + BUTTON.gap + textWidth);
  const icon = `<g transform="translate(${BUTTON.pad} ${(BUTTON.height - BUTTON.icon) / 2}) scale(${BUTTON.icon / 24})" fill="none" stroke="${fg}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${MAIL_ICON}</g>`;
  const text = glyphs.text(address, { x: BUTTON.pad + BUTTON.icon + BUTTON.gap, y: BUTTON.baseline, weight: 'semibold', size: BUTTON.size, fill: fg }).svg;
  const fill = buttonSurface(width, BUTTON.height, BUTTON.radius);
  return svgDocument({ width, height: BUTTON.height, title: `Email: ${address}`, defs: fill.defs + glyphs.defs(), body: fill.body + icon + text });
}

export function allChips() {
  const seen = new Set();
  const chips = profile.stack.flatMap(({ group, items }) => {
    if (items.length > MAX_CHIPS_PER_GROUP) throw new Error(`Stack group "${group}" has ${items.length} chips (max ${MAX_CHIPS_PER_GROUP})`);
    return items.map((item) => {
      const slug = slugify(item.label);
      if (seen.has(slug)) throw new Error(`Duplicate stack item: ${item.label}`);
      seen.add(slug);
      return { ...item, name: `chip-${slug}` };
    });
  });
  if (chips.length > MAX_VISIBLE_CHIPS) throw new Error(`${chips.length} stack chips (max ${MAX_VISIBLE_CHIPS})`);
  return chips;
}
