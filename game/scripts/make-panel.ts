// 生成九宫格面板贴图（供编辑器预制体使用）：棕色圆角面板，四边可拉伸
// 用法：node --experimental-strip-types scripts/make-panel.ts
import { PNG } from 'pngjs'
import { writeFileSync } from 'node:fs'

const W = 96, H = 64, R = 14, BORDER = 3
const FILL = [154, 108, 70]   // #9a6c46 棕色面板底
const EDGE = [107, 68, 35]    // #6b4423 描边

const out = new PNG({ width: W, height: H })
for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
        const o = (y * W + x) * 4
        // 圆角矩形 SDF
        const cx = W / 2, cy = H / 2
        const hx = W / 2 - BORDER, hy = H / 2 - BORDER
        const dxo = Math.abs(x - cx) - hx, dyo = Math.abs(y - cy) - hy
        const dOuter = Math.min(Math.max(dxo, dyo), 0) + Math.hypot(Math.max(dxo, 0), Math.max(dyo, 0))
        const dxi = Math.abs(x - cx) - (hx - BORDER), dyi = Math.abs(y - cy) - (hy - BORDER)
        const dInner = Math.min(Math.max(dxi, dyi), 0) + Math.hypot(Math.max(dxi, 0), Math.max(dyi, 0))
        const inOuter = dOuter <= 0
        const inInner = dInner > 0
        // 顶部轻微高光
        const hi = y < H * 0.35 ? 12 : 0
        if (!inOuter) { out.data[o + 3] = 0; continue }
        const base = inInner ? FILL : EDGE
        out.data[o] = Math.min(255, base[0] + hi)
        out.data[o + 1] = Math.min(255, base[1] + hi)
        out.data[o + 2] = Math.min(255, base[2] + hi)
        out.data[o + 3] = 255
    }
}
writeFileSync('src/assets/panels/panel-brown.png', PNG.sync.write(out))
console.log('九宫格面板已输出: src/assets/panels/panel-brown.png（四边拉伸边距建议 20）')
