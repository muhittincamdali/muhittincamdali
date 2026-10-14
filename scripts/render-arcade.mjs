// Draws the Pac-Man and Breakout boards from build/github.json into dist/: a desktop board (a year)
// and a phone board (26 weeks), each played once and drawn for both themes.
import { readFileSync } from 'node:fs';
import { THEMES, writeAsset } from './lib/svg.mjs';
import { VARIANTS, calendarGrid } from './arcade/board.mjs';
import { playPacman, renderPacman } from './arcade/pacman.mjs';
import { playBreakout, renderBreakout } from './arcade/breakout.mjs';

const { calendar } = JSON.parse(readFileSync('build/github.json', 'utf8'));

for (const variant of Object.keys(VARIANTS)) {
  const grid = calendarGrid(calendar, VARIANTS[variant].weeks);
  const suffix = variant === 'compact' ? '-compact' : '';
  const pacman = playPacman(grid);
  const breakout = playBreakout(grid, variant);
  for (const theme of THEMES) {
    const files = [
      writeAsset(`pacman${suffix}-${theme}.svg`, renderPacman(grid, pacman, variant, theme)),
      writeAsset(`breakout${suffix}-${theme}.svg`, renderBreakout(grid, breakout, variant, theme)),
    ];
    console.log(files.join(', '));
  }
  console.log(`${variant}: Pac-Man ${pacman.ticks} steps, Breakout ${breakout.broken.size} bricks in ${breakout.duration} s`);
}
