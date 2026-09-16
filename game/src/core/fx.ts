/* DOM 工具与游戏特效（飘字、飞行动画、彩带、数字滚动、Toast） */

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html !== undefined) e.innerHTML = html
  return e
}

export function q<T extends HTMLElement = HTMLElement>(sel: string): T {
  const e = document.querySelector(sel)
  if (!e) throw new Error(`missing element: ${sel}`)
  return e as T
}

export function toast(msg: string, dur = 1600): void {
  const root = q('#toast-root')
  const t = el('div', 'toast', msg)
  root.appendChild(t)
  requestAnimationFrame(() => t.classList.add('show'))
  setTimeout(() => {
    t.classList.remove('show')
    setTimeout(() => t.remove(), 300)
  }, dur)
}

export function centerRect(e: HTMLElement): DOMRect {
  const r = e.getBoundingClientRect()
  return new DOMRect(r.left + r.width / 2, r.top + r.height / 2, 0, 0)
}

export function floatText(x: number, y: number, text: string, cls = ''): void {
  const f = el('div', `float-text ${cls}`, text)
  f.style.left = `${x}px`
  f.style.top = `${y}px`
  q('#fx-root').appendChild(f)
  setTimeout(() => f.remove(), 1100)
}

/** 从 from 中心飞一个图标到 to 中心（抛物线），可多个错开 */
export function flyIcon(from: DOMRect, to: DOMRect, content: string, count = 1, onEach?: () => void, dur = 650): Promise<void> {
  return new Promise(resolve => {
    const fx = q('#fx-root')
    const dx = to.left - from.left
    const dy = to.top - from.top
    let done = 0
    for (let i = 0; i < count; i++) {
      const s = el('div', 'fly-icon', content)
      s.style.left = `${from.left}px`
      s.style.top = `${from.top}px`
      fx.appendChild(s)
      const jitter = count > 1 ? (Math.random() * 50 - 25) : 0
      const anim = s.animate([
        { transform: 'translate(-50%,-50%) scale(1)' },
        { transform: `translate(calc(-50% + ${dx * 0.5 + jitter}px), calc(-50% + ${dy * 0.5 - 90}px)) scale(1.25)`, offset: 0.55 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.5)`, opacity: 0.9 },
      ], { duration: dur, delay: i * 90, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'both' })
      anim.onfinish = () => {
        s.remove()
        onEach?.()
        if (++done === count) resolve()
      }
    }
  })
}

export function confetti(n = 90): void {
  const fx = q('#fx-root')
  const colors = ['#ffb937', '#ff5470', '#3ecf6f', '#3f8cff', '#a05cff', '#ff9640', '#ffe45e']
  for (let i = 0; i < n; i++) {
    const p = el('div', 'confetti')
    p.style.left = `${Math.random() * 100}%`
    p.style.background = colors[Math.floor(Math.random() * colors.length)]
    p.style.width = `${6 + Math.random() * 7}px`
    p.style.height = `${8 + Math.random() * 8}px`
    fx.appendChild(p)
    const drift = Math.random() * 160 - 80
    const anim = p.animate([
      { transform: `translate(0,-30px) rotate(0deg)`, opacity: 1 },
      { transform: `translate(${drift}px, ${window.innerHeight + 60}px) rotate(${Math.random() * 720 - 360}deg)`, opacity: 0.9 },
    ], { duration: 1800 + Math.random() * 1600, delay: Math.random() * 500, easing: 'cubic-bezier(.2,.6,.6,1)', fill: 'both' })
    anim.onfinish = () => p.remove()
  }
}

export function countUp(elm: HTMLElement, to: number, dur = 700): Promise<void> {
  return new Promise(resolve => {
    const start = performance.now()
    function frame(t: number): void {
      const p = Math.min(1, (t - start) / dur)
      elm.textContent = String(Math.round(to * (1 - Math.pow(1 - p, 3))))
      if (p < 1) requestAnimationFrame(frame)
      else resolve()
    }
    requestAnimationFrame(frame)
  })
}

export function pulse(e: HTMLElement, cls = 'pulse'): void {
  e.classList.remove(cls)
  void e.offsetWidth
  e.classList.add(cls)
}
