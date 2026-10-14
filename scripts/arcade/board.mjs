// Shared pieces of the two arcade boards this repository draws itself (Pac-Man and Breakout): the
// calendar grid, a seeded random source, CSS keyframes and the frame. Both games are simulated once
// per board size and drawn for both themes, so the light and dark images show the same game.
import { palette, escapeXml, REDUCED_MOTION } from '../lib/svg.mjs';

// Same cell size and spacing as the snake board, so the three games line up on the page.
export const GRID = { pitch: 16, cell: 12, radius: 2, rows: 7 };

// The desktop board shows a year in an 846 px column; the phone board the last 26 weeks at 360 px.
export const VARIANTS = {
  full: { weeks: 53, boardCells: 56, width: 846, range: 'the past year' },
  compact: { weeks: 26, boardCells: 28, width: 360, range: 'the last 26 weeks' },
};

const DAY_MS = 86400000;
const FRAME = { radius: 16, phoneRadius: 12 };

// The last `weeks` calendar weeks, Sunday first, as GitHub draws them: a column per week, a row per
// weekday, the last column ending today. Levels are GitHub's own (fetch-github.mjs stores them).
export function calendarGrid(calendar, weeks) {
  const lastDay = Date.parse(`${calendar[calendar.length - 1].date}T00:00:00Z`);
  const start = lastDay - (new Date(lastDay).getUTCDay() + 7 * (weeks - 1)) * DAY_MS;
  const cells = [];
  for (const day of calendar) {
    const index = (Date.parse(`${day.date}T00:00:00Z`) - start) / DAY_MS;
    if (index < 0) continue;
    if (!Number.isInteger(day.level) || day.level < 0 || day.level > 4) throw new Error(`Calendar day ${day.date} has no contribution level`);
    cells.push({ col: Math.floor(index / 7), row: index % 7, level: day.level, count: day.count, index: cells.length });
  }
  const expected = (lastDay - start) / DAY_MS + 1;
  if (cells.length !== expected || cells.some((cell, i) => cell.col * 7 + cell.row !== i)) throw new Error('Calendar days are not continuous');
  return { weeks, cells, at: (col, row) => cells[col * 7 + row] };
}

// mulberry32: small, fast and the same on every machine, so a calendar always gives the same game.
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const cellX = (col) => col * GRID.pitch;
export const cellY = (row) => row * GRID.pitch;
export const round = (value) => Math.round(value * 100) / 100;

const percent = (time, duration) => `${Math.min(100, (time / duration) * 100).toFixed(3).replace(/\.?0+$/, '')}%`;

// A CSS @keyframes rule from [time in seconds, declarations] pairs.
export function keyframes(name, frames, duration) {
  return `@keyframes ${name}{${frames.map(([time, value]) => `${percent(time, duration)}{${value}}`).join('')}}`;
}

// Keeps the first sample, the last one and every sample where the motion changes, so a straight
// run at constant speed is a single keyframe interval.
export function turningPoints(samples) {
  return samples.filter((sample, i) => {
    if (i === 0 || i === samples.length - 1) return true;
    const [before, after] = [samples[i - 1], samples[i + 1]];
    const inX = (sample.x - before.x) / (sample.t - before.t);
    const inY = (sample.y - before.y) / (sample.t - before.t);
    const outX = (after.x - sample.x) / (after.t - sample.t);
    const outY = (after.y - sample.y) / (after.t - sample.t);
    return Math.abs(inX - outX) > 1e-6 || Math.abs(inY - outY) > 1e-6;
  });
}

export const translate = (x, y) => `transform:translate(${round(x)}px,${round(y)}px)`;

// Calendar cells: empty days in the empty colour, the rest in their level colour until `goneAt`
// (seconds) gives them the empty colour; the cycle start brings them back.
export function cellsSvg(grid, theme, goneAt, duration) {
  const colors = palette[theme];
  const css = [];
  const rects = grid.cells.map((cell) => {
    const time = goneAt.get(cell.index);
    const name = time === undefined ? '' : `e${cell.index.toString(36)}`;
    if (name && time < duration) css.push(`${keyframes(name, [[time, 'fill:var(--e)']], duration)}.${name}{animation-name:${name}}`);
    return `<rect${name ? ` class="e ${name}"` : ''} x="${cellX(cell.col)}" y="${cellY(cell.row)}" width="${GRID.cell}" height="${GRID.cell}" rx="${GRID.radius}" fill="${colors.contrib[cell.level]}"/>`;
  });
  // The shared rule comes first: a cell's own rule has the same weight and wins by order.
  return { css: `:root{--e:${colors.contrib[0]}}.e{animation:none ${duration.toFixed(3)}s step-end infinite}${css.join('')}`, svg: rects.join('') };
}

// The board's view box: the grid centred with equal margins on every side, as on the snake board.
export function boardBox(variant, contentHeight) {
  const { weeks, boardCells } = VARIANTS[variant];
  const width = boardCells * GRID.pitch;
  const margin = (width - (weeks * GRID.pitch - (GRID.pitch - GRID.cell))) / 2;
  return { x: -margin, y: -margin, width, height: contentHeight + margin * 2, margin };
}

// Standalone SVG at the board's natural width, with a 1 px frame flush with the README column.
export function framedSvg({ variant, theme, title, box, style, body }) {
  const colors = palette[theme];
  const displayWidth = VARIANTS[variant].width;
  const unit = box.width / displayWidth;
  const radius = (displayWidth < 600 ? FRAME.phoneRadius : FRAME.radius) * unit;
  const displayHeight = Math.round((box.height * displayWidth) / box.width);
  const [x, y, w, h] = [box.x, box.y, box.width, box.height].map(round);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${displayWidth}" height="${displayHeight}" viewBox="${x} ${y} ${w} ${h}" role="img" aria-labelledby="t">` +
    `<title id="t">${escapeXml(title)}</title><style>${style}${REDUCED_MOTION}</style>` +
    `<rect x="${round(x + unit / 2)}" y="${round(y + unit / 2)}" width="${round(w - unit)}" height="${round(h - unit)}" rx="${round(radius)}" fill="${colors.surface}" stroke="${colors.border}" stroke-width="${unit.toFixed(3)}"/>` +
    `${body}</svg>\n`
  );
}
