import type { TCard } from '@wrapped/lib/cards'
import { chartGeometry } from '@wrapped/lib/chart'

function textLines(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  return text.split(/\s+/).reduce<string[]>(
    (lines, word) => {
      const previous = lines.at(-1) ?? ''
      if (ctx.measureText(`${previous} ${word}`).width <= width) {
        lines[lines.length - 1] = `${previous} ${word}`.trim()
        return lines
      }
      lines.push(word)
      return lines
    },
    ['']
  )
}

export async function renderCard(card: TCard, isDemo: boolean): Promise<Blob> {
  if (card.id === 'identity') throw new Error('Identity cards cannot be exported.')
  await document.fonts.ready
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 1200
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Image export is unavailable in this browser.')
  const styles = getComputedStyle(document.documentElement)
  const isLight = document.documentElement.dataset.theme === 'light'
  const background = styles.getPropertyValue('--color-app').trim() || '#0a0a0a'
  const text = styles.getPropertyValue('--color-text-primary').trim() || '#fafafa'
  const secondary = styles.getPropertyValue('--color-text-secondary').trim() || '#b8c0cd'
  const accent = isLight ? '#0657f9' : '#5c9aff'
  ctx.fillStyle = background
  ctx.fillRect(0, 0, 1200, 1200)
  const glow = ctx.createRadialGradient(900, 250, 0, 900, 250, 650)
  glow.addColorStop(0, isLight ? '#eaf1ff' : '#102b52')
  glow.addColorStop(1, background)
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, 1200, 1200)
  const logo = new Image()
  logo.src = '/yearn-wrapped-lockup.svg'
  await logo.decode()
  ctx.filter = isLight ? 'invert(1)' : 'none'
  ctx.drawImage(logo, 72, 60, 260, 32)
  ctx.filter = 'none'
  ctx.textAlign = 'center'
  ctx.fillStyle = secondary
  ctx.font = '24px AeonikMono'
  ctx.fillText(card.title.toUpperCase(), 600, 210)
  ctx.fillStyle = text
  ctx.font = `700 ${Math.min(106, 1500 / Math.max(card.value.length, 1))}px Aeonik`
  ctx.fillText(card.value, 600, 380, 1056)
  ctx.font = '32px Aeonik'
  textLines(ctx, card.line, 960).forEach((line, index) => {
    ctx.fillText(line, 600, 460 + index * 42)
  })
  if (card.chart?.some((point) => point.value !== null)) {
    const geometry = chartGeometry(card.chart, 960, 140)
    ctx.save()
    ctx.translate(120, 590)
    ctx.strokeStyle = accent
    ctx.fillStyle = accent
    ctx.lineWidth = 5
    if (card.chartKind === 'bars')
      geometry.bars.forEach((bar) => {
        ctx.fillRect(bar.x, 140 - bar.height, bar.width, bar.height)
      })
    else ctx.stroke(new Path2D(geometry.line))
    ctx.restore()
    ctx.font = '18px AeonikMono'
    ctx.fillStyle = secondary
    ctx.textAlign = 'left'
    ctx.fillText(geometry.first ?? '', 120, 765)
    ctx.textAlign = 'right'
    ctx.fillText(geometry.last ?? '', 1080, 765)
    ctx.textAlign = 'center'
    ctx.fillText(
      card.chartKind === 'bars'
        ? 'Indexed events · UTC'
        : `Index · ${geometry.min.toFixed(1)}–${geometry.max.toFixed(1)}`,
      600,
      765
    )
  }
  card.facts.forEach((fact, index) => {
    const x = 120 + (960 * (index + 0.5)) / card.facts.length
    ctx.fillStyle = text
    ctx.font = '700 48px Aeonik'
    ctx.fillText(fact.value, x, 850)
    ctx.fillStyle = secondary
    ctx.font = '23px Aeonik'
    ctx.fillText(fact.label, x, 890)
  })
  ctx.font = '24px Aeonik'
  ctx.fillStyle = secondary
  const notes = textLines(ctx, card.note, 1010)
  notes.forEach((line, index) => {
    ctx.fillText(line, 600, 975 + index * 32)
  })
  ctx.font = '20px AeonikMono'
  ctx.fillText(isDemo ? 'FICTIONAL DEMO · 2026' : 'YEAR IN REVIEW · 2026', 600, 1150)
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create image.'))), 'image/png')
  )
}
