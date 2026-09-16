// 生成干净背景板：把场景图中已拆件的格子与骰子基座用扩散填色抹除
// 用法：node --experimental-strip-types scripts/make-clean-bg.ts
import { PNG } from 'pngjs'
import { readFileSync, writeFileSync } from 'node:fs'

const png = PNG.sync.read(readFileSync('src/assets/board-island.png'))
const { width: W, height: H, data } = png
const px = (x: number, y: number) => (y * W + x) * 4

// 从 boardArt.ts 解析节点与骰子区
const srcText = readFileSync('src/core/boardArt.ts', 'utf8')
const chapter1 = srcText.split('tiles: [')[1]?.split('],')[0] ?? ''
const tiles = [...chapter1.matchAll(/\{ x: (\d+), y: (\d+), w: (\d+), h: (\d+) \}/g)]
  .map(m => ({ x: +m[1], y: +m[2], w: +m[3], h: +m[4] }))
const diceMatch = srcText.match(/dice: \{ x: (\d+), y: (\d+), w: (\d+), h: (\d+) \}/)
const dice = diceMatch ? { x: +diceMatch[1], y: +diceMatch[2], w: +diceMatch[3], h: +diceMatch[4] } : null

// 标记待抹除区（外扩 6px）
const hole = new Uint8Array(W * H)
let holes = 0
const mark = (r: { x: number; y: number; w: number; h: number }): void => {
  const pad = 6
  for (let y = Math.max(0, Math.round(r.y - r.h / 2 - pad)); y < Math.min(H, Math.round(r.y + r.h / 2 + pad)); y++) {
    for (let x = Math.max(0, Math.round(r.x - r.w / 2 - pad)); x < Math.min(W, Math.round(r.x + r.w / 2 + pad)); x++) {
      if (!hole[y * W + x]) { hole[y * W + x] = 1; holes++ }
    }
  }
}
tiles.forEach(mark)
if (dice) mark(dice)
console.log(`待抹除像素 ${holes}（${(holes / (W * H) * 100).toFixed(1)}% 画面）`)

// 扩散填色（洋葱剥皮）：反复把与已填像素相邻的洞填成邻居均值
let filled = 0
let round = 0
while (filled < holes && round < 500) {
  round++
  const fills: { p: number; r: number; g: number; b: number }[] = []
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      if (!hole[i]) continue
      let r = 0, g = 0, b = 0, n = 0
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue
        const ni = ny * W + nx
        if (hole[ni]) continue
        const p = ni * 4
        r += data[p]; g += data[p + 1]; b += data[p + 2]; n++
      }
      if (n >= 3) fills.push({ p: i * 4, r: r / n, g: g / n, b: b / n })
    }
  }
  if (!fills.length) break
  for (const f of fills) {
    data[f.p] = Math.round(f.r); data[f.p + 1] = Math.round(f.g); data[f.p + 2] = Math.round(f.b)
    hole[f.p / 4] = 0
    filled++
  }
}
console.log(`扩散填色 ${round} 轮完成`)

writeFileSync('src/assets/bg-clean.png', PNG.sync.write(png))
console.log('干净背景板已输出: src/assets/bg-clean.png')
