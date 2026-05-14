import { OPEN_TABS_ACTION, countEntries, readCurrentWindowUrls } from './core.js'

const storageKeys = {
  text: 'text',
  activeTab: 'activeTab'
}

const defaultState = {
  text: '',
  activeTab: 'open'
}

const elements = {
  openTabButton: document.getElementById('openTabButton'),
  saveTabButton: document.getElementById('saveTabButton'),
  openPanel: document.getElementById('openPanel'),
  savePanel: document.getElementById('savePanel'),
  urlInput: document.getElementById('urlInput'),
  savedUrlOutput: document.getElementById('savedUrlOutput'),
  tabCount: document.getElementById('tabCount'),
  savedCount: document.getElementById('savedCount'),
  statusMessage: document.getElementById('statusMessage'),
  saveStatusMessage: document.getElementById('saveStatusMessage'),
  copyUrlsButton: document.getElementById('copyUrlsButton'),
  exportUrlsButton: document.getElementById('exportUrlsButton'),
  clearInputButton: document.getElementById('clearInputButton'),
  openUrlsButton: document.getElementById('openUrlsButton')
}

function setStatus(target, message, kind = 'idle') {
  target.textContent = message
  target.dataset.kind = kind
}

function updateOpenCount() {
  const total = countEntries(elements.urlInput.value, true)
  elements.tabCount.textContent = String(total)
}

function updateSavedCount() {
  const total = countEntries(elements.savedUrlOutput.value, false)
  elements.savedCount.textContent = String(total)
}

async function loadState() {
  const saved = await chrome.storage.local.get(Object.values(storageKeys))
  return { ...defaultState, ...saved }
}

async function saveState() {
  const state = {
    text: elements.urlInput.value,
    activeTab: elements.openPanel.classList.contains('is-hidden') ? 'save' : 'open'
  }

  await chrome.storage.local.set(state)
  updateOpenCount()
}

function applyState(state) {
  elements.urlInput.value = state.text
  updateOpenCount()
  switchTab(state.activeTab)
}

function exportCurrentText(text) {
  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'tabs-urls.txt'
  anchor.click()
  URL.revokeObjectURL(url)
}

function buildRequest() {
  return {
    text: elements.urlInput.value,
    deduplicate: true
  }
}

function switchTab(tabName) {
  const openActive = tabName === 'open'
  elements.openTabButton.classList.toggle('is-active', openActive)
  elements.saveTabButton.classList.toggle('is-active', !openActive)
  elements.openPanel.classList.toggle('is-hidden', !openActive)
  elements.savePanel.classList.toggle('is-hidden', openActive)
}

async function loadCurrentWindowUrlsIntoSavePanel() {
  elements.savedUrlOutput.value = await readCurrentWindowUrls()
  updateSavedCount()
}

function bindEvents() {
  const saveOnChange = () => {
    void saveState()
  }

  elements.openTabButton.addEventListener('click', async () => {
    switchTab('open')
    await saveState()
  })

  elements.saveTabButton.addEventListener('click', async () => {
    switchTab('save')
    await loadCurrentWindowUrlsIntoSavePanel()
    await saveState()
  })

  elements.urlInput.addEventListener('input', saveOnChange)

  elements.copyUrlsButton.addEventListener('click', async () => {
    await navigator.clipboard.writeText(elements.savedUrlOutput.value)
    setStatus(elements.saveStatusMessage, '已复制到剪贴板', 'success')
  })

  elements.exportUrlsButton.addEventListener('click', () => {
    exportCurrentText(elements.savedUrlOutput.value)
    setStatus(elements.saveStatusMessage, '已导出为文本文件', 'success')
  })

  elements.clearInputButton.addEventListener('click', async () => {
    elements.urlInput.value = ''
    await saveState()
    setStatus(elements.statusMessage, '已清空内容', 'success')
  })

  elements.openUrlsButton.addEventListener('click', async () => {
    const response = await chrome.runtime.sendMessage({
      action: OPEN_TABS_ACTION,
      payload: buildRequest()
    })

    if (response?.ok) {
      setStatus(elements.statusMessage, '正在打开链接', 'success')
      await saveState()
      return
    }

    setStatus(elements.statusMessage, response?.error || '打开链接失败', 'error')
  })
}

async function initialize() {
  const state = await loadState()
  applyState(state)
  await loadCurrentWindowUrlsIntoSavePanel()
  bindEvents()
}

void initialize()
