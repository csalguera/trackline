export function detectBrowserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

export function formatTimestamp(value: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone,
  }).format(new Date(value))
}

export function formatEventTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone }).format(new Date(value))
}

export function formatEventDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone }).format(new Date(value))
}

export function formatEventDay(value: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', { day: '2-digit', timeZone }).format(new Date(value))
}

export function formatEventMonth(value: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', timeZone }).format(new Date(value)).toUpperCase()
}

export function timeZoneLabel(timeZone: string) {
  return timeZone.replace(/_/g, ' ').replace('America/', '').replace('Europe/', '')
}
