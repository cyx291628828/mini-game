/* 玩法场景：统一外壳（返回/计时/错误生命）+ 五个玩法的界面与交互 */
import { el, toast, pulse } from './core/fx'
import { sfx } from './core/audio'
import { SPECS, genSudoku, genKiller, genSuguru, genStarBattle, genMines, neighbors8, neighborsOrtho } from './puzzlekit'
import type { KillerDiff, KillerPuzzle, StarPuzzle, SuguruPuzzle, SudokuPuzzle } from './puzzlekit'
import { persist } from './core/save'
import { getSave } from './core/meta'
import { openOverlay } from './ui'
export interface GameCallbacks { onWin(): void; onFail(): void; onExit(): void }
export interface GameHandle { restart(): void; debugWin(): void }

interface Chrome {
  root: HTMLElement
  body: HTMLElement
  foot: HTMLElement
  setInfo(html: string): void
  register(h: GameHandle): void
}

const REGION_COLORS = ['#ffe3ec', '#e3f2ff', '#e6ffe3', '#fff7d6', '#f1e6ff', '#ffe9d9', '#e0fff7', '#ffdddd', '#eef3ff', '#f6ffe0', '#f3e8ff', '#e8f6ff']

export function launchGame(root: HTMLElement, game: string, diff: string, free: boolean, cb: GameCallbacks): GameHandle {
  void free
  root.innerHTML = ''
  root.className = 'screen'

  const header = el('div', 'g-header')
  const back = el('button', 'g-back', '‹')
  const title = el('div', 'g-title', `${game} · ${diff}${free ? ' · 练习' : ''}`)
  const info = el('div', 'g-info', '')
  const timer = el('span', 'g-timer', '00:00')
  header.append(back, title, info, timer)
  const body = el('div', 'g-body')
  const foot = el('div', 'g-foot')
  root.append(header, body, foot)

  let t = 0
  const tm = setInterval(() => {
    t++
    timer.textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
  }, 1000)
  window.addEventListener('pagehide', () => clearInterval(tm))

  back.onclick = () => {
    sfx('tap')
    openOverlay((box, h) => {
      box.classList.add('mini')
      box.innerHTML = `<div class="sheet-title">退出本局？</div><div class="sheet-sub">进度将不保存、不结算</div>
        <div class="r-btns"><button class="btn ghost">继续挑战</button><button class="btn danger">退出</button></div>`
      const [keep, quit] = box.querySelectorAll('button')
      keep.onclick = () => { sfx('tap'); h.close() }
      quit.onclick = () => { sfx('tap'); h.close(); cb.onExit() }
    })
  }

  let handle: GameHandle = { restart: () => {}, debugWin: () => {} }
  const chrome: Chrome = {
    root, body, foot,
    setInfo: html => { info.innerHTML = html },
    register: h => { handle = h },
  }

  const key = `${game}|${diff}`
  const spec: unknown = SPECS[key]
  const build = (): void => {
    chrome.body.innerHTML = `<div class="gen-loading">🧩 出题中…</div>`
    chrome.foot.innerHTML = ''
    setTimeout(() => {
      switch (game) {
        case '数独': makeNumberGame(chrome, cb, sudokuFactory(spec as { kind: 'sudoku'; bw: number; bh: number; holes: number })); break
        case '杀手数独': makeNumberGame(chrome, cb, killerFactory((spec as { kind: 'killer'; diff: KillerDiff }).diff)); break
        case '数方': makeNumberGame(chrome, cb, suguruFactory(spec as { kind: 'suguru'; W: number; H: number; cap: number })); break
        case '星之战': makeStarGame(chrome, cb, spec as { kind: 'star'; W: number; K: number }); break
        case '扫雷': makeMinesGame(chrome, cb, spec as { kind: 'mines'; W: number; H: number; mines: number }); break
        default: makeNumberGame(chrome, cb, sudokuFactory({ kind: 'sudoku', bw: 3, bh: 3, holes: 30 }))
      }
    }, 30)
  }
  build()

  return {
    restart: () => { t = 0; timer.textContent = '00:00'; build() },
    debugWin: () => handle.debugWin(),
  }
}

/* ================= 数字填格类：数独 / 杀手数独 / 数方 ================= */

interface NumberGameOpts {
  W: number
  H: number
  digits: number
  given: number[]
  solution: number[]
  peers: (i: number) => number[]
  regionOf?: (i: number) => number
  boxBorders?: { bw: number; bh: number }
  cageSums?: KillerPuzzle
  notesMax: number
  regen: () => void
}

function sudokuFactory(spec: { kind: 'sudoku'; bw: number; bh: number; holes: number }): () => NumberGameOpts {
  return () => {
    const data: SudokuPuzzle = genSudoku(spec.bw, spec.bh, spec.holes)
    const N = data.N
    return {
      W: N, H: N, digits: N, given: data.puzzle, solution: data.solution, notesMax: 9,
      boxBorders: { bw: data.bw, bh: data.bh },
      peers: (i) => {
        const r = Math.floor(i / N), c = i % N
        const out = new Set<number>()
        for (let k = 0; k < N; k++) { out.add(r * N + k); out.add(k * N + c) }
        const br = Math.floor(r / data.bh) * data.bh, bc = Math.floor(c / data.bw) * data.bw
        for (let dr = 0; dr < data.bh; dr++) for (let dc = 0; dc < data.bw; dc++) out.add((br + dr) * N + bc + dc)
        out.delete(i)
        return [...out]
      },
      regen: () => makeNumberGame(currentChrome!, currentCb!, sudokuFactory(spec)),
    }
  }
}

function killerFactory(diff: KillerDiff): () => NumberGameOpts {
  return () => {
    const data: KillerPuzzle = genKiller(diff)
    const N = 9
    return {
      W: N, H: N, digits: N, given: new Array<number>(N * N).fill(0), solution: data.solution, notesMax: 9,
      boxBorders: { bw: 3, bh: 3 },
      cageSums: data,
      peers: (i) => {
        const r = Math.floor(i / N), c = i % N
        const out = new Set<number>()
        for (let k = 0; k < N; k++) { out.add(r * N + k); out.add(k * N + c) }
        const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3
        for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) out.add((br + dr) * N + bc + dc)
        out.delete(i)
        return [...out]
      },
      regen: () => makeNumberGame(currentChrome!, currentCb!, killerFactory(diff)),
    }
  }
}

function suguruFactory(spec: { kind: 'suguru'; W: number; H: number; cap: number }): () => NumberGameOpts {
  return () => {
    const data: SuguruPuzzle = genSuguru(spec.W, spec.H, spec.cap)
    return {
      W: data.W, H: data.H, digits: data.maxDigit, given: data.puzzle, solution: data.solution,
      notesMax: data.maxDigit,
      regionOf: (i) => data.regions[i],
      peers: (i) => {
        const out = new Set<number>(neighborsOrtho(data.W, data.H, i))
        for (let k = 0; k < data.W * data.H; k++) if (data.regions[k] === data.regions[i]) out.add(k)
        out.delete(i)
        return [...out]
      },
      regen: () => makeNumberGame(currentChrome!, currentCb!, suguruFactory(spec)),
    }
  }
}

let currentChrome: Chrome | null = null
let currentCb: GameCallbacks | null = null

function makeNumberGame(chrome: Chrome, cb: GameCallbacks, optsFn: () => NumberGameOpts): void {
  currentChrome = chrome
  currentCb = cb
  const opts = optsFn()
  const { W, H, digits, given, solution, peers } = opts
  const cells = W * H
  chrome.body.innerHTML = ''

  const values = given.slice()
  const notes: Set<number>[] = Array.from({ length: cells }, () => new Set<number>())
  const undoStack: { i: number; v: number; notes: number[] }[] = []
  let selected = -1
  let noteMode = false
  let mistakes = 0
  let hints = 1
  let finished = false

  chrome.setInfo(`<span class="hearts" id="hearts">❤️❤️❤️</span>`)

  const bd = el('div', `num-board ${opts.regionOf ? 'regions' : 'boxes'}${opts.cageSums ? ' cages' : ''}`)
  bd.style.setProperty('--n', String(W))
  bd.style.setProperty('--w', String(W))
  const cellEls: HTMLElement[] = []
  for (let i = 0; i < cells; i++) {
    const c = el('div', 'ncell')
    if (given[i]) c.classList.add('given')
    if (opts.boxBorders) {
      const r = Math.floor(i / W), col = i % W
      if (col % opts.boxBorders.bw === opts.boxBorders.bw - 1 && col !== W - 1) c.classList.add('br-r')
      if (r % opts.boxBorders.bh === opts.boxBorders.bh - 1 && r !== H - 1) c.classList.add('br-b')
    }
    if (opts.regionOf) {
      c.style.background = REGION_COLORS[opts.regionOf(i) % REGION_COLORS.length]
      const r = Math.floor(i / W), col = i % W
      if (col < W - 1 && opts.regionOf(i + 1) !== opts.regionOf(i)) c.classList.add('rg-r')
      if (r < H - 1 && opts.regionOf(i + W) !== opts.regionOf(i)) c.classList.add('rg-b')
    }
    c.onclick = () => { sfx('tick'); selected = i; paint() }
    bd.appendChild(c)
    cellEls.push(c)
  }
  chrome.body.appendChild(bd)
  chrome.body.classList.toggle('scrollable', H >= 12)

  const pad = el('div', 'numpad')
  for (let d = 1; d <= digits; d++) {
    const b = el('button', 'np-key', String(d))
    b.onclick = () => inputDigit(d)
    pad.appendChild(b)
  }
  const erase = el('button', 'np-key fn', '⌫')
  erase.onclick = () => inputDigit(0)
  pad.appendChild(erase)
  chrome.foot.appendChild(pad)

  const tools = el('div', 'tools')
  const noteBtn = el('button', 'tool-btn', '✏️ 笔记')
  noteBtn.onclick = () => { noteMode = !noteMode; noteBtn.classList.toggle('on', noteMode); sfx('tap') }
  const undoBtn = el('button', 'tool-btn', '↩️ 撤销')
  undoBtn.onclick = () => {
    const last = undoStack.pop()
    if (!last) { toast('没有可撤销的操作'); return }
    values[last.i] = last.v
    notes[last.i] = new Set(last.notes)
    sfx('tick')
    paint()
  }
  const hintBtn = el('button', 'tool-btn gold', '💡 提示 ×1')
  const refreshHintBtn = (): void => { hintBtn.textContent = hints > 0 ? '💡 提示 ×1' : '📺 提示' }
  hintBtn.onclick = () => {
    if (hints <= 0) {
      void import('./ui').then(u => u.showAdModal('获得 1 次提示', () => { hints++; refreshHintBtn(); toast('💡 提示 +1') }))
      return
    }
    const empties: number[] = []
    for (let i = 0; i < cells; i++) if (values[i] !== solution[i]) empties.push(i)
    if (!empties.length) return
    const i = empties[Math.floor(Math.random() * empties.length)]
    values[i] = solution[i]
    notes[i].clear()
    hints--
    getSave().stats.hints++
    persist(getSave())
    sfx('piece')
    refreshHintBtn()
    paint()
    checkWin()
  }
  tools.append(noteBtn, undoBtn, hintBtn)
  chrome.foot.appendChild(tools)

  function inputDigit(d: number): void {
    if (finished) return
    if (selected < 0) { toast('先点选一个格子'); return }
    if (given[selected]) { toast('题目数字不可修改'); return }
    if (noteMode && d > 0) {
      if (values[selected]) return
      const s = notes[selected]
      if (s.has(d)) s.delete(d); else s.add(d)
      sfx('tick')
      paint()
      return
    }
    undoStack.push({ i: selected, v: values[selected], notes: [...notes[selected]] })
    if (d === 0) { values[selected] = 0; sfx('tick'); paint(); return }
    values[selected] = d
    notes[selected].clear()
    if (d !== solution[selected]) {
      mistakes++
      setHearts(3 - mistakes)
      sfx('fail')
      pulse(cellEls[selected], 'shake')
      if (mistakes >= 3) {
        finished = true
        cb.onFail()
        return
      }
    } else {
      sfx('tap')
    }
    paint()
    checkWin()
  }

  function setHearts(left: number): void {
    const hearts = chrome.root.querySelector('#hearts')
    if (hearts) hearts.textContent = '❤️'.repeat(Math.max(0, left)) + '🖤'.repeat(Math.max(0, 3 - left))
  }

  function label(i: number): string {
    return opts.cageSums && cageTop(opts.cageSums, i) ? `<span class="cage-sum">${opts.cageSums.sums[opts.cageSums.cages[i]]}</span>` : ''
  }

  function paint(): void {
    const peerSet = selected >= 0 ? new Set(peers(selected)) : null
    const selVal = selected >= 0 ? values[selected] : 0
    for (let i = 0; i < cells; i++) {
      const c = cellEls[i]
      c.classList.toggle('sel', i === selected)
      c.classList.toggle('peer', peerSet?.has(i) ?? false)
      c.classList.toggle('same', selVal > 0 && values[i] === selVal && i !== selected)
      const v = values[i]
      if (v) {
        c.classList.toggle('err', !given[i] && v !== solution[i])
        c.classList.toggle('ok', !given[i] && v === solution[i])
        c.innerHTML = `${label(i)}<span class="v">${v}</span>`
      } else {
        c.classList.remove('err', 'ok')
        const ns = notes[i]
        c.innerHTML = label(i) + (ns.size
          ? `<span class="notes">${Array.from({ length: opts.notesMax }, (_, k) => `<i>${ns.has(k + 1) ? k + 1 : ''}</i>`).join('')}</span>`
          : '')
      }
    }
  }

  function checkWin(): void {
    for (let i = 0; i < cells; i++) if (values[i] !== solution[i]) return
    finished = true
    sfx('win')
    cb.onWin()
  }

  chrome.register({
    restart: () => makeNumberGame(chrome, cb, optsFn),
    debugWin: () => {
      for (let i = 0; i < cells; i++) values[i] = solution[i]
      checkWin()
    },
  })
  paint()
}

function cageTop(cages: KillerPuzzle, i: number): boolean {
  const cage = cages.cages[i]
  for (let k = 0; k < i; k++) if (cages.cages[k] === cage) return false
  return true
}

/* ================= 星之战 ================= */

function makeStarGame(chrome: Chrome, cb: GameCallbacks, spec: { kind: 'star'; W: number; K: number }): void {
  let data: StarPuzzle
  try { data = genStarBattle(spec.W, spec.K) } catch { data = genStarBattle(8, 2) }
  const W = data.W, K = data.K
  const regions = data.regions
  const solution = new Set(data.solution)
  const cells = W * W
  const state = new Array<number>(cells).fill(0) // 0空 1星 2排除
  let hints = 1
  let finished = false

  chrome.body.innerHTML = ''
  chrome.setInfo(`<span class="star-rule">每行/列/区域 ${K} ⭐ · 互不相邻</span>`)

  const bd = el('div', 'star-board regions')
  bd.style.setProperty('--n', String(W))
  bd.style.setProperty('--w', String(W))
  const cellEls: HTMLElement[] = []
  for (let i = 0; i < cells; i++) {
    const c = el('div', 'scell')
    c.style.background = REGION_COLORS[regions[i] % REGION_COLORS.length]
    const r = Math.floor(i / W), col = i % W
    if (col < W - 1 && regions[i + 1] !== regions[i]) c.classList.add('rg-r')
    if (r < W - 1 && regions[i + W] !== regions[i]) c.classList.add('rg-b')
    c.onclick = () => {
      if (finished) return
      state[i] = (state[i] + 1) % 3
      sfx('tick')
      paint()
      checkWin()
    }
    bd.appendChild(c)
    cellEls.push(c)
  }
  chrome.body.appendChild(bd)
  chrome.body.classList.toggle('scrollable', W >= 12)

  const tools = el('div', 'tools')
  const clearBtn = el('button', 'tool-btn', '🧹 清空')
  clearBtn.onclick = () => { state.fill(0); sfx('tap'); paint() }
  const hintBtn = el('button', 'tool-btn gold', '💡 提示')
  const refreshHintBtn = (): void => { hintBtn.textContent = hints > 0 ? '💡 提示 ×1' : '📺 提示' }
  hintBtn.onclick = () => {
    if (hints <= 0) {
      void import('./ui').then(u => u.showAdModal('放置 1 颗正确星星', () => { hints++; refreshHintBtn(); toast('💡 提示 +1') }))
      return
    }
    for (const i of solution) {
      if (state[i] !== 1) {
        state[i] = 1
        hints--
        refreshHintBtn()
        sfx('piece')
        paint()
        checkWin()
        return
      }
    }
  }
  tools.append(clearBtn, hintBtn)
  chrome.foot.appendChild(tools)

  function conflicts(): Set<number> {
    const bad = new Set<number>()
    const stars: number[] = []
    for (let i = 0; i < cells; i++) if (state[i] === 1) stars.push(i)
    const rowCount = new Array<number>(W).fill(0)
    const colCount = new Array<number>(W).fill(0)
    const regCount = new Array<number>(W).fill(0)
    for (const i of stars) {
      rowCount[Math.floor(i / W)]++
      colCount[i % W]++
      regCount[regions[i]]++
    }
    for (const i of stars) {
      if (rowCount[Math.floor(i / W)] > K || colCount[i % W] > K || regCount[regions[i]] > K) bad.add(i)
    }
    for (let a = 0; a < stars.length; a++) for (let b = a + 1; b < stars.length; b++) {
      if (neighbors8(W, W, stars[a]).includes(stars[b])) { bad.add(stars[a]); bad.add(stars[b]) }
    }
    return bad
  }

  function paint(): void {
    const bad = conflicts()
    for (let i = 0; i < cells; i++) {
      const c = cellEls[i]
      c.classList.toggle('conf', bad.has(i))
      c.textContent = state[i] === 1 ? '⭐' : state[i] === 2 ? '✕' : ''
    }
  }

  function checkWin(): void {
    if (finished) return
    if (conflicts().size) return
    const rowCount = new Array<number>(W).fill(0)
    for (let i = 0; i < cells; i++) if (state[i] === 1) rowCount[Math.floor(i / W)]++
    if (rowCount.some(n => n !== K)) return
    finished = true
    sfx('win')
    cb.onWin()
  }

  chrome.register({
    restart: () => makeStarGame(chrome, cb, spec),
    debugWin: () => {
      for (const i of solution) state[i] = 1
      checkWin()
    },
  })
  paint()
}

/* ================= 扫雷 ================= */

function makeMinesGame(chrome: Chrome, cb: GameCallbacks, spec: { kind: 'mines'; W: number; H: number; mines: number }): void {
  const { W, H, mines: M } = spec
  const cells = W * H
  let board: ReturnType<typeof genMines> | null = null
  let started = false
  let flagMode = false
  let finished = false
  const revealed = new Array<boolean>(cells).fill(false)
  const flags = new Array<boolean>(cells).fill(false)

  chrome.body.innerHTML = ''
  chrome.setInfo(`<span class="m-count">💣 ${M}</span>`)

  const bd = el('div', 'm-board')
  bd.style.setProperty('--w', String(W))
  bd.classList.toggle('tiny', W >= 16)
  const cellEls: HTMLElement[] = []
  for (let i = 0; i < cells; i++) {
    const c = el('div', 'mcell')
    c.oncontextmenu = (e) => { e.preventDefault(); toggleFlag(i) }
    c.onclick = () => tap(i)
    bd.appendChild(c)
    cellEls.push(c)
  }
  chrome.body.appendChild(bd)

  const tools = el('div', 'tools')
  const flagBtn = el('button', 'tool-btn', '🚩 插旗模式')
  flagBtn.onclick = () => { flagMode = !flagMode; flagBtn.classList.toggle('on', flagMode); sfx('tap') }
  tools.append(flagBtn)
  chrome.foot.appendChild(tools)

  function tap(i: number): void {
    if (finished) return
    if (flagMode) { toggleFlag(i); return }
    if (flags[i] || revealed[i]) return
    if (!started) {
      board = genMines(W, H, M, i)
      started = true
    }
    if (board!.mines[i]) {
      finished = true
      sfx('boom')
      for (let k = 0; k < cells; k++) {
        if (board!.mines[k]) { cellEls[k].classList.add('boom'); cellEls[k].textContent = '💣' }
      }
      cellEls[i].classList.add('hit')
      setTimeout(() => cb.onFail(), 650)
      return
    }
    flood(i)
    sfx('tick')
    paint()
    checkWin()
  }

  function toggleFlag(i: number): void {
    if (finished || revealed[i]) return
    flags[i] = !flags[i]
    sfx('tick')
    paint()
  }

  function flood(i: number): void {
    if (revealed[i] || flags[i]) return
    revealed[i] = true
    if (board!.nums[i] !== 0) return
    const r = Math.floor(i / W), c = i % W
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue
      const nr = r + dr, nc = c + dc
      if (nr >= 0 && nr < H && nc >= 0 && nc < W) flood(nr * W + nc)
    }
  }

  function paint(): void {
    for (let i = 0; i < cells; i++) {
      const c = cellEls[i]
      const n = board?.nums[i] ?? 0
      if (revealed[i]) {
        c.className = `mcell open${n ? ` mn${n}` : ''}`
        c.textContent = n ? String(n) : ''
      } else {
        c.className = `mcell${flags[i] ? ' flag' : ''}`
        c.textContent = flags[i] ? '🚩' : ''
      }
    }
    const left = M - flags.filter(Boolean).length
    const mc = chrome.root.querySelector('.m-count')
    if (mc) mc.textContent = `💣 ${left}`
  }

  function checkWin(): void {
    let opened = 0
    for (let i = 0; i < cells; i++) if (revealed[i]) opened++
    if (opened === cells - M) {
      finished = true
      sfx('win')
      cb.onWin()
    }
  }

  chrome.register({
    restart: () => makeMinesGame(chrome, cb, spec),
    debugWin: () => {
      if (!board) board = genMines(W, H, M, 0)
      for (let i = 0; i < cells; i++) if (!board.mines[i]) revealed[i] = true
      checkWin()
    },
  })
  paint()
}
