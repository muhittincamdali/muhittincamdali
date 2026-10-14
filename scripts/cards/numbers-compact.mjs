// Phone and tablet version of "By the numbers": the same data on a 340-unit card with a 2 x 2 metric grid and a
// 2 x 2 language legend. A 360 px phone leaves a ~278 px column, where 14-unit text is still ~11.4 px.
import { GlyphSet, measure } from '../lib/text.mjs';
import { palette, svgDocument, formatDate } from '../lib/svg.mjs';
import { ICONS, STYLE, metricItems, percent, languageColours, languageBar, numbersTitle } from './numbers.mjs';

const WIDTH = 340;
const PAD = 20;
const LEFT = PAD;
const RIGHT = WIDTH - PAD;
const CELL_WIDTH = (RIGHT - LEFT) / 2;
const GUTTER = 12;
const TITLE = { size: 17, cap: 12.4 };
const TEXT_SIZE = 14;
const VALUE = { size: 24, indent: 26 };
const ICON_SCALE = 0.9;
// A label with a qualifier ("longest streak, all time") takes two lines: side by side, two such
// labels would not fit a 340-unit card at 14 units.
const LABEL_LINE = 18;
const METRIC_ROWS = [{ value: 76, label: 96 }, { value: 136, label: 156 }];
const DIVIDER = 196;
const LANGUAGES = { title: 228, bar: 242, legend: [280, 304] };
const LEGEND = { size: 14, dot: 5, indent: 16 };
const BAR_HEIGHT = 10;
const HEIGHT = LANGUAGES.legend[1] + PAD;

const cellX = (index) => LEFT + (index % 2) * CELL_WIDTH;

// Fails the build instead of publishing text that runs into the next cell or past the frame.
function assertFits(label, right, limit) {
  if (right > limit + 0.5) throw new Error(`Compact card: "${label}" overflows its cell (${right.toFixed(1)} > ${limit.toFixed(1)})`);
}

function header(glyphs, colors, title, note, y) {
  const titleWidth = measure(title, { weight: 'semibold', size: TITLE.size });
  const noteWidth = measure(note, { size: TEXT_SIZE });
  assertFits(`${title} / ${note}`, LEFT + titleWidth + 12 + noteWidth, RIGHT);
  return (
    glyphs.text(title, { x: LEFT, y, weight: 'semibold', size: TITLE.size, fill: colors.text }).svg +
    glyphs.text(note, { x: RIGHT, y, size: TEXT_SIZE, fill: colors.muted, anchor: 'end' }).svg
  );
}

function metrics(glyphs, colors, summary) {
  return metricItems(summary)
    .map((item, index) => {
      const x = cellX(index);
      const row = METRIC_ROWS[Math.floor(index / 2)];
      const limit = x + CELL_WIDTH - GUTTER / 2;
      assertFits(item.value, x + VALUE.indent + measure(item.value, { weight: 'display', size: VALUE.size }), limit);
      const labelLines = item.label.split(', ');
      if (labelLines.length > 1 && row !== METRIC_ROWS[METRIC_ROWS.length - 1]) throw new Error(`Compact card: two-line label "${item.label}" must be in the last row`);
      for (const text of labelLines) assertFits(text, x + measure(text, { size: TEXT_SIZE }), limit);
      return (
        `<g class="in" style="animation-delay:${(0.1 + index * 0.1).toFixed(1)}s">` +
        `<g transform="translate(${x} ${row.value - 17}) scale(${ICON_SCALE})" stroke="${colors.accent}">${ICONS[item.icon]}</g>` +
        glyphs.text(item.value, { x: x + VALUE.indent, y: row.value, weight: 'display', size: VALUE.size, fill: colors.text }).svg +
        labelLines.map((text, line) => glyphs.text(text, { x, y: row.label + line * LABEL_LINE, size: TEXT_SIZE, fill: colors.muted }).svg).join('') +
        `</g>`
      );
    })
    .join('');
}

function legend(glyphs, colors, languages, fills) {
  return languages
    .map((language, index) => {
      const x = cellX(index);
      const y = LANGUAGES.legend[Math.floor(index / 2)];
      const value = percent(language.share);
      // The right-hand column ends with the bar; the left one a gutter before the next dot.
      const valueRight = index % 2 === 1 ? RIGHT : x + CELL_WIDTH - GUTTER;
      const nameRight = x + LEGEND.indent + measure(language.name, { weight: 'medium', size: LEGEND.size }) + 8;
      assertFits(language.name, nameRight, valueRight - measure(value, { size: LEGEND.size }));
      return (
        `<g class="in" style="animation-delay:${(0.3 + index * 0.06).toFixed(2)}s">` +
        `<circle cx="${x + 5}" cy="${y - 5}" r="${LEGEND.dot}" fill="${fills[index]}"/>` +
        glyphs.text(language.name, { x: x + LEGEND.indent, y, weight: 'medium', size: LEGEND.size, fill: colors.text }).svg +
        glyphs.text(value, { x: valueRight, y, size: LEGEND.size, fill: colors.muted, anchor: 'end' }).svg +
        `</g>`
      );
    })
    .join('');
}

export function renderNumbersCompact(theme, summary) {
  const colors = palette[theme];
  const glyphs = new GlyphSet('m');
  const languages = summary.languages;
  const fills = languageColours(theme, languages, 4);
  const updated = `Updated ${formatDate(summary.fetchedAt)}`;
  const bar = languageBar(languages, fills, { left: LEFT, right: RIGHT, y: LANGUAGES.bar, height: BAR_HEIGHT });
  const body =
    `<rect x="0.5" y="0.5" width="${WIDTH - 1}" height="${HEIGHT - 1}" rx="14" fill="${colors.surface}" stroke="${colors.border}"/>` +
    header(glyphs, colors, 'GitHub', updated, PAD + TITLE.cap) +
    metrics(glyphs, colors, summary) +
    `<path d="M${LEFT} ${DIVIDER + 0.5}H${RIGHT}" stroke="${colors.border}"/>` +
    header(glyphs, colors, 'Languages', 'public repos, by code size', LANGUAGES.title) +
    bar.svg +
    legend(glyphs, colors, languages, fills);
  return svgDocument({ width: WIDTH, height: HEIGHT, title: numbersTitle(summary, updated), style: STYLE, defs: bar.clip + glyphs.defs(), body });
}
