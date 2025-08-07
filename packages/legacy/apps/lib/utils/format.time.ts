import dayjs, { extend } from 'dayjs'
import dayjsDuration from 'dayjs/plugin/duration'
import relativeTime from 'dayjs/plugin/relativeTime'

extend(relativeTime)
extend(dayjsDuration)

/* 🔵 - Yearn Finance ******************************************************
 ** Bunch of function using the power of the browsers and standard functions
 ** to correctly format date
 **************************************************************************/
export function date(value: number, withDate = true, separator = '/'): string {
  let locale = 'fr-FR'
  if (typeof navigator !== 'undefined') {
    locale = navigator.language || 'fr-FR'
  }

  let formatedDate = new Intl.DateTimeFormat([locale, 'en-US'], {
    dateStyle: 'short',
    timeStyle: 'short',
    hourCycle: 'h24'
  }).format(value)
  if (!withDate) {
    formatedDate = new Intl.DateTimeFormat([locale, 'en-US'], {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    }).format(value)
  }
  if (separator !== '/') {
    formatedDate = formatedDate.replace(/\//g, separator)
  }
  return formatedDate
}

export function since(value: number): string {
  return dayjs(value).from(dayjs())
}

export function duration(value: number, withSuffix?: boolean): string {
  return dayjs.duration(value, 'milliseconds').humanize(withSuffix)
}

export { date as formatDate }
export { since as formatSince }
export { duration as formatDuration }
