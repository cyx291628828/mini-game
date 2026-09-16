/* 棋盘场景：大富翁轨道渲染、掷骰、移动动画、落格触发、章节之门 */
import { el, q, toast, floatText, pulse } from './core/fx'
import { sfx } from './core/audio'
import * as meta from './core/meta'
import { persist } from './core/save'
import { chapterTheme } from './core/pictures'
import { ART_BOARDS, type ArtBoard } from './core/boardArt'
import {
  renderHUD, updateHUD, openDifficulty, freeplayPanel, showAdModal, wheelPanel,
  chapterIntro, gateCeremony, endingScreen,
} from './ui'
import { launchGame, type GameHandle } from './games'

const randInt = (a: number, b: number): number => a + Math.floor(Math.random() * (b - a + 1))
const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms))

const TYPE_ICON: Record<string, string> = { '起点格': '🏁', '金币格': '💰', '骰子格': '🎲', '事件格': '❓' }
const GAME_EMOJI: Record<string, string> = { '数独': '🔢', '扫雷': '💣', '数方': '🟩', '星之战': '⭐', '杀手数独': '🎯' }

function tileIcon(node: { type: string; game: string }): string {
  if (node.type === '玩法格' && node.game) return GAME_EMOJI[node.game] ?? '🎮'
  return TYPE_ICON[node.type] ?? '🎮'
}

let busy = false
let currentGame: GameHandle | null = null

/* ---------- 渲染 ---------- */

export function renderBoard(): void {
  const s = meta.getSave()
  const art = ART_BOARDS[s.chapter]
  if (art) renderArtBoard(art)
  else renderGridBoard()
  positionToken(false)
  markCurrentTile()
}

/** 美术棋盘模式（换肤）：图上的元素就是界面——格子承载状态、图内按钮即真实按钮、数值写进图的资源框 */
let artUnit: (() => void) | null = null
function renderArtBoard(art: ArtBoard): void {
  const s = meta.getSave()
  const nodes = meta.trackNodes()
  q('#hud').style.display = 'none'
  q('#bottom-bar').style.display = 'none'
  q('#board').style.display = 'none'
  q('#chapter-banner').style.display = 'none'
  const wrap = q('#board-wrap')
  wrap.className = 'art-mode'
  wrap.querySelector('.stage')?.remove()
  const stage = el('div', 'stage')
  stage.style.aspectRatio = `${art.w} / ${art.h}`
  const bg = el('img', 'stage-bg') as HTMLImageElement
  bg.src = art.src
  bg.alt = ''
  stage.appendChild(bg)
  const pc = (v: number, total: number): string => `${(v / total) * 100}%`

  // 设计像素单位（字号/描边随舞台缩放）
  artUnit = (): void => stage.style.setProperty('--u', `${stage.getBoundingClientRect().width / art.w}px`)

  // 轨道贴点：透明热区 + 状态（点亮/当前位置）+ 类型小图标，尺寸与图中格子完全一致
  const layer = el('div', 'art-layer')
  nodes.forEach((node, k) => {
    const t0 = art.tiles[k]
    if (!t0) return
    const t = el('div', `tile skin-tile t-${node.type}${s.lit[`${s.chapter}:${node.idx}`] ? ' lit' : ''}`)
    t.dataset.idx = String(node.idx)
    t.style.left = pc(t0.x - t0.w / 2, art.w)
    t.style.top = pc(t0.y - t0.h / 2, art.h)
    t.style.width = pc(t0.w, art.w)
    t.style.height = pc(t0.h, art.h)
    t.innerHTML = `${t0.sprite ? `<img class="slot-sprite" src="${t0.sprite}" alt="">` : ''}<span class="tile-ic" style="font-size:calc(var(--u,1px) * ${Math.round(t0.h * 0.5)})">${tileIcon(node)}</span>`
    layer.appendChild(t)
  })
  stage.appendChild(layer)

  // 棋子
  const token = el('div', 'token', '😀')
  token.id = 'token'
  stage.appendChild(token)

  // 数值写进图的资源框（补丁 + 动态文字）
  for (const t of art.texts) {
    const p = el('div', 'skin-num')
    p.style.left = pc(t.rect.x, art.w)
    p.style.top = pc(t.rect.y, art.h)
    p.style.width = pc(t.rect.w, art.w)
    p.style.height = pc(t.rect.h, art.h)
    p.style.background = t.rect.patch
    p.style.fontSize = `calc(var(--u,1px) * ${Math.round(t.rect.h * 0.62)})`
    p.innerHTML = `${t.prefix ?? ''}<span data-bind="${t.bind}"></span>`
    stage.appendChild(p)
  }

  // 骰子按钮（图上裁出的贴片 = 真实按钮，带按压反馈）
  const dice = el('button', 'skin-hot')
  dice.id = 'skin-dice'
  if (art.dice.sprite) dice.innerHTML = `<img class="skin-dice-img" src="${art.dice.sprite}" alt="">`
  dice.style.left = pc(art.dice.x, art.w)
  dice.style.top = pc(art.dice.y, art.h)
  dice.style.width = pc(art.dice.w, art.w)
  dice.style.height = pc(art.dice.h, art.h)
  dice.onclick = () => void doRoll()
  stage.appendChild(dice)

  // 功能热区（图上的背包/地产/地图/齿轮）
  const act = (a: string): void => {
    sfx('open')
    if (a === 'free') freeplayPanel(g => openDifficulty({ game: g, free: true, onPick: diff => enterGameFlow(g, diff, true) }))
    else if (a === 'gallery') void import('./ui').then(u => u.galleryPage())
    else void import('./ui').then(u => u.settingsPanel())
  }
  for (const h of art.hotspots) {
    const b = el('button', 'skin-hot')
    b.style.left = pc(h.rect.x, art.w)
    b.style.top = pc(h.rect.y, art.h)
    b.style.width = pc(h.rect.w, art.w)
    b.style.height = pc(h.rect.h, art.h)
    b.onclick = () => act(h.action)
    stage.appendChild(b)
  }

  wrap.appendChild(stage)
  artUnit()
  updateHUD()
}

/** 经典网格模式（无美术图的章节） */
function renderGridBoard(): void {
  const s = meta.getSave()
  const nodes = meta.trackNodes()
  const N = nodes.length
  const cols = 6
  const rows = Math.ceil(N / cols)
  q('#hud').style.display = ''
  q('#bottom-bar').style.display = ''
  q('#board').style.display = ''
  q('#chapter-banner').style.display = ''
  q('#board-wrap').querySelector('.stage')?.remove()
  const board = q('#board')
  board.innerHTML = ''
  board.style.setProperty('--cols', String(cols))

  const theme = chapterTheme(s.chapter).theme
  q('#board-wrap').className = `theme-${theme}`
  q('#chapter-banner').textContent = meta.chapterName()

  const idxAt = (vr: number, col: number): number => {
    const r0 = rows - 1 - vr
    const c = r0 % 2 === 1 ? cols - 1 - col : col
    return r0 * cols + c + 1
  }

  for (let vr = 0; vr < rows; vr++) {
    for (let col = 0; col < cols; col++) {
      const idx = idxAt(vr, col)
      if (idx > N) { board.appendChild(el('div', 'tile spacer')); continue }
      const node = nodes[idx - 1]
      const t = el('div', 'tile')
      t.dataset.idx = String(idx)
      if (node.type === '玩法格' && node.game) {
        t.classList.add('t-game')
        t.innerHTML = `<span class="tile-idx">${idx}</span><span class="tile-ic">${GAME_EMOJI[node.game] ?? '🎮'}</span><span class="tile-name">${node.game}</span>`
      } else {
        t.classList.add(`t-${node.type}`)
        t.innerHTML = `<span class="tile-idx">${idx}</span><span class="tile-ic">${TYPE_ICON[node.type] ?? '🎮'}</span>`
      }
      if (s.lit[`${s.chapter}:${idx}`]) t.classList.add('lit')
      board.appendChild(t)
    }
  }

  const token = el('div', 'token', '😀')
  token.id = 'token'
  board.appendChild(token)

  renderBottomBar()
}

function tileEl(idx: number): HTMLElement | null {
  return document.querySelector(`#board .tile[data-idx="${idx}"], .art-layer .tile[data-idx="${idx}"]`)
}

function markCurrentTile(): void {
  document.querySelectorAll('.tile.cur').forEach(e => e.classList.remove('cur'))
  tileEl(meta.getSave().pos)?.classList.add('cur')
}

function positionToken(animate: boolean): void {
  const token = q<HTMLElement>('#token')
  const tile = tileEl(meta.getSave().pos)
  if (!tile || !token) return
  if (!animate) token.style.transition = 'none'
  const w = tile.offsetWidth
  token.style.left = `${tile.offsetLeft + w / 2}px`
  token.style.top = `${tile.offsetTop + tile.offsetHeight / 2}px`
  if (!animate) { void token.offsetWidth; token.style.transition = '' }
}

export function refreshBoard(): void {
  renderBoard()
  updateHUD()
}

/* ---------- 底栏 ---------- */

function renderBottomBar(): void {
  const bar = q('#bottom-bar')
  bar.innerHTML = ''
  const s = meta.getSave()

  const diceBtn = el('button', 'dice-btn', `<span class="dice-face">🎲</span><span class="dice-cap">掷骰子</span>`)
  diceBtn.onclick = () => void doRoll()
  if (s.dice <= 0) diceBtn.querySelector('.dice-cap')!.textContent = '看广告 +🎲'
  bar.appendChild(diceBtn)

  const free = el('button', 'side-btn', `🛠<span>自由练习</span>`)
  free.onclick = () => {
    if (busy) return
    sfx('open')
    freeplayPanel(g => openDifficulty({ game: g, free: true, onPick: diff => enterGameFlow(g, diff, true) }))
  }
  bar.appendChild(free)

  const gal = el('button', 'side-btn', `🖼<span>拼图馆</span>`)
  gal.onclick = () => { sfx('open'); import('./ui').then(u => u.galleryPage()) }
  bar.appendChild(gal)
}

/* ---------- 掷骰与移动 ---------- */

async function doRoll(): Promise<void> {
  const save = meta.getSave()
  if (busy) return
  if (save.finished) { toast('🏆 章节已全部通关，去自由练习吧！'); return }
  if (save.dice <= 0) { offerDiceAd(); return }
  busy = true
  save.dice--
  persist(save)
  updateHUD()

  const n = randInt(1, 6)
  const gridBtn = document.querySelector('#bottom-bar .dice-btn') as HTMLElement | null
  const gridFace = document.querySelector('#bottom-bar .dice-face') as HTMLElement | null
  const skinDice = document.getElementById('skin-dice')
  sfx('roll')
  if (gridBtn && gridFace) {
    gridBtn.classList.add('rolling')
    const spin = setInterval(() => { gridFace.textContent = String(randInt(1, 6)) }, 80)
    await sleep(680)
    clearInterval(spin)
    gridFace.textContent = String(n)
    gridBtn.classList.remove('rolling')
  } else if (skinDice) {
    const shake = skinDice.animate([
      { transform: 'rotate(0deg) scale(1)' },
      { transform: 'rotate(-7deg) scale(1.04)' },
      { transform: 'rotate(6deg) scale(1.05)' },
      { transform: 'rotate(-4deg) scale(1.02)' },
      { transform: 'rotate(0deg) scale(1)' },
    ], { duration: 680 })
    await shake.finished.catch(() => {})
  } else {
    await sleep(400)
  }
  if (skinDice) {
    pulse(skinDice, 'skin-press')
    const r = skinDice.getBoundingClientRect()
    floatText(r.left + r.width / 2, r.top + r.height * 0.06, String(n))
  }

  const res = meta.roll(n)
  try {
    await animatePath(res)
    if (res.crossedEnd) {
      await sleep(420)
      onCrossEnd()
      return
    }
    await handleTile()
  } finally {
    busy = false
  }
}

async function animatePath(res: meta.MoveResult): Promise<void> {
  let supplies = res.supplies
  for (const pos of res.path) {
    meta.getSave().pos = pos
    positionToken(true)
    markCurrentTile()
    const tile = tileEl(pos)
    if (tile) pulse(tile, 'step-pulse')
    sfx('hop')
    if (pos === 1 && supplies > 0) {
      supplies--
      floatText(window.innerWidth / 2 - 20, window.innerHeight * 0.35, '🏁 补给 +🪙')
      updateHUD()
    }
    await sleep(175)
    if (res.bounces.includes(pos)) {
      toast('🧩 拼图未集齐 · 回走！', 1200)
      const t2 = tileEl(pos)
      if (t2) pulse(t2, 'bounce-flash')
      sfx('tick')
      await sleep(240)
    }
  }
  persist(meta.getSave())
}

/* ---------- 落格触发 ---------- */

async function handleTile(): Promise<void> {
  const save = meta.getSave()
  const node = meta.trackNodes()[save.pos - 1]
  if (!node) { busy = false; return }
  const tile = tileEl(save.pos)
  const tilePos = (): { x: number; y: number } => {
    const r = (tile ?? q('#board')).getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top }
  }
  switch (node.type) {
    case '玩法格': {
      if (!node.game) return
      openDifficulty({ game: node.game, onPick: diff => enterGameFlow(node.game, diff, false) })
      break
    }
    case '金币格': {
      let amount = meta.getConfig().params['金币格金额'] ?? 30
      if (meta.consumeDoubleFlag()) { amount *= 2; toast('✨ 双倍！') }
      meta.addCoins(amount)
      sfx('coin')
      const { x, y } = tilePos()
      floatText(x, y, `+${amount} 🪙`)
      updateHUD()
      break
    }
    case '骰子格': {
      meta.addDice(1)
      sfx('coin')
      const { x, y } = tilePos()
      floatText(x, y, '+1 🎲')
      updateHUD()
      renderBottomBar()
      break
    }
    case '事件格': {
      await resolveEvent(node.param)
      break
    }
    case '起点格': {
      meta.addCoins(meta.getConfig().params['起点经过补给'] ?? 10)
      sfx('coin')
      updateHUD()
      break
    }
    default: busy = false
  }
}

async function resolveEvent(param: string): Promise<void> {
  if (param.includes('幸运转盘')) {
    wheelPanel(prize => {
      switch (prize.kind) {
        case 'coin30': meta.addCoins(30); break
        case 'coin60': meta.addCoins(60); break
        case 'coin15': meta.addCoins(15); break
        case 'dice': meta.addDice(1); break
        case 'double': meta.setDoubleNext(); toast('✨ 下一格奖励双倍！'); break
        case 'piece': {
          const got = meta.grantExtraPiece(false)
          if (got >= 0) { sfx('piece'); toast('🧩 获得缺失碎片！'); updateHUD() }
          else { meta.addCoins(meta.PIECE_TO_COINS); toast('碎片已满 → 🪙+20') }
          break
        }
      }
      updateHUD()
      busy = false
    })
    return
  }
  if (param.includes('双倍')) {
    meta.setDoubleNext()
    toast('✨ 下一格奖励双倍！')
    busy = false
    return
  }
  if (param.includes('传送')) {
    const m = param.match(/传送\s*(-?\d+)\s*～\s*\+?(\d+)/)
    const lo = m ? parseInt(m[1], 10) : -2
    const hi = m ? parseInt(m[2], 10) : 3
    const delta = randInt(lo, hi)
    toast(`🌀 传送 ${delta > 0 ? '前进' : '后退'} ${Math.abs(delta)} 格`)
    const res = meta.teleport(delta)
    await animatePath(res)
    if (res.crossedEnd) { await sleep(350); onCrossEnd(); return }
    busy = false
    await handleTile()
    return
  }
  busy = false
}

/* ---------- 广告：补骰子 ---------- */

function offerDiceAd(): void {
  if (!meta.canDiceAd()) { toast('今日广告次数已用完，明天再来～'); return }
  sfx('open')
  showAdModal(`骰子 +${meta.getConfig().params['视频补骰子数量'] ?? 3}`, () => {
    meta.grantDiceAd()
    updateHUD()
    renderBottomBar()
    toast('🎲 骰子补充完毕！')
  })
}

/* ---------- 章节之门 ---------- */

function onCrossEnd(): void {
  const ch = meta.getSave().chapter
  gateCeremony(ch, () => {
    const r = meta.enterNextChapter()
    renderBoard()
    updateHUD()
    if (r.finished) endingScreen()
    else chapterIntro(meta.getSave().chapter, () => refreshBoard())
  })
}

/* ---------- 进入玩法 ---------- */

export function enterGameFlow(game: string, diff: string, free: boolean): void {
  busy = true
  q('#screen-board').classList.add('hidden')
  const gs = q('#screen-game')
  gs.classList.remove('hidden')

  const settleAndReport = (win: boolean): void => {
    if (win) {
      const br = meta.settleWin(game, diff, free)
      void import('./ui').then(u => u.showResult({ ...br, free }, {
        onContinue: () => backToBoard(),
        onDouble: br.win && !free ? () => { meta.addCoins(br.coinsGain); updateHUD(); toast('🪙 金币翻倍！') } : undefined,
      }))
    } else {
      const coins = meta.settleFail(game, diff)
      void import('./ui').then(u => u.showResult({
        win: false, game, diff, coinsGain: coins, firstLit: false, doubled: false,
        piecesGained: [], convCoins: 0, pityUsed: false, diceGain: 0, gateOpened: false, free,
      }, {
        onContinue: () => backToBoard(),
        onRetry: () => currentGame?.restart(),
      }))
    }
  }

  currentGame = launchGame(gs, game, diff, free, {
    onWin: () => settleAndReport(true),
    onFail: () => settleAndReport(false),
    onExit: () => backToBoard(),
  })
}

export function enterFreePlay(game: string): void {
  openDifficulty({ game, free: true, onPick: diff => enterGameFlow(game, diff, true) })
}

/** 调试：直接通关当前玩法 */
export function debugWinNow(): void {
  currentGame?.debugWin()
}

export function backToBoard(): void {
  q('#screen-game').classList.add('hidden')
  q('#screen-game').innerHTML = ''
  currentGame = null
  q('#screen-board').classList.remove('hidden')
  refreshBoard()
  busy = false
}

window.addEventListener('resize', () => {
  const token = document.getElementById('token')
  if (token) positionToken(false)
  artUnit?.()
})

/* type-only re-export to keep MoveResult in this module's public API */
export type { MoveResult } from './core/meta'
