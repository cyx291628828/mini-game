// 生成器压测：唯一解校验 + 耗时（node --experimental-strip-types scripts/gen-test.ts）
import { genSudoku, countSudokuSolutions, genKiller, countKillerSolutions, genSuguru, countSuguruSolutions, genStarBattle, countStarSolutions, genMines } from '../src/puzzlekit.ts'

function bench(name: string, fn: () => void, times: number): void {
  const t0 = Date.now()
  for (let i = 0; i < times; i++) fn()
  console.log(`${name} ×${times}: ${Date.now() - t0}ms`)
}

// 数独
for (const [bw, bh, holes] of [[3, 2, 8], [3, 3, 35], [3, 3, 46], [3, 3, 52]] as const) {
  bench(`数独 ${bw * bh}×${bw * bh} 挖${holes}`, () => {
    const p = genSudoku(bw, bh, holes)
    if (countSudokuSolutions(p.puzzle, bw, bh, 2) !== 1) throw new Error('非唯一解!')
  }, 5)
}
// 杀手数独
bench('杀手数独 easy', () => {
  const k = genKiller('easy')
  if (countKillerSolutions(k.cages, k.sums, 2) !== 1) throw new Error('非唯一解!')
}, 3)
bench('杀手数独 expert', () => {
  const k = genKiller('expert')
  if (countKillerSolutions(k.cages, k.sums, 2) !== 1) throw new Error('非唯一解!')
}, 2)
// 数方（验证拼图含提示格的唯一解）
bench('数方 6×6', () => {
  const s = genSuguru(6, 6, 4)
  if (countSuguruSolutions(s.regions, s.sizes, 6, 6, 2, 300000, s.puzzle) !== 1) throw new Error('非唯一解!')
}, 5)
bench('数方 8×8', () => {
  const s = genSuguru(8, 8, 5)
  if (countSuguruSolutions(s.regions, s.sizes, 8, 8, 2, 300000, s.puzzle) !== 1) throw new Error('非唯一解!')
}, 2)
// 星之战
bench('星之战 8×8·2', () => {
  const st = genStarBattle(8, 2)
  if (countStarSolutions(st.regions, 8, 2, 2).length !== 1) throw new Error('非唯一解!')
}, 5)
// 扫雷
const m = genMines(16, 30, 99, 0)
if (m.mines.filter(Boolean).length !== 99) throw new Error('雷数错误')
console.log('扫雷 OK')
console.log('✅ 全部生成器通过')
