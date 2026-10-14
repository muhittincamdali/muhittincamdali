// Prints palette-driven settings for the game tools that run as GitHub Actions.
// Usage: node scripts/game-config.mjs snake <dir> [name] -> "outputs" input for Platane/snk
//        (name: file prefix, "snake" by default; "snake-compact" for the phone board)
//        node scripts/game-config.mjs 3d <file>     -> SETTING_JSON file for github-profile-3d-contrib
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { palette, THEMES } from './lib/svg.mjs';

const [tool, target, name = 'snake'] = process.argv.slice(2);

if (tool === 'snake') {
  if (!/^snake(-compact)?$/.test(name)) throw new Error(`Unknown snake board "${name}"`);
  const lines = THEMES.map((theme) => {
    const colors = palette[theme];
    return `${target}/${name}-${theme}.svg?color_snake=${colors.player}&color_dots=${colors.contrib.join(',')}`;
  });
  process.stdout.write(lines.join('\n') + '\n');
} else if (tool === '3d') {
  const settings = THEMES.map((theme) => {
    const colors = palette[theme];
    return {
      type: 'normal',
      fileName: `3d-${theme}.svg`,
      backgroundColor: colors.bg,
      foregroundColor: colors.text,
      strongColor: colors.accent,
      weakColor: colors.muted,
      radarColor: colors.accent,
      growingAnimation: true,
      contribColors: colors.contrib,
    };
  });
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(settings, null, 2));
  console.log(`Wrote ${target}`);
} else {
  throw new Error(`Unknown tool "${tool}"`);
}
