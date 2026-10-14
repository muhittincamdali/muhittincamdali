// The only files the output branch may hold, with the checks each must pass.
const KB = 1024;

export const RULES = [
  { pattern: /^hero-(compact-)?(light|dark)\.svg$/, min: 6 * KB, max: 120 * KB, mustContain: ['<use href="#'] },
  { pattern: /^numbers-(compact-)?(light|dark)\.svg$/, min: 4 * KB, max: 80 * KB, mustContain: ['<use href="#'] },
  { pattern: /^chip-[a-z0-9-]+-(light|dark)\.svg$/, min: 300, max: 24 * KB, mustContain: ['<use href="#'] },
  { pattern: /^contact-email\.svg$/, min: 500, max: 24 * KB, mustContain: ['<use href="#'] },
  { pattern: /^snake-(light|dark)\.svg$/, min: 20 * KB, max: 300 * KB, minCells: 300 },
  // Phone boards: the last 26 weeks (>= 175 cells).
  { pattern: /^snake-compact-(light|dark)\.svg$/, min: 12 * KB, max: 200 * KB, minCells: 175 },
  { pattern: /^3d-(compact-)?(light|dark)\.svg$/, min: 50 * KB, max: 350 * KB, minCells: 300 },
  // Arcade boards drawn by scripts/render-arcade.mjs: a year, or the last 26 weeks on phones.
  { pattern: /^(pacman|breakout)-(light|dark)\.svg$/, min: 30 * KB, max: 300 * KB, minCells: 52 * 7 },
  { pattern: /^(pacman|breakout)-compact-(light|dark)\.svg$/, min: 15 * KB, max: 200 * KB, minCells: 25 * 7 },
];

export function ruleFor(file) {
  return RULES.find((rule) => rule.pattern.test(file));
}
