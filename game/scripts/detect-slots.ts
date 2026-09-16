// 棋盘格坐标提取：按四种 slot 颜色做连通域检测，输出每个格子的中心（设计稿 864×1536 像素坐标）
// 用法：node --experimental-strip-types scripts/detect-slots.ts
import { PNG } from 'pngjs'
import { readFileSync, writeFileSync } from 'node:fs'

const SRC = 'src/assets/board-island.png'
const OUT = 'scripts/slots-marked.png'
const png = PNG.sync.read(readFileSync(SRC))
const { width: W, height: H, data } = png

// slot 参考色（从图取样的近似值，允许容差）
const FAMILIES: { name: string; rgb: [number, number, number]; tol: number }[] = [
  { name: 'blue', rgb: [110, 178, 224], tol: 38 },
  { name: 'yellow', rgb: [247, 208, 108], tol: 38 },
  { name: 'red', rgb: [236, 122, 116], tol: 38 },
  { name: 'green', rgb: [124, 200, 138], tol: 38 },
]

const idx = (x: number, y: number) => (y * W + x) * 4
function classify(x: number, y: number): number {
  const p = idx(x, y)
  const r = data[p], g = data[p + 1], b = data[p + 2]
  for (let f = 0; f < FAMILIES.length; f++) {
    const [rr, gg, bb] = FAMILIES[f].rgb
    if (Math.abs(r - rr) <= FAMILIES[f].tol && Math.abs(g - gg) <= FAMILIES[f].tol && Math.abs(b - bb) <= FAMILIES[f].tol) return f + 1
  }
  return 0
}

// 连通域（BFS，步长2采样）
const label = new Int32Array(W * H)
const comps: { fam: number; n: number; sx: number; sy: number; minX: number; maxX: number; minY: number; maxY: number }[] = []
for (let y = 0; y < H; y += 2) {
  for (let x = 0; x < W; x += 2) {
    if (label[y * W + x]) continue
    const fam = classify(x, y)
    if (!fam) continue
    const comp = { fam, n: 0, sx: 0, sy: 0, minX: x, maxX: x, minY: y, maxY: y }
    comps.push(comp)
    const queue = [[x, y]]
    label[y * W + x] = 1
    while (queue.length) {
      const [cx, cy] = queue.pop()!
      comp.n++
      comp.sx += cx; comp.sy += cy
      if (cx < comp.minX) comp.minX = cx
      if (cx > comp.maxX) comp.maxX = cx
      if (cy < comp.minY) comp.minY = cy
      if (cy > comp.maxY) comp.maxY = cy
      for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
        const nx = cx + dx, ny = cy + dy
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue
        if (label[ny * W + nx]) continue
        if (classify(nx, ny) === fam) { label[ny * W + nx] = 1; queue.push([nx, ny]) }
      }
    }
  }
}

// 过滤：slot 面积约 80×80（步长2采样→约1600），取 500..9000
const slots = comps
  .filter(c => c.n > 500 && c.n < 9000)
  .map(c => {
    const cx = Math.round(c.sx / c.n), cy = Math.round(c.sy / c.n)
    return { fam: FAMILIES[c.fam - 1].name, cx, cy, w: c.maxX - c.minX, h: c.maxY - c.minY, n: c.n }
  })
  .sort((a, b) => a.cy - b.cy || a.cx - b.cx)

console.log(`检测到 ${slots.length} 个候选 slot：`)
for (const s of slots) console.log(`  ${s.fam.padEnd(6)} center=(${s.cx},${s.cy}) size=${s.w}x${s.h} area=${s.n}`)

// 输出可视化标注图（十字标记每个中心）
const out = new PNG({ width: W, height: H })
out.data.set(data)
for (const s of slots) {
  for (let d = -14; d <= 14; d++) {
    const px = idx(Math.min(W - 1, Math.max(0, s.cx + d)), s.cy)
    out.data[px] = 255; out.data[px + 1] = 0; out.data[px + 2] = 255; out.data[px + 3] = 255
    const py = idx(s.cx, Math.min(H - 1, Math.max(0, s.cy + d)))
    out.data[py] = 255; out.data[py + 1] = 0; out.data[py + 2] = 255; out.data[py + 3] = 255
  }
}
writeFileSync(OUT, PNG.sync.write(out))
console.log('标注图已输出: ' + OUT)
