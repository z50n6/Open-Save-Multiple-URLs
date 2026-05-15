export const OPEN_TABS_ACTION = 'open-tabs'

const lineBreakPattern = /\r\n?|\n/g
const defaultTabGroupColor = 'red'
const noTabGroupId = -1
const groupLookupAttempts = 10
const groupLookupDelayMs = 100

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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createTab(createProperties) {
  return new Promise((resolve, reject) => {
    chrome.tabs.create(createProperties, (tab) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }

      resolve(tab)
    })
  })
}

function getTab(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }

      resolve(tab)
    })
  })
}

function groupTabs(tabIds) {
  return new Promise((resolve, reject) => {
    chrome.tabs.group({ tabIds }, (groupId) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }

      resolve(groupId)
    })
  })
}

function updateTabGroup(groupId, updateProperties) {
  return new Promise((resolve, reject) => {
    chrome.tabGroups.update(groupId, updateProperties, (group) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }

      resolve(group)
    })
  })
}

async function resolveGroupId(createdTabIds, groupedId) {
  if (typeof groupedId === 'number' && groupedId >= 0) {
    return groupedId
  }

  if (!chrome.tabs.get || createdTabIds.length === 0) {
    return null
  }

  for (let attempt = 0; attempt < groupLookupAttempts; attempt += 1) {
    const firstTab = await getTab(createdTabIds[0])
    if (typeof firstTab.groupId === 'number' && firstTab.groupId > noTabGroupId) {
      return firstTab.groupId
    }

    await delay(groupLookupDelayMs)
  }

  return null
}

export async function openTabsFromRequest(request) {
  const targets = buildTabTargets(request.text, request)
  const createdTabIds = []

  for (const target of targets) {
    const createdTab = await createTab({
      url: target,
      active: false
    })

    if (typeof createdTab.id === 'number') {
      createdTabIds.push(createdTab.id)
    }
  }

  if (createdTabIds.length > 1 && chrome.tabs.group) {
    try {
      const groupedId = await groupTabs(createdTabIds)
      const groupId = await resolveGroupId(createdTabIds, groupedId)

      if (groupId != null && chrome.tabGroups?.update) {
        await updateTabGroup(groupId, {
          title: `Opened URLs (${createdTabIds.length})`,
          color: defaultTabGroupColor,
          collapsed: false
        })
      } else {
        console.warn('Open-Save-Multiple-URLs: failed to resolve tab group id', {
          createdTabIds,
          groupedId
        })
      }
    } catch (error) {
      console.error('Open-Save-Multiple-URLs: failed to color tab group', error)
    }
  }
}

export async function readCurrentWindowUrls() {
  const tabs = await chrome.tabs.query({ currentWindow: true })
  return tabs
    .map((tab) => tab.url)
    .filter((url) => typeof url === 'string' && url.length > 0)
    .join('\n')
}
