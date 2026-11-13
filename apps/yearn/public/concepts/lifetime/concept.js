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
    renderStat('#tvl', value, true)
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
    select('#tvl-note').textContent =
      `Uses the same published metrics baseline and estimated growth as the hero, abbreviated for display. Baseline: ${usd(data.metrics.totalTvlUsd)}. Reporting boundary: ${date(data.metrics.asOfTimestamp)}. Includes source overlap and bridge deductions; the display label does not apply an endorsed-only filter.`
    select('#animation-note').textContent =
      `Estimated TVL starts at the latest published metrics value when this mockup was captured (${new Date(data.anchor.timestamp * 1000).toISOString()}). It then adds $${data.growth.estimatedUsdPerSecond.toFixed(9)} per second: $${data.growth.yearnScheduledUnlockUsdPerSecond.toFixed(9)} of Yearn scheduled unlocking plus $${data.growth.morphoProjectedNetAccrualUsdPerSecond.toFixed(9)} of estimated Morpho net accrual. The growth model is dated ${new Date(data.growth.asOfTimestamp * 1000).toISOString()}; ${data.growth.valuedRoots} of ${data.growth.selectedRoots} roots are valued. This is a constant-rate presentation estimate beyond the sampled pilot curve, not live measured TVL or a guarantee of future interest. Metrics TVL already includes locked profit, so this animation does not imply new measured totalAssets. Reloads and tabs use the same shared anchor and wall-clock formula. Device clock differences affect the estimate. The counter animates independently of reduced-motion preferences.`
  } catch (error) {
    console.error('Unable to load the TVL counter:', error)
    stopCounter()
    state.data = null
    select('#tvl').textContent = 'Unavailable'
    select('#tvl').removeAttribute('title')
    select('#tvl').removeAttribute('aria-label')
    select('#tvl-note').textContent = 'Unavailable. No zero value has been substituted.'
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
    ;['#tvl', '#assets-secured-value', '#vaults-deployed', '#harvest-count'].forEach((selector) => {
      select(selector).textContent = 'Unavailable'
    })
  }
}
select('#replay').addEventListener('click', () => {
  notes.close()
  window.scrollTo({ top: 0, behavior: motion.matches ? 'instant' : 'smooth' })
  loadHero()
})
if ('IntersectionObserver' in window) {
  document.body.classList.add('has-observer')
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible')
          observer.unobserve(entry.target)
        }
      })
    },
    { threshold: 0.12 }
  )
  document.querySelectorAll('.reveal').forEach((element) => {
    observer.observe(element)
  })
}
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
const selectSecurity = (choice) => {
  securityChoices.forEach((item) => {
    const selected = item === choice
    item.dataset.selected = String(selected)
    if (item.tagName === 'BUTTON') item.setAttribute('aria-pressed', String(selected))
    const expand = item.parentElement.querySelector('.security-expand')
    if (expand) {
      expand.setAttribute('aria-expanded', String(selected))
      expand.textContent = selected ? '−' : '+'
    }
    if (mobileSecurity.matches) item.setAttribute('aria-expanded', String(selected))
    else item.removeAttribute('aria-expanded')
    document.getElementById(item.getAttribute('aria-controls')).hidden = !selected
  })
}
const placeSecurityPanels = () => {
  securityChoices.forEach((choice) => {
    const panel = document.getElementById(choice.getAttribute('aria-controls'))
    if (mobileSecurity.matches) (choice.closest('.security-link-row') ?? choice).after(panel)
    else securityDisplay.append(panel)
  })
  const selected = securityChoices.find((choice) => choice.dataset.selected === 'true')
  selectSecurity(selected ?? (mobileSecurity.matches ? null : securityChoices[0]))
}
placeSecurityPanels()
mobileSecurity.addEventListener('change', placeSecurityPanels)
securityChoices.forEach((choice) => {
  choice.addEventListener('pointerenter', (event) => {
    if (!mobileSecurity.matches && event.pointerType === 'mouse') selectSecurity(choice)
  })
  choice.addEventListener('focus', () => {
    if (!mobileSecurity.matches) selectSecurity(choice)
  })
  const toggle = choice.parentElement.querySelector('.security-expand') ?? choice
  if (choice.tagName === 'A') choice.addEventListener('click', () => selectSecurity(choice))
  toggle.addEventListener('click', () => {
    const collapse = mobileSecurity.matches && choice.getAttribute('aria-expanded') === 'true'
    selectSecurity(collapse ? null : choice)
    if (mobileSecurity.matches && !collapse) choice.scrollIntoView({ block: 'start', behavior: 'instant' })
  })
})
// Rotate desktop panels only; mobile keeps its user-controlled accordion.
const securitySection = document.getElementById('security')
const securityRotation = { timer: null, hovered: false }
const stopSecurityRotation = () => {
  clearTimeout(securityRotation.timer)
  securityRotation.timer = null
}
const scheduleSecurityRotation = () => {
  stopSecurityRotation()
  securityRotation.timer = setTimeout(() => {
    const bounds = securitySection.getBoundingClientRect()
    if (
      !mobileSecurity.matches &&
      !motion.matches &&
      !document.hidden &&
      !securityRotation.hovered &&
      !securitySection.contains(document.activeElement) &&
      bounds.top < window.innerHeight &&
      bounds.bottom > 0
    ) {
      const index = securityChoices.findIndex((choice) => choice.dataset.selected === 'true')
      selectSecurity(securityChoices[(index + 1) % securityChoices.length])
    }
    scheduleSecurityRotation()
  }, 4000)
}
securitySection.addEventListener('pointerenter', (event) => {
  if (event.pointerType !== 'mouse') return
  securityRotation.hovered = true
  stopSecurityRotation()
})
securitySection.addEventListener('pointerleave', () => {
  securityRotation.hovered = false
  scheduleSecurityRotation()
})
securitySection.addEventListener('focusin', stopSecurityRotation)
securitySection.addEventListener('focusout', scheduleSecurityRotation)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopSecurityRotation()
  else scheduleSecurityRotation()
})
scheduleSecurityRotation()

const alertContainer = document.getElementById('security-alerts')
const alertStatus = document.getElementById('alert-status')
const renderSecurityAlerts = (data, status) => {
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
  alertStatus.textContent = status
}
const refreshSecurityAlerts = async () => {
  try {
    const response = await fetch('https://curation.yearn.fi/api/monitoring/alerts?limit=20', {
      signal: AbortSignal.timeout(8000)
    })
    if (!response.ok) throw new Error('Alerts unavailable')
    const payload = await response.json()
    renderSecurityAlerts(payload.data, 'Updated just now · refreshes every minute')
  } catch {
    try {
      const response = await fetch(new URL('./security/alerts.json', import.meta.url))
      if (!response.ok) throw new Error('Snapshot unavailable')
      const snapshot = await response.json()
      renderSecurityAlerts(snapshot.data, `Snapshot · ${snapshot.capturedAt}`)
    } catch {
      alertStatus.textContent = 'Alerts unavailable'
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
  const visible = window.scrollY > 12
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
