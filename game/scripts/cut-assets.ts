// 资产拆件：从场景图自动裁出棋盘格贴片与骰子按钮（透明底 PNG，圆角/圆形羽化蒙版）
// 用法：node --experimental-strip-types scripts/cut-assets.ts
import { PNG } from 'pngjs'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const SRC = 'src/assets/board-island.png'
const png = PNG.sync.read(readFileSync(SRC))
const { width: W, height: H, data } = png
const px = (x: number, y: number) => (y * W + x) * 4

// 从 boardArt.ts 解析节点坐标（含宽高）
const srcText = readFileSync('src/core/boardArt.ts', 'utf8')
const chapter1 = srcText.split('tiles: [')[1]?.split('],')[0] ?? ''
const tiles = [...chapter1.matchAll(/\{ x: (\d+), y: (\d+), w: (\d+), h: (\d+) \}/g)]
  .map(m => ({ x: +m[1], y: +m[2], w: +m[3], h: +m[4] }))
const diceMatch = srcText.match(/dice: \{ x: (\d+), y: (\d+), w: (\d+), h: (\d+) \}/)
const dice = diceMatch ? { x: +diceMatch[1], y: +diceMatch[2], w: +diceMatch[3], h: +diceMatch[4] } : null
console.log(`解析到 ${tiles.length} 个节点，骰子区 ${dice ? 'OK' : '缺失'}`)

/** 圆角矩形蒙版裁切：pad 外扩、radius 圆角、feather 边缘羽化 */
function cropRounded(rect: { x: number; y: number; w: number; h: number }, radiusRatio: number, pad: number, feather = 3): PNG {
  const x0 = Math.max(0, rect.x - rect.w / 2 - pad)
  const y0 = Math.max(0, rect.y - rect.h / 2 - pad)
  const w = Math.min(W - x0, rect.w + pad * 2)
  const h = Math.min(H - y0, rect.h + pad * 2)
  const out = new PNG({ width: w, height: h })
  const r = Math.min(w, h) * radiusRatio
  const cx = w / 2, cy = h / 2
  const hx = rect.w / 2, hy = rect.h / 2
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4
      // 圆角矩形 SDF
      const dx = Math.abs(x - cx) - (hx - r)
      const dy = Math.abs(y - cy) - (hy - r)
      const ax = Math.max(dx, 0), ay = Math.max(dy, 0)
      const d = Math.min(Math.max(dx, dy), 0) + Math.hypot(ax, ay) - r
      const a = d >= 0 ? Math.max(0, 255 * (1 - d / feather)) : 255
      const sx = x0 + x, sy = y0 + y
      const p = px(sx, sy)
      out.data[o] = data[p]
      out.data[o + 1] = data[p + 1]
      out.data[o + 2] = data[p + 2]
      out.data[o + 3] = Math.round(a)
    }
  }
  return out
}

mkdirSync('src/assets/slots', { recursive: true })
tiles.forEach((t, i) => {
  const out = cropRounded(t, 0.32, Math.round(Math.min(t.w, t.h) * 0.1))
  writeFileSync(`src/assets/slots/slot_${i + 1}.png`, PNG.sync.write(out))
})
if (dice) writeFileSync('src/assets/btn-dice.png', PNG.sync.write(cropRounded(dice, 0.5, 4)))
console.log(`已拆件：slots/slot_1..${tiles.length}.png + btn-dice.png`)
