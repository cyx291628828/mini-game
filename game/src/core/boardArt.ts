// 章节美术棋盘：游戏数据直接"穿"在人工提供的场景图上（换肤模式）
// - tiles: 图上每个棋盘格的中心与尺寸（设计稿像素），由 scripts/detect-slots.ts 检测 + 人工排序
// - ui: 图内已有 UI 元素的锚点（数值框补丁、骰子按钮热区、功能按钮热区）
// 背景板用 bg-clean（格子已抹除），格子以贴片形式由程序按玩法类型放置
export interface ArtTile { x: number; y: number; w: number; h: number; sprite?: string }
export interface ArtRect { x: number; y: number; w: number; h: number }
export interface SkinText extends ArtRect { patch: string }
export type SkinAction = 'free' | 'gallery' | 'settings'
export interface ArtBoard {
  src: string
  w: number
  h: number
  /** 轨道节点（顺序即节点 1..N），xy 中心、wh 尺寸；sprite 为该格贴片（透明底 PNG） */
  tiles: ArtTile[]
  /** 数值显示位：面板贴图/补丁上绘制动态数值 */
  texts: { bind: 'coins' | 'dice' | 'pieces'; rect: SkinText; prefix?: string }[]
  /** 骰子按钮（图上裁出的贴片 = 真实按钮） */
  dice: ArtRect & { sprite?: string }
  /** 功能按钮热区（图上的背包/地产/地图/齿轮） */
  hotspots: { rect: ArtRect; action: SkinAction }[]
}

// 自动加载 assets 下所有贴片（slot_N.png / btn-dice.png）
const assetUrls = import.meta.glob('../assets/**/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const assetUrl = (name: string): string => {
  const hit = Object.entries(assetUrls).find(([k]) => k.endsWith('/' + name))
  return hit ? hit[1] : ''
}

export const ART_BOARDS: Record<number, ArtBoard> = {
  1: {
    src: assetUrl('bg-clean.png'),
    w: 864,
    h: 1536,
    tiles: [
      { x: 122, y: 392, w: 110, h: 70 },  // 1 起点（角色基座）
      { x: 220, y: 396, w: 80, h: 54 },   // 2
      { x: 306, y: 406, w: 90, h: 56 },   // 3
      { x: 397, y: 431, w: 90, h: 54 },   // 4
      { x: 519, y: 479, w: 104, h: 66 },  // 5
      { x: 622, y: 534, w: 106, h: 76 },  // 6
      { x: 706, y: 604, w: 98, h: 82 },   // 7
      { x: 753, y: 686, w: 104, h: 82 },  // 8
      { x: 770, y: 765, w: 96, h: 72 },   // 9
      { x: 707, y: 826, w: 112, h: 80 },  // 10
      { x: 610, y: 875, w: 128, h: 96 },  // 11
      { x: 510, y: 924, w: 114, h: 86 },  // 12
      { x: 540, y: 1033, w: 122, h: 88 }, // 13
      { x: 623, y: 1111, w: 120, h: 86 }, // 14
      { x: 371, y: 1112, w: 118, h: 78 }, // 15
      { x: 289, y: 1048, w: 108, h: 78 }, // 16
      { x: 308, y: 959, w: 114, h: 92 },  // 17
      { x: 305, y: 856, w: 104, h: 78 },  // 18
      { x: 230, y: 803, w: 112, h: 80 },  // 19
      { x: 125, y: 753, w: 108, h: 74 },  // 20
      { x: 106, y: 646, w: 114, h: 84 },  // 21
      { x: 176, y: 539, w: 94, h: 74 },   // 22
      { x: 146, y: 468, w: 82, h: 54 },   // 23
    ],
    texts: [
      { bind: 'coins', rect: { x: 497, y: 34, w: 158, h: 50, patch: '#9a6c46' } },
      { bind: 'dice', rect: { x: 703, y: 34, w: 52, h: 50, patch: '#8b5a3b' } },
      { bind: 'coins', rect: { x: 106, y: 1436, w: 164, h: 54, patch: '#647e89' } },
      { bind: 'pieces', rect: { x: 352, y: 34, w: 108, h: 50, patch: 'rgba(60,35,10,.55)' }, prefix: '🧩' },
    ],
    dice: { x: 320, y: 1232, w: 224, h: 226 },
    hotspots: [
      { rect: { x: 606, y: 1376, w: 88, h: 118 }, action: 'free' },     // 背包 → 自由练习
      { rect: { x: 686, y: 1374, w: 88, h: 120 }, action: 'gallery' },  // 地产 → 拼图馆
      { rect: { x: 766, y: 1374, w: 88, h: 120 }, action: 'settings' }, // 地图 → 设置
      { rect: { x: 779, y: 24, w: 72, h: 70 }, action: 'settings' },    // 齿轮 → 设置
    ],
  },
}

// 挂接贴片：slot_N.png 按节点序号对应，btn-dice.png 为骰子按钮贴图
ART_BOARDS[1].tiles.forEach((t, i) => { t.sprite = assetUrl(`slot_${i + 1}.png`) })
ART_BOARDS[1].dice.sprite = assetUrl('btn-dice.png')
