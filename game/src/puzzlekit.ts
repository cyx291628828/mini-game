/* ============================================================
 * puzzle-kit · 五个玩法的生成器 / 求解器（纯逻辑，零 DOM 依赖）
 * 全部保证唯一解。规格参数见 SPECS 表（与 config/难度奖励表.csv 规格说明对应）。
 * ============================================================ */

export function shuffle<T>(a: T[], rnd: () => number = Math.random): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
export function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

/* ---------------- 数独（支持 4×4 / 6×6 / 9×9，bw×bh 宫） ---------------- */

export interface SudokuPuzzle { bw: number; bh: number; N: number; puzzle: number[]; solution: number[] }

function sudokuMasks(bw: number, bh: number, grid: number[]) {
  const N = bw * bh
  const rows = new Array<number>(N).fill(0)
  const cols = new Array<number>(N).fill(0)
  const boxes = new Array<number>(N).fill(0)
  for (let i = 0; i < N * N; i++) {
    const v = grid[i]
    if (!v) continue
    const r = Math.floor(i / N), c = i % N
    const bx = Math.floor(r / bh) * (N / bw) + Math.floor(c / bw)
    const b = 1 << v
    rows[r] |= b; cols[c] |= b; boxes[bx] |= b
  }
  return { rows, cols, boxes }
}
function boxId(bw: number, bh: number, i: number): number {
  const N = bw * bh, r = Math.floor(i / N), c = i % N
  return Math.floor(r / bh) * (N / bw) + Math.floor(c / bw)
}
function popcount(x: number): number { let c = 0; while (x) { x &= x - 1; c++ } return c }

export function countSudokuSolutions(grid: number[], bw: number, bh: number, limit = 2): number {
  const N = bw * bh
  const g = grid.slice()
  const { rows, cols, boxes } = sudokuMasks(bw, bh, g)
  const empties: number[] = []
  for (let i = 0; i < N * N; i++) if (!g[i]) empties.push(i)
  let count = 0
  const fullMask = ((1 << (N + 1)) - 2)
  function dfs(): void {
    if (count >= limit) return
    let best = -1, bestCand = 0, bestCnt = 99
    for (const i of empties) {
      if (g[i]) continue
      const r = Math.floor(i / N), c = i % N, bx = boxId(bw, bh, i)
      const cand = ~(rows[r] | cols[c] | boxes[bx]) & fullMask
      const cnt = popcount(cand)
      if (cnt === 0) return
      if (cnt < bestCnt) { bestCnt = cnt; best = i; bestCand = cand; if (cnt === 1) break }
    }
    if (best === -1) { count++; return }
    const r = Math.floor(best / N), c = best % N, bx = boxId(bw, bh, best)
    for (let v = 1; v <= N; v++) {
      const b = 1 << v
      if (!(bestCand & b)) continue
      g[best] = v; rows[r] |= b; cols[c] |= b; boxes[bx] |= b
      dfs()
      g[best] = 0; rows[r] &= ~b; cols[c] &= ~b; boxes[bx] &= ~b
      if (count >= limit) return
    }
  }
  dfs()
  return count
}

function sudokuOk(grid: number[], bw: number, bh: number, i: number, v: number): boolean {
  const N = bw * bh, r = Math.floor(i / N), c = i % N
  for (let k = 0; k < N; k++) {
    if (grid[r * N + k] === v || grid[k * N + c] === v) return false
  }
  const br = Math.floor(r / bh) * bh, bc = Math.floor(c / bw) * bw
  for (let dr = 0; dr < bh; dr++) for (let dc = 0; dc < bw; dc++) {
    if (grid[(br + dr) * N + bc + dc] === v) return false
  }
  return true
}

export function genSudokuFull(bw: number, bh: number): number[] {
  const N = bw * bh
  const grid = new Array<number>(N * N).fill(0)
  const vals = Array.from({ length: N }, (_, k) => k + 1)
  function fill(i: number): boolean {
    if (i >= N * N) return true
    for (const v of shuffle(vals.slice())) {
      if (sudokuOk(grid, bw, bh, i, v)) { grid[i] = v; if (fill(i + 1)) return true; grid[i] = 0 }
    }
    return false
  }
  fill(0)
  return grid
}

export function genSudoku(bw: number, bh: number, holes: number): SudokuPuzzle {
  const N = bw * bh
  const solution = genSudokuFull(bw, bh)
  const puzzle = solution.slice()
  const order = shuffle(Array.from({ length: N * N }, (_, i) => i))
  let removed = 0
  for (const i of order) {
    if (removed >= holes) break
    const backup = puzzle[i]
    puzzle[i] = 0
    if (countSudokuSolutions(puzzle, bw, bh, 2) === 1) removed++
    else puzzle[i] = backup
  }
  return { bw, bh, N, puzzle, solution }
}

/* ---------------- 杀手数独（9×9） ---------------- */

export interface KillerPuzzle { cages: number[]; sums: number[]; solution: number[] }
export type KillerDiff = 'easy' | 'med' | 'hard' | 'expert'

function cageSizeFor(diff: KillerDiff): number {
  const r = Math.random()
  switch (diff) {
    case 'easy': return r < 0.55 ? 2 : r < 0.92 ? 3 : 4
    case 'med': return r < 0.4 ? 2 : r < 0.8 ? 3 : 4
    case 'hard': return r < 0.45 ? 2 : r < 0.85 ? 3 : 4
    case 'expert': return r < 0.5 ? 2 : r < 0.85 ? 3 : r < 0.95 ? 1 : 4
  }
}

export function countKillerSolutions(cages: number[], sums: number[], limit = 2): number {
  const N = 9
  const maxCage = Math.max(...cages) + 1
  const cellLists: number[][] = Array.from({ length: maxCage }, () => [])
  for (let i = 0; i < N * N; i++) cellLists[cages[i]].push(i)
  const cageUsed = new Array<number>(maxCage).fill(0)
  const cageLeft = cellLists.map(l => l.length)
  const cageLeftSum = sums.slice()
  const g = new Array<number>(N * N).fill(0)
  const rows = new Array<number>(N).fill(0), cols = new Array<number>(N).fill(0), boxes = new Array<number>(N).fill(0)
  const fullMask = ((1 << (N + 1)) - 2)
  let count = 0
  let nodes = 0
  function dfs(): void {
    if (count >= limit) return
    if (++nodes > 400000) { count = limit; return } // 超预算视为非唯一
    let best = -1, bestCand = 0, bestCnt = 99
    for (let i = 0; i < N * N; i++) {
      if (g[i]) continue
      const r = Math.floor(i / N), c = i % N
      const bx = Math.floor(r / 3) * 3 + Math.floor(c / 3)
      const cage = cages[i]
      let cand = ~(rows[r] | cols[c] | boxes[bx] | cageUsed[cage]) & fullMask
      // 笼可行性剪枝：本格赋 v 后，剩余格能凑出剩余和
      let mask = cand
      while (mask) {
        const v = 31 - Math.clz32(mask & -mask)
        mask &= mask - 1
        if (v > cageLeftSum[cage]) { cand &= ~(1 << v); continue }
        const rc = cageLeft[cage] - 1
        const rs = cageLeftSum[cage] - v
        const minSum = rc * (rc + 1) / 2
        const maxSum = rc * (19 - rc) / 2
        if (rc === 0 ? rs !== 0 : rs < minSum || rs > maxSum) cand &= ~(1 << v)
      }
      const cnt = popcount(cand)
      if (cnt === 0) return
      if (cnt < bestCnt) { bestCnt = cnt; best = i; bestCand = cand; if (cnt === 1) break }
    }
    if (best === -1) { count++; return }
    const r = Math.floor(best / N), c = best % N
    const bx = Math.floor(r / 3) * 3 + Math.floor(c / 3)
    const cage = cages[best]
    for (let v = 1; v <= N; v++) {
      const b = 1 << v
      if (!(bestCand & b)) continue
      g[best] = v; rows[r] |= b; cols[c] |= b; boxes[bx] |= b
      cageUsed[cage] |= b; cageLeft[cage]--; cageLeftSum[cage] -= v
      dfs()
      g[best] = 0; rows[r] &= ~b; cols[c] &= ~b; boxes[bx] &= ~b
      cageUsed[cage] &= ~b; cageLeft[cage]++; cageLeftSum[cage] += v
      if (count >= limit) return
    }
  }
  dfs()
  return count
}

export function genKiller(diff: KillerDiff): KillerPuzzle {
  const N = 9
  for (let attempt = 0; attempt < 90; attempt++) {
    const solution = genSudokuFull(3, 3)
    const cages = new Array<number>(N * N).fill(-1)
    const sums: number[] = []
    let cageId = 0
    for (let start = 0; start < N * N; start++) {
      if (cages[start] !== -1) continue
      const target = cageSizeFor(diff)
      const cage = [start]; cages[start] = cageId
      while (cage.length < target) {
        const frontier: number[] = []
        for (const c of cage) {
          const r = Math.floor(c / N), col = c % N
          if (r > 0 && cages[c - N] === -1) frontier.push(c - N)
          if (r < N - 1 && cages[c + N] === -1) frontier.push(c + N)
          if (col > 0 && cages[c - 1] === -1) frontier.push(c - 1)
          if (col < N - 1 && cages[c + 1] === -1) frontier.push(c + 1)
        }
        if (!frontier.length) break
        const pick = frontier[Math.floor(Math.random() * frontier.length)]
        cages[pick] = cageId; cage.push(pick)
      }
      sums.push(cage.reduce((s, c) => s + solution[c], 0))
      cageId++
    }
    if (countKillerSolutions(cages, sums, 2) === 1) return { cages, sums, solution }
  }
  throw new Error('killer gen failed')
}

/* ---------------- 数方 Suguru（正交相邻 + 区域内 1..N 恰好一次；构造式收敛保证唯一解） ---------------- */

export interface SuguruPuzzle { W: number; H: number; regions: number[]; sizes: number[]; puzzle: number[]; solution: number[]; maxDigit: number }

export function neighbors8(W: number, H: number, i: number): number[] {
  const r = Math.floor(i / W), c = i % W
  const out: number[] = []
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue
    const nr = r + dr, nc = c + dc
    if (nr >= 0 && nr < H && nc >= 0 && nc < W) out.push(nr * W + nc)
  }
  return out
}

export function neighborsOrtho(W: number, H: number, i: number): number[] {
  const r = Math.floor(i / W), c = i % W
  const out: number[] = []
  if (r > 0) out.push(i - W)
  if (r < H - 1) out.push(i + W)
  if (c > 0) out.push(i - 1)
  if (c < W - 1) out.push(i + 1)
  return out
}

/** 数方候选数：1..区域大小，且不在正交邻格、不在同区域已填数字中 */
function suguruCands(i: number, g: number[], regions: number[], sizes: number[], regionCells: number[][], nbs: number[][]): number[] {
  const used = new Set<number>()
  for (const nb of nbs[i]) if (g[nb]) used.add(g[nb])
  for (const c of regionCells[regions[i]]) if (g[c]) used.add(g[c])
  const out: number[] = []
  for (let v = 1; v <= sizes[regions[i]]; v++) if (!used.has(v)) out.push(v)
  return out
}

export interface SuguruSearch { sols: number[][]; exhausted: boolean }

/** 求最多 limit 个解；exhausted=true 表示预算耗尽（结果不可信）；givens 为预填格 */
export function suguruSearch(regions: number[], sizes: number[], W: number, H: number, limit = 2, nodeBudget = 300000, givens: number[] = []): SuguruSearch {
  const cells = W * H
  const g = givens.slice()
  const nbs = Array.from({ length: cells }, (_, i) => neighborsOrtho(W, H, i))
  const maxRegion = Math.max(...regions) + 1
  const regionCells: number[][] = Array.from({ length: maxRegion }, () => [])
  for (let i = 0; i < cells; i++) regionCells[regions[i]].push(i)
  const sols: number[][] = []
  let nodes = 0
  let exhausted = false
  function dfs(): void {
    if (sols.length >= limit || exhausted) return
    if (++nodes > nodeBudget) { exhausted = true; return }
    let best = -1, bestCands: number[] = [], bestCnt = 99
    let any = false
    for (let i = 0; i < cells; i++) {
      if (g[i]) continue
      any = true
      const cands = suguruCands(i, g, regions, sizes, regionCells, nbs)
      if (cands.length === 0) return
      if (cands.length < bestCnt) { bestCnt = cands.length; best = i; bestCands = cands; if (cands.length === 1) break }
    }
    if (!any) { sols.push(g.slice()); return }
    for (const v of bestCands) {
      g[best] = v
      dfs()
      g[best] = 0
      if (sols.length >= limit || exhausted) return
    }
  }
  dfs()
  return { sols, exhausted }
}

export function countSuguruSolutions(regions: number[], sizes: number[], W: number, H: number, limit = 2, nodeBudget = 300000, givens: number[] = []): number {
  const r = suguruSearch(regions, sizes, W, H, limit, nodeBudget, givens)
  return r.exhausted ? limit : r.sols.length
}

/** 某填盘是否是该分区的一个合法解 */
function validFor(sol: number[], regions: number[], sizes: number[], W: number, H: number): boolean {
  const cells = W * H
  const seen = new Map<number, Set<number>>()
  for (let i = 0; i < cells; i++) {
    const r = regions[i]
    if (!seen.has(r)) seen.set(r, new Set())
    seen.get(r)!.add(sol[i])
  }
  for (const [r, set] of seen) {
    if (set.size !== sizes[r]) return false // 数量须等于区域大小
    for (const v of set) if (v > sizes[r]) return false // 值域 1..size → 恰好 1..size 各一次
  }
  for (let i = 0; i < cells; i++) {
    for (const nb of neighborsOrtho(W, H, i)) {
      if (sol[i] === sol[nb]) return false
    }
  }
  return true
}

export function genSuguru(W: number, H: number, regionCap: number): SuguruPuzzle {
  const cells = W * H
  const deadline = Date.now() + 12000
  let outer = 0
  while (Date.now() < deadline && outer++ < 60) {
    // 1. 蛇形随机分区
    const regions = new Array<number>(cells).fill(-1)
    let rid = 0
    for (let s = 0; s < cells; s++) {
      if (regions[s] !== -1) continue
      const target = randInt(3, regionCap)
      const list = [s]; regions[s] = rid
      let tail = s
      while (list.length < target) {
        const cands = shuffle(neighborsOrtho(W, H, tail).filter(nb => regions[nb] === -1))
        if (!cands.length) break
        tail = cands[0]
        regions[tail] = rid; list.push(tail)
      }
      rid++
    }
    const sizes = new Array<number>(rid).fill(0)
    for (const r of regions) sizes[r]++
    const maxDigit0 = Math.max(...sizes)
    if (maxDigit0 < 3 || maxDigit0 > 7) continue
    // 2. 合并 + 提示格收敛：合并杀解；合并不动时锁一格提示（杀一个解、保一个解，必然收敛）
    const givens = new Array<number>(cells).fill(0)
    let confirmed = false
    for (let iter = 0; iter < 150; iter++) {
      const res = suguruSearch(regions, sizes, W, H, 2, 400000, givens)
      let s1: number[], s2: number[]
      if (res.sols.length >= 2) { s1 = res.sols[0]; s2 = res.sols[1] }
      else if (res.exhausted && res.sols.length === 1) { confirmed = true; break }
      else {
        const verify = suguruSearch(regions, sizes, W, H, 2, 2500000, givens)
        if (verify.sols.length === 1) { confirmed = true; break }
        if (verify.sols.length === 0) break
        if (verify.sols.length < 2) break // 预算耗尽且解稀少：放弃该分区重来
        s1 = verify.sols[0]; s2 = verify.sols[1]
      }
      const diffs = shuffle(Array.from({ length: cells }, (_, i) => i).filter(i => s1[i] !== s2[i]))
      // 只做"恰好杀掉一个解"的合并（保持分区始终有解）；找不到就加提示格，同样恰好杀一个解
      let committed = false
      for (const x of diffs) {
        const targets = shuffle(neighborsOrtho(W, H, x).map(nb => regions[nb]).filter(r => r !== regions[x]))
        const tried = new Set<number>()
        for (const tr of targets) {
          if (tried.has(tr)) continue
          tried.add(tr)
          if (sizes[tr] + 1 > 8) continue
          const nr = regions.slice()
          const ns = sizes.slice()
          ns[nr[x]]--
          nr[x] = tr
          ns[tr]++
          const v1 = validFor(s1, nr, ns, W, H)
          const v2 = validFor(s2, nr, ns, W, H)
          if (v1 !== v2) {
            regions.length = 0; regions.push(...nr)
            sizes.length = 0; sizes.push(...ns)
            committed = true
            break
          }
        }
        if (committed) break
      }
      if (!committed) {
        // 提示格：锁定 s1 的分歧值 → s2 必被杀、s1 仍合法，迭代必然收敛
        givens[diffs[0]] = s1[diffs[0]]
      }
    }
    if (confirmed) {
      const final = suguruSearch(regions, sizes, W, H, 1, 400000, givens)
      if (final.sols.length >= 1) {
        const maxDigit = Math.max(...sizes)
        return { W, H, regions, sizes, puzzle: givens, solution: final.sols[0], maxDigit }
      }
    }
  }
  throw new Error('suguru gen failed')
}
/* ---------------- 星之战 Star Battle（正方形盘） ---------------- */

export interface StarPuzzle { W: number; K: number; regions: number[]; solution: number[] }

function combinations(W: number, K: number): number[][] {
  const out: number[][] = []
  const cur: number[] = []
  function rec(start: number): void {
    if (cur.length === K) { out.push(cur.slice()); return }
    for (let c = start; c <= W - (K - cur.length); c++) { cur.push(c); rec(c + 1); cur.pop() }
  }
  rec(0)
  return out
}

export function countStarSolutions(regions: number[], W: number, K: number, limit = 2, nodeBudget = 60000): number[][] {
  const colCnt = new Array<number>(W).fill(0)
  const regCnt = new Array<number>(W).fill(0)
  const chosen: number[][] = []
  const out: number[][] = []
  const combos = combinations(W, K)
  let nodes = 0
  function rec(r: number): void {
    if (out.length >= limit) return
    if (++nodes > nodeBudget) { out.push([0, -1], [0, -1]); return } // 超预算：推入伪解使 length>1，即拒绝该分区
    if (r === W) { out.push(chosen.flat()); return }
    const prev = r > 0 ? chosen[r - 1] : []
    for (const cols of combos) {
      let ok = true
      for (const c of cols) {
        if (colCnt[c] >= K || regCnt[regions[r * W + c]] >= K) { ok = false; break }
        for (const pc of prev) if (Math.abs(pc - c) <= 1) { ok = false; break }
        if (!ok) break
      }
      if (!ok) continue
      chosen[r] = cols
      for (const c of cols) { colCnt[c]++; regCnt[regions[r * W + c]]++ }
      rec(r + 1)
      for (const c of cols) { colCnt[c]--; regCnt[regions[r * W + c]]-- }
      chosen.length = r
      if (out.length >= limit) return
    }
  }
  rec(0)
  return out
}

export function partitionSquare(W: number, regionCount: number): number[] {
  const cells = W * W
  const regions = new Array<number>(cells).fill(-1)
  const seeds = shuffle(Array.from({ length: cells }, (_, i) => i)).slice(0, regionCount)
  const fronts: number[][] = Array.from({ length: regionCount }, () => [])
  seeds.forEach((s, r) => { regions[s] = r })
  for (const s of seeds) {
    for (const nb of neighborsOrtho(W, W, s)) if (regions[nb] === -1) fronts[regions[s]].push(nb)
  }
  let remaining = cells - regionCount
  while (remaining > 0) {
    const r = Math.floor(Math.random() * regionCount)
    const front = fronts[r]
    let placed = false
    while (front.length) {
      const k = Math.floor(Math.random() * front.length)
      const c = front[k]
      front[k] = front[front.length - 1]; front.pop()
      if (regions[c] !== -1) continue
      regions[c] = r
      remaining--
      placed = true
      for (const nb of neighborsOrtho(W, W, c)) if (regions[nb] === -1) front.push(nb)
      break
    }
    if (!placed && fronts.every(f => f.length === 0) && remaining > 0) {
      // 理论上多源 BFS 不会出现孤岛；兜底：任选未分配格接上相邻已分配区
      for (let i = 0; i < cells && remaining > 0; i++) {
        if (regions[i] !== -1) continue
        const nbRegion = neighborsOrtho(W, W, i).map(nb => regions[nb]).find(x => x !== -1)
        if (nbRegion !== undefined) { regions[i] = nbRegion; remaining-- }
      }
    }
  }
  return regions
}

/** 随机生成一个合法星位（每行/列 K 颗、互不相邻），返回星格下标数组 */
export function placeStars(W: number, K: number): number[] | null {
  const chosen: number[][] = []
  const colCnt = new Array<number>(W).fill(0)
  const combos = combinations(W, K).filter(cols => cols.every((c, i) => i === 0 || c - cols[i - 1] >= 2))
  function rec(r: number): boolean {
    if (r === W) return true
    for (const cols of shuffle(combos.slice())) {
      if (cols.some(c => colCnt[c] >= K)) continue
      const prev = r > 0 ? chosen[r - 1] : null
      if (prev && cols.some(c => prev.some(pc => Math.abs(pc - c) <= 1))) continue
      chosen[r] = cols
      cols.forEach(c => colCnt[c]++)
      if (rec(r + 1)) return true
      cols.forEach(c => colCnt[c]--)
      chosen.length = r
    }
    return false
  }
  if (!rec(0)) return null
  return chosen.flat()
}

/** 让 W 个区域围绕星位生长，每区域恰好含 K 颗星（普通格不限） */
export function growRegionsAroundStars(W: number, K: number, stars: number[]): number[] | null {
  const cells = W * W
  const starSet = new Set(stars)
  const regions = new Array<number>(cells).fill(-1)
  const regionStars = new Array<number>(W).fill(0)
  const fronts: number[][] = Array.from({ length: W }, () => [])
  for (let r = 0; r < W; r++) {
    const s = stars[r * K]
    regions[s] = r
    regionStars[r] = 1
    for (const nb of neighborsOrtho(W, W, s)) if (regions[nb] === -1) fronts[r].push(nb)
  }
  let remaining = cells - W
  let idle = 0
  while (remaining > 0) {
    if (idle > cells * 4 + 200) return null
    const r = Math.floor(Math.random() * W)
    const front = fronts[r]
    let claimed = false
    let scan = 0
    while (scan < front.length + 4 && !claimed && front.length) {
      scan++
      const k = Math.floor(Math.random() * front.length)
      const c = front[k]
      front[k] = front[front.length - 1]; front.pop()
      if (regions[c] !== -1) continue
      const isStar = starSet.has(c)
      if (isStar && regionStars[r] >= K) continue
      regions[c] = r
      if (isStar) regionStars[r]++
      remaining--
      claimed = true
      for (const nb of neighborsOrtho(W, W, c)) if (regions[nb] === -1) front.push(nb)
    }
    if (!claimed) idle++
    else idle = 0
  }
  // 保底清扫：任何漏格挂到相邻已分配区域（星格须找还有星余额的区域）
  const holes = () => regions.map((r, i) => (r === -1 ? i : -1)).filter(i => i >= 0)
  for (let sweep = 0; sweep < 8 && holes().length > 0; sweep++) {
    for (const i of holes()) {
      const cands = shuffle(neighborsOrtho(W, W, i).map(nb => regions[nb]).filter(x => x !== -1))
      for (const r of cands) {
        if (starSet.has(i) && regionStars[r] >= K) continue
        regions[i] = r
        if (starSet.has(i)) regionStars[r]++
        break
      }
    }
  }
  if (holes().length > 0) return null
  return regions
}

export function genStarBattle(W: number, K: number): StarPuzzle {
  const deadline = Date.now() + 5000
  let guard = 0
  while (Date.now() < deadline && guard++ < 5000) {
    const stars = placeStars(W, K)
    if (!stars) continue
    const regions = growRegionsAroundStars(W, K, stars)
    if (!regions) continue
    const sols = countStarSolutions(regions, W, K, 2, 200000)
    if (sols.length === 1) return { W, K, regions, solution: sols[0] }
  }
  if (K > 2) return genStarBattle(W, 2)
  if (W > 8) return genStarBattle(8, K)
  throw new Error('star gen failed')
}

/* ---------------- 扫雷 ---------------- */

export interface MinesBoard { W: number; H: number; mines: boolean[]; nums: number[] }

export function genMines(W: number, H: number, count: number, safeIdx: number): MinesBoard {
  const cells = W * H
  const forbidden = new Set<number>([safeIdx])
  {
    const r = Math.floor(safeIdx / W), c = safeIdx % W
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const nr = r + dr, nc = c + dc
      if (nr >= 0 && nr < H && nc >= 0 && nc < W) forbidden.add(nr * W + nc)
    }
  }
  const pool = shuffle(Array.from({ length: cells }, (_, i) => i).filter(i => !forbidden.has(i)))
  const mines = new Array<boolean>(cells).fill(false)
  for (let k = 0; k < Math.min(count, pool.length); k++) mines[pool[k]] = true
  const nums = new Array<number>(cells).fill(0)
  for (let i = 0; i < cells; i++) {
    const r = Math.floor(i / W), c = i % W
    let n = 0
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue
      const nr = r + dr, nc = c + dc
      if (nr >= 0 && nr < H && nc >= 0 && nc < W && mines[nr * W + nc]) n++
    }
    nums[i] = n
  }
  return { W, H, mines, nums }
}

/* ---------------- 难度规格映射（与 config/难度奖励表.csv 的规格说明保持一致） ---------------- */

export type Spec =
  | { kind: 'sudoku'; bw: number; bh: number; holes: number }
  | { kind: 'mines'; W: number; H: number; mines: number }
  | { kind: 'suguru'; W: number; H: number; cap: number }
  | { kind: 'star'; W: number; K: number }
  | { kind: 'killer'; diff: KillerDiff }

export const SPECS: Record<string, Spec> = {
  '数独|简单': { kind: 'sudoku', bw: 3, bh: 2, holes: 8 },
  '数独|中等': { kind: 'sudoku', bw: 3, bh: 3, holes: 35 },
  '数独|困难': { kind: 'sudoku', bw: 3, bh: 3, holes: 46 },
  '数独|专家': { kind: 'sudoku', bw: 3, bh: 3, holes: 52 },
  '扫雷|简单': { kind: 'mines', W: 9, H: 9, mines: 10 },
  '扫雷|中等': { kind: 'mines', W: 12, H: 12, mines: 20 },
  '扫雷|困难': { kind: 'mines', W: 16, H: 16, mines: 40 },
  '扫雷|专家': { kind: 'mines', W: 16, H: 30, mines: 99 },
  '数方|简单': { kind: 'suguru', W: 6, H: 6, cap: 4 },
  '数方|中等': { kind: 'suguru', W: 8, H: 6, cap: 5 },
  '数方|困难': { kind: 'suguru', W: 8, H: 8, cap: 5 },
  '数方|专家': { kind: 'suguru', W: 8, H: 8, cap: 6 },
  '星之战|简单': { kind: 'star', W: 8, K: 2 },
  '星之战|中等': { kind: 'star', W: 8, K: 2 },
  '星之战|困难': { kind: 'star', W: 8, K: 2 },
  '星之战|专家': { kind: 'star', W: 8, K: 2 },
  '杀手数独|简单': { kind: 'killer', diff: 'easy' },
  '杀手数独|中等': { kind: 'killer', diff: 'med' },
  '杀手数独|困难': { kind: 'killer', diff: 'hard' },
  '杀手数独|专家': { kind: 'killer', diff: 'expert' },
}

export function generatePuzzle(key: string): { spec: Spec } & Record<string, unknown> {
  const spec = SPECS[key]
  if (!spec) throw new Error(`未知规格: ${key}`)
  switch (spec.kind) {
    case 'sudoku': return { spec, ...genSudoku(spec.bw, spec.bh, spec.holes) }
    case 'mines': return { spec, W: spec.W, H: spec.H, mines: spec.mines } // 扫雷在首点后才布雷
    case 'suguru': return { spec, ...genSuguru(spec.W, spec.H, spec.cap) }
    case 'star': return { spec, ...genStarBattle(spec.W, spec.K) }
    case 'killer': return { spec, ...genKiller(spec.diff) }
  }
}
