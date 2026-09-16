// 美术棋盘坐标核对图：把 ART_BOARDS 的节点坐标画到场景图上，人工核对路径走向
// 用法：node --experimental-strip-types scripts/render-art-check.ts
import { PNG } from 'pngjs'
import { readFileSync, writeFileSync } from 'node:fs'

// 从 boardArt.ts 源码提取第 1 章坐标（避免 node 无法 import png 模块）
const srcText = readFileSync('src/core/boardArt.ts', 'utf8')
const chapter1 = srcText.split('1: {')[1]?.split('],')[0] ?? ''
const tiles = [...chapter1.matchAll(/\{ x: (\d+), y: (\d+) \}/g)].map(m => ({ x: +m[1], y: +m[2] }))
console.log(`解析到 ${tiles.length} 个节点`)

const png = PNG.sync.read(readFileSync('src/assets/board-island.png'))
const { width: W, height: H, data } = png
const idx = (x: number, y: number) => (y * W + x) * 4

// 画节点标记：品红圆环 + 序号底色块
for (let n = 0; n < tiles.length; n++) {
  const { x, y } = tiles[n]
  const R = 22
  for (let a = 0; a < 360; a += 2) {
    for (const rr of [R, R - 1]) {
      const px = Math.round(x + rr * Math.cos(a * Math.PI / 180))
      const py = Math.round(y + rr * Math.sin(a * Math.PI / 180))
      if (px < 0 || px >= W || py < 0 || py >= H) continue
      const p = idx(px, py)
      data[p] = 255; data[p + 1] = 0; data[p + 2] = 255; data[p + 3] = 255
    }
  }
  // 序号牌
  const label = String(n + 1)
  const bw = 6 + label.length * 12
  for (let dy = -10; dy <= 10; dy++) {
    for (let dx = 0; dx < bw; dx++) {
      const px = x - R - bw + dx, py = y - 34 + dy
      if (px < 0 || px >= W || py < 0 || py >= H) continue
      const p = idx(px, py)
      data[p] = 40; data[p + 1] = 20; data[p + 2] = 80; data[p + 3] = 230
    }
  }
}
writeFileSync('scripts/art-check.png', PNG.sync.write(png))
console.log('核对图已输出: scripts/art-check.png')
