// Renders every graphic that is drawn by this repository (not by a game tool) into dist/.
import { readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { THEMES, OUTPUT_DIR, profile, writeAsset } from './lib/svg.mjs';
import { summarize } from './lib/stats.mjs';
import { renderHero } from './cards/hero.mjs';
import { renderHeroCompact } from './cards/hero-compact.mjs';
import { renderNumbers } from './cards/numbers.mjs';
import { renderNumbersCompact } from './cards/numbers-compact.mjs';
import { renderChip, renderEmailButton, allChips } from './cards/chips.mjs';

const summary = summarize(JSON.parse(readFileSync('build/github.json', 'utf8')));
const written = [];

// Chips are named after their labels, so a renamed or removed skill must not leave its old file behind;
// the two half-width cards that the numbers card replaced are cleared too.
if (existsSync(OUTPUT_DIR)) {
  for (const file of readdirSync(OUTPUT_DIR)) if (/^(chip|contact|open-source|languages)-.*\.svg$/.test(file)) rmSync(`${OUTPUT_DIR}/${file}`);
}

for (const theme of THEMES) {
  written.push(writeAsset(`hero-${theme}.svg`, renderHero(theme)));
  written.push(writeAsset(`hero-compact-${theme}.svg`, renderHeroCompact(theme)));
  written.push(writeAsset(`numbers-${theme}.svg`, renderNumbers(theme, summary)));
  written.push(writeAsset(`numbers-compact-${theme}.svg`, renderNumbersCompact(theme, summary)));
  for (const chip of allChips()) written.push(writeAsset(`${chip.name}-${theme}.svg`, renderChip(chip, theme)));
}
written.push(writeAsset('contact-email.svg', renderEmailButton(profile.email)));

console.log(`Rendered ${written.length} files (stars ${summary.stars}, forks ${summary.forks}, longest streak ${summary.longest}, active days ${summary.activeDays})`);
