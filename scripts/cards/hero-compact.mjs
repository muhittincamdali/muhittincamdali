// Phone version of the banner: the name and the sentence stacked at a size that stays >= 20 px in a
// ~308 px column, with the two phones rising from the bottom edge. Same drawing as hero.mjs.
import { GlyphSet } from '../lib/text.mjs';
import { palette, profile, svgDocument } from '../lib/svg.mjs';
import { FRONT, BACK, STYLE, wrapHeadline, backPhone, frontPhone, heroDefs, heroText } from './hero.mjs';

const WIDTH = 360;
const HEIGHT = 270;
const PAD = 24;
const NAME = { size: 15, cap: 10.9, gap: 16 };
const HEADLINE = { size: 25, lineHeight: 31, maxLines: 4, letterSpacing: -0.2, capHeight: 18.2 };
// The phones are drawn at the banner's coordinates and scaled into the lower part of this card.
const DEVICE_SCALE = 0.62;
const DEVICE_GAP = 22;

export function renderHeroCompact(theme) {
  const colors = palette[theme];
  const glyphs = new GlyphSet('p');
  const lines = wrapHeadline(profile.tagline, { ...HEADLINE, maxWidth: WIDTH - PAD * 2 });
  const text = heroText(glyphs, colors, lines, { x: PAD, top: PAD + 4, name: NAME, headline: HEADLINE });
  const back = backPhone(colors, theme);
  const front = frontPhone(colors, theme);
  // The pair is centred and starts DEVICE_GAP below the last baseline; the frame crops its lower half.
  const pairLeft = BACK.x;
  const pairWidth = FRONT.x + FRONT.w - BACK.x;
  const offsetX = (WIDTH - pairWidth * DEVICE_SCALE) / 2 - pairLeft * DEVICE_SCALE;
  const offsetY = text.bottom + DEVICE_GAP - FRONT.y * DEVICE_SCALE;
  if (HEIGHT - (text.bottom + DEVICE_GAP) < 60) throw new Error('Compact hero: no room left for the phones');
  const frameBox = `x="0.5" y="0.5" width="${WIDTH - 1}" height="${HEIGHT - 1}" rx="16"`;

  const body =
    `<g clip-path="url(#card)">` +
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>` +
    `<circle cx="${WIDTH / 2}" cy="${HEIGHT}" r="190" fill="url(#glow)"/>` +
    `<g transform="translate(${offsetX.toFixed(2)} ${offsetY.toFixed(2)}) scale(${DEVICE_SCALE})">${back.svg}${front.svg}</g>` +
    text.svg +
    `</g>` +
    `<rect ${frameBox} fill="none" stroke="${colors.border}"/>`;

  const defs = heroDefs(colors, theme, frameBox) + back.clip + front.clip + glyphs.defs();
  return svgDocument({ width: WIDTH, height: HEIGHT, title: `${profile.name}: ${profile.tagline}`, style: STYLE, defs, body });
}
