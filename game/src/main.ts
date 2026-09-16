import { loadConfig } from './core/config'
import { loadSave } from './core/save'
import { initMeta, dailyCheck, getSave, grantExtraPiece, addDice, gateFor, piecesOf } from './core/meta'
import { setSound } from './core/audio'
import { renderHUD, updateHUD, chapterIntro, toast } from './ui'
import { renderBoard, refreshBoard, enterFreePlay, debugWinNow } from './board'
import './styles.css'

async function boot(): Promise<void> {
  const cfg = await loadConfig()
  const save = loadSave()
  initMeta(cfg, save)
  setSound(save.settings.sound)

  renderHUD(document.getElementById('hud')!)
  renderBoard()

  const granted = dailyCheck()
  if (granted) setTimeout(() => toast(`📅 每日登录奖励 · 🎲 +${granted}`, 2200), 600)
  updateHUD()

  if (!getSave().chapterEntered) {
    chapterIntro(getSave().chapter, () => refreshBoard())
  }

  // 调试钩子（仅开发用）
  ;(window as unknown as Record<string, unknown>).DBG = {
    addDice: (n: number) => { addDice(n); updateHUD() },
    addPiece: () => { grantExtraPiece(false); updateHUD() },
    completeGate: () => {
      const g = gateFor()
      const have = piecesOf(g.picId)
      for (let i = 0; i < g.need; i++) if (!have.includes(i)) grantExtraPiece(false)
      updateHUD()
    },
    freePlay: (g: string) => enterFreePlay(g),
    winNow: () => debugWinNow(),
    refresh: () => refreshBoard(),
  }
}

void boot()
