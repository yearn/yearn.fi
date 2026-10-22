const select = (selector) => document.querySelector(selector)
const money = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const usd = (value) => `$${money.format(value)}`
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
const state = { frame: null, data: null }
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
const renderCounter = (data) => {
  cancelAnimationFrame(state.frame)
  const latest = Number(data.earningsUsd)
  const [previous, current] = data.weeklyPoints
  const rate = (Number(current.earningsUsd) - Number(previous.earningsUsd)) / (current.timestamp - previous.timestamp)
  const duration = 120
  const startValue = latest - rate * duration
  const started = performance.now()
  const paint = (value) => {
    select('#earnings').textContent = earningsMoney.format(value)
    select('#yield-earned').textContent = usd(value)
  }
  // Keep the accessible value stable; only the visual number replays toward the recorded snapshot.
  select('.counter').setAttribute(
    'aria-label',
    `${earningsUsd(latest)} in reported lifetime earnings at the captured snapshot`
  )
  const tick = (now) => {
    const elapsed = Math.min(duration, (now - started) / 1000)
    paint(startValue + rate * elapsed)
    if (elapsed < duration) state.frame = requestAnimationFrame(tick)
  }
  if (!Number.isFinite(rate) || rate <= 0) {
    paint(latest)
    return
  }
  tick(performance.now())
}
const load = async () => {
  try {
    const response = await fetch(new URL('./data.json', import.meta.url), { cache: 'no-store' })
    if (!response.ok) throw new Error('Snapshot unavailable')
    const data = await response.json()
    if (
      ![data.earningsUsd, data.feesUsd, data.tvlUsd].every((value) => value !== null && Number.isFinite(Number(value)))
    )
      throw new Error('Invalid snapshot')
    state.data = data
    renderCounter(data)
    select('#tvl').textContent = usd(Number(data.tvlUsd))
    select('#vaults-deployed').textContent = Number.isInteger(data.vaultsDeployed)
      ? money.format(data.vaultsDeployed)
      : 'Unavailable'
    select('#harvest-count').textContent = Number.isInteger(data.harvestCount)
      ? money.format(data.harvestCount)
      : 'Unavailable'
    select('#fees-value').textContent = usd(Number(data.feesUsd))
    select('#earnings-note').textContent = `${earningsUsd(Number(data.earningsUsd))}. ${data.methodology.earnings}`
    select('#animation-note').textContent =
      'The counter replays the final two minutes approaching the recorded total, using the measured Oct 5–12 weekly rate. It stops at that total. It is an illustration of pace, not live earnings or a forecast. The counter updates smoothly regardless of reduced-motion preferences; other site animations still respect them.'
    select('#tvl-note').textContent = `${data.methodology.tvl} Snapshot: ${date(data.tvlAsOf)}.`
    select('#fees-note').textContent = data.methodology.fees
    select('#vaults-note').textContent =
      data.methodology.vaults ?? 'Vault inventory metadata is unavailable in this snapshot.'
    select('#harvests-note').textContent = data.activityCounts?.harvestCutoff
      ? `${data.methodology.harvests ?? 'Recorded V2 and V3 strategy reports.'} Reporting cutoff: ${date(data.activityCounts.harvestCutoff)} (exclusive, UTC).`
      : 'Harvest reporting metadata is unavailable in this snapshot.'
    select('#capture-date').textContent =
      `Captured ${new Date(data.capturedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}. Each metric retains its own source reporting boundary.`
  } catch (error) {
    console.error('Unable to load the landing statistics snapshot:', error)
    cancelAnimationFrame(state.frame)
    state.data = null
    select('#earnings').textContent = 'Unavailable'
    select('.counter').style.fontSize = 'clamp(36px, 9vw, 120px)'
    select('.currency').hidden = true
    select('.counter').setAttribute('aria-label', 'Earnings snapshot unavailable')
    select('#earnings-note').textContent = 'The captured data could not be loaded. Refresh to try again.'
    select('#animation-note').textContent = 'Animation is paused until the snapshot is available.'
    select('#tvl-note').textContent = 'Unavailable. No zero value has been substituted.'
    select('#fees-note').textContent = 'Unavailable. No zero value has been substituted.'
    select('#vaults-note').textContent = 'Unavailable. No zero value has been substituted.'
    select('#harvests-note').textContent = 'Unavailable. No zero value has been substituted.'
    ;['#yield-earned', '#tvl', '#fees-value', '#vaults-deployed', '#harvest-count'].forEach((selector) => {
      select(selector).textContent = 'Unavailable'
    })
    select('#replay').disabled = true
  }
}
select('#replay').addEventListener('click', () => {
  notes.close()
  window.scrollTo({ top: 0, behavior: motion.matches ? 'instant' : 'smooth' })
  if (state.data) renderCounter(state.data)
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
    item.setAttribute('aria-pressed', String(selected))
    if (mobileSecurity.matches) item.setAttribute('aria-expanded', String(selected))
    else item.removeAttribute('aria-expanded')
    document.getElementById(item.getAttribute('aria-controls')).hidden = !selected
  })
}
const placeSecurityPanels = () => {
  securityChoices.forEach((choice) => {
    const panel = document.getElementById(choice.getAttribute('aria-controls'))
    if (mobileSecurity.matches) choice.after(panel)
    else securityDisplay.append(panel)
  })
  const selected = securityChoices.find((choice) => choice.getAttribute('aria-pressed') === 'true')
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
  choice.addEventListener('click', () => {
    const collapse = mobileSecurity.matches && choice.getAttribute('aria-expanded') === 'true'
    selectSecurity(collapse ? null : choice)
    if (mobileSecurity.matches && !collapse) choice.scrollIntoView({ block: 'start', behavior: 'instant' })
  })
})
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
