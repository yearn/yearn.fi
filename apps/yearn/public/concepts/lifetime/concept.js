import { counterValueAt } from './counter-model.mjs'

const select = (selector) => document.querySelector(selector)
const earningsMoney = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const earningsUsd = (value) => `$${earningsMoney.format(value)}`
const date = (timestamp) =>
  new Date(timestamp * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  })
const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
const state = { frame: null, data: null, lastPaintAt: 0 }
const notes = select('#notes')
document.querySelectorAll('[data-open-notes]').forEach((button) => {
  button.addEventListener('click', () => notes.showModal())
})
select('.close').addEventListener('click', () => notes.close())
notes.addEventListener('click', (event) => {
  const bounds = notes.getBoundingClientRect()
  if (
    event.target === notes &&
    (event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom)
  )
    notes.close()
})
const stopCounter = () => {
  cancelAnimationFrame(state.frame)
  state.frame = null
}
const renderCounter = (data) => {
  stopCounter()
  const paint = () => {
    const value = counterValueAt(data, Date.now() / 1000)
    const [whole, fraction] = earningsMoney.format(value).split('.')
    if (select('#earnings-whole').textContent !== whole) select('#earnings-whole').textContent = whole
    const decimals = `.${fraction}`
    if (select('#earnings-decimals').textContent !== decimals) select('#earnings-decimals').textContent = decimals
    state.lastPaintAt = Date.now()
  }
  select('.counter').setAttribute(
    'aria-label',
    `${earningsUsd(counterValueAt(data, Date.now() / 1000))} estimated total value locked, based on a captured metrics snapshot and modeled share-value growth`
  )
  const tick = () => {
    state.frame = null
    paint()
    if (data.growth.estimatedUsdPerSecond !== 0 && !document.hidden) state.frame = requestAnimationFrame(tick)
  }
  tick()
}
const loadHero = async () => {
  try {
    const response = await fetch(new URL('./hero-tvl.json', import.meta.url), { cache: 'no-store' })
    if (!response.ok) throw new Error('TVL snapshot unavailable')
    const data = await response.json()
    counterValueAt(data, Date.now() / 1000)
    state.data = data
    select('.currency').hidden = false
    select('.counter').style.fontSize = ''
    renderCounter(data)
    select('#earnings-note').textContent =
      `${earningsUsd(data.metrics.totalTvlUsd)} published metrics TVL, reported at ${new Date(data.metrics.asOfTimestamp * 1000).toISOString()}. ${data.metrics.completeness.status === 'complete' ? 'Complete published scope.' : 'Known subtotal with incomplete coverage.'}`
    select('#animation-note').textContent =
      `Estimated TVL starts at the latest published metrics value when this mockup was captured (${new Date(data.anchor.timestamp * 1000).toISOString()}). It then adds $${data.growth.estimatedUsdPerSecond.toFixed(9)} per second: $${data.growth.yearnScheduledUnlockUsdPerSecond.toFixed(9)} of Yearn scheduled unlocking plus $${data.growth.morphoProjectedNetAccrualUsdPerSecond.toFixed(9)} of estimated Morpho net accrual. The growth model is dated ${new Date(data.growth.asOfTimestamp * 1000).toISOString()}; ${data.growth.valuedRoots} of ${data.growth.selectedRoots} roots are valued. This is a constant-rate presentation estimate beyond the sampled pilot curve, not live measured TVL or a guarantee of future interest. Metrics TVL already includes locked profit, so this animation does not imply new measured totalAssets. Reloads and tabs use the same shared anchor and wall-clock formula. Device clock differences affect the estimate. The counter animates independently of reduced-motion preferences.`
  } catch (error) {
    console.error('Unable to load the TVL counter:', error)
    stopCounter()
    state.data = null
    select('#earnings-whole').textContent = 'Unavailable'
    select('#earnings-decimals').textContent = ''
    select('.currency').hidden = true
    select('.counter').style.fontSize = 'clamp(36px, 9vw, 120px)'
    select('.counter').setAttribute('aria-label', 'TVL estimate unavailable')
    select('#earnings-note').textContent = 'TVL source unavailable. No zero value has been substituted.'
    select('#animation-note').textContent = 'Refresh the estimate to retry.'
  }
}
const resumeCounter = () => {
  if (state.data && !document.hidden) renderCounter(state.data)
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopCounter()
  else resumeCounter()
})
window.addEventListener('pagehide', stopCounter)
window.addEventListener('pageshow', resumeCounter)
window.addEventListener('focus', resumeCounter)
window.setInterval(() => {
  if (
    state.data &&
    state.data.growth.estimatedUsdPerSecond !== 0 &&
    !document.hidden &&
    Date.now() - state.lastPaintAt > 1500
  )
    resumeCounter()
}, 1000)
const loadSourceNotes = async () => {
  try {
    const response = await fetch(new URL('./data.json', import.meta.url), { cache: 'no-store' })
    if (!response.ok) throw new Error('Snapshot unavailable')
    const data = await response.json()
    if (
      ![data.earningsUsd, data.feesUsd, data.tvlUsd].every((value) => value !== null && Number.isFinite(Number(value)))
    )
      throw new Error('Invalid snapshot')
    select('#yield-note').textContent =
      `${data.methodology.earnings} Snapshot captured ${new Date(data.capturedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}.`
    select('#fees-note').textContent = data.methodology.fees
    select('#vaults-note').textContent =
      data.methodology.vaults ?? 'Vault inventory metadata is unavailable in this snapshot.'
    select('#harvests-note').textContent = data.activityCounts?.harvestCutoff
      ? `${data.methodology.harvests ?? 'Recorded V2 and V3 strategy reports.'} Reporting cutoff: ${date(data.activityCounts.harvestCutoff)} (exclusive, UTC).`
      : 'Harvest reporting metadata is unavailable in this snapshot.'
    select('#capture-date').textContent =
      `Other statistics captured ${new Date(data.capturedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}. Each metric retains its own source reporting boundary.`
  } catch (error) {
    console.error('Unable to load the landing statistics snapshot:', error)
    select('#fees-note').textContent = 'Unavailable. No zero value has been substituted.'
    select('#vaults-note').textContent = 'Unavailable. No zero value has been substituted.'
    select('#harvests-note').textContent = 'Unavailable. No zero value has been substituted.'
  }
}
select('#replay').addEventListener('click', () => {
  notes.close()
  window.scrollTo({ top: 0, behavior: motion.matches ? 'instant' : 'smooth' })
  loadHero()
})
// Scroll progress is reversible, so content fades again on every return visit.
document.querySelectorAll('.reveal').forEach((element) => {
  element.classList.remove('reveal')
})
const revealElements = [...document.querySelectorAll('[data-reveal="early"], #your-way, #security, #integrators')]
revealElements.forEach((element) => {
  element.classList.add('reveal')
})
document.body.classList.add('scroll-reveals')
const revealFrame = { pending: false }
const paintReveals = () => {
  revealFrame.pending = false
  const fadeDistance = Math.min(280, window.innerHeight * 0.35)
  const revealInset = window.innerHeight * 0.45
  const measurements = revealElements.map((element) => {
    const bounds = element.getBoundingClientRect()
    const earlyReveal = element.dataset.reveal === 'early'
    const inset = earlyReveal ? revealInset / 2 : revealInset
    const distance = earlyReveal ? (Math.min(180, window.innerHeight * 0.2) + fadeDistance) / 2 : fadeDistance
    const entering = (window.innerHeight - inset - bounds.top) / distance
    return { element, progress: Math.max(0, Math.min(1, entering)) }
  })
  measurements.forEach(({ element, progress }) => {
    element.style.setProperty('--reveal-progress', String(progress))
  })
}
const scheduleReveals = () => {
  if (revealFrame.pending) return
  revealFrame.pending = true
  requestAnimationFrame(paintReveals)
}
window.addEventListener('scroll', scheduleReveals, { passive: true })
window.addEventListener('resize', scheduleReveals)
window.addEventListener('pageshow', scheduleReveals)
new MutationObserver(scheduleReveals).observe(select('main'), {
  subtree: true,
  attributes: true,
  attributeFilter: ['hidden']
})
document.fonts.ready.then(scheduleReveals)
paintReveals()

loadSourceNotes()
loadHero()

const headerMenus = [...document.querySelectorAll('.header-menu')]
const closeHeaderMenus = (except) => {
  headerMenus
    .filter((menu) => menu !== except)
    .forEach((menu) => {
      menu.open = false
      delete menu.dataset.pinned
    })
}
headerMenus.forEach((menu) => {
  const trigger = menu.querySelector('summary')
  trigger.addEventListener('click', (event) => {
    event.preventDefault()
    const wasPinned = menu.dataset.pinned === 'true'
    closeHeaderMenus()
    menu.open = !wasPinned
    if (!wasPinned) menu.dataset.pinned = 'true'
  })
  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      closeHeaderMenus(menu)
      menu.open = true
      menu.querySelector('a').focus()
    }
  })
  menu.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'mouse') return
    closeHeaderMenus(menu)
    menu.open = true
  })
  menu.addEventListener('pointerleave', () => {
    if (menu.dataset.pinned !== 'true' && !menu.contains(document.activeElement)) menu.open = false
  })
  menu.addEventListener('focusout', (event) => {
    if (!menu.contains(event.relatedTarget)) closeHeaderMenus()
  })
  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => closeHeaderMenus())
  })
})
document.addEventListener('click', (event) => {
  if (!event.target.closest('.header-menu')) closeHeaderMenus()
})
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return
  const openMenu = headerMenus.find((menu) => menu.open)
  if (openMenu) {
    closeHeaderMenus()
    openMenu.querySelector('summary').focus()
  }
})

const securityChoices = [...document.querySelectorAll('[data-security]')]
const mobileSecurity = matchMedia('(max-width: 760px)')
const securityLayers = document.querySelector('.security-layers')
const securityDisplay = document.querySelector('.security-display')
const securityPin = { choice: null }
const securityTransition = { incoming: null }
const securityRotation = { elapsed: 0, resumeAt: 0 }
const selectSecurity = (choice) => {
  const previous = securityDisplay.querySelector('.security-panel:not([hidden])')
  const next = choice ? document.getElementById(choice.getAttribute('aria-controls')) : null
  if (previous !== next || mobileSecurity.matches) {
    securityTransition.incoming?.cancel()
    securityTransition.incoming = null
    securityRotation.elapsed = 0
  }
  securityChoices.forEach((item) => {
    const selected = item === choice
    item.dataset.selected = String(selected)
    if (mobileSecurity.matches) item.removeAttribute('aria-pressed')
    else item.setAttribute('aria-pressed', String(item === securityPin.choice))
    const expand = item.parentElement.querySelector('.security-expand')
    if (expand) {
      expand.setAttribute('aria-expanded', String(selected))
      expand.textContent = selected ? '−' : '+'
    }
    if (mobileSecurity.matches) item.setAttribute('aria-expanded', String(selected))
    else item.removeAttribute('aria-expanded')
    document.getElementById(item.getAttribute('aria-controls')).hidden = !selected
  })
  if (!mobileSecurity.matches && !motion.matches && previous && next && previous !== next) {
    securityTransition.incoming = next.animate([{ opacity: 0.72 }, { opacity: 1 }], {
      duration: 160,
      easing: 'ease-out'
    })
  }
}
const placeSecurityPanels = () => {
  securityPin.choice = null
  securityChoices.forEach((choice) => {
    const panel = document.getElementById(choice.getAttribute('aria-controls'))
    if (mobileSecurity.matches) (choice.closest('.security-link-row') ?? choice).after(panel)
    else securityDisplay.append(panel)
  })
  const selected = securityChoices.find((choice) => choice.dataset.selected === 'true')
  selectSecurity(mobileSecurity.matches ? null : (selected ?? securityChoices[0]))
}
placeSecurityPanels()
mobileSecurity.addEventListener('change', placeSecurityPanels)
securityChoices.forEach((choice) => {
  choice.addEventListener('pointerenter', (event) => {
    if (!mobileSecurity.matches && !securityPin.choice && event.pointerType === 'mouse') selectSecurity(choice)
  })
  choice.addEventListener('focus', () => {
    if (!mobileSecurity.matches && !securityPin.choice) selectSecurity(choice)
  })
  choice.addEventListener('click', () => {
    if (!mobileSecurity.matches) {
      securityPin.choice = securityPin.choice === choice ? null : choice
      securityRotation.resumeAt = performance.now() + 1000
      selectSecurity(choice)
      return
    }
    const collapse = mobileSecurity.matches && choice.getAttribute('aria-expanded') === 'true'
    selectSecurity(collapse ? null : choice)
  })
  choice.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse') securityRotation.resumeAt = performance.now() + 1000
  })
})
securityDisplay.addEventListener('pointerleave', (event) => {
  if (event.pointerType === 'mouse') securityRotation.resumeAt = performance.now() + 1000
})

const securityTickMs = 250
window.setInterval(() => {
  if (
    mobileSecurity.matches ||
    document.hidden ||
    motion.matches ||
    securityPin.choice !== null ||
    performance.now() < securityRotation.resumeAt ||
    securityChoices.some((choice) => choice.matches(':hover, :focus-visible')) ||
    securityDisplay.matches(':hover') ||
    securityDisplay.contains(document.activeElement)
  )
    return

  const bounds = securityLayers.getBoundingClientRect()
  if (bounds.top >= window.innerHeight || bounds.bottom <= 0) return

  securityRotation.elapsed += securityTickMs
  if (securityRotation.elapsed < 4000) return

  const selected = securityChoices.findIndex((choice) => choice.dataset.selected === 'true')
  selectSecurity(securityChoices[(selected + 1) % securityChoices.length])
}, securityTickMs)

const alertContainer = document.getElementById('security-alerts')
const renderSecurityAlerts = (data) => {
  if (
    !Array.isArray(data) ||
    data.some((item) => typeof item.message !== 'string' || !Number.isFinite(Date.parse(item.created_at)))
  )
    throw new Error('Invalid alert data')
  alertContainer.replaceChildren(
    ...data.slice(0, 20).map((item) => {
      const article = document.createElement('article')
      article.className = 'alert-item'
      const meta = document.createElement('div')
      meta.className = 'alert-meta'
      const protocol = document.createElement('span')
      protocol.textContent = String(item.protocol || 'Protocol').replace(/(^|[-_ ])\w/g, (part) =>
        part.replace(/[-_]/g, ' ').toUpperCase()
      )
      const time = document.createElement('time')
      time.dateTime = item.created_at
      time.textContent = new Date(item.created_at).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
      meta.append(protocol, time)
      const message = document.createElement('p')
      message.textContent = item.message
        .split('\n')
        .map((line) => line.replace(/\p{Extended_Pictographic}|\uFE0F|\u200D|\u20E3/gu, '').trim())
        .filter((line) => line && !/^\*?Protocol:/i.test(line))
        .slice(0, 1)
        .join(' · ')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[*`]/g, '')
        .slice(0, 180)
      message.title = message.textContent
      article.append(protocol, message, time)
      return article
    })
  )
  if (!data.length) alertContainer.textContent = 'No recent alerts returned.'
}
const refreshSecurityAlerts = async () => {
  try {
    const response = await fetch('https://curation.yearn.fi/api/monitoring/alerts?limit=20', {
      signal: AbortSignal.timeout(8000)
    })
    if (!response.ok) throw new Error('Alerts unavailable')
    const payload = await response.json()
    renderSecurityAlerts(payload.data)
  } catch {
    try {
      const response = await fetch(new URL('./security/alerts.json', import.meta.url))
      if (!response.ok) throw new Error('Snapshot unavailable')
      const snapshot = await response.json()
      renderSecurityAlerts(snapshot.data)
    } catch {
      alertContainer.textContent = 'Visit Yearn Curation to view monitoring alerts.'
    }
  }
}
refreshSecurityAlerts()
setInterval(() => {
  if (!document.hidden && !document.getElementById('security-monitoring').hidden) refreshSecurityAlerts()
}, 60000)

// Keep the actual rows selectable and linked, with manual scroll available at any time.
const autoScrollRegions = [...document.querySelectorAll('[data-auto-scroll]')].map((element) => {
  const state = { element, hovered: false, resumeAt: 0 }
  element.addEventListener('pointerenter', () => {
    state.hovered = true
  })
  element.addEventListener('pointerleave', () => {
    state.hovered = false
  })
  element.addEventListener(
    'wheel',
    () => {
      state.resumeAt = Date.now() + 5000
    },
    { passive: true }
  )
  element.addEventListener(
    'touchstart',
    () => {
      state.resumeAt = Date.now() + 10000
    },
    { passive: true }
  )
  return state
})
setInterval(() => {
  if (document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  autoScrollRegions.forEach((state) => {
    const element = state.element
    if (
      !element.checkVisibility() ||
      state.hovered ||
      element.contains(document.activeElement) ||
      Date.now() < state.resumeAt
    )
      return
    const bottom = element.scrollHeight - element.clientHeight
    if (bottom <= 0) return
    if (element.scrollTop >= bottom - 1) {
      element.scrollTop = 0
      state.resumeAt = Date.now() + 2000
    } else {
      element.scrollTop += 1
    }
  })
}, 60)

const mobileNavigation = document.getElementById('mobile-navigation')
const mobileMenuToggle = document.querySelector('.mobile-menu-toggle')
const mobileSections = document.getElementById('mobile-nav-sections')
document.querySelectorAll('.header-menus .nav-column').forEach((column) => {
  const section = document.createElement('details')
  section.className = 'mobile-nav-section'
  const summary = document.createElement('summary')
  summary.textContent = column.querySelector('h2').textContent
  const chevron = document.querySelector('.nav-chevron').cloneNode(true)
  summary.append(chevron)
  const links = document.createElement('div')
  column.querySelectorAll('a').forEach((link) => {
    links.append(link.cloneNode(true))
  })
  section.append(summary, links)
  mobileSections.append(section)
})
const closeMobileNavigation = () => mobileNavigation.close()
mobileMenuToggle.addEventListener('click', () => {
  closeHeaderMenus()
  mobileNavigation.showModal()
  mobileMenuToggle.setAttribute('aria-expanded', 'true')
  document.body.classList.add('mobile-nav-open')
})
mobileNavigation.querySelector('.mobile-menu-close').addEventListener('click', closeMobileNavigation)
mobileNavigation.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', closeMobileNavigation)
})
mobileNavigation.addEventListener('close', () => {
  document.body.classList.remove('mobile-nav-open')
  mobileMenuToggle.setAttribute('aria-expanded', 'false')
  mobileNavigation.querySelectorAll('details').forEach((section) => {
    section.open = false
  })
  if (mobileMenuToggle.checkVisibility()) mobileMenuToggle.focus()
})
matchMedia('(max-width: 900px)').addEventListener('change', (event) => {
  if (!event.matches && mobileNavigation.open) closeMobileNavigation()
})

// Animate the perimeter of the hero vaults link.
const svgElement = (tag, attributes) => {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag)
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value)
  })
  return element
}
const createHeroOutline = (target) => {
  const outline = target.querySelector('.hero-outline')
  const outlineStroke = outline.querySelector('.hero-outline-stroke')
  const outlineDefinitions = outline.querySelector('defs')
  const outlineMotion = { frame: null, length: 0, elapsed: 0, lastTimestamp: null, pieces: [], hoverProgress: 0 }
  const buildOutline = () => {
    const { width, height } = outline.getBoundingClientRect()
    const radius = Math.min(Number.parseFloat(getComputedStyle(target).borderRadius) || 0, height / 2, width / 2)
    const point = (cx, cy, angle) => [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]
    const line = (from, to) => ({ from, to, length: Math.hypot(to[0] - from[0], to[1] - from[1]), d: `M${from}L${to}` })
    const corner = (cx, cy, start) =>
      Array.from({ length: 4 }, (_, index) => {
        const from = point(cx, cy, start + (index * Math.PI) / 8)
        const to = point(cx, cy, start + ((index + 1) * Math.PI) / 8)
        return { from, to, length: (radius * Math.PI) / 8, d: `M${from}A${radius},${radius} 0 0 1 ${to}` }
      })
    const geometry = [
      line([radius, 0], [width - radius, 0]),
      ...corner(width - radius, radius, -Math.PI / 2),
      line([width, radius], [width, height - radius]),
      ...corner(width - radius, height - radius, 0),
      line([width - radius, height], [radius, height]),
      ...corner(radius, height - radius, Math.PI / 2),
      line([0, height - radius], [0, radius]),
      ...corner(radius, radius, Math.PI)
    ]
    outlineDefinitions.replaceChildren()
    outlineStroke.replaceChildren()
    outlineMotion.length = geometry.reduce((total, piece) => total + piece.length, 0)
    outlineMotion.pieces = geometry.map((piece, index) => {
      const id = `outline-hero-edge-${index}`
      const gradient = svgElement('linearGradient', {
        id,
        gradientUnits: 'userSpaceOnUse',
        x1: piece.from[0],
        y1: piece.from[1],
        x2: piece.to[0],
        y2: piece.to[1]
      })
      const stops = Array.from({ length: 6 }, () => svgElement('stop', { 'stop-color': 'currentColor' }))
      gradient.append(...stops)
      outlineDefinitions.append(gradient)
      outlineStroke.append(svgElement('path', { d: piece.d, stroke: `url(#${id})` }))
      return { ...piece, start: geometry.slice(0, index).reduce((total, part) => total + part.length, 0), stops }
    })
  }
  const paintStroke = (position, coverage, blueMix) => {
    const total = outlineMotion.length
    const head = position * total
    const trail = 0.18 * total
    const blueTrail = coverage * total
    const blueTail = (head - blueTrail + total) % total
    const tail = (head - trail + total) % total
    const alphaAt = (distance) => {
      const behind = (head - distance + total) % total
      const greyAlpha = behind <= trail ? 1 - behind / trail : 0
      const blueAlpha = behind <= blueTrail ? 1 - behind / blueTrail : 0
      return greyAlpha + (blueAlpha - greyAlpha) * blueMix
    }
    if (total > 0)
      outlineMotion.pieces.forEach((piece) => {
        const end = piece.start + piece.length
        const boundaries = [
          ...(blueTail > piece.start && blueTail < end
            ? [{ offset: (blueTail - piece.start) / piece.length, alpha: 0 }]
            : []),
          ...(trail < total && tail > piece.start && tail < end
            ? [{ offset: (tail - piece.start) / piece.length, alpha: alphaAt(tail) }]
            : []),
          ...(head > piece.start && head < end
            ? [
                { offset: (head - piece.start) / piece.length, alpha: alphaAt(head) },
                { offset: (head - piece.start) / piece.length, alpha: 0 }
              ]
            : [])
        ].sort((a, b) => a.offset - b.offset)
        const values = [{ offset: 0, alpha: alphaAt(piece.start) }, ...boundaries, { offset: 1, alpha: alphaAt(end) }]
        piece.stops.forEach((stop, index) => {
          const value = values[Math.min(index, values.length - 1)]
          stop.setAttribute('offset', value.offset)
          stop.setAttribute('stop-opacity', value.alpha)
        })
      })
  }
  new ResizeObserver(buildOutline).observe(target)
  const paintOutline = (timestamp) => {
    const delta = outlineMotion.lastTimestamp === null ? 0 : timestamp - outlineMotion.lastTimestamp
    outlineMotion.elapsed += delta
    outlineMotion.lastTimestamp = timestamp
    const hovered = target.matches(':hover, :focus-visible')
    outlineMotion.hoverProgress = Math.max(
      0,
      Math.min(1, outlineMotion.hoverProgress + ((hovered ? 1 : -1) * delta) / 450)
    )
    paintStroke((outlineMotion.elapsed % 10666.667) / 10666.667, 0.95, outlineMotion.hoverProgress)
    outlineMotion.frame = document.hidden ? null : requestAnimationFrame(paintOutline)
  }
  const resumeOutline = () => {
    if (!document.hidden && outlineMotion.frame === null) {
      outlineMotion.lastTimestamp = null
      outlineMotion.frame = requestAnimationFrame(paintOutline)
    }
  }
  document.addEventListener('visibilitychange', resumeOutline)
  window.addEventListener('pageshow', resumeOutline)
  resumeOutline()
}
createHeroOutline(select('#tagline'))

const partnerSweep = select('.partners-section')
partnerSweep.addEventListener('pointerenter', (event) => {
  if (event.pointerType !== 'mouse' || !matchMedia('(hover: hover) and (pointer: fine)').matches) return
  if (partnerSweep.classList.contains('is-sweeping')) return
  partnerSweep.classList.add('is-sweeping')
})
partnerSweep.addEventListener('animationend', (event) => {
  if (event.animationName === 'partner-border-sweep') partnerSweep.classList.remove('is-sweeping')
})
