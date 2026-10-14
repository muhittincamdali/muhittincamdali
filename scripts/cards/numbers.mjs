// "By the numbers": one full-width card built from build/github.json. GitHub metrics on top,
// languages below, both on the same four columns. It scales with the README column (846 px on a
// wide window, 578-766 px down to a 1012 px window) and keeps 17-unit text >= 11.6 px there; narrower
// windows get the compact card (numbers-compact.mjs) through a <source media> in the README.
import { GlyphSet, measure } from '../lib/text.mjs';
import { palette, svgDocument, formatNumber, formatDate, contrast, colourDistance, COLUMN } from '../lib/svg.mjs';

const WIDTH = COLUMN;
// The same padding on every side: the first cap height starts PAD px below the frame and the
// last baseline sits PAD px above it.
const PAD = 28;
const COLUMNS = 4;
const LEFT = PAD;
const RIGHT = WIDTH - PAD;
const COLUMN_WIDTH = (RIGHT - LEFT) / COLUMNS;
const TITLE = { size: 17, cap: 12.4 };
const NOTE_SIZE = 17;
const METRICS = { title: PAD + TITLE.cap, value: 96, label: 122 };
const DIVIDER = 148;
const LANGUAGES = { title: 188, bar: 204, legend: 244 };
const HEIGHT = LANGUAGES.legend + PAD;
const VALUE = { size: 28, indent: 30 };
const LABEL_SIZE = 17;
const ICON_SIZE = 18;
const LEGEND = { size: 17, dot: 5.5, indent: 20, gutter: 24 };
const BAR = { height: 12, gap: 2, minSegment: 6, radius: 4 };
// Every legend colour, "Other" included, is a graphic that must keep 3:1 against the card.
const MIN_CARD_CONTRAST = 3;
const MIN_COLOUR_DISTANCE = 20;

export const ICONS = {
  star: '<path d="M9 1.8l2.2 4.6 5 .7-3.6 3.5.9 5L9 13.2l-4.5 2.4.9-5L1.8 7.1l5-.7z" fill="none" stroke-width="1.6" stroke-linejoin="round"/>',
  fork: '<circle cx="4.5" cy="3.5" r="2" fill="none" stroke-width="1.6"/><circle cx="13.5" cy="3.5" r="2" fill="none" stroke-width="1.6"/><circle cx="9" cy="14.5" r="2" fill="none" stroke-width="1.6"/><path d="M4.5 5.5v1.5a2 2 0 002 2h5a2 2 0 002-2V5.5M9 9v3.5" fill="none" stroke-width="1.6"/>',
  flame: '<path d="M9 1.5c.6 3-3.2 4.6-3.2 8.4a3.2 3.2 0 006.4 0c0-1.4-.8-2.4-1.3-3 2.4.6 3.9 2.7 3.9 5A5.8 5.8 0 019 17.6 5.8 5.8 0 013.2 12c0-5.3 5.2-6.4 5.8-10.5z" fill="none" stroke-width="1.6" stroke-linejoin="round"/>',
  calendar: '<rect x="2" y="3.5" width="14" height="12.5" rx="2.5" fill="none" stroke-width="1.6"/><path d="M2 7.5h14M6 1.8v3.4M12 1.8v3.4" fill="none" stroke-width="1.6" stroke-linecap="round"/>',
};

// Motion only, never opacity: the very first frame (and any renderer that skips CSS) shows every number.
// The bar grows as one piece: a single clip rectangle is scaled, so the gaps between segments
// never open up while it grows.
export const STYLE =
  '.in{animation:in .7s ease-out both}@keyframes in{from{transform:translateY(6px)}to{transform:none}}' +
  '.grow{transform-box:fill-box;transform-origin:left center;animation:grow 1.1s cubic-bezier(.2,.7,.2,1) .1s both}@keyframes grow{from{transform:scaleX(.001)}to{transform:none}}';

const columnX = (index) => LEFT + index * COLUMN_WIDTH;

// Fails the build instead of publishing text that runs into the next column or past the frame.
function assertFits(label, x, width, right) {
  if (x < LEFT - 0.5 || x + width > right + 0.5) {
    throw new Error(`"${label}" overflows its column (${x.toFixed(1)}-${(x + width).toFixed(1)}, limit ${right.toFixed(1)})`);
  }
}

function header(glyphs, colors, title, note, y) {
  const noteWidth = measure(note, { size: NOTE_SIZE });
  if (LEFT + measure(title, { weight: 'semibold', size: TITLE.size }) + 16 > RIGHT - noteWidth) throw new Error(`"${title}" collides with "${note}"`);
  return (
    glyphs.text(title, { x: LEFT, y, weight: 'semibold', size: TITLE.size, fill: colors.text }).svg +
    glyphs.text(note, { x: RIGHT, y, size: NOTE_SIZE, fill: colors.muted, anchor: 'end' }).svg
  );
}

export function metricItems(summary) {
  return [
    { icon: 'star', value: formatNumber(summary.stars), label: 'stars on my repos' },
    { icon: 'fork', value: formatNumber(summary.forks), label: 'forks of my repos' },
    { icon: 'flame', value: `${formatNumber(summary.longest)} days`, label: 'longest streak, all time' },
    { icon: 'calendar', value: formatNumber(summary.activeDays), label: 'active days, past year' },
  ];
}

// Icon and value on one line, the label under both, starting at the column edge.
function metrics(glyphs, colors, summary) {
  return metricItems(summary)
    .map((item, index) => {
      const x = columnX(index);
      const textX = x + VALUE.indent;
      const limit = x + COLUMN_WIDTH - LEGEND.gutter / 2;
      assertFits(item.value, textX, measure(item.value, { weight: 'display', size: VALUE.size }), limit);
      assertFits(item.label, x, measure(item.label, { size: LABEL_SIZE }), limit);
      return (
        `<g class="in" style="animation-delay:${(0.1 + index * 0.1).toFixed(1)}s">` +
        `<g transform="translate(${x} ${METRICS.value - ICON_SIZE - 1})" stroke="${colors.accent}">${ICONS[item.icon]}</g>` +
        glyphs.text(item.value, { x: textX, y: METRICS.value, weight: 'display', size: VALUE.size, fill: colors.text }).svg +
        glyphs.text(item.label, { x, y: METRICS.label, size: LABEL_SIZE, fill: colors.muted }).svg +
        `</g>`
      );
    })
    .join('');
}

export function percent(share) {
  if (share < 0.001) return '<0.1%';
  return `${(share * 100).toFixed(1)}%`;
}

// Segment widths that add up to the bar, with a visible minimum for tiny shares.
function segmentWidths(shares, available) {
  const widths = shares.map((share) => Math.max(share * available, BAR.minSegment));
  const excess = widths.reduce((a, b) => a + b, 0) - available;
  const largest = widths.indexOf(Math.max(...widths));
  widths[largest] -= excess;
  return widths;
}

const looksDistinct = (colour, others) => others.every((other) => colourDistance(colour, other) >= MIN_COLOUR_DISTANCE);

// A language keeps its own colour (palette.<theme>.languages); one without a colour of its own takes
// the first spare that stays distinct from the rest. Every colour needs 3:1 against the card and
// every pair must differ clearly in colour, not just in lightness, so no two legend dots look alike.
// Neighbouring segments aim for 3:1 as well; below that only a warning, since the legend names them.
export function languageColours(theme, languages, maxLanguages = COLUMNS) {
  const { languages: byName, languageSpare, languageOther, surface } = palette[theme];
  if (languages.length > maxLanguages) throw new Error(`${languages.length} languages do not fit ${maxLanguages} legend slots`);
  const taken = languages.map(({ name }) => (name === 'Other' ? languageOther : byName[name])).filter(Boolean);
  const colours = languages.map(({ name }) => {
    const own = name === 'Other' ? languageOther : byName[name];
    if (own) return own;
    const spare = languageSpare.find((candidate) => !taken.includes(candidate) && looksDistinct(candidate, taken));
    if (!spare) throw new Error(`palette.${theme}.languageSpare has no colour distinct enough for ${name}`);
    taken.push(spare);
    return spare;
  });
  colours.forEach((colour, index) => {
    if (contrast(colour, surface) < MIN_CARD_CONTRAST) throw new Error(`${theme} language colour ${colour} is below ${MIN_CARD_CONTRAST}:1 on the card`);
    if (!looksDistinct(colour, colours.slice(index + 1))) throw new Error(`${theme} language colour ${colour} looks like another one`);
    const next = colours[index + 1];
    if (next && contrast(colour, next) < MIN_CARD_CONTRAST) console.warn(`${theme}: neighbouring language colours ${colour} and ${next} are below ${MIN_CARD_CONTRAST}:1`);
  });
  return colours;
}

// Returns the clip path (for <defs>) and the clipped segments.
export function languageBar(languages, fills, { left, right, y, height = BAR.height, id = 'bar' }) {
  const widths = segmentWidths(
    languages.map((language) => language.share),
    right - left - BAR.gap * (languages.length - 1),
  );
  let segmentX = left;
  const segments = languages
    .map((language, index) => {
      const width = widths[index];
      const rect = `<rect x="${segmentX.toFixed(2)}" y="${y}" width="${width.toFixed(2)}" height="${height}" rx="${Math.min(BAR.radius, width / 2)}" fill="${fills[index]}"/>`;
      segmentX += width + BAR.gap;
      return rect;
    })
    .join('');
  return {
    clip: `<clipPath id="${id}"><rect class="grow" x="${left}" y="${y}" width="${right - left}" height="${height}"/></clipPath>`,
    svg: `<g clip-path="url(#${id})">${segments}</g>`,
  };
}

// One legend entry per column: the names start on the metric labels' line; a percentage ends a
// gutter before the next column, and the last one ends with the bar.
function languageLegend(glyphs, colors, languages, fills) {
  return languages
    .map((language, index) => {
      const x = columnX(index);
      const value = percent(language.share);
      const valueRight = index === COLUMNS - 1 ? RIGHT : x + COLUMN_WIDTH - LEGEND.gutter;
      const valueWidth = measure(value, { size: LEGEND.size });
      const nameWidth = measure(language.name, { weight: 'medium', size: LEGEND.size });
      if (x + LEGEND.indent + nameWidth + 8 > valueRight - valueWidth) throw new Error(`"${language.name}" collides with its percentage`);
      return (
        `<g class="in" style="animation-delay:${(0.3 + index * 0.06).toFixed(2)}s">` +
        `<circle cx="${x + 6}" cy="${LANGUAGES.legend - 5}" r="${LEGEND.dot}" fill="${fills[index]}"/>` +
        glyphs.text(language.name, { x: x + LEGEND.indent, y: LANGUAGES.legend, weight: 'medium', size: LEGEND.size, fill: colors.text }).svg +
        glyphs.text(value, { x: valueRight, y: LANGUAGES.legend, size: LEGEND.size, fill: colors.muted, anchor: 'end' }).svg +
        `</g>`
      );
    })
    .join('');
}

export function renderNumbers(theme, summary) {
  const colors = palette[theme];
  const glyphs = new GlyphSet('n');
  const languages = summary.languages;
  const fills = languageColours(theme, languages);
  const updated = `Updated ${formatDate(summary.fetchedAt)}`;
  const bar = languageBar(languages, fills, { left: LEFT, right: RIGHT, y: LANGUAGES.bar });
  const frame = `<rect x="0.5" y="0.5" width="${WIDTH - 1}" height="${HEIGHT - 1}" rx="16" fill="${colors.surface}" stroke="${colors.border}"/>`;
  const body =
    frame +
    header(glyphs, colors, 'GitHub', updated, METRICS.title) +
    metrics(glyphs, colors, summary) +
    `<path d="M${LEFT} ${DIVIDER + 0.5}H${RIGHT}" stroke="${colors.border}"/>` +
    header(glyphs, colors, 'Languages', 'public repos, by code size', LANGUAGES.title) +
    bar.svg +
    languageLegend(glyphs, colors, languages, fills);
  return svgDocument({ width: WIDTH, height: HEIGHT, title: numbersTitle(summary, updated), style: STYLE, defs: bar.clip + glyphs.defs(), body });
}

export function numbersTitle(summary, updated) {
  const languages = summary.languages;
  return (
    `GitHub: ${formatNumber(summary.stars)} stars on my repositories, ${formatNumber(summary.forks)} forks of my repositories, ` +
    `longest daily contribution streak ${formatNumber(summary.longest)} days (all time), ` +
    `${formatNumber(summary.activeDays)} active days in the past year. ` +
    `Languages in public repositories by code size: ${languages.map((l) => `${l.name} ${percent(l.share)}`).join(', ')}. ${updated}.`
  );
}
