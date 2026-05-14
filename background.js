import { OPEN_TABS_ACTION, openTabsFromRequest } from './src/core.js'

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.action !== OPEN_TABS_ACTION || !message.payload) {
    return false
  }

  openTabsFromRequest(message.payload)
    .then(() => sendResponse({ ok: true }))
    .catch((error) => sendResponse({ ok: false, error: String(error) }))

  return true
})
