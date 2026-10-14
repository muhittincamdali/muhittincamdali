// Pac-Man on the contribution calendar. Every day with contributions is a pellet; Pac-Man always
// heads for the nearest one, and the cycle restarts the moment the last pellet goes. Four ghosts
// chase, ambush and scatter like the arcade ones but always keep two cells away, and the four
// busiest days frighten them for a while. Everything comes from the calendar and a fixed seed, so
// both themes show the same game and a new image only differs when the calendar does.
import { palette } from '../lib/svg.mjs';
import { GRID, VARIANTS, seededRandom, keyframes, turningPoints, translate, cellsSvg, boardBox, framedSvg, cellX, cellY } from './board.mjs';

const SEED = 20261014;
const TICK = 0.16; // seconds per cell
const BITE = 0.35; // a pellet goes this share of a tick before Pac-Man's centre reaches it
const POWER_PELLETS = 4;
const FRIGHT_TICKS = 28;
const PHASE = { chase: 36, scatter: 12 }; // ticks
const WANDER = 0.15; // chance that a ghost takes a random turn
const SAFE_DISTANCE = 2; // cells (grid steps) every ghost keeps from Pac-Man
const DIRECTIONS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // right, down, left, up: index x 90 degrees
const SIZE = { pacman: 7.5, ghost: 7, halo: 1.6, jaw: 34, pupil: 1 };
const MAX_TICKS = 5000;

const steps = (a, b) => Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
const distance = (a, b) => Math.hypot(a.col - b.col, a.row - b.row);

function neighbours(grid, { col, row }) {
  return DIRECTIONS.map(([dx, dy], dir) => ({ col: col + dx, row: row + dy, dir })).filter(
    (cell) => cell.col >= 0 && cell.col < grid.weeks && cell.row >= 0 && cell.row < GRID.rows && grid.at(cell.col, cell.row),
  );
}

// Breadth-first search to the nearest pellet; the current heading is tried first, so ties keep
// Pac-Man going straight. Returns the direction of the first step.
function towardNearestPellet(grid, from, heading, pellets) {
  const order = [heading, ...[0, 1, 2, 3].filter((dir) => dir !== heading)];
  const firstStep = new Map([[grid.at(from.col, from.row).index, null]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i += 1) {
    const current = queue[i];
    const currentIndex = grid.at(current.col, current.row).index;
    if (i > 0 && pellets.has(currentIndex)) return firstStep.get(currentIndex);
    for (const next of neighbours(grid, current).sort((a, b) => order.indexOf(a.dir) - order.indexOf(b.dir))) {
      const index = grid.at(next.col, next.row).index;
      if (firstStep.has(index)) continue;
      firstStep.set(index, i === 0 ? next.dir : firstStep.get(currentIndex));
      queue.push(next);
    }
  }
  throw new Error('Pac-Man cannot reach the remaining pellets');
}

// The arcade personalities: one chases, one cuts ahead, one closes from behind and one keeps its
// distance; in scatter phases each returns to its own corner.
function ghostTarget(grid, index, ghost, pacman, heading, scatter) {
  const corners = [[grid.weeks - 1, 0], [0, 0], [grid.weeks - 1, GRID.rows - 1], [0, GRID.rows - 1]];
  const corner = { col: corners[index][0], row: corners[index][1] };
  if (scatter) return corner;
  const [dx, dy] = DIRECTIONS[heading];
  if (index === 1) return { col: pacman.col + 4 * dx, row: pacman.row + 4 * dy };
  if (index === 2) return { col: pacman.col - 4 * dx, row: pacman.row - 4 * dy };
  if (index === 3 && distance(ghost, pacman) < 8) return corner;
  return pacman;
}

function moveGhosts(grid, ghosts, pacman, heading, tick, frightened, random) {
  const taken = new Set(ghosts.map((ghost) => grid.at(ghost.col, ghost.row).index));
  const scatter = tick % (PHASE.chase + PHASE.scatter) >= PHASE.chase;
  ghosts.forEach((ghost, index) => {
    const options = neighbours(grid, ghost).filter((cell) => steps(cell, pacman) >= SAFE_DISTANCE && !taken.has(grid.at(cell.col, cell.row).index));
    const forward = options.filter((cell) => cell.dir !== (ghost.dir + 2) % 4);
    const pool = forward.length ? forward : options;
    if (!pool.length) return;
    let next;
    if (random() < WANDER) next = pool[Math.floor(random() * pool.length)];
    else {
      const target = ghostTarget(grid, index, ghost, pacman, heading, scatter);
      const score = (cell) => (frightened ? -distance(cell, pacman) : distance(cell, target));
      next = pool.reduce((best, cell) => (score(cell) < score(best) ? cell : best));
    }
    taken.delete(grid.at(ghost.col, ghost.row).index);
    taken.add(grid.at(next.col, next.row).index);
    Object.assign(ghost, next);
  });
}

// Plays the whole game; returns every position per tick, when each pellet went and the frightened spans.
export function playPacman(grid) {
  const random = seededRandom(SEED + grid.weeks);
  const pellets = new Set(grid.cells.filter((cell) => cell.level > 0).map((cell) => cell.index));
  const power = new Set([...pellets].sort((a, b) => grid.cells[b].count - grid.cells[a].count || a - b).slice(0, POWER_PELLETS));
  const pacman = { col: 0, row: 3, dir: 0 };
  const ghosts = [1, 2, 3, 4].map((n) => ({ col: Math.round((grid.weeks * n) / 5), row: n % 2 ? 1 : 5, dir: 2 }));
  const tracks = { pacman: [{ ...pacman }], ghosts: ghosts.map((ghost) => [{ ...ghost }]) };
  const eaten = new Map();
  const fright = [];
  const eat = (tick) => {
    const index = grid.at(pacman.col, pacman.row).index;
    if (!pellets.delete(index)) return;
    eaten.set(index, tick);
    if (!power.has(index)) return;
    const last = fright[fright.length - 1];
    if (last && last[1] >= tick) last[1] = tick + FRIGHT_TICKS;
    else fright.push([tick, tick + FRIGHT_TICKS]);
  };
  eat(0);
  for (let tick = 1; pellets.size; tick += 1) {
    if (tick > MAX_TICKS) throw new Error('Pac-Man game does not end');
    const dir = towardNearestPellet(grid, pacman, pacman.dir, pellets);
    Object.assign(pacman, { col: pacman.col + DIRECTIONS[dir][0], row: pacman.row + DIRECTIONS[dir][1], dir });
    eat(tick);
    moveGhosts(grid, ghosts, pacman, dir, tick, fright.some(([from, to]) => tick >= from && tick <= to), random);
    tracks.pacman.push({ ...pacman });
    ghosts.forEach((ghost, i) => tracks.ghosts[i].push({ ...ghost }));
  }
  tracks.pacman[0].dir = tracks.pacman[1].dir;
  return { tracks, eaten, fright, ticks: tracks.pacman.length - 1 };
}

const centre = (position) => ({ x: cellX(position.col) + GRID.cell / 2, y: cellY(position.row) + GRID.cell / 2 });

// Positions per tick, cut at the end of the cycle (part-way into the last tick).
function motion(name, track, game, duration) {
  const samples = track.slice(0, game.ticks).map((position, tick) => ({ t: tick * TICK, ...centre(position) }));
  const [from, to] = [centre(track[game.ticks - 1]), centre(track[game.ticks])];
  samples.push({ t: duration, x: from.x + (to.x - from.x) * (1 - BITE), y: from.y + (to.y - from.y) * (1 - BITE) });
  return keyframes(name, turningPoints(samples).map((sample) => [sample.t, translate(sample.x, sample.y)]), duration);
}

// Values that switch at a tick (heading, gaze, fright) as step-end keyframes.
function switches(name, values, duration) {
  const frames = values.filter(([, value], i) => i === 0 || value !== values[i - 1][1]);
  return keyframes(name, frames, duration);
}

function pacmanSvg(game, colors, duration) {
  const track = game.tracks.pacman;
  const rotation = (dir) => `transform:rotate(${dir * 90}deg)`;
  const turns = track.slice(1, game.ticks + 1).map((position, i) => [i * TICK, rotation(position.dir)]);
  const { x, y } = centre(track[0]);
  const r = SIZE.pacman;
  const css =
    `.p{animation:p ${duration}s linear infinite}${motion('p', track, game, duration)}` +
    `.pr{transform-box:fill-box;transform-origin:center;animation:pr ${duration}s step-end infinite}${switches('pr', turns, duration)}` +
    `.ju,.jd{transform-box:fill-box;animation:.32s linear infinite alternate}.ju{transform-origin:50% 100%;animation-name:ju}.jd{transform-origin:50% 0;animation-name:jd}` +
    `@keyframes ju{from{transform:rotate(-${SIZE.jaw}deg)}to{transform:none}}@keyframes jd{from{transform:rotate(${SIZE.jaw}deg)}to{transform:none}}`;
  const svg =
    `<g class="p" transform="translate(${x} ${y})"><g class="pr" transform="rotate(${track[0].dir * 90})">` +
    `<circle r="${r + SIZE.halo}" fill="${colors.halo}"/>` +
    `<path class="ju" transform="rotate(-${SIZE.jaw})" d="M${r} 0A${r} ${r} 0 0 0 -${r} 0Z" fill="${colors.player}"/>` +
    `<path class="jd" transform="rotate(${SIZE.jaw})" d="M${r} 0A${r} ${r} 0 0 1 -${r} 0Z" fill="${colors.player}"/></g></g>`;
  return { css, svg };
}

function ghostSvg(game, colors, index, duration) {
  const track = game.tracks.ghosts[index];
  const { ghosts, scared, eye, pupil } = colors.arcade;
  const s = SIZE.ghost;
  const gaze = (dir) => `transform:translate(${DIRECTIONS[dir][0] * SIZE.pupil}px,${DIRECTIONS[dir][1] * SIZE.pupil}px)`;
  const looks = track.slice(1, game.ticks + 1).map((position, i) => [i * TICK, gaze(position.dir)]);
  const moods = [[0, 'fill:var(--g)'], ...game.fright.flatMap(([from, to]) => [[from * TICK, `fill:${scared}`], [to * TICK, 'fill:var(--g)']])];
  const name = `g${index}`;
  const css =
    `.${name}{--g:${ghosts[index]};animation:${name} ${duration}s linear infinite}${motion(name, track, game, duration)}` +
    `.${name} .q{animation:q${index} ${duration}s step-end infinite}${switches(`q${index}`, looks, duration)}` +
    (game.fright.length ? `.${name} .b{animation:b${index} ${duration}s step-end infinite}${switches(`b${index}`, moods.filter(([t]) => t < duration), duration)}` : '');
  const { x, y } = centre(track[0]);
  const eyes = (r, fill) => `<circle cx="-2.6" cy="-1" r="${r}" fill="${fill}"/><circle cx="2.6" cy="-1" r="${r}" fill="${fill}"/>`;
  const svg =
    `<g class="${name}" transform="translate(${x} ${y})">` +
    `<path class="b" d="M-${s} ${s}V0A${s} ${s} 0 0 1 ${s} 0V${s}L4.67 5L2.33 ${s}L0 5L-2.33 ${s}L-4.67 5Z" stroke="${colors.halo}" stroke-width="${SIZE.halo}" stroke-linejoin="round" paint-order="stroke"/>` +
    `${eyes(2.3, eye)}<g class="q" transform="translate(${DIRECTIONS[track[0].dir][0] * SIZE.pupil} 0)">${eyes(1.15, pupil)}</g></g>`;
  return { css, svg };
}

export function renderPacman(grid, game, variant, theme) {
  const colors = palette[theme];
  const duration = Number(((game.ticks - BITE) * TICK).toFixed(3));
  const goneAt = new Map([...game.eaten].map(([index, tick]) => [index, Math.max(0, (tick - BITE) * TICK)]));
  const cells = cellsSvg(grid, theme, goneAt, duration);
  const ghosts = [0, 1, 2, 3].map((index) => ghostSvg(game, colors, index, duration));
  const pacman = pacmanSvg(game, colors, duration);
  const parts = [...ghosts, pacman];
  return framedSvg({
    variant,
    theme,
    title: `Pac-Man game eating my GitHub contribution calendar for ${VARIANTS[variant].range}, with four ghosts roaming the board`,
    box: boardBox(variant, GRID.rows * GRID.pitch - (GRID.pitch - GRID.cell)),
    style: `.b{fill:var(--g)}${cells.css}${parts.map((part) => part.css).join('')}`,
    body: cells.svg + parts.map((part) => part.svg).join(''),
  });
}
