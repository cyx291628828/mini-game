/* HUD 与全部浮层面板：难度选择、结算、拼图页、拼图馆、设置、成就、自由练习、广告占位、转盘、章节过场 */
import { el, q, toast, floatText, flyIcon, confetti, countUp, pulse, centerRect } from './core/fx'
import { sfx } from './core/audio'
import * as meta from './core/meta'
import { getSave } from './core/meta'
import { persist } from './core/save'
import { chapterPicture, chapterTheme } from './core/pictures'
import { DIFFS } from './core/config'
import type { TrackNode } from './core/config'

export const GAME_EMOJI: Record<string, string> = { '数独': '🔢', '扫雷': '💣', '数方': '🟩', '星之战': '⭐', '杀手数独': '🎯' }
const DIFF_CLS: Record<string, string> = { '简单': 'd-easy', '中等': 'd-med', '困难': 'd-hard', '专家': 'd-expert' }

/* ---------- 浮层管理 ---------- */

export interface OverlayHandle { close(): void; box: HTMLElement }

export function openOverlay(build: (box: HTMLElement, h: OverlayHandle) => void, opts: { cls?: string; closable?: boolean } = {}): OverlayHandle {
  const root = q('#overlay-root')
  const ov = el('div', `overlay ${opts.cls ?? ''}`)
  const box = el('div', 'panel')
  ov.appendChild(box)
  root.appendChild(ov)
  requestAnimationFrame(() => ov.classList.add('show'))
  const h: OverlayHandle = {
    box,
    close(): void {
      ov.classList.remove('show')
      setTimeout(() => ov.remove(), 260)
    },
  }
  if (opts.closable !== false) {
    ov.addEventListener('click', e => { if (e.target === ov) { sfx('tap'); h.close() } })
  }
  build(box, h)
  return h
}

/* ---------- HUD ---------- */

let hudRefs: { coins?: HTMLElement; dice?: HTMLElement; piece?: HTMLElement } = {}

export function renderHUD(container: HTMLElement): void {
  container.innerHTML = ''
  const s = getSave()
  const menu = el('button', 'hud-btn', '☰')
  menu.onclick = () => { sfx('open'); settingsPanel() }
  const chap = el('div', 'hud-chip chapter', meta.chapterName())
  const coins = el('div', 'hud-chip', `🪙 <b>${s.coins}</b>`)
  const dice = el('div', 'hud-chip', `🎲 <b>${s.dice}</b>`)
  const piece = el('div', 'hud-chip piece-chip')
  piece.onclick = () => { sfx('open'); puzzlePage() }
  hudRefs = { coins, dice, piece }
  container.append(menu, chap, coins, dice, piece)
  updatePieceChip()
}

export function updateHUD(): void {
  const s = getSave()
  if (hudRefs.coins) hudRefs.coins.innerHTML = `🪙 <b>${s.coins}</b>`
  if (hudRefs.dice) hudRefs.dice.innerHTML = `🎲 <b>${s.dice}</b>`
  const chap = document.querySelector('.hud-chip.chapter')
  if (chap) chap.textContent = meta.chapterName()
  updatePieceChip()
  // 换肤模式的数值位（美术图上的动态文字）
  const pieceText = s.finished ? '' : `${meta.piecesOf(meta.gateFor().picId).length}/${meta.gateFor().need}`
  document.querySelectorAll<HTMLElement>('[data-bind]').forEach(e => {
    const k = e.getAttribute('data-bind')
    if (k === 'coins') e.textContent = String(s.coins)
    else if (k === 'dice') e.textContent = String(s.dice)
    else if (k === 'pieces') e.textContent = pieceText
  })
}

function updatePieceChip(): void {
  const piece = hudRefs.piece
  if (!piece) return
  const s = getSave()
  if (s.finished) { piece.innerHTML = `🏆` ; return }
  const g = meta.gateFor()
  const have = meta.piecesOf(g.picId).length
  piece.innerHTML = `🧩 <b>${have}/${g.need}</b>`
  piece.classList.toggle('ready', have >= g.need)
}

export function hudChipRef(k: 'coins' | 'dice' | 'piece'): HTMLElement | undefined { return hudRefs[k] }

/* ---------- 广告占位 ---------- */

export function showAdModal(rewardText: string, onReward: () => void): void {
  openOverlay((box, h) => {
    box.classList.add('ad-box')
    box.innerHTML = `
      <button class="close-x" title="跳过">✕</button>
      <div class="ad-tag">激励视频 · 广告位占位</div>
      <div class="ad-screen"><div class="ad-play">▶</div><div class="ad-txt">${rewardText}</div></div>
      <div class="ad-count">3</div>
      <button class="btn primary big" disabled>领取奖励</button>`
    const btn = box.querySelector<HTMLButtonElement>('.btn')!
    const closeBtn = box.querySelector<HTMLButtonElement>('.close-x')!
    let left = 3
    const timer = setInterval(() => {
      left--
      const cd = box.querySelector('.ad-count')
      if (cd) cd.textContent = String(left)
      sfx('tick')
      if (left <= 0) {
        clearInterval(timer)
        btn.disabled = false
        btn.textContent = '领取奖励 ✓'
        const x = box.querySelector('.ad-count')
        if (x) x.remove()
      }
    }, 1000)
    btn.onclick = () => {
      clearInterval(timer)
      sfx('coin')
      h.close()
      onReward()
    }
    closeBtn.onclick = () => { clearInterval(timer); sfx('tap'); h.close() }
  }, { cls: 'overlay-ad', closable: false })
}

/* ---------- 难度选择面板 ---------- */

export function openDifficulty(opts: {
  game: string
  free?: boolean
  onPick: (diff: string) => void
}): void {
  const { game } = opts
  openOverlay((box, h) => {
    box.classList.add('sheet')
    const head = el('div', 'sheet-head')
    head.innerHTML = `<div class="sheet-title">${GAME_EMOJI[game] ?? '🎮'} ${game}</div><div class="sheet-sub">选择难度 · 奖励不同</div>`
    box.appendChild(head)
    for (const diff of DIFFS) {
      const row = meta.getConfig().rewards.get(`${game}|${diff}`)
      if (!row) continue
      const card = el('button', `diff-card ${DIFF_CLS[diff]}`)
      const pieceTxt = opts.free ? '' : ` · 🧩 ${row.pieces > 0 ? `必得${row.pieces}片` : `掉率${row.pieceChance}%`}`
      card.innerHTML = `
        <div class="dc-left"><span class="dc-badge">${diff}</span><span class="dc-spec">${row.spec}</span></div>
        <div class="dc-right"><span class="dc-coin">🪙 +${row.coins}${row.firstClearCoins ? `<i>(首通+${row.firstClearCoins})</i>` : ''}</span>
        <span class="dc-extra">${row.dice ? `🎲+${row.dice}` : ''}${pieceTxt}${row.failCoins ? ` · 失败补偿 🪙${row.failCoins}` : ''}</span></div>`
      card.onclick = () => {
        sfx('tap')
        h.close()
        opts.onPick(diff)
      }
      box.appendChild(card)
    }
  })
}

/* ---------- 结算面板 ---------- */

export function showResult(br: {
  win: boolean
  game: string; diff: string
  coinsGain: number; firstLit: boolean; doubled: boolean
  piecesGained: number[]; convCoins: number; pityUsed: boolean
  diceGain: number
  gateOpened: boolean
  free?: boolean
}, cb: { onContinue: () => void; onDouble?: () => void; onRetry?: () => void }): void {
  updateHUD()
  openOverlay((box, h) => {
    box.classList.add('result-box')
    if (br.win) {
      confetti(getSave().settings.reduceMotion ? 20 : 90)
      sfx('win')
    } else sfx('fail')
    const title = br.win
      ? `<div class="r-emoji">🎉</div><div class="r-title">挑战成功！</div>`
      : `<div class="r-emoji">😵</div><div class="r-title">挑战失败</div>`
    box.innerHTML = `${title}
      <div class="r-sub">${GAME_EMOJI[br.game] ?? ''} ${br.game} · ${br.diff}${br.free ? ' · 自由练习' : ''}</div>
      <div class="r-rewards"></div>
      <div class="r-badges"></div>
      <div class="r-btns"></div>`
    const rewards = box.querySelector('.r-rewards')!
    const badges = box.querySelector('.r-badges')!
    const btns = box.querySelector('.r-btns')!

    if (br.win) {
      const coinRow = el('div', 'r-row', `<span class="r-ic">🪙</span><b class="r-num">0</b>`)
      rewards.appendChild(coinRow)
      if (br.piecesGained.length) {
        const pr = el('div', 'r-row', `<span class="r-ic">🧩</span><b>+${br.piecesGained.length} 片碎片</b>`)
        rewards.appendChild(pr)
      }
      if (br.convCoins) rewards.appendChild(el('div', 'r-row dim', `<span class="r-ic">🧩</span><b>碎片溢出 → 🪙+${br.convCoins}</b>`))
      if (br.diceGain) rewards.appendChild(el('div', 'r-row', `<span class="r-ic">🎲</span><b>+${br.diceGain}</b>`))
      if (br.firstLit) badges.appendChild(el('span', 'badge gold', '✨ 首通点亮'))
      if (br.pityUsed) badges.appendChild(el('span', 'badge blue', '🎁 碎片保底'))
      if (br.doubled) badges.appendChild(el('span', 'badge purple', '✖️ 双倍奖励'))
      const numEl = coinRow.querySelector('.r-num')!
      setTimeout(async () => {
        await countUp(numEl as HTMLElement, br.coinsGain)
        const chip = hudChipRef('coins')
        if (chip) {
          void flyIcon(centerRect(numEl as HTMLElement), centerRect(chip), '🪙', 3)
          setTimeout(() => pulse(chip), 600)
        }
        if (br.piecesGained.length) {
          const pchip = hudChipRef('piece')
          if (pchip) void flyIcon(centerRect(rewards as HTMLElement), centerRect(pchip), '🧩', Math.min(br.piecesGained.length, 5), undefined, 800)
        }
        sfx('coin')
        updateHUD()
      }, 250)
      if (cb.onDouble && !br.doubled && !br.free) {
        const db = el('button', 'btn gold', '📺 看广告 · 金币×2')
        db.onclick = () => { sfx('tap'); showAdModal('本局金币奖励 ×2', () => { cb.onDouble!(); h.close() }) }
        btns.appendChild(db)
      }
      const cont = el('button', 'btn primary big', '继续')
      cont.onclick = () => { sfx('tap'); h.close(); cb.onContinue() }
      btns.appendChild(cont)
    } else {
      rewards.appendChild(el('div', 'r-row dim', `<span class="r-ic">🪙</span><b>安慰奖 +${br.coinsGain}</b>`))
      if (cb.onRetry) {
        const rb = el('button', 'btn gold big', '📺 看广告 · 原地重试')
        rb.onclick = () => { sfx('tap'); showAdModal('原地重试本关', () => { cb.onRetry!(); h.close() }) }
        btns.appendChild(rb)
      }
      const back = el('button', 'btn ghost', '返回棋盘')
      back.onclick = () => { sfx('tap'); h.close(); cb.onContinue() }
      btns.appendChild(back)
    }

    if (br.win && br.gateOpened) {
      setTimeout(() => toast('🧩 拼图集齐！章节之门已开启，向前冲！', 2600), 900)
    }
  }, { cls: 'overlay-result', closable: false })
}

/* ---------- 拼图页（门禁拼图收集） ---------- */

export function puzzlePage(): void {
  const s = getSave()
  if (s.finished) { toast('🏆 已全部通关，去拼图馆欣赏藏品吧'); galleryPage(); return }
  const gate = meta.gateFor()
  const targetCh = s.chapter + 1
  const need = gate.need
  const cols = need <= 9 ? 3 : need <= 12 ? 4 : 4
  const rows = Math.ceil(need / cols)
  const img = chapterPicture(targetCh)
  openOverlay((box) => {
    box.classList.add('big-sheet')
    box.innerHTML = `
      <div class="pp-head"><div class="sheet-title">🧩 拼图之门</div>
      <div class="sheet-sub">集齐碎片，拼出「${chapterTheme(targetCh).name}」之门</div></div>
      <div class="pp-progress"><b>${meta.piecesOf(gate.picId).length}</b> / ${need} 片${s.locked ? '' : ' · ✅ 已拼合'}</div>
      <div class="pp-grid" style="--cols:${cols};--rows:${rows}"></div>
      <div class="pp-btns"></div>`
    const grid = box.querySelector('.pp-grid') as HTMLElement
    const have = meta.piecesOf(gate.picId)
    for (let i = 0; i < need; i++) {
      const cellEl = el('div', `pp-cell ${have.includes(i) ? 'got' : 'missing'}`)
      const col = i % cols, row = Math.floor(i / cols)
      cellEl.style.backgroundPosition = `${(col * 100) / (cols - 1)}% ${(row * 100) / (rows - 1)}%`
      if (have.includes(i)) cellEl.style.backgroundImage = `url(${img})`
      else cellEl.textContent = '?'
      grid.appendChild(cellEl)
    }
    const btns = box.querySelector('.pp-btns') as HTMLElement
    if (s.locked && meta.canPieceAd() && have.length < need) {
      const ad = el('button', 'btn gold', `📺 看广告 · 碎片加速 (${s.daily.pieceAds}/${meta.getConfig().params['碎片视频加速每日次数'] ?? 2})`)
      ad.onclick = () => {
        sfx('tap')
        showAdModal('获得 1 片缺失碎片', () => {
          const got = meta.grantExtraPiece(true)
          if (got >= 0) { sfx('piece'); toast('🧩 获得缺失碎片！') }
          updateHUD()
          box.closest('.overlay')?.remove()
          puzzlePage()
        })
      }
      btns.appendChild(ad)
    }
    const close = el('button', 'btn ghost', '返回棋盘')
    close.onclick = () => { sfx('tap'); box.closest('.overlay')?.remove() }
    btns.appendChild(close)
  }, { cls: 'overlay-page' })
}

/* ---------- 拼图馆 ---------- */

export function galleryPage(): void {
  const s = getSave()
  openOverlay((box) => {
    box.classList.add('big-sheet')
    box.innerHTML = `<div class="pp-head"><div class="sheet-title">🖼 拼图馆</div>
      <div class="sheet-sub">每一章的完整画卷</div></div><div class="gal-grid"></div>
      <div class="pp-btns"><button class="btn ghost gal-close">返回棋盘</button></div>`
    const grid = box.querySelector('.gal-grid') as HTMLElement
    for (let ch = 2; ch <= meta.chapterCount() + 1; ch++) {
      const picId = `pic${ch}`
      const done = s.picsDone.includes(picId) || ch <= s.chapter
      const collecting = ch === s.chapter + 1
      const item = el('div', `gal-item ${done ? 'done' : collecting ? 'doing' : 'lock'}`)
      const need = meta.getConfig().params[`章节${ch}拼图片数`] ?? 9
      item.innerHTML = `<div class="gal-img" style="background-image:url(${chapterPicture(ch)})"></div>
        <div class="gal-name">${chapterTheme(ch).name}${done ? ' ✅' : collecting ? ` 🧩${meta.piecesOf(picId).length}/${need}` : ' 🔒'}</div>`
      grid.appendChild(item)
    }
    ;(box.querySelector('.gal-close') as HTMLElement).onclick = () => { sfx('tap'); box.closest('.overlay')?.remove() }
  }, { cls: 'overlay-page' })
}

/* ---------- 设置 ---------- */

export function settingsPanel(): void {
  const s = getSave()
  openOverlay((box) => {
    box.classList.add('big-sheet')
    box.innerHTML = `<div class="pp-head"><div class="sheet-title">⚙️ 设置</div></div><div class="set-list"></div>
      <div class="set-ver">谜题大富翁 v0.1 · Web 完整版<br/>配置表驱动 · 数值可在 config/ 调整</div>`
    const list = box.querySelector('.set-list') as HTMLElement
    const mkRow = (label: string, on: boolean, cb: (v: boolean) => void): void => {
      const row = el('div', 'set-row', `<span>${label}</span>`)
      const t = el('button', `toggle ${on ? 'on' : ''}`, `<i></i>`)
      t.onclick = () => {
        const nv = !t.classList.contains('on')
        t.classList.toggle('on', nv)
        sfx('tap')
        cb(nv)
      }
      row.appendChild(t)
      list.appendChild(row)
    }
    mkRow('🔊 音效', s.settings.sound, v => { s.settings.sound = v; persist(s) })
    mkRow('🎞 减少动效', s.settings.reduceMotion, v => { s.settings.reduceMotion = v; persist(s) })
    const ach = el('button', 'btn ghost wide', '🏅 成就')
    ach.onclick = () => { sfx('open'); achievementsPanel() }
    list.appendChild(ach)
    const reset = el('button', 'btn danger wide', '🗑 重置全部进度')
    let armed = false
    reset.onclick = () => {
      sfx('tap')
      if (!armed) { armed = true; reset.textContent = '⚠️ 再点一次确认重置'; return }
      import('./core/save').then(m => {
        const ns = m.resetSave()
        Object.assign(s, ns)
        location.reload()
      })
    }
    list.appendChild(reset)
  }, { cls: 'overlay-page' })
}

/* ---------- 成就 ---------- */

export function achievementsPanel(): void {
  const s = getSave()
  const defs = [
    { name: '初出茅庐', desc: '完成第 1 次挑战', cur: s.stats.wins, max: 1 },
    { name: '小有所成', desc: '完成 10 次挑战', cur: s.stats.wins, max: 10 },
    { name: '谜题大师', desc: '完成 50 次挑战', cur: s.stats.wins, max: 50 },
    { name: '专家之路', desc: '专家难度通关 5 次', cur: s.stats.expertWins, max: 5 },
    { name: '收藏家', desc: '拼合 1 幅完整拼图', cur: s.picsDone.length + (s.chapter - 1), max: 1 },
    { name: '小富翁', desc: '持有 1000 金币', cur: s.coins, max: 1000 },
  ]
  openOverlay((box) => {
    box.classList.add('big-sheet')
    box.innerHTML = `<div class="pp-head"><div class="sheet-title">🏅 成就</div></div><div class="ach-list"></div>
      <div class="pp-btns"><button class="btn ghost ach-close">返回</button></div>`
    const list = box.querySelector('.ach-list') as HTMLElement
    for (const d of defs) {
      const done = d.cur >= d.max
      const pct = Math.min(100, Math.round((d.cur / d.max) * 100))
      list.appendChild(el('div', `ach-row ${done ? 'done' : ''}`, `
        <div class="ach-top"><span class="ach-name">${done ? '🏆' : '🔒'} ${d.name}</span><span class="ach-num">${Math.min(d.cur, d.max)}/${d.max}</span></div>
        <div class="ach-desc">${d.desc}</div>
        <div class="ach-bar"><i style="width:${pct}%"></i></div>`))
    }
    ;(box.querySelector('.ach-close') as HTMLElement).onclick = () => { sfx('tap'); box.closest('.overlay')?.remove() }
  }, { cls: 'overlay-page' })
}

/* ---------- 自由练习 ---------- */

export function freeplayPanel(onPick: (game: string) => void): void {
  openOverlay((box, h) => {
    box.classList.add('sheet')
    box.innerHTML = `<div class="sheet-head"><div class="sheet-title">🛠 自由练习</div>
      <div class="sheet-sub">解锁的玩法随意练 · 仅金币奖励</div></div>`
    for (const g of meta.unlockedGames()) {
      const b = el('button', 'fp-row', `${GAME_EMOJI[g]} <span>${g}</span> <i>›</i>`)
      b.onclick = () => { sfx('tap'); h.close(); onPick(g) }
      box.appendChild(b)
    }
  })
}

/* ---------- 幸运转盘 ---------- */

export function wheelPanel(onDone: (prize: { label: string; kind: string }) => void): void {
  const prizes = [
    { label: '🪙+30', kind: 'coin30' },
    { label: '🎲+1', kind: 'dice' },
    { label: '🪙+60', kind: 'coin60' },
    { label: '🧩碎片', kind: 'piece' },
    { label: '✨双倍', kind: 'double' },
    { label: '🪙+15', kind: 'coin15' },
  ]
  openOverlay((box, h) => {
    box.classList.add('wheel-box')
    box.innerHTML = `<div class="sheet-title">🎡 幸运转盘</div>
      <div class="wheel-wrap"><div class="wheel-pointer">▼</div><div class="wheel"></div></div>
      <button class="btn primary big wheel-go">转动！</button>`
    const wheel = box.querySelector('.wheel') as HTMLElement
    prizes.forEach((p, i) => {
      const seg = el('div', 'wheel-seg', p.label)
      const angle = (360 / prizes.length) * i
      seg.style.transform = `rotate(${angle}deg) translate(0,-72px)`
      wheel.appendChild(seg)
    })
    let spinning = false
    ;(box.querySelector('.wheel-go') as HTMLElement).onclick = () => {
      if (spinning) return
      spinning = true
      sfx('roll')
      const pick = Math.floor(Math.random() * prizes.length)
      const turns = 5 + Math.floor(Math.random() * 3)
      const deg = turns * 360 + (360 - (360 / prizes.length) * pick)
      wheel.style.transition = 'transform 2.4s cubic-bezier(.15,.8,.25,1)'
      wheel.style.transform = `rotate(${deg}deg)`
      setTimeout(() => {
        sfx('win')
        toast(`🎡 获得 ${prizes[pick].label}！`)
        h.close()
        onDone(prizes[pick])
      }, 2500)
    }
  }, { closable: false })
}

/* ---------- 章节过场 ---------- */

export function chapterIntro(ch: number, onGo: () => void): void {
  const prevGames = ch > 1 ? meta.unlockedGames(ch - 1) : []
  const nowGames = meta.unlockedGames(ch)
  const newGames = nowGames.filter(g => !prevGames.includes(g))
  openOverlay((box) => {
    box.classList.add('intro-box')
    box.innerHTML = `
      <div class="intro-img" style="background-image:url(${chapterPicture(ch)})"></div>
      <div class="intro-name">${chapterTheme(ch).name}</div>
      <div class="intro-sub">${meta.chapterName(ch)}</div>
      ${newGames.length ? `<div class="intro-unlock">🔓 解锁新玩法：${newGames.map(g => `${GAME_EMOJI[g]} ${g}`).join('、')}</div>` : ''}
      <button class="btn primary big intro-go">开始冒险 →</button>`
    ;(box.querySelector('.intro-go') as HTMLElement).onclick = () => {
      sfx('open')
      meta.markChapterEntered()
      box.closest('.overlay')?.remove()
      onGo()
    }
  }, { cls: 'overlay-intro', closable: false })
}

export function gateCeremony(ch: number, onDone: () => void): void {
  const s = getSave()
  const need = meta.getConfig().params[`章节${ch + 1}拼图片数`] ?? 9
  const cols = need <= 9 ? 3 : 4
  const rows = Math.ceil(need / cols)
  const img = chapterPicture(ch + 1)
  const bonus = 100 + ch * 50
  meta.addCoins(bonus)
  if (!s.picsDone.includes(`pic${ch + 1}`)) {
    s.picsDone.push(`pic${ch + 1}`)
    persist(s)
  }
  openOverlay((box) => {
    box.classList.add('gate-box')
    box.innerHTML = `
      <div class="gate-title">🎉 第${ch}章 完成！</div>
      <div class="gate-sub">拼图之门 · 拼合「${chapterTheme(ch + 1).name}」</div>
      <div class="pp-grid assemble" style="--cols:${cols};--rows:${rows}"></div>
      <div class="gate-reward">章节奖励 <b>🪙 +${bonus}</b></div>
      <button class="btn primary big gate-go" disabled>继续</button>`
    const grid = box.querySelector('.pp-grid') as HTMLElement
    for (let i = 0; i < need; i++) {
      const cellEl = el('div', 'pp-cell got')
      const col = i % cols, row = Math.floor(i / cols)
      cellEl.style.backgroundPosition = `${(col * 100) / (cols - 1)}% ${(row * 100) / (rows - 1)}%`
      cellEl.style.backgroundImage = `url(${img})`
      grid.appendChild(cellEl)
    }
    sfx('gate')
    confetti(getSave().settings.reduceMotion ? 24 : 120)
    ;(grid.querySelectorAll('.pp-cell') as NodeListOf<HTMLElement>).forEach((c, i) => {
      setTimeout(() => { c.classList.add('pop'); sfx('piece') }, 350 + i * 160)
    })
    const btn = box.querySelector<HTMLButtonElement>('.gate-go')!
    setTimeout(() => { btn.disabled = false }, 350 + need * 160 + 400)
    btn.onclick = () => { sfx('tap'); box.closest('.overlay')?.remove(); onDone() }
  }, { cls: 'overlay-gate', closable: false })
}

export function endingScreen(): void {
  const s = getSave()
  openOverlay((box) => {
    box.classList.add('gate-box')
    box.innerHTML = `
      <div class="gate-title">🏆 全部章节通关！</div>
      <div class="gate-sub">挑战 ${s.stats.wins} 次 · 专家通关 ${s.stats.expertWins} 次 · 金币 ${s.coins}</div>
      <div class="gate-reward">更多章节可在 config/ 轨道表中扩展，敬请期待 ✨</div>
      <button class="btn primary big end-go">进入自由练习</button>`
    ;(box.querySelector('.end-go') as HTMLElement).onclick = () => {
      sfx('open')
      box.closest('.overlay')?.remove()
      freeplayPanel(g => {
        import('./board').then(b => b.enterFreePlay(g))
      })
    }
  }, { cls: 'overlay-gate', closable: false })
  confetti(140)
}

export type { TrackNode }
export function flyFromPanel(from: HTMLElement, to: HTMLElement, icon: string, n: number): void {
  void flyIcon(centerRect(from), centerRect(to), icon, n)
}
export { floatText, toast }
