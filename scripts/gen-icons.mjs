// Generates Camelia PWA icons from the app's in-app brand mark: a rose→peach
// gradient with a white "C". Run: `node scripts/gen-icons.mjs`
// Outputs to public/icons/ (+ refreshes favicon.png / apple-touch-icon.png).
import sharp from 'sharp'
import { mkdirSync } from 'fs'

const ROSE = '#F4628E'
const PEACH = '#FFB088'

const polar = (cx, cy, r, deg) => {
  const a = (deg * Math.PI) / 180
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}

// Draw the "C" as a stroked arc (font-independent). gap opens to the right.
function iconSVG(size, { rFrac, wFrac, radius }) {
  const cx = size / 2
  const cy = size / 2
  const r = size * rFrac
  const w = size * wFrac
  const gap = 38 // half-angle of the opening, in degrees
  const [x1, y1] = polar(cx, cy, r, gap)
  const [x2, y2] = polar(cx, cy, r, -gap)
  // large-arc, clockwise sweep → the long way round (bottom/left/top), gap on the right
  const path = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 1 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${ROSE}"/>
      <stop offset="1" stop-color="${PEACH}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/>
  <path d="${path}" fill="none" stroke="#ffffff" stroke-width="${w.toFixed(2)}" stroke-linecap="round"/>
</svg>`
}

async function render(size, opts, out) {
  await sharp(Buffer.from(iconSVG(size, opts))).png().toFile(out)
  console.log('wrote', out)
}

mkdirSync('public/icons', { recursive: true })

// any-purpose: bold C, rounded-square corners (nice on Chrome/desktop)
await render(192, { rFrac: 0.30, wFrac: 0.13, radius: 42 }, 'public/icons/icon-192.png')
await render(512, { rFrac: 0.30, wFrac: 0.13, radius: 112 }, 'public/icons/icon-512.png')
// maskable: full-bleed gradient (no corners so Android's mask always has content);
// C kept inside the center ~62% so it survives the 80% safe-zone crop
await render(512, { rFrac: 0.26, wFrac: 0.11, radius: 0 }, 'public/icons/icon-512-maskable.png')
// refresh browser-tab / iOS icons (were a stale portfolio "GM" mark)
await render(256, { rFrac: 0.30, wFrac: 0.13, radius: 56 }, 'public/favicon.png')
await render(180, { rFrac: 0.30, wFrac: 0.13, radius: 40 }, 'public/apple-touch-icon.png')

console.log('done')
