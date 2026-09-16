// 把用户可编辑的 ../config/*.csv 同步到 public/config/，供游戏运行时读取
import { cp, mkdir, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const srcDir = join(root, '..', 'config')
const dstDir = join(root, 'public', 'config')

await mkdir(dstDir, { recursive: true })
let n = 0
for (const f of await readdir(srcDir)) {
  if (f.endsWith('.csv')) {
    await cp(join(srcDir, f), join(dstDir, f))
    n++
  }
}
console.log(`[sync-config] 已同步 ${n} 个配置文件 → public/config/`)
