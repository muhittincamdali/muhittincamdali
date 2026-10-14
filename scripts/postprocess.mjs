// Brings third-party calendar SVGs into the profile palette, trims what would duplicate
// other cards, frames them and writes dist/<tool>[-compact]-<theme>.svg: a desktop board drawn for
// the 846 px column and a phone board of the last 26 weeks drawn at 360 units.
// Usage: node scripts/postprocess.mjs <snake|3d> <input-dir>
import { existsSync, readFileSync } from 'node:fs';
import { palette, THEMES, escapeXml, writeAsset, REDUCED_MOTION } from './lib/svg.mjs';
import { VIEWS, cropWeeks, compressSkyline, recolorSkyline, skylineBox, skylineTransform } from './lib/skyline.mjs';

const CALENDAR = { full: 'my GitHub contribution calendar for the past year', compact: 'my GitHub contribution calendar for the last 26 weeks' };
const FRAME_RADIUS = 16;

// The desktop board shows 53 weeks inside a viewBox 56 cells wide (846 / 56 = 15.1 px per cell);
// the phone board 26 weeks in 28 cells (308 / 28 = 11 px pitch, 8.25 px cells in a 308 px column).
// The vertical margin equals the horizontal one, which centres the board in its frame.
const SNAKE = { pitch: 16, cell: 12, halo: 1.6, boardCells: { full: 56, compact: 28 } };

function gridBox({ boardCells, pitch, left, right, top, bottom }) {
  const width = boardCells * pitch;
  const margin = (width - (right - left)) / 2;
  return [left - margin, top - margin, width, bottom - top + margin * 2];
}

// A board holds at least its full weeks minus the current one (7 cells each).
const MIN_CELLS = { full: 52 * 7, compact: 25 * 7 };

function snakeLayout(svg, variant) {
  const rows = [...svg.matchAll(/<rect class="c[^"]*"[^>]*\sy="([\d.]+)"/g)].map((match) => Number(match[1]));
  const cols = [...svg.matchAll(/<rect class="c[^"]*"[^>]*\sx="([\d.]+)"/g)].map((match) => Number(match[1]));
  if (rows.length < MIN_CELLS[variant]) throw new Error(`Snake grid not found (${rows.length} cells)`);
  return { left: Math.min(...cols), right: Math.max(...cols) + SNAKE.cell, top: Math.min(...rows), bottom: Math.max(...rows) + SNAKE.cell };
}

// Colours are set from the palette here as well, so a board drawn with older settings still
// matches. The snake gets a thin halo in the card colour, which keeps it apart from cells of a
// similar shade. The progress bar under the grid is dropped: the board itself shows the progress.
// With reduced motion the board stands still and shows the calendar.
function snakeTransform(svg, theme) {
  const colors = palette[theme];
  const out = svg
    .replace(/--cb:#[0-9a-f]{8}/i, `--cb:${theme === 'dark' ? 'rgba(255,255,255,.05)' : 'rgba(0,40,92,.07)'}`)
    .replace(/--cs:#[0-9a-f]{6}/i, `--cs:${colors.player}`)
    .replace(/--ce:#[0-9a-f]{6}/i, `--ce:${colors.contrib[0]}`)
    .replace(/--c([0-4]):#[0-9a-f]{6}/gi, (_, level) => `--c${level}:${colors.contrib[level]}`)
    .replace(/<rect class="u[^"]*"[^>]*\/>/g, '')
    .replace(/\.u(\.u\d+)?\{[^}]*\}/g, '')
    .replace(/@keyframes u\d+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  if (/class="u|@keyframes u\d/.test(out)) throw new Error('Snake progress bar was not removed');
  if (!out.includes(`--cs:${colors.player}`)) throw new Error('Snake colour variable not found');
  if (!out.includes('</style>')) throw new Error('Snake style block not found');
  return out.replace('</style>', `.s{stroke:${colors.halo};stroke-width:${SNAKE.halo}px;paint-order:stroke}${REDUCED_MOTION}</style>`);
}

// The snake tool draws each board from its own calendar; the 3D phone view is cut from the desktop one.
const TOOLS = {
  snake: {
    input: (theme, variant) => `snake${variant === 'compact' ? '-compact' : ''}-${theme}.svg`,
    title: (variant) => `Snake game eating ${CALENDAR[variant]}`,
    box: (svg, variant) => gridBox({ boardCells: SNAKE.boardCells[variant], pitch: SNAKE.pitch, ...snakeLayout(svg, variant) }),
    transform: (svg, theme) => snakeTransform(svg, theme),
  },
  '3d': {
    input: (theme) => `3d-${theme}.svg`,
    title: (variant) => `3D chart of ${CALENDAR[variant]}, with month labels`,
    prepare: (svg, theme, variant) => recolorSkyline(compressSkyline(cropWeeks(svg, VIEWS[variant].weeks)), theme),
    box: (svg, variant) => skylineBox(svg, VIEWS[variant]),
    transform: (svg, theme, variant) => skylineTransform(svg, theme, VIEWS[variant]),
  },
};
const WIDTH = { full: VIEWS.full.width, compact: VIEWS.compact.width };

// The frame is drawn in the board's own units but sized for the screen: 1 px line and 16 px
// corners (12 on the phone board) at the natural width, flush with the column edges.
function frame(svg, theme, title, box, displayWidth) {
  const colors = palette[theme];
  const [x, y, width, height] = box.map((value) => Math.round(value * 100) / 100);
  const unit = width / displayWidth;
  const radius = displayWidth < 600 ? 12 : FRAME_RADIUS;
  // Drawn at the natural width, so a board narrower in its own units is not left at that size.
  const displayHeight = Math.round((height * displayWidth) / width);
  const openTag = `<svg xmlns="http://www.w3.org/2000/svg" width="${displayWidth}" height="${displayHeight}" viewBox="${x} ${y} ${width} ${height}" role="img" aria-labelledby="t">`;
  const background =
    `<title id="t">${escapeXml(title)}</title>` +
    `<rect x="${(x + unit / 2).toFixed(2)}" y="${(y + unit / 2).toFixed(2)}" width="${(width - unit).toFixed(2)}" height="${(height - unit).toFixed(2)}" ` +
    `rx="${(radius * unit).toFixed(2)}" fill="${colors.surface}" stroke="${colors.border}" stroke-width="${unit.toFixed(3)}"/>`;
  return svg.replace(/<svg[^>]*>/, openTag + background);
}

const [toolName, inputDir] = process.argv.slice(2);
const tool = TOOLS[toolName];
if (!tool || !inputDir) throw new Error('Usage: postprocess.mjs <snake|3d> <input-dir>');

for (const variant of ['full', 'compact']) {
  for (const theme of THEMES) {
    const path = `${inputDir}/${tool.input(theme, variant)}`;
    if (!existsSync(path)) throw new Error(`Missing ${path}`);
    const raw = readFileSync(path, 'utf8')
      .replace(/<\?xml[^>]*>/, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<desc>[\s\S]*?<\/desc>/g, '')
      .replace(/<metadata>[\s\S]*?<\/metadata>/g, '')
      .trim();
    const prepared = tool.prepare ? tool.prepare(raw, theme, variant) : raw;
    const svg = frame(tool.transform(prepared, theme, variant), theme, tool.title(variant), tool.box(prepared, variant), WIDTH[variant]);
    const name = `${toolName}${variant === 'compact' ? '-compact' : ''}-${theme}.svg`;
    console.log(writeAsset(name, svg + '\n'), `${svg.length} bytes`);
  }
}
