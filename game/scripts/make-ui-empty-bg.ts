// 生成无 HUD 背景板（bg-empty）+ 裁切 HUD 小图标（coin/dice）
// 把场景图中所有烙死的 UI（格子、骰子基座、顶部资源框、齿轮、底部按钮条、玩家卡）全部抹除
// 用法：node --experimental-strip-types scripts/make-ui-empty-bg.ts
import { PNG } from 'pngjs'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const png = PNG.sync.read(readFileSync('src/assets/board-island.png'))
const { width: W, height: H, data } = png
const px = (x: number, y: number) => (y * W + x) * 4

// 从 boardArt.ts 解析节点与骰子区
const srcText = readFileSync('src/core/boardArt.ts', 'utf8')
const chapter1 = srcText.split('tiles: [')[1]?.split('],')[0] ?? ''
const tiles = [...chapter1.matchAll(/\{ x: (\d+), y: (\d+), w: (\d+), h: (\d+) \}/g)]
  .map(m => ({ x: +m[1], y: +m[2], w: +m[3], h: +m[4] }))
const diceMatch = srcText.match(/dice: \{ x: (\d+), y: (\d+), w: (\d+), h: (\d+) \}/)

// 待抹除区（中心式坐标）：格子 + 骰子基座 + 顶部资源框条 + 底部按钮条
const erase: { x: number; y: number; w: number; h: number }[] = [...tiles]
if (diceMatch) erase.push({ x: +diceMatch[1], y: +diceMatch[2], w: +diceMatch[3], h: +diceMatch[4] })
erase.push(
    { x: 657, y: 60, w: 420, h: 90 },    // 顶部：金币框+骰子框+齿轮（中心式）
    { x: 432, y: 1454, w: 880, h: 170 }, // 底部：玩家卡+按钮条（中心式）
)

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
erase.forEach(mark)
console.log(`待抹除像素 ${holes}（${(holes / (W * H) * 100).toFixed(1)}% 画面）`)

let filled = 0, round = 0
while (filled < holes && round < 600) {
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

writeFileSync('src/assets/bg-empty.png', PNG.sync.write(png))
console.log('无 HUD 背景板已输出: src/assets/bg-empty.png')

// 裁 HUD 小图标（金币/骰子）——必须从原始未修改的图上裁（抹除后的区域已是涂抹痕）
mkdirSync('src/assets/icons', { recursive: true })
const orig = PNG.sync.read(readFileSync('src/assets/board-island.png'))
const oW = orig.width
const opx = (x: number, y: number) => (y * oW + x) * 4
function crop(name: string, x: number, y: number, w: number, h: number): void {
    const out = new PNG({ width: w, height: h })
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
        const o = (yy * w + xx) * 4
        const p = opx(x + xx, y + yy)
        out.data[o] = orig.data[p]; out.data[o + 1] = orig.data[p + 1]; out.data[o + 2] = orig.data[p + 2]; out.data[o + 3] = 255
    }
    writeFileSync(`src/assets/icons/${name}.png`, PNG.sync.write(out))
}
crop('icon-coin', 468, 34, 52, 52)
crop('icon-dice', 660, 34, 52, 52)
console.log('HUD 图标已输出: src/assets/icons/icon-coin.png / icon-dice.png')
