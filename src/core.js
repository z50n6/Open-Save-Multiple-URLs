export const OPEN_TABS_ACTION = 'open-tabs'
export const NO_TAB_GROUP_ID = -1
export const NEW_TAB_GROUP_ID = -2

const lineBreakPattern = /\r\n?|\n/g
const urlPattern =
  /\b((?:[a-z][\w-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.-]+[.][a-z]{2,}\/?)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()[\]{};:'".,<>?«»“”‘’]))/gi

export function extractUrls(text) {
  const matches = text.match(urlPattern) ?? []
  return matches.join('\n')
}

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

function hasKnownScheme(value) {
  return /^[a-z][a-z0-9+\-.]*:\/\//i.test(value)
}

function looksLikeUrlWithoutScheme(value) {
  if (/\s/.test(value)) {
    return false
  }

  return /^localhost(?::\d+)?(\/|$)/i.test(value) || /^(www\.)/i.test(value) || /\.[a-z]{2,}(\/|$)/i.test(value)
}

function shuffle(items) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

export function buildTabTargets(text, options) {
  let lines = normalizeLines(text, options.deduplicate)

  if (options.reverseOrder) {
    lines = [...lines].reverse()
  }

  if (options.randomOrder) {
    lines = shuffle(lines)
  }

  return lines.map((line) => {
    const search = !hasKnownScheme(line) && !looksLikeUrlWithoutScheme(line) && options.treatAsSearchQuery
    let value = line

    if (!search && !hasKnownScheme(line) && looksLikeUrlWithoutScheme(line)) {
      value = `http://${line}`
    }

    return {
      kind: search ? 'search' : 'url',
      value
    }
  })
}

export async function openTabsFromRequest(request) {
  const targets = buildTabTargets(request.text, request)
  const createdTabIds = []

  for (const target of targets) {
    const tab = await chrome.tabs.create({
      url: target.kind === 'search' ? 'about:blank' : target.value,
      active: false
    })

    if (typeof tab.id === 'number') {
      createdTabIds.push(tab.id)
    }

    if (target.kind === 'search' && typeof tab.id === 'number') {
      await chrome.search.query({ text: target.value, tabId: tab.id })
    }
  }

  if (request.selectedTabGroupId !== NO_TAB_GROUP_ID && createdTabIds.length > 0) {
    await chrome.tabs.group({
      tabIds: createdTabIds,
      groupId: request.selectedTabGroupId === NEW_TAB_GROUP_ID ? undefined : request.selectedTabGroupId
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

export async function loadTabGroupOptions() {
  const base = [
    { value: NO_TAB_GROUP_ID, label: 'No tab group' },
    { value: NEW_TAB_GROUP_ID, label: 'New tab group' }
  ]

  if (!chrome.tabGroups?.query) {
    return base
  }

  const groups = await chrome.tabGroups.query({})
  return base.concat(
    groups.map((group) => ({
      value: group.id,
      label: group.title ? `${group.title} (${group.color})` : `Untitled (${group.color})`
    }))
  )
}
