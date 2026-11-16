import { counterValueAt } from './counter-model.mjs'

const select = (selector) => document.querySelector(selector)
const money = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const usd = (value) => `$${money.format(value)}`
const compactNumber = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 0,
  roundingMode: 'trunc'
})
const renderStat = (selector, value, currency = false) => {
  const element = select(selector)
  element.textContent = `${currency ? '$' : ''}${compactNumber.format(value)}`
  const fullValue = currency ? usd(value) : money.format(value)
  element.title = fullValue
  element.setAttribute('aria-label', fullValue)
}
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
const load = async () => {
  try {
    const response = await fetch(new URL('./data.json', import.meta.url), { cache: 'no-store' })
    if (!response.ok) throw new Error('Snapshot unavailable')
    const data = await response.json()
    if (
      ![data.earningsUsd, data.feesUsd, data.tvlUsd].every((value) => value !== null && Number.isFinite(Number(value)))
    )
      throw new Error('Invalid snapshot')
    renderStat('#yield-earned', Number(data.earningsUsd), true)
    select('#yield-note').textContent =
      `${data.methodology.earnings} Snapshot captured ${new Date(data.capturedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}.`
    if (Number.isFinite(data.assetsSecured?.usd)) renderStat('#assets-secured-value', data.assetsSecured.usd, true)
    else select('#assets-secured-value').textContent = 'Unavailable'
    if (Number.isInteger(data.vaultsDeployed)) renderStat('#vaults-deployed', data.vaultsDeployed)
    else select('#vaults-deployed').textContent = 'Unavailable'
    if (Number.isInteger(data.harvestCount)) renderStat('#harvest-count', data.harvestCount)
    else select('#harvest-count').textContent = 'Unavailable'
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
    ;['#yield-earned', '#assets-secured-value', '#vaults-deployed', '#harvest-count'].forEach((selector) => {
      select(selector).textContent = 'Unavailable'
    })
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
const revealElements = [...document.querySelectorAll('.partners-section, #your-way, #security, #integrators')]
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
    const isPartners = element.classList.contains('partners-section')
    const inset = isPartners ? revealInset / 2 : revealInset
    const distance = isPartners ? (Math.min(180, window.innerHeight * 0.2) + fadeDistance) / 2 : fadeDistance
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

load()
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
const securityDisplay = document.querySelector('.security-display')
const securityPin = { choice: null }
const securityTransition = { outgoing: null, incoming: null }
const selectSecurity = (choice) => {
  const previous = securityDisplay.querySelector('.security-panel:not([hidden]):not(.security-panel-outgoing)')
  const next = choice ? document.getElementById(choice.getAttribute('aria-controls')) : null
  const crossfade = !mobileSecurity.matches && !motion.matches && previous && next && previous !== next
  if (previous !== next || mobileSecurity.matches) {
    securityTransition.incoming?.cancel()
    securityTransition.outgoing?.remove()
    securityTransition.outgoing = null
  }
  const outgoing = crossfade ? previous.cloneNode(true) : null
  if (outgoing) {
    outgoing.classList.add('security-panel-outgoing')
    outgoing.removeAttribute('id')
    outgoing.removeAttribute('aria-labelledby')
    outgoing.querySelectorAll('[id]').forEach((element) => {
      element.removeAttribute('id')
    })
    outgoing.setAttribute('aria-hidden', 'true')
    outgoing.inert = true
    const originals = [...previous.querySelectorAll('[data-auto-scroll], .vault-code')]
    outgoing.querySelectorAll('[data-auto-scroll], .vault-code').forEach((element, index) => {
      element.scrollTop = originals[index].scrollTop
    })
  }
  securityChoices.forEach((item) => {
    const selected = item === choice
    item.dataset.selected = String(selected)
    if (mobileSecurity.matches) item.removeAttribute('aria-pressed')
    else item.setAttribute('aria-pressed', String(item === securityPin.choice))
    item.classList.toggle('is-pinned', !mobileSecurity.matches && item === securityPin.choice)
    const expand = item.parentElement.querySelector('.security-expand')
    if (expand) {
      expand.setAttribute('aria-expanded', String(selected))
      expand.textContent = selected ? '−' : '+'
    }
    if (mobileSecurity.matches) item.setAttribute('aria-expanded', String(selected))
    else item.removeAttribute('aria-expanded')
    document.getElementById(item.getAttribute('aria-controls')).hidden = !selected
  })
  if (outgoing) {
    securityDisplay.append(outgoing)
    securityTransition.outgoing = outgoing
    const fade = outgoing.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease-in' })
    fade.onfinish = () => {
      outgoing.remove()
    }
    securityTransition.incoming = next.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 320,
      delay: 90,
      fill: 'backwards',
      easing: 'ease-in-out'
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
})
// One clock drives both the selected panel and its travelling underline.
const securitySection = document.getElementById('security')
const securityRotation = { elapsed: 0, lastTimestamp: null, index: 0, pieces: [], resumeAt: 0, returning: false }

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

const hero = select('.hero')
const heroStatistics = select('.hero-statistics')
const statsBarObserver = new ResizeObserver(([entry]) => {
  heroStatistics.style.setProperty('--stats-bar-height', `${entry.borderBoxSize[0].blockSize}px`)
})
statsBarObserver.observe(heroStatistics)
const updateHeroStatistics = () => {
  const progress = Math.min(1, Math.max(0, window.scrollY / 120))
  hero.style.setProperty('--stats-progress', String(progress))
  const visible = progress > 0
  hero.classList.toggle('has-scrolled', window.scrollY > 12)
  hero.classList.toggle('stats-visible', visible)
  heroStatistics.inert = !visible
}
window.addEventListener('scroll', updateHeroStatistics, { passive: true })
window.addEventListener('pageshow', updateHeroStatistics)
select('.scroll-link').addEventListener('click', (event) => {
  event.preventDefault()
  const stop = select('.hero-stats-stop')
  window.scrollTo({
    top: stop.getBoundingClientRect().top + window.scrollY,
    behavior: motion.matches ? 'instant' : 'smooth'
  })
})
updateHeroStatistics()

// Reuse the same perimeter-based fade for hero and card outlines.
const svgElement = (tag, attributes) => {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag)
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value)
  })
  return element
}
const createTravellingOutline = (
  target,
  instance,
  hoverOnly = false,
  coverage = hoverOnly ? 0.6 : 0.95,
  direction = 1
) => {
  const outline =
    target.querySelector('.hero-outline') ??
    svgElement('svg', { class: 'hero-outline', 'aria-hidden': 'true', focusable: 'false' })
  if (!outline.parentElement) {
    outline.append(svgElement('defs', {}), svgElement('g', { class: 'hero-outline-stroke' }))
    target.append(outline)
  }
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
      const id = `outline-${instance}-edge-${index}`
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
  new ResizeObserver(buildOutline).observe(target)
  const paintOutline = (timestamp) => {
    const delta = outlineMotion.lastTimestamp === null ? 0 : timestamp - outlineMotion.lastTimestamp
    outlineMotion.elapsed += delta
    outlineMotion.lastTimestamp = timestamp
    const hovered = target.matches(':hover, :focus-visible, .is-pinned')
    outlineMotion.hoverProgress = Math.max(
      0,
      Math.min(1, outlineMotion.hoverProgress + ((hovered ? 1 : -1) * delta) / 450)
    )
    const total = outlineMotion.length
    const head = (((((direction * outlineMotion.elapsed) % 10666.667) + 10666.667) % 10666.667) / 10666.667) * total
    const trail = 0.18 * total
    const blueTrail = typeof coverage === 'function' ? coverage(total) : coverage * total
    const blueTail = (head - direction * blueTrail + total) % total
    const tail = (head - direction * trail + total) % total
    const alphaAt = (distance) => {
      const behind = (direction * (head - distance) + total) % total
      const greyAlpha = !hoverOnly && behind <= trail ? 1 - behind / trail : 0
      const blueAlpha = behind <= blueTrail ? 1 - behind / blueTrail : 0
      return greyAlpha + (blueAlpha - greyAlpha) * outlineMotion.hoverProgress
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
                { offset: (head - piece.start) / piece.length, alpha: direction === 1 ? alphaAt(head) : 0 },
                { offset: (head - piece.start) / piece.length, alpha: direction === 1 ? 0 : alphaAt(head) }
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
    outlineMotion.frame =
      document.hidden || (hoverOnly && !hovered && outlineMotion.hoverProgress === 0)
        ? null
        : requestAnimationFrame(paintOutline)
  }
  const resumeOutline = () => {
    if (!document.hidden && outlineMotion.frame === null) {
      outlineMotion.lastTimestamp = null
      outlineMotion.frame = requestAnimationFrame(paintOutline)
    }
  }
  document.addEventListener('visibilitychange', resumeOutline)
  window.addEventListener('pageshow', resumeOutline)
  if (hoverOnly) {
    ;['pointerenter', 'pointerleave', 'focus', 'blur', 'click'].forEach((event) => {
      target.addEventListener(event, resumeOutline)
    })
  } else resumeOutline()
}
createTravellingOutline(select('#tagline'), 'hero')
document.querySelectorAll('.infrastructure-card').forEach((card, index) => {
  createTravellingOutline(card, `infrastructure-${index}`, true)
})

const securityTrailLength = 180
securityChoices.forEach((choice, index) => {
  createTravellingOutline(choice, `security-${index}`, true, () => securityTrailLength, index % 2 === 0 ? -1 : 1)
  choice.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse') securityRotation.resumeAt = performance.now() + 1000
  })
})
securityDisplay.addEventListener('pointerleave', (event) => {
  if (event.pointerType === 'mouse') securityRotation.resumeAt = performance.now() + 1000
})
const securityLayers = select('.security-layers')
const securitySnake = svgElement('svg', { class: 'security-snake', 'aria-hidden': 'true', focusable: 'false' })
const snakeDefinitions = svgElement('defs', {})
const snakeStroke = svgElement('g', { class: 'security-snake-stroke' })
securitySnake.append(snakeDefinitions, snakeStroke)
securityLayers.append(securitySnake)
const buildSecuritySnake = () => {
  if (mobileSecurity.matches) return
  const origin = securityLayers.getBoundingClientRect()
  snakeDefinitions.replaceChildren()
  snakeStroke.replaceChildren()
  const cards = securityChoices.map((choice) => choice.getBoundingClientRect())
  securityRotation.pieces = [...cards, cards[0]].map((card, index) => {
    const left = card.left - origin.left
    const right = card.right - origin.left
    const bottom = card.bottom - origin.top
    const top = index === 0 ? card.top - origin.top : cards[index - 1].bottom - origin.top
    const startX = index % 2 === 0 ? left : right
    const endX = index % 2 === 0 ? right : left
    const vertical = bottom - top
    const horizontal = right - left
    const geometry =
      index === cards.length
        ? [{ from: [left, top], to: [left, card.top - origin.top], start: 0, length: top - (card.top - origin.top) }]
        : [
            { from: [startX, top], to: [startX, bottom], start: 0, length: vertical },
            { from: [startX, bottom], to: [endX, bottom], start: vertical, length: horizontal }
          ]
    return {
      length: geometry.reduce((sum, edge) => sum + edge.length, 0),
      edges: geometry.map((edge, edgeIndex) => {
        const id = `security-snake-${index}-${edgeIndex}`
        const gradient = svgElement('linearGradient', {
          id,
          gradientUnits: 'userSpaceOnUse',
          x1: edge.from[0],
          y1: edge.from[1],
          x2: edge.to[0],
          y2: edge.to[1]
        })
        const stops = Array.from({ length: 5 }, () => svgElement('stop', { 'stop-color': '#0657f9' }))
        gradient.append(...stops)
        snakeDefinitions.append(gradient)
        snakeStroke.append(svgElement('path', { d: `M${edge.from}L${edge.to}`, stroke: `url(#${id})` }))
        return { ...edge, stops }
      })
    }
  })
}
new ResizeObserver(buildSecuritySnake).observe(securityLayers)
const paintSecuritySnake = (timestamp) => {
  const bounds = securitySection.getBoundingClientRect()
  const interacting =
    securityPin.choice !== null ||
    securityChoices.some((choice) => choice.matches(':hover, :focus-visible')) ||
    securityDisplay.matches(':hover') ||
    securityDisplay.contains(document.activeElement)
  const running =
    !mobileSecurity.matches &&
    !document.hidden &&
    !motion.matches &&
    !interacting &&
    timestamp >= securityRotation.resumeAt &&
    bounds.top < window.innerHeight &&
    bounds.bottom > 0
  const selected = securityChoices.findIndex((choice) => choice.dataset.selected === 'true')
  if (selected >= 0 && selected !== securityRotation.index) {
    securityRotation.index = selected
    securityRotation.elapsed = 0
    securityRotation.returning = false
  }
  const delta = securityRotation.lastTimestamp === null ? 0 : Math.min(100, timestamp - securityRotation.lastTimestamp)
  securityRotation.lastTimestamp = timestamp
  const duration = securityRotation.returning ? 2550 : 4000
  if (running) {
    securityRotation.elapsed += delta
    if (securityRotation.elapsed >= duration) {
      securityRotation.elapsed %= duration
      if (securityRotation.returning) {
        securityRotation.returning = false
        securityRotation.index = 0
      } else if (securityRotation.index === securityChoices.length - 1) {
        securityRotation.returning = true
      } else securityRotation.index += 1
      selectSecurity(securityChoices[securityRotation.index])
    }
  }
  securitySnake.classList.toggle('is-running', running)
  securitySnake.dataset.phase = securityRotation.returning ? 'return' : 'carousel'
  const routeIndex = securityRotation.returning ? securityChoices.length : securityRotation.index
  const current = securityRotation.pieces[routeIndex]
  const progress = securityRotation.returning
    ? Math.min(1, Math.max(0, securityRotation.elapsed - 250) / 1800)
    : securityRotation.elapsed / 4000
  // After the final card, follow the left edge upwards without changing its panel.
  const head =
    securityRotation.pieces.slice(0, routeIndex).reduce((sum, piece) => sum + piece.length, 0) +
    (current?.length ?? 0) * progress
  snakeStroke.style.opacity = securityRotation.returning
    ? String(1 - 0.75 * Math.min(1, securityRotation.elapsed / 250))
    : '1'
  const trail = securityTrailLength
  securityRotation.pieces.forEach((piece, index) => {
    const base = securityRotation.pieces.slice(0, index).reduce((sum, part) => sum + part.length, 0)
    piece.edges.forEach((edge) => {
      const start = base + edge.start
      const alpha = (distance) => Math.max(0, Math.min(1, 1 - (head - distance) / trail)) * (distance <= head ? 1 : 0)
      const boundaries = [
        { offset: 0, alpha: alpha(start) },
        ...(head - trail > start && head - trail < start + edge.length
          ? [{ offset: (head - trail - start) / edge.length, alpha: 0 }]
          : []),
        ...(head >= start && head < start + edge.length
          ? [
              { offset: (head - start) / edge.length, alpha: 1 },
              { offset: (head - start) / edge.length, alpha: 0 }
            ]
          : []),
        { offset: 1, alpha: alpha(start + edge.length) }
      ]
      edge.stops.forEach((stop, stopIndex) => {
        const value = boundaries[Math.min(stopIndex, boundaries.length - 1)]
        stop.setAttribute('offset', value.offset)
        stop.setAttribute('stop-opacity', value.alpha)
      })
    })
  })
  requestAnimationFrame(paintSecuritySnake)
}
requestAnimationFrame(paintSecuritySnake)

const partnerSweep = select('.partners-section')
partnerSweep.addEventListener('pointerenter', (event) => {
  if (event.pointerType !== 'mouse' || !matchMedia('(hover: hover) and (pointer: fine)').matches) return
  if (partnerSweep.classList.contains('is-sweeping')) return
  partnerSweep.classList.add('is-sweeping')
})
partnerSweep.addEventListener('animationend', (event) => {
  if (event.animationName === 'partner-border-sweep') partnerSweep.classList.remove('is-sweeping')
})
