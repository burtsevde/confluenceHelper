'use strict';

// Universal browser API (works for Chrome, Firefox, and Safari fallback)
const browserAPI = (typeof browser !== 'undefined') ? browser : (typeof chrome !== 'undefined' ? chrome : null);

// DOM elements
const colorPicker = document.getElementById('colorPicker');
const colorInput = document.getElementById('colorInput');
const findButton = document.getElementById('findButton');
const expandButton = document.getElementById('expandButton');
const getColorButton = document.getElementById('getColorButton');
const resultsList = document.getElementById('resultsList');
const expandStatus = document.getElementById('expandStatus');

// State
let currentTab = null;
let contentScriptReady = false;
let initializationPromise = null;
const pendingOperations = new Map();
let isBusy = false; // 🔹 глобальный флаг синхронности

// Helpers
function log(...args) { console.log('[popup]', ...args); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function setBusy(state) {
    isBusy = state;
    findButton.disabled = state;
    expandButton.disabled = state;
    getColorButton.disabled = state;
}

// Wrap callback based APIs into promises
function tabsQuery(queryInfo) {
    if (!browserAPI) return Promise.resolve(null);
    if (browserAPI.tabs && browserAPI.tabs.query.length === 1) {
        return new Promise((resolve) => browserAPI.tabs.query(queryInfo, (tabs) => resolve(tabs)));
    }
    return browserAPI.tabs.query(queryInfo);
}

function tabsSendMessage(tabId, message) {
    if (!browserAPI) return Promise.reject(new Error('No browser API'));
    if (browserAPI.tabs && browserAPI.tabs.sendMessage.length === 2) {
        try {
            return browserAPI.tabs.sendMessage(tabId, message);
        } catch (e) {
            return Promise.reject(e);
        }
    }
    return new Promise((resolve, reject) => {
        try {
            browserAPI.tabs.sendMessage(tabId, message, (response) => {
                if (browserAPI.runtime && browserAPI.runtime.lastError) {
                    reject(browserAPI.runtime.lastError);
                } else {
                    resolve(response);
                }
            });
        } catch (err) {
            reject(err);
        }
    });
}

async function injectContentScript(tabId) {
    log('Attempting to inject content script into', tabId);
    if (browserAPI.scripting && browserAPI.scripting.executeScript) {
        try {
            const details = { target: { tabId }, files: ['content-bundle.js'] };
            if (browserAPI.scripting.executeScript.length === 1) {
                await browserAPI.scripting.executeScript(details);
            } else {
                await new Promise((resolve, reject) =>
                    browserAPI.scripting.executeScript(details, () => {
                        if (browserAPI.runtime && browserAPI.runtime.lastError) return reject(browserAPI.runtime.lastError);
                        resolve();
                    })
                );
            }
            await sleep(250);
            log('Injection via scripting succeeded');
            return true;
        } catch (e) {
            log('scripting.executeScript failed:', e);
        }
    }
    if (browserAPI.tabs && browserAPI.tabs.executeScript) {
        try {
            await new Promise((resolve, reject) => {
                browserAPI.tabs.executeScript(tabId, { file: 'content-bundle.js' }, (res) => {
                    if (browserAPI.runtime && browserAPI.runtime.lastError) return reject(browserAPI.runtime.lastError);
                    resolve(res);
                });
            });
            await sleep(250);
            log('Injection via tabs.executeScript succeeded');
            return true;
        } catch (e) {
            log('tabs.executeScript failed:', e);
        }
    }
    throw new Error('Не удалось инжектировать content script программно');
}

async function sendMessageToTab(tabId, message) {
    const actionKey = `${tabId}_${message.action}`;
    if (pendingOperations.has(actionKey)) return pendingOperations.get(actionKey);

    const promise = (async () => {
        try {
            return await tabsSendMessage(tabId, message);
        } catch (err) {
            log('sendMessage error, trying inject+retry:', err);
            try {
                await injectContentScript(tabId);
                return await tabsSendMessage(tabId, message);
            } catch (err2) {
                log('Retry after inject failed:', err2);
                throw err2;
            }
        }
    })();

    pendingOperations.set(actionKey, promise);
    promise.finally(() => pendingOperations.delete(actionKey));
    return promise;
}

function withTimeout(promise, ms = 10000) {
    let id;
    const timeout = new Promise((_, reject) => {
        id = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
    });
    return Promise.race([promise.finally(() => clearTimeout(id)), timeout]);
}

async function init() {
    if (initializationPromise) return initializationPromise;
    initializationPromise = (async () => {
        try {
            const tabs = await tabsQuery({ active: true, currentWindow: true });
            const tab = Array.isArray(tabs) ? tabs[0] : tabs;
            if (!tab) throw new Error('Не удалось получить активную вкладку');
            currentTab = tab;
            try {
                await withTimeout(sendMessageToTab(currentTab.id, { action: 'ping' }), 1500);
                contentScriptReady = true;
            } catch {
                await injectContentScript(currentTab.id);
                await withTimeout(sendMessageToTab(currentTab.id, { action: 'ping' }), 1500);
                contentScriptReady = true;
            }
            return currentTab;
        } catch (err) {
            contentScriptReady = false;
            throw err;
        } finally {
            initializationPromise = null;
        }
    })();
    return initializationPromise;
}

// UI helpers
function showStatus(message, isSuccess = true) {
    expandStatus.textContent = message;
    expandStatus.className = `status-message ${isSuccess ? 'status-success' : 'status-error'}`;
    expandStatus.style.display = 'block';
    setTimeout(() => { expandStatus.style.display = 'none'; }, 4000);
}

function rgbToHex(rgb) {
    if (!rgb) return rgb;
    if (rgb.startsWith('#')) return rgb;
    const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(,\s*[\d.]+)?\)/i);
    if (match) {
        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);
        return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
    }
    return rgb;
}

function isValidColor(color) {
    const hexRegex = /^#([0-9A-F]{3}){1,2}$/i;
    const rgbRegex = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i;
    const rgbaRegex = /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*[\d.]+\)$/i;
    return hexRegex.test(color) || rgbRegex.test(color) || rgbaRegex.test(color);
}

function updateColorPreview(color) {
    if (!color) return;
    const hex = rgbToHex(color);
    colorInput.value = hex;
    colorPicker.value = hex;
}

function displayResults(results) {
    resultsList.innerHTML = '';
    if (!results || results.length === 0) {
        resultsList.innerHTML = '<div>Текст с указанным цветом не найден</div>';
        return;
    }
    results.forEach((r, i) => {
        const item = document.createElement('div');
        item.className = 'result-item';
        item.textContent = (r.text || '').substring(0, 120) + ((r.text || '').length > 120 ? '...' : '');
        item.title = r.text || '';
        item.style.borderLeftColor = r.color || '#007bff';
        item.addEventListener('click', async () => {
            try {
                await withTimeout(sendMessageToTab(currentTab.id, { action: 'highlightElement', index: i }), 2000);
            } catch (e) { log('Highlight error', e); }
        });
        resultsList.appendChild(item);
    });
}

// Actions with sync guard
async function handleFind() {
    if (isBusy) return;
    setBusy(true);
    try {
        const color = colorInput.value.trim();
        if (!isValidColor(color)) { alert('Введите корректный цвет (#RRGGBB или rgb(...))'); return; }
        await init();
        const res = await withTimeout(sendMessageToTab(currentTab.id, { action: 'findTextByColor', color }), 15000);
        if (res?.results?.length) {
            displayResults(res.results);
            showStatus(`Найдено ${res.results.length} элементов`, true);
        } else {
            resultsList.innerHTML = '<div>Текст с указанным цветом не найден</div>';
            showStatus('Текст не найден', false);
        }
    } catch (err) {
        log('Find error', err);
        showStatus('Ошибка поиска', false);
    } finally {
        setBusy(false);
    }
}

async function handleGetColor() {
    if (isBusy) return;
    setBusy(true);
    try {
        await init();
        const res = await withTimeout(sendMessageToTab(currentTab.id, { action: 'getSelectedColor' }), 2000);
        if (res?.success && res.color) {
            updateColorPreview(res.color);
            showStatus('Цвет выделенного текста получен!', true);
            try { await navigator.clipboard.writeText(rgbToHex(res.color)); } catch (e) { log('Clipboard failed', e); }
        } else {
            showStatus('Сначала выделите текст на странице', false);
        }
    } catch (err) {
        log('Get color error', err);
        showStatus('Ошибка получения цвета', false);
    } finally {
        setBusy(false);
    }
}

async function handleExpand() {
    if (isBusy) return;
    setBusy(true);
    try {
        await init();
        const res = await withTimeout(sendMessageToTab(currentTab.id, { action: 'clickExpandButtons' }), 10000);
        if (res?.success) {
            showStatus(res.clickedCount > 0 ? `Кликнуто на ${res.clickedCount} раскрывашек` : 'Раскрывашки не найдены', res.clickedCount > 0);
        } else {
            showStatus('Ошибка при клике', false);
        }
    } catch (err) {
        log('Expand error', err);
        showStatus('Ошибка: обновите страницу', false);
    } finally {
        setBusy(false);
    }
}

// UI wiring
colorPicker.addEventListener('input', e => { colorInput.value = e.target.value; });
colorInput.addEventListener('input', e => { if (e.target.value.match(/^#[0-9A-F]{6}$/i)) colorPicker.value = e.target.value; });
findButton.addEventListener('click', handleFind);
getColorButton.addEventListener('click', handleGetColor);
expandButton.addEventListener('click', handleExpand);

// init
(async () => {
    try {
        const tab = await init();
        if (tab) {
            log('Initialized for tab', tab.id);
            updateColorPreview(colorInput.value);
        }
    } catch (e) {
        log('Initial init failed', e);
    }
})();
