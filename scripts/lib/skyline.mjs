// Post-processing for the 3D contribution chart (github-profile-3d-contrib): caps tower heights,
// recolours the faces from the palette, keeps only the calendar, shears it into a skyline and adds
// month labels along its front edge. The phone view is the same chart cut to its last weeks.
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { palette, hexToRgb } from './svg.mjs';
import { GlyphSet, measure } from './text.mjs';

// The tool draws the year as an isometric diamond (weeks run 30 degrees downhill), which leaves
// two empty triangles in a wide frame. A vertical shear turns it into an oblique view whose weeks
// run almost level, like a skyline. Bar sizes are fixed by the tool's 1280 px canvas (dx = 20):
// each bar is 2 x 18 px wide and its top and bottom faces reach 10.39 px past its corners.
export const SKYLINE = { shear: Math.tan(Math.PI / 6) - Math.tan((7 * Math.PI) / 180), barWidth: 36, faceRise: 10.39 };
const DAY_MS = 86400000;
const SATURDAY = 6;
// Month labels: gap and cap height are a share of the label size, in the view's own units.
const LABEL = { gap: 0.6, cap: 0.73, minWeeksApart: 3 };
// width: natural width of the image; labelSize and margin in its units. The desktop view is drawn
// for the 846 px column and keeps 17-unit labels >= 11.9 px at 590 px; the phone view shows the
// last 26 weeks at 360 units, so its 13-unit labels stay >= 11 px in a 308 px column.
export const VIEWS = {
  full: { width: 846, labelSize: 17, margin: 24, weeks: null, minLabels: 10 },
  compact: { width: 360, labelSize: 13, margin: 14, weeks: 26, minLabels: 5 },
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function skylineBars(svg, view = VIEWS.full) {
  const bars = [...svg.matchAll(/<g transform="translate\(([\d.]+) ([\d.]+)\)">(<animateTransform[^>]*values="[\d.]+ ([\d.]+);)?/g)];
  const minimum = view.weeks ? (view.weeks - 1) * 7 : 300;
  if (bars.length < minimum) throw new Error(`3D calendar has ${bars.length} bars`);
  // A growing bar animates up from 3 px above its base; an empty day is a 3 px slab, so either way base = start + 3.
  return bars.map(([, x, top, , start]) => ({ x: Number(x), top: Number(top), base: Number(start ?? top) + 3 }));
}

// The tool already uses a log scale, but a few days with hundreds of contributions (bulk pushes)
// still rise 3-4x above an ordinary busy day and hide the rest of the year. Above KNEE px a bar
// approaches CAP px smoothly, so tall days stay the tallest without towering; the colour still
// shows the contribution level. Heights are in the tool's own units (empty day = 3 px slab).
const HEIGHT_LIMIT = { knee: 48, cap: 84, slab: 3 };

function limitedHeight(height) {
  const { knee, cap, slab } = HEIGHT_LIMIT;
  const rise = height - slab;
  if (rise <= knee) return height;
  return slab + knee + (cap - knee) * (1 - Math.exp(-(rise - knee) / (cap - knee)));
}

const round2 = (value) => Math.round(value * 100) / 100;

export function compressSkyline(svg) {
  let bars = 0;
  const out = svg.replace(/<g transform="translate\(([\d.]+) ([\d.]+)\)">([\s\S]*?)<\/g>/g, (whole, x, top, inner) => {
    const motion = inner.match(/<animateTransform[^>]*values="[\d.]+ ([\d.]+);[\d.]+ [\d.]+"/);
    if (!motion) return whole;
    bars += 1;
    const base = Number(motion[1]) + HEIGHT_LIMIT.slab;
    const height = base - Number(top);
    const ratio = limitedHeight(height) / height;
    if (ratio === 1) return whole;
    const newTop = round2(base - limitedHeight(height));
    const body = inner
      .replace(/(values="[\d.]+ [\d.]+;[\d.]+ )[\d.]+"/, `$1${newTop}"`)
      .replace(/(<rect[^>]*\sheight=")([\d.]+)("[^>]*class="cont-(?:left|right)-\d")/g, (_, a, h, b) => `${a}${round2(Number(h) * ratio)}${b}`)
      .replace(/(<animate attributeName="height" values="[\d.]+;)([\d.]+)"/g, (_, a, h) => `${a}${round2(Number(h) * ratio)}"`);
    return `<g transform="translate(${x} ${newTop})">${body}</g>`;
  });
  if (bars < 50) throw new Error(`3D calendar: only ${bars} growing bars found`);
  return out;
}

// Side faces are the top colour mixed towards the theme's deep navy (not towards grey), so the
// light theme keeps clean blue sides and the faces still follow assets/palette.json.
const FACE_SHADE = { top: 0, left: 0.22, right: 0.4 };

export function recolorSkyline(svg, theme) {
  const { contrib, shade } = palette[theme];
  const target = hexToRgb(shade);
  return svg.replace(/\.cont-(top|left|right)-([0-4]) \{ fill: [^;]+; \}/g, (_, face, level) => {
    const amount = FACE_SHADE[face];
    const [r, g, b] = hexToRgb(contrib[level]).map((channel, index) => Math.round(channel + (target[index] - channel) * amount));
    return `.cont-${face}-${level} { fill: rgb(${r}, ${g}, ${b}); }`;
  });
}

const shearY = (x, y) => y - SKYLINE.shear * x;

// The bars come week by week, Sunday first, so a new week starts wherever x jumps right.
function weeks(bars) {
  const out = [];
  bars.forEach((bar, index) => {
    if (index === 0 || bar.x > bars[index - 1].x) out.push([]);
    out[out.length - 1].push(index);
  });
  return out;
}

const BAR_GROUP = /<g transform="translate\(([\d.]+) ([\d.]+)\)">[\s\S]*?<\/g>/g;

// Keeps the last `count` weeks: every bar group of an older week is removed.
export function cropWeeks(svg, count) {
  if (!count) return svg;
  const xs = [...svg.matchAll(BAR_GROUP)].map((match) => Number(match[1]));
  const grouped = weeks(xs.map((x) => ({ x })));
  if (grouped.length < count) throw new Error(`3D calendar has ${grouped.length} weeks, ${count} requested`);
  const firstKept = grouped[grouped.length - count][0];
  let index = -1;
  return svg.replace(BAR_GROUP, (whole) => {
    index += 1;
    return index < firstKept ? '' : whole;
  });
}

// Date of the last bar: the latest day up to tomorrow (UTC, for time zones ahead of it) that falls
// on the last bar's weekday. SKYLINE_END (YYYY-MM-DD) pins it when re-rendering an older image.
function lastDay(lastWeekday) {
  const pinned = process.env.SKYLINE_END;
  const start = pinned ? Date.parse(`${pinned}T00:00:00Z`) : Math.floor(Date.now() / DAY_MS) * DAY_MS + DAY_MS;
  let day = start;
  while (new Date(day).getUTCDay() !== lastWeekday) day -= DAY_MS;
  return day;
}

// One label per month, under the Saturday (front) bar of the week that holds the 1st. Only the first
// label carries the year: at 17 units "Jan 2026" would run into "Dec".
function monthLabels(bars, minLabels) {
  const grouped = weeks(bars);
  const lastWeek = grouped[grouped.length - 1];
  const firstWeek = grouped[0];
  const end = lastDay(lastWeek.length - 1);
  const firstWeekday = 7 - firstWeek.length;
  const dayOf = (index) => new Date(end - (bars.length - 1 - index) * DAY_MS);
  if (dayOf(0).getUTCDay() !== firstWeekday) throw new Error('3D calendar weeks do not line up with the dates');
  const labels = [];
  grouped.forEach((week, weekIndex) => {
    const first = week.map(dayOf).find((date) => date.getUTCDate() === 1);
    const saturday = week.find((index) => dayOf(index).getUTCDay() === SATURDAY);
    if (!first || saturday === undefined) return;
    if (labels.length && weekIndex - labels[labels.length - 1].week < LABEL.minWeeksApart) return;
    const month = first.getUTCMonth();
    const text = labels.length === 0 ? `${MONTHS[month]} ${first.getUTCFullYear()}` : MONTHS[month];
    const { x, base } = bars[saturday];
    labels.push({ week: weekIndex, text, x: x + SKYLINE.barWidth / 2, y: base + SKYLINE.faceRise });
  });
  if (labels.length < minLabels) throw new Error(`3D calendar: only ${labels.length} month labels`);
  return labels;
}

// Size of one unit of the view in the chart's units, from the bars' width alone (the labels sit inside it).
function viewUnit(bars, view) {
  const xs = bars.map(({ x }) => x);
  const width = Math.max(...xs) + SKYLINE.barWidth - Math.min(...xs);
  return width / (view.width - view.margin * 2);
}

function placedLabels(svg, view) {
  const bars = skylineBars(svg, view);
  const unit = viewUnit(bars, view);
  const placed = monthLabels(bars, view.minLabels).map((label) => {
    const size = view.labelSize * unit;
    const width = measure(label.text, { weight: 'medium', size });
    return { ...label, size, width, baseline: shearY(label.x, label.y) + (LABEL.gap + LABEL.cap) * view.labelSize * unit };
  });
  placed.slice(1).forEach((label, index) => {
    const previous = placed[index];
    if (label.x - label.width / 2 < previous.x + previous.width / 2 + 4 * unit) throw new Error(`3D labels "${previous.text}" and "${label.text}" overlap`);
  });
  return placed;
}

// Bounding box of every bar after the shear and of the month labels, plus view.margin units.
export function skylineBox(svg, view) {
  const xs = [];
  const ys = [];
  for (const { x, top, base } of skylineBars(svg, view)) {
    const corners = [
      [x + SKYLINE.barWidth / 2, top - SKYLINE.faceRise],
      [x, top],
      [x + SKYLINE.barWidth, top],
      [x, base],
      [x + SKYLINE.barWidth, base],
      [x + SKYLINE.barWidth / 2, base + SKYLINE.faceRise],
    ];
    for (const [cornerX, cornerY] of corners) {
      xs.push(cornerX);
      ys.push(shearY(cornerX, cornerY));
    }
  }
  for (const label of placedLabels(svg, view)) {
    xs.push(label.x - label.width / 2, label.x + label.width / 2);
    ys.push(label.baseline);
  }
  const [left, right, top, bottom] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const margin = (view.margin * (right - left)) / (view.width - view.margin * 2);
  return [left - margin, top - margin, right - left + margin * 2, bottom - top + margin * 2];
}

// The tool also draws stars, forks, a contribution radar and a language pie;
// those numbers live on the "By the numbers" card, so only the skyline stays.
function keepOnly3dCalendar(svg) {
  const options = { preserveOrder: true, ignoreAttributes: false, attributeNamePrefix: '@', suppressEmptyNode: true };
  const tree = new XMLParser(options).parse(svg);
  const root = tree.find((node) => node.svg);
  let calendarKept = false;
  root.svg = root.svg.filter((node) => {
    if (node.style) return true;
    if (node.g && !calendarKept) {
      calendarKept = true;
      return true;
    }
    return false;
  });
  if (!calendarKept) throw new Error('3D calendar group not found');
  return new XMLBuilder(options).build(tree);
}

export function skylineTransform(svg, theme, view) {
  const glyphs = new GlyphSet('k');
  const labels = placedLabels(svg, view)
    .map(({ text, x, baseline, size }) => glyphs.text(text, { x, y: baseline, weight: 'medium', size, fill: palette[theme].muted, anchor: 'middle' }).svg)
    .join('');
  const sheared = keepOnly3dCalendar(svg).replace(/<g>/, `<g transform="matrix(1 ${-SKYLINE.shear} 0 1 0 0)">`);
  return sheared.replace(/<\/svg>\s*$/, `<defs>${glyphs.defs()}</defs>${labels}</svg>`);
}
