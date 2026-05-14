export const OPEN_TABS_ACTION = 'open-tabs'

const lineBreakPattern = /\r\n?|\n/g

export function normalizeLines(text, deduplicate) {
  const lines = text
    .split(lineBreakPattern)
    .map((line) => line.trim())
    .filter(Boolean)

  return deduplicate ? Array.from(new Set(lines)) : lines
}

export function countEntries(text, deduplicate) {
  return normalizeLines(text, deduplicate).length
}

export function buildTabTargets(text, options) {
  return normalizeLines(text, options.deduplicate)
}

export async function openTabsFromRequest(request) {
  const targets = buildTabTargets(request.text, request)

  for (const target of targets) {
    await chrome.tabs.create({
      url: target,
      active: false
    })
  }
}

export async function readCurrentWindowUrls() {
  const tabs = await chrome.tabs.query({ currentWindow: true })
  return tabs
    .map((tab) => tab.url)
    .filter((url) => typeof url === 'string' && url.length > 0)
    .join('\n')
}
