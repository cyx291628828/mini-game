/* 章节主题画：程序化绘制（无外部美术资源），用于拼图碎片与拼图馆 */

export interface ChapterTheme { name: string; theme: 'tropical' | 'alpine' | 'space' }

const THEMES: ChapterTheme[] = [
  { name: '椰风岛', theme: 'tropical' },
  { name: '雪松岭', theme: 'alpine' },
  { name: '星海号', theme: 'space' },
]

export function chapterTheme(ch: number): ChapterTheme {
  return THEMES[(ch - 1) % THEMES.length] ?? { name: `第${ch}章`, theme: 'tropical' }
}

const cache = new Map<number, string>()

export function chapterPicture(ch: number): string {
  const hit = cache.get(ch)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = 720; c.height = 720
  const g = c.getContext('2d')!
  const theme = chapterTheme(ch).theme
  draw(g, theme, ch)
  const url = c.toDataURL('image/png')
  cache.set(ch, url)
  return url
}

function draw(g: CanvasRenderingContext2D, theme: string, ch: number): void {
  const rnd = (() => { let s = ch * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 } })()
  if (theme === 'tropical') {
    const sky = g.createLinearGradient(0, 0, 0, 720)
    sky.addColorStop(0, '#4fc3f7'); sky.addColorStop(0.6, '#b3e5fc'); sky.addColorStop(1, '#fff59d')
    g.fillStyle = sky; g.fillRect(0, 0, 720, 720)
    // 太阳
    g.fillStyle = '#ffeb3b'; g.beginPath(); g.arc(560, 150, 70, 0, Math.PI * 2); g.fill()
    g.fillStyle = 'rgba(255,235,59,.35)'; g.beginPath(); g.arc(560, 150, 100, 0, Math.PI * 2); g.fill()
    // 云
    g.fillStyle = 'rgba(255,255,255,.85)'
    for (const [x, y, s] of [[120, 130, 1], [420, 90, 0.7], [260, 210, 0.5]] as const) cloud(g, x, y, s)
    // 海
    const sea = g.createLinearGradient(0, 420, 0, 720)
    sea.addColorStop(0, '#26c6da'); sea.addColorStop(1, '#00838f')
    g.fillStyle = sea; g.fillRect(0, 430, 720, 290)
    g.fillStyle = 'rgba(255,255,255,.35)'
    for (let i = 0; i < 12; i++) g.fillRect(rnd() * 700, 470 + rnd() * 220, 40 + rnd() * 70, 4)
    // 岛
    g.fillStyle = '#ffdf8e'; g.beginPath(); g.ellipse(360, 620, 300, 90, 0, 0, Math.PI * 2); g.fill()
    palm(g, 250, 600, 1); palm(g, 470, 610, 0.85)
    // 小船
    g.fillStyle = '#bf360c'; g.beginPath(); g.moveTo(90, 560); g.lineTo(150, 560); g.lineTo(135, 585); g.lineTo(105, 585); g.closePath(); g.fill()
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(120, 560); g.lineTo(120, 510); g.lineTo(155, 555); g.closePath(); g.fill()
  } else if (theme === 'alpine') {
    const sky = g.createLinearGradient(0, 0, 0, 720)
    sky.addColorStop(0, '#0d1b4b'); sky.addColorStop(0.7, '#3a5db0'); sky.addColorStop(1, '#88a7e8')
    g.fillStyle = sky; g.fillRect(0, 0, 720, 720)
    // 星
    g.fillStyle = '#fff'
    for (let i = 0; i < 90; i++) { g.globalAlpha = 0.3 + rnd() * 0.7; g.fillRect(rnd() * 720, rnd() * 400, 2.4, 2.4) }
    g.globalAlpha = 1
    // 月亮
    g.fillStyle = '#fff9c4'; g.beginPath(); g.arc(560, 140, 60, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#0d1b4b'; g.beginPath(); g.arc(590, 120, 52, 0, Math.PI * 2); g.fill()
    // 雪山
    const m = (x: number, w: number, h: number, c1: string, c2: string): void => {
      g.fillStyle = c1; g.beginPath(); g.moveTo(x, 720); g.lineTo(x + w / 2, 720 - h); g.lineTo(x + w, 720); g.closePath(); g.fill()
      g.fillStyle = c2; g.beginPath()
      g.moveTo(x + w / 2, 720 - h)
      g.lineTo(x + w / 2 - w * 0.12, 720 - h + h * 0.28)
      g.lineTo(x + w / 2, 720 - h + h * 0.2)
      g.lineTo(x + w / 2 + w * 0.12, 720 - h + h * 0.3)
      g.lineTo(x + w / 2, 720 - h + h * 0.24)
      g.closePath(); g.fill()
    }
    m(-60, 480, 430, '#4a6bc4', '#fff')
    m(240, 560, 560, '#3757a8', '#f2f6ff')
    m(480, 460, 400, '#4a6bc4', '#fff')
    // 松树
    tree(g, 80, 690, 1); tree(g, 170, 700, 0.8); tree(g, 600, 700, 0.9); tree(g, 680, 690, 0.7)
    // 雪
    g.fillStyle = 'rgba(255,255,255,.8)'
    for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(rnd() * 720, rnd() * 720, 1.5 + rnd() * 2, 0, Math.PI * 2); g.fill() }
  } else {
    const sky = g.createLinearGradient(0, 0, 0, 720)
    sky.addColorStop(0, '#120740'); sky.addColorStop(0.6, '#3c1470'); sky.addColorStop(1, '#6a1b9a')
    g.fillStyle = sky; g.fillRect(0, 0, 720, 720)
    g.fillStyle = '#fff'
    for (let i = 0; i < 140; i++) { g.globalAlpha = 0.3 + rnd() * 0.7; const s = 1 + rnd() * 2.6; g.fillRect(rnd() * 720, rnd() * 720, s, s) }
    g.globalAlpha = 1
    // 带环行星
    g.fillStyle = '#ff8a65'; g.beginPath(); g.arc(480, 250, 110, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#ffab91'; g.beginPath(); g.ellipse(460, 220, 40, 26, -0.5, 0, Math.PI * 2); g.fill()
    g.strokeStyle = '#ffd180'; g.lineWidth = 12
    g.beginPath(); g.ellipse(480, 250, 175, 46, -0.35, 0, Math.PI * 2); g.stroke()
    // 小行星
    g.fillStyle = '#9575cd'; g.beginPath(); g.arc(160, 420, 44, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#7e57c2'; g.beginPath(); g.arc(148, 410, 12, 0, Math.PI * 2); g.fill()
    // 火箭
    g.save(); g.translate(250, 560); g.rotate(-0.5)
    g.fillStyle = '#eceff1'; g.beginPath(); g.ellipse(0, 0, 34, 74, 0, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#f44336'; g.beginPath(); g.moveTo(-34, 20); g.lineTo(-58, 66); g.lineTo(-22, 48); g.closePath(); g.fill()
    g.beginPath(); g.moveTo(34, 20); g.lineTo(58, 66); g.lineTo(22, 48); g.closePath(); g.fill()
    g.fillStyle = '#29b6f6'; g.beginPath(); g.arc(0, -20, 15, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#ffa726'; g.beginPath(); g.moveTo(-16, 70); g.lineTo(0, 120 + rnd() * 30); g.lineTo(16, 70); g.closePath(); g.fill()
    g.restore()
  }
}

function cloud(g: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  g.beginPath()
  g.arc(x, y, 30 * s, 0, Math.PI * 2)
  g.arc(x + 34 * s, y - 12 * s, 36 * s, 0, Math.PI * 2)
  g.arc(x + 70 * s, y, 28 * s, 0, Math.PI * 2)
  g.fill()
}
function palm(g: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  g.save(); g.translate(x, y); g.scale(s, s)
  g.strokeStyle = '#8d6e63'; g.lineWidth = 12
  g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(14, -70, 4, -130); g.stroke()
  g.fillStyle = '#43a047'
  for (const a of [-2.6, -1.9, -1.1, -0.4, 0.3]) {
    g.beginPath(); g.ellipse(4 + Math.cos(a) * 44, -132 + Math.sin(a) * 22, 46, 15, a, 0, Math.PI * 2); g.fill()
  }
  g.restore()
}
function tree(g: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  g.save(); g.translate(x, y); g.scale(s, s)
  g.fillStyle = '#5d4037'; g.fillRect(-6, -30, 12, 30)
  g.fillStyle = '#2e7d32'
  for (const [w, h] of [[64, -30], [52, -70], [40, -104]]) {
    g.beginPath(); g.moveTo(-w / 2, h); g.lineTo(0, h - 44); g.lineTo(w / 2, h); g.closePath(); g.fill()
  }
  g.restore()
}
