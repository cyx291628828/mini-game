/* 配置加载：直接读取用户可编辑的 config/*.csv（构建时由 scripts/sync-config.mjs 同步） */

export interface RewardRow {
  game: string; diff: string; spec: string
  coins: number; pieces: number; pieceChance: number; dice: number
  firstClearCoins: number; failCoins: number
}
export interface TrackNode { idx: number; type: string; game: string; param: string }
export interface GameConfig {
  params: Record<string, number>
  rewards: Map<string, RewardRow>
  tracks: Map<number, TrackNode[]>
}

export const DIFFS = ['简单', '中等', '困难', '专家'] as const
export const GAMES = ['数独', '扫雷', '数方', '星之战', '杀手数独'] as const

async function fetchCSV(name: string): Promise<string[][] | null> {
  const res = await fetch(`./config/${encodeURIComponent(name)}`, { cache: 'no-store' })
  if (!res.ok) return null
  let text = await res.text()
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  const rows = text.split(/\r?\n/).map(l => l.split(',').map(s => s.trim())).filter(r => r.some(c => c !== ''))
  return rows
}

function toObjects(rows: string[][]): Record<string, string>[] {
  const head = rows[0]
  return rows.slice(1).map(r => {
    const o: Record<string, string> = {}
    head.forEach((h, i) => { o[h] = r[i] ?? '' })
    return o
  })
}

const num = (s: string | undefined, d = 0): number => {
  const v = parseInt((s ?? '').replace(/[^0-9-]/g, ''), 10)
  return Number.isFinite(v) ? v : d
}

export async function loadConfig(): Promise<GameConfig> {
  // 全局参数
  const params: Record<string, number> = {}
  const pRows = await fetchCSV('全局参数表.csv')
  if (pRows) for (const o of toObjects(pRows)) params[o['参数名']] = num(o['值'])

  // 难度奖励表
  const rewards = new Map<string, RewardRow>()
  const rRows = await fetchCSV('难度奖励表.csv')
  if (rRows) {
    for (const o of toObjects(rRows)) {
      const row: RewardRow = {
        game: o['玩法类型'], diff: o['难度'], spec: o['规格说明'],
        coins: num(o['金币']), pieces: num(o['拼图碎片必得']),
        pieceChance: num(o['额外碎片掉率%']), dice: num(o['骰子']),
        firstClearCoins: num(o['首通加成金币']), failCoins: num(o['失败安慰金币']),
      }
      rewards.set(`${row.game}|${row.diff}`, row)
    }
  }

  // 章节轨道表：章节1-轨道表.csv 起，404 即停
  const tracks = new Map<number, TrackNode[]>()
  for (let ch = 1; ch <= 50; ch++) {
    const rows = await fetchCSV(`章节${ch}-轨道表.csv`)
    if (!rows) break
    const nodes: TrackNode[] = toObjects(rows).map(o => ({
      idx: num(o['节点序号']), type: o['格子类型'], game: o['玩法类型'] ?? '', param: o['参数/事件'] ?? '',
    })).filter(n => n.idx > 0)
    tracks.set(ch, nodes.sort((a, b) => a.idx - b.idx))
  }

  return { params, rewards, tracks }
}
