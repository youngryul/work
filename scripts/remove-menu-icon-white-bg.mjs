import sharp from 'sharp'
import { readdir } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ICON_DIR = path.join(__dirname, '../public/images/menu-icons')
const WHITE_THRESHOLD = 238
const SOFT_EDGE_RANGE = 18

/**
 * @param {Buffer} data
 * @param {number} width
 * @param {number} height
 */
function removeNearWhiteBackground(data, width, height) {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const minChannel = Math.min(r, g, b)
      const maxChannel = Math.max(r, g, b)
      const isNeutral = maxChannel - minChannel < 28

      if (!isNeutral) continue

      const brightness = (r + g + b) / 3
      if (brightness >= WHITE_THRESHOLD) {
        data[i + 3] = 0
        continue
      }

      if (brightness >= WHITE_THRESHOLD - SOFT_EDGE_RANGE) {
        const fade = (brightness - (WHITE_THRESHOLD - SOFT_EDGE_RANGE)) / SOFT_EDGE_RANGE
        data[i + 3] = Math.round(data[i + 3] * (1 - fade))
      }
    }
  }
}

const files = (await readdir(ICON_DIR)).filter((name) => name.endsWith('.png'))

for (const file of files) {
  const filePath = path.join(ICON_DIR, file)
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  removeNearWhiteBackground(data, info.width, info.height)
  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toFile(filePath)
  console.log(`Processed: ${file}`)
}

console.log('Done.')
