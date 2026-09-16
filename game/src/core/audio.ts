/* 极简 WebAudio 合成音效（无音频资源文件） */

let ctx: AudioContext | null = null
let enabled = true

export function setSound(on: boolean): void { enabled = on }

function ac(): AudioContext | null {
  if (!enabled) return null
  if (!ctx) {
    try { ctx = new AudioContext() } catch { return null }
  }
  if (ctx && ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; vol?: number; delay?: number; slide?: number } = {}): void {
  const c = ac()
  if (!c) return
  const t0 = c.currentTime + (opts.delay ?? 0)
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = opts.type ?? 'sine'
  osc.frequency.setValueAtTime(freq, t0)
  if (opts.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, opts.slide), t0 + dur)
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(opts.vol ?? 0.18, t0 + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(gain).connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

export type SfxName = 'tap' | 'roll' | 'hop' | 'coin' | 'piece' | 'win' | 'fail' | 'open' | 'gate' | 'boom' | 'tick'

export function sfx(name: SfxName): void {
  switch (name) {
    case 'tap': tone(620, 0.06, { type: 'triangle', vol: 0.12 }); break
    case 'open': tone(440, 0.1, { type: 'triangle', vol: 0.1 }); tone(660, 0.12, { delay: 0.06 }); break
    case 'roll':
      for (let i = 0; i < 6; i++) tone(300 + Math.random() * 350, 0.05, { type: 'square', vol: 0.07, delay: i * 0.09 })
      break
    case 'hop': tone(520, 0.07, { type: 'triangle', vol: 0.1, slide: 760 }); break
    case 'tick': tone(880, 0.03, { type: 'square', vol: 0.05 }); break
    case 'coin': tone(920, 0.08, { vol: 0.14 }); tone(1380, 0.12, { delay: 0.07, vol: 0.12 }); break
    case 'piece': tone(700, 0.09, { type: 'triangle' }); tone(1040, 0.12, { delay: 0.08, type: 'triangle' }); break
    case 'win': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, { delay: i * 0.09, type: 'triangle', vol: 0.16 })); break
    case 'gate': [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.2, { delay: i * 0.11, type: 'triangle', vol: 0.18 })); break
    case 'fail': tone(300, 0.25, { type: 'sawtooth', vol: 0.12, slide: 150 }); break
    case 'boom': tone(120, 0.5, { type: 'sawtooth', vol: 0.25, slide: 40 }); break
  }
}
