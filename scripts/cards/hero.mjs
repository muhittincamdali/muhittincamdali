// Banner: my name as a small line and one sentence about what I do on the left, two abstract
// phones on the right. The role is not repeated here: it is the GitHub bio next to the README.
// The text is static (no fade-in), so the first frame and any renderer that skips CSS shows it;
// only the phones move. Phones get hero-compact.mjs through a <source media> in the README.
import { GlyphSet, measure } from '../lib/text.mjs';
import { palette, profile, svgDocument, withAlpha, COLUMN } from '../lib/svg.mjs';

const WIDTH = COLUMN;
const HEIGHT = 300;
// The frame is flush with the README column, like every other full-width graphic.
const TEXT_X = 48;
const NAME = { size: 20, cap: 14.5, gap: 22 };
const HEADLINE = { size: 33, lineHeight: 42, maxLines: 3, letterSpacing: -0.3, capHeight: 24 };
// The phones sit DEVICE_SHIFT px further right than their drawing coordinates.
const DEVICE_SHIFT = 26;
export const FRONT = { x: 652, y: 24, w: 134, h: 252 };
export const BACK = { x: 578, y: 62, w: 118, h: 214 };
const TEXT_RIGHT = BACK.x + DEVICE_SHIFT - 24;
// Content of the front screen starts this far down, so the dynamic island stays visible.
const ISLAND_CLEARANCE = 14;
// The notification slides in from above the screen. Hidden, it sits wholly above the screen clip
// (its top offset and height plus a margin for the border), and it is also transparent then, so no
// edge of it can show under the dynamic island at any point of the loop.
const NOTICE = { offset: 8, height: 30 };
const NOTICE_HIDDEN_SHIFT = ISLAND_CLEARANCE + NOTICE.offset + NOTICE.height + 8;

// Greedy wrap. A dash stays on the line of the word before it, so no line starts with one.
export function wrapHeadline(text, { size, letterSpacing, maxWidth, maxLines }) {
  const words = text.split(' ').reduce((out, word) => {
    if (/^[–—]$/.test(word) && out.length) out[out.length - 1] += ` ${word}`;
    else out.push(word);
    return out;
  }, []);
  const style = { weight: 'display', size, letterSpacing };
  const lines = [];
  for (const word of words) {
    const candidate = lines.length ? `${lines[lines.length - 1]} ${word}` : word;
    if (lines.length && measure(candidate, style) <= maxWidth) lines[lines.length - 1] = candidate;
    else lines.push(word);
  }
  for (const line of lines) {
    if (measure(line, style) > maxWidth) throw new Error(`Hero headline line is too wide: "${line}"`);
  }
  if (lines.length > maxLines) throw new Error(`Hero headline needs ${lines.length} lines (max ${maxLines})`);
  return lines;
}

function phoneShell({ x, y, w, h }, colors, theme, id) {
  const screen = { x: x + 6, y: y + 6, w: w - 12, h: h - 12 };
  const shell =
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="30" fill="${colors.device.bezel}" stroke="${withAlpha(colors.accent, theme === 'dark' ? 0.55 : 0.25)}" stroke-width="1.5"/>` +
    `<rect x="${screen.x}" y="${screen.y}" width="${screen.w}" height="${screen.h}" rx="24" fill="${colors.device.screen}"/>`;
  // Drawn after the screen content, so nothing on the screen can cover it.
  const island = `<rect x="${x + w / 2 - 19}" y="${y + 13}" width="38" height="11" rx="5.5" fill="${colors.device.island}"/>`;
  const clip = `<clipPath id="${id}"><rect x="${screen.x}" y="${screen.y}" width="${screen.w}" height="${screen.h}" rx="24"/></clipPath>`;
  return { shell, island, clip, screen };
}

function line(x, y, width, height, fill, extra = '') {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${height / 2}" fill="${fill}"${extra}/>`;
}

// Back phone: a small dashboard whose bars rise and settle.
export function backPhone(colors, theme) {
  const { shell, island, clip, screen } = phoneShell(BACK, colors, theme, 'backScreen');
  const left = screen.x + 12;
  const bars = [0.45, 0.7, 0.55, 0.9, 0.65, 0.8]
    .map((level, index) => {
      const height = Math.round(level * 70);
      const x = left + index * 15;
      const fill = colors.contrib[1 + (index % 4)];
      return `<rect class="bar" style="animation-delay:-${(index * 0.7).toFixed(1)}s" x="${x}" y="${screen.y + 160 - height}" width="10" height="${height}" rx="3" fill="${fill}"/>`;
    })
    .join('');
  const content =
    line(left, screen.y + 30, 40, 6, colors.text, ' opacity=".8"') +
    line(left, screen.y + 42, 58, 4, colors.device.line) +
    line(left, screen.y + 62, 30, 12, withAlpha(colors.accent, 0.9)) +
    bars +
    line(left, screen.y + 172, 84, 4, colors.device.line);
  return { svg: `<g class="float-back">${shell}<g clip-path="url(#backScreen)">${content}</g>${island}</g>`, clip };
}

function listRow(x, y, colors, index) {
  const avatar = [colors.contrib[2], colors.accentSoft, colors.contrib[3]][index];
  return (
    `<circle cx="${x + 8}" cy="${y}" r="8" fill="${avatar}"/>` +
    line(x + 22, y - 5, 46 - index * 6, 5, colors.text, ' opacity=".75"') +
    line(x + 22, y + 3, 30 + index * 4, 4, colors.device.line)
  );
}

// Front phone: an app screen with a live card, a list, a toggle and a notification.
export function frontPhone(colors, theme) {
  const { shell, island, clip, screen } = phoneShell(FRONT, colors, theme, 'frontScreen');
  const top = screen.y + ISLAND_CLEARANCE;
  const left = screen.x + 12;
  const width = screen.w - 24;
  const cardY = top + 60;
  const rowY = (index) => top + 138 + index * 22;
  const toggleX = left + width - 22;
  const card =
    `<rect x="${left}" y="${cardY}" width="${width}" height="58" rx="12" fill="url(#cardFill)"/>` +
    line(left + 10, cardY + 12, 40, 6, '#fff') +
    line(left + 10, cardY + 23, 58, 4, withAlpha('#ffffff', 0.7)) +
    `<path class="spark" d="M${left + 10} ${cardY + 47} l12 -6 l12 4 l12 -12 l12 6 l12 -10 l12 2 l14 -8" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" pathLength="100"/>`;
  const rows = [0, 1, 2].map((index) => listRow(left, rowY(index), colors, index)).join('');
  const toggle =
    `<rect x="${toggleX}" y="${rowY(0) - 6}" width="22" height="12" rx="6" fill="${colors.accent}"/>` +
    `<circle class="knob" cx="${toggleX + 6}" cy="${rowY(0)}" r="4.2" fill="#fff"/>`;
  const tabs = [0, 1, 2, 3]
    .map((index) => `<circle cx="${left + 10 + index * ((width - 20) / 3)}" cy="${screen.y + screen.h - 26}" r="3.2" fill="${index === 0 ? colors.accent : colors.device.line}"/>`)
    .join('');
  const home = line(screen.x + screen.w / 2 - 20, screen.y + screen.h - 11, 40, 4, colors.text, ' opacity=".45"');
  const notice =
    `<g class="notice">` +
    `<rect x="${left - 4}" y="${top + NOTICE.offset}" width="${width + 8}" height="${NOTICE.height}" rx="10" fill="${colors.surface}" stroke="${colors.border}"/>` +
    `<rect x="${left + 3}" y="${top + 14}" width="18" height="18" rx="5" fill="${colors.accent}"/>` +
    line(left + 27, top + 16, 44, 5, colors.text, ' opacity=".8"') +
    line(left + 27, top + 25, 60, 4, colors.device.line) +
    `</g>`;
  const content =
    line(left, top + 30, 50, 7, colors.text, ' opacity=".85"') +
    line(left, top + 43, 72, 4, colors.device.line) +
    card +
    rows +
    toggle +
    tabs +
    home +
    `<rect class="shine" x="${screen.x - 60}" y="${screen.y}" width="50" height="${screen.h}" fill="url(#shine)" transform="skewX(-14)"/>` +
    notice;
  return { svg: `<g class="float-front">${shell}<g clip-path="url(#frontScreen)">${content}</g>${island}</g>`, clip };
}

export const STYLE =
  '.float-front{animation:floatA 6s ease-in-out infinite alternate}' +
  '@keyframes floatA{from{transform:translateY(0)}to{transform:translateY(-6px)}}' +
  '.float-back{animation:floatB 7s ease-in-out infinite alternate}' +
  '@keyframes floatB{from{transform:translateY(0)}to{transform:translateY(5px)}}' +
  '.bar{transform-box:fill-box;transform-origin:center bottom;animation:bar 4.2s ease-in-out infinite alternate}' +
  '@keyframes bar{from{transform:scaleY(.55)}to{transform:scaleY(1)}}' +
  '.spark{stroke-dasharray:100;animation:spark 6s ease-in-out infinite}' +
  '@keyframes spark{0%{stroke-dashoffset:100}40%,100%{stroke-dashoffset:0}}' +
  '.knob{animation:knob 6s ease-in-out infinite}' +
  '@keyframes knob{0%,45%{transform:translateX(0)}55%,95%{transform:translateX(10px)}100%{transform:translateX(0)}}' +
  '.shine{animation:shine 7s ease-in-out infinite}' +
  '@keyframes shine{0%,55%{transform:skewX(-14deg) translateX(0)}85%,100%{transform:skewX(-14deg) translateX(220px)}}' +
  '.notice{animation:notice 9s ease-in-out infinite}' +
  `@keyframes notice{0%,12%{transform:translateY(-${NOTICE_HIDDEN_SHIFT}px);opacity:0}20%,48%{transform:translateY(0);opacity:1}56%,100%{transform:translateY(-${NOTICE_HIDDEN_SHIFT}px);opacity:0}}`;

// Gradients and clips shared by both banners.
export function heroDefs(colors, theme, frameBox) {
  return (
    `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colors.heroFrom}"/><stop offset="1" stop-color="${colors.heroTo}"/></linearGradient>` +
    `<radialGradient id="glow"><stop offset="0" stop-color="${colors.accent}" stop-opacity="${theme === 'dark' ? 0.42 : 0.2}"/><stop offset="1" stop-color="${colors.accent}" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="cardFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colors.accent}"/><stop offset="1" stop-color="${colors.accentSoft}"/></linearGradient>` +
    `<linearGradient id="shine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity="${theme === 'dark' ? 0.08 : 0.35}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<clipPath id="card"><rect ${frameBox}/></clipPath>`
  );
}

// Name line and headline, stacked from the first name cap height at `top`.
export function heroText(glyphs, colors, lines, { x, top, name, headline }) {
  const nameBaseline = top + name.cap;
  const firstBaseline = nameBaseline + name.gap + headline.capHeight;
  const nameSvg = glyphs.text(profile.name, { x, y: nameBaseline, weight: 'semibold', size: name.size, fill: colors.eyebrow }).svg;
  const lineSvgs = lines.map(
    (text, index) =>
      glyphs.text(text, { x, y: firstBaseline + index * headline.lineHeight, weight: 'display', size: headline.size, letterSpacing: headline.letterSpacing, fill: colors.text }).svg,
  );
  return { svg: nameSvg + lineSvgs.join(''), bottom: firstBaseline + (lines.length - 1) * headline.lineHeight };
}

export function renderHero(theme) {
  const colors = palette[theme];
  const glyphs = new GlyphSet('h');
  const lines = wrapHeadline(profile.tagline, { ...HEADLINE, maxWidth: TEXT_RIGHT - TEXT_X });
  const blockHeight = NAME.cap + NAME.gap + HEADLINE.capHeight + (lines.length - 1) * HEADLINE.lineHeight;
  const text = heroText(glyphs, colors, lines, { x: TEXT_X, top: Math.round((HEIGHT - blockHeight) / 2), name: NAME, headline: HEADLINE });
  const back = backPhone(colors, theme);
  const front = frontPhone(colors, theme);
  const frameBox = `x="0.5" y="0.5" width="${WIDTH - 1}" height="${HEIGHT - 1}" rx="20"`;

  const body =
    `<g clip-path="url(#card)">` +
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>` +
    `<circle cx="${FRONT.x + DEVICE_SHIFT + 10}" cy="150" r="230" fill="url(#glow)"/>` +
    `<g transform="translate(${DEVICE_SHIFT} 0)">${back.svg}${front.svg}</g>` +
    text.svg +
    `</g>` +
    `<rect ${frameBox} fill="none" stroke="${colors.border}"/>`;

  const defs = heroDefs(colors, theme, frameBox) + back.clip + front.clip + glyphs.defs();
  return svgDocument({ width: WIDTH, height: HEIGHT, title: `${profile.name}: ${profile.tagline}`, style: STYLE, defs, body });
}
