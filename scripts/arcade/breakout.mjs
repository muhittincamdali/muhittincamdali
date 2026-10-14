// Breakout on the contribution calendar: every day with contributions is a brick in its level's
// colour. The ball only ever travels along clear straight lines between bounces off the walls,
// breaks one brick per rally and the paddle meets it where it lands. The cycle ends on
// the last brick, so the board is never shown empty. Fixed seed: both themes show the same game.
import { palette } from '../lib/svg.mjs';
import { GRID, VARIANTS, seededRandom, keyframes, translate, cellsSvg, boardBox, framedSvg, cellX, cellY, round } from './board.mjs';

const SEED = 20261015;
const BALL = { radius: 3.5, speed: 640, halo: 1.4 }; // speed in board units per second
const PADDLE = { top: 176, width: 40, height: 5, reach: 12 }; // reach: how far off-centre the ball may land
const WALL_INSET = 8;
const MAX_SLOPE = 1.5; // horizontal units per vertical unit, so no rally is nearly flat
const AIM_JITTER = 3; // the ball meets a brick up to this far from its centre
const MAX_RALLIES = 2000;

// Liang-Barsky: does the segment a-b pass through the inside of the box?
function crosses(a, b, box) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let [enter, leave] = [0, 1];
  for (const [p, q] of [[-dx, a.x - box.left], [dx, box.right - a.x], [-dy, a.y - box.top], [dy, box.bottom - a.y]]) {
    if (p === 0) {
      if (q <= 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) enter = Math.max(enter, t);
    else leave = Math.min(leave, t);
    if (enter >= leave) return false;
  }
  return true;
}

// A brick as the area the ball's centre cannot enter (a hair smaller, so grazing is allowed).
function brickBox(cell) {
  const grow = BALL.radius - 0.01;
  return { left: cellX(cell.col) - grow, right: cellX(cell.col) + GRID.cell + grow, top: cellY(cell.row) - grow, bottom: cellY(cell.row) + GRID.cell + grow };
}

const clear = (path, bricks) => path.every((point, i) => i === 0 || bricks.every((brick) => !crosses(path[i - 1], point, brickBox(brick))));

// A straight run from a point to the line y = toY at `step` horizontal units per vertical unit,
// folded at the side walls. Returns the points and the step it ends with.
function fold(from, step, toY, walls) {
  const points = [from];
  let point = from;
  for (;;) {
    const x = point.x + step * (toY - point.y);
    if (x >= walls.left && x <= walls.right) return { points: [...points, { x, y: toY }], step };
    const wall = x > walls.right ? walls.right : walls.left;
    point = { x: wall, y: point.y + (wall - point.x) / step };
    points.push(point);
    step = -step;
  }
}

// Up to a brick's bottom face and, mirrored, back down to the paddle line.
function rally(launch, cell, aim, walls) {
  const hit = { x: cellX(cell.col) + GRID.cell / 2 + aim, y: cellY(cell.row) + GRID.cell + BALL.radius };
  const slope = (hit.x - launch.x) / (launch.y - hit.y);
  return { cell, slope, path: [launch, ...fold(hit, slope, walls.launch, walls).points] };
}

const centreDistance = (cell, x) => Math.abs(cellX(cell.col) + GRID.cell / 2 - x);
const lowestNearest = (bricks, x) => {
  const lowest = Math.max(...bricks.map((cell) => cell.row));
  return bricks.filter((cell) => cell.row === lowest).sort((a, b) => centreDistance(a, x) - centreDistance(b, x) || a.index - b.index)[0];
};

// Any brick the ball can reach and leave along clear lines at a playable angle, picked by the seed.
function breakingRally(launch, bricks, walls, random) {
  const exposed = bricks.filter((cell) => !bricks.some((other) => other.col === cell.col && other.row === cell.row + 1));
  const options = exposed
    .map((cell) => rally(launch, cell, (random() * 2 - 1) * AIM_JITTER, walls))
    .filter((option) => Math.abs(option.slope) <= MAX_SLOPE && clear(option.path, bricks.filter((cell) => cell !== option.cell)));
  return options.length ? options[Math.floor(random() * options.length)] : null;
}

// No brick is in reach: the ball goes up through the gaps to the top wall and lands as close as it
// can to the lowest remaining brick.
function relayRally(launch, bricks, walls) {
  const aim = cellX(lowestNearest(bricks, launch.x).col) + GRID.cell / 2;
  let best = null;
  for (let slope = -MAX_SLOPE; slope <= MAX_SLOPE + 1e-9; slope += 0.05) {
    const up = fold(launch, -slope, walls.top, walls);
    const path = [...up.points, ...fold(up.points[up.points.length - 1], -up.step, walls.launch, walls).points.slice(1)];
    const miss = Math.abs(path[path.length - 1].x - aim);
    if (clear(path, bricks) && (!best || miss < best.miss)) best = { path, miss };
  }
  return best;
}

// Plays the whole game: the ball's path with times, the paddle's stops and when each brick broke.
// If neither a breaking rally nor a relay works, the ball takes the brick in the lowest remaining
// row nearest to it: nothing is below that row, so that line is always clear.
export function playBreakout(grid, variant) {
  const random = seededRandom(SEED + grid.weeks);
  const box = boardBox(variant, PADDLE.top + PADDLE.height);
  const inner = { left: box.x + WALL_INSET, right: box.x + box.width - WALL_INSET };
  const walls = { left: inner.left + BALL.radius, right: inner.right - BALL.radius, top: box.y + WALL_INSET + BALL.radius, launch: PADDLE.top - BALL.radius };
  const bricks = grid.cells.filter((cell) => cell.level > 0);
  const ball = [{ t: 0, x: round(box.x + box.width / 2), y: walls.launch }];
  const paddle = [{ t: 0, x: ball[0].x }];
  const broken = new Map();
  // Moves the ball along a path; when it lands, the paddle is there to meet it, a little off-centre.
  const travel = (points, lands) => {
    for (const point of points.slice(1)) {
      const last = ball[ball.length - 1];
      ball.push({ t: last.t + Math.hypot(point.x - last.x, point.y - last.y) / BALL.speed, ...point });
    }
    if (!lands) return;
    const end = ball[ball.length - 1];
    const offset = (random() * 2 - 1) * PADDLE.reach;
    paddle.push({ t: end.t, x: Math.min(inner.right - PADDLE.width / 2, Math.max(inner.left + PADDLE.width / 2, end.x + offset)) });
  };
  let relayed = false;
  for (let rallies = 0; bricks.length; rallies += 1) {
    if (rallies > MAX_RALLIES) throw new Error('Breakout game does not end');
    const launch = ball[ball.length - 1];
    const next = breakingRally(launch, bricks, walls, random) ?? (relayed ? null : relayRally(launch, bricks, walls));
    relayed = Boolean(next && !next.cell);
    const chosen = next ?? rally(launch, lowestNearest(bricks, launch.x), 0, walls);
    const hitIndex = ball.length;
    // The cycle ends on the last brick, so its rally stops at the hit.
    const final = chosen.cell && bricks.length === 1;
    travel(final ? chosen.path.slice(0, 2) : chosen.path, !final);
    if (!chosen.cell) continue;
    broken.set(chosen.cell.index, ball[hitIndex].t);
    bricks.splice(bricks.indexOf(chosen.cell), 1);
  }
  // The paddle drifts back to the centre during the last rally, where the next cycle starts.
  paddle.push({ t: ball[ball.length - 1].t, x: paddle[0].x });
  return { ball, paddle, broken, duration: Number(ball[ball.length - 1].t.toFixed(3)), box };
}

export function renderBreakout(grid, game, variant, theme) {
  const colors = palette[theme];
  const { duration, box } = game;
  const cells = cellsSvg(grid, theme, game.broken, duration);
  const [start] = game.ball;
  const ballFrames = game.ball.map((point) => [point.t, translate(point.x, point.y)]);
  const paddleFrames = game.paddle.map((stop) => [stop.t, translate(stop.x, 0)]);
  const style =
    cells.css +
    `.o{animation:o ${duration}s linear infinite}${keyframes('o', ballFrames, duration)}` +
    `.d{animation:d ${duration}s linear infinite}${keyframes('d', paddleFrames, duration)}`;
  const body =
    cells.svg +
    `<rect class="d" transform="translate(${start.x} 0)" x="${-PADDLE.width / 2}" y="${PADDLE.top}" width="${PADDLE.width}" height="${PADDLE.height}" rx="${PADDLE.height / 2}" fill="${colors.player}"/>` +
    `<circle class="o" transform="translate(${start.x} ${start.y})" r="${BALL.radius}" fill="${colors.player}" stroke="${colors.halo}" stroke-width="${BALL.halo}" paint-order="stroke"/>`;
  return framedSvg({
    variant,
    theme,
    title: `Breakout game clearing my GitHub contribution calendar for ${VARIANTS[variant].range}, one brick per active day`,
    box,
    style,
    body,
  });
}
