import { rgbToHex, isValidColor } from './utils.js';


(async function () {
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
  let initializationPromise = null; // single promise for init when in progress
  const pendingOperations = new Map();

  // Helpers
  function log(...args) { console.log('[popup]', ...args); }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // Wrap callback based APIs into promises
  function tabsQuery(queryInfo) {
    if (!browserAPI) return Promise.resolve(null);
    // firefox's browser.tabs.query returns a promise; chrome uses callback
    if (browserAPI.tabs && browserAPI.tabs.query.length === 1) {
      // chrome callback-style (tabs.query(queryInfo, callback))
      return new Promise((resolve) => browserAPI.tabs.query(queryInfo, (tabs) => resolve(tabs)));
    }
    return browserAPI.tabs.query(queryInfo);
  }

  function tabsSendMessage(tabId, message) {
    if (!browserAPI) return Promise.reject(new Error('No browser API'));

    // browser (promise) style
    if (browserAPI.tabs && browserAPI.tabs.sendMessage.length === 2 && typeof browserAPI.tabs.sendMessage === 'function' && browserAPI.tabs.sendMessage.length !== 3) {
      // likely promise-based (Firefox)
      try {
        return browserAPI.tabs.sendMessage(tabId, message);
      } catch (e) {
        // some browsers still throw sync if no connection
        return Promise.reject(e);
      }
    }

    // chrome callback style
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
    // Prefer scripting.executeScript (Manifest V3 in Chrome)
    if (browserAPI.scripting && browserAPI.scripting.executeScript) {
      // chrome returns a promise
      try {
        const details = { target: { tabId }, files: ['content.js'] };
        if (browserAPI.scripting.executeScript.length === 1) {
          // callback-style unlikely; treat as promise
          await browserAPI.scripting.executeScript(details);
        } else {
          await new Promise((resolve, reject) => browserAPI.scripting.executeScript(details, () => {
            if (browserAPI.runtime && browserAPI.runtime.lastError) return reject(browserAPI.runtime.lastError);
            resolve();
          }));
        }
        // give script brief time to initialize
        await sleep(250);
        log('Injection via scripting succeeded');
        return true;
      } catch (e) {
        log('scripting.executeScript failed:', e);
      }
    }

    // Fallback for older Chrome/Firefox: tabs.executeScript (may require "tabs" permission)
    if (browserAPI.tabs && browserAPI.tabs.executeScript) {
      try {
        await new Promise((resolve, reject) => {
          browserAPI.tabs.executeScript(tabId, { file: 'content.js' }, (res) => {
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

    // As a last resort - tell user
    throw new Error('Не удалось инжектировать content script программно');
  }

  // sendMessageToTab with pending operation dedupe and automatic injection retry once
  async function sendMessageToTab(tabId, message, options = {}) {
    const actionKey = `${tabId}_${message.action}`;
    if (pendingOperations.has(actionKey)) {
      log(`Waiting for existing operation ${actionKey}`);
      return pendingOperations.get(actionKey);
    }

    const promise = (async () => {
      try {
        return await tabsSendMessage(tabId, message);
      } catch (err) {
        // If content script not present, try to inject and retry once
        log('sendMessage error, trying inject+retry:', err && err.message ? err.message : err);
        try {
          await injectContentScript(tabId);
          return await tabsSendMessage(tabId, message);
        } catch (err2) {
          log('Retry after inject failed:', err2);
          throw err2;
        }
      } finally {
        // cleanup handled below
      }
    })();

    // ensure removal when done
    pendingOperations.set(actionKey, promise);
    promise.finally(() => pendingOperations.delete(actionKey));
    return promise;
  }

  // Timeout helper
  function withTimeout(promise, ms = 10000) {
    let id;
    const timeout = new Promise((_, reject) => {
      id = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
    });
    return Promise.race([promise.finally(() => clearTimeout(id)), timeout]);
  }

  // Init sequence (deduped)
  async function init() {
    if (initializationPromise) return initializationPromise;

    initializationPromise = (async () => {
      try {
        // get active tab
        const tabs = await tabsQuery({ active: true, currentWindow: true });
        const tab = Array.isArray(tabs) ? tabs[0] : tabs;
        if (!tab) throw new Error('Не удалось получить активную вкладку');
        currentTab = tab;

        // quick ping to see if content script answers
        try {
          await withTimeout(sendMessageToTab(currentTab.id, { action: 'ping' }), 1500);
          contentScriptReady = true;
          log('Content script already present');
        } catch (e) {
          log('Ping failed, injecting content script...', e.message || e);
          await injectContentScript(currentTab.id);
          // verify
          await withTimeout(sendMessageToTab(currentTab.id, { action: 'ping' }), 1500);
          contentScriptReady = true;
          log('Injected and ping succeeded');
        }

        return currentTab;
      } catch (err) {
        contentScriptReady = false;
        throw err;
      } finally {
        initializationPromise = null; // allow retries later
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

  function updateColorPreview(color) {
    if (!color) return;
    const hex = rgbToHex(color);
    colorInput.value = hex;
    colorPicker.value = hex;
  }

  // UI wiring
  colorPicker.addEventListener('input', e => { colorInput.value = e.target.value; });
  colorInput.addEventListener('input', e => { if (e.target.value.match(/^#[0-9A-F]{6}$/i)) colorPicker.value = e.target.value; });

  // Core actions
  async function handleFind() {
    const color = colorInput.value.trim();
    if (!isValidColor(color)) { alert('Пожалуйста, введите корректный цвет в формате #RRGGBB или rgb(r,g,b)'); return; }
    findButton.disabled = true;
    try {
      await init();
      const res = await withTimeout(sendMessageToTab(currentTab.id, { action: 'findTextByColor', color }), 15000);
      if (res && res.results && res.results.length) {
        displayResults(res.results);
        showStatus(`Найдено ${res.results.length} элементов`, true);
      } else {
        resultsList.innerHTML = '<div>Текст с указанным цветом не найден</div>';
        showStatus('Текст не найден', false);
      }
    } catch (err) {
      log('Find error', err);
      showStatus(err.message && err.message.includes('Timeout') ? 'Таймаут. Попробуйте обновить страницу.' : 'Ошибка поиска. Обновите страницу.', false);
    } finally {
      findButton.disabled = false;
    }
  }

  async function handleGetColor() {
    getColorButton.disabled = true;
    try {
      await init();
      const res = await withTimeout(sendMessageToTab(currentTab.id, { action: 'getSelectedColor' }), 2000);
      if (res && res.success) {
        if (res.color) {
          updateColorPreview(res.color);
          showStatus('Цвет выделенного текста получен!', true);
          try { await navigator.clipboard.writeText(rgbToHex(res.color)); } catch (e) { log('Clipboard failed', e); }
        } else {
          showStatus('Сначала выделите текст на странице', false);
        }
      } else {
        showStatus('Ошибка получения цвета', false);
      }
    } catch (err) {
      log('Get color error', err);
      showStatus(err.message && err.message.includes('Timeout') ? 'Таймаут. Попробуйте выделить текст и повторить.' : 'Ошибка получения цвета', false);
    } finally {
      getColorButton.disabled = false;
    }
  }

  async function handleExpand() {
    expandButton.disabled = true;
    try {
      await init();
      const res = await withTimeout(sendMessageToTab(currentTab.id, { action: 'clickExpandButtons' }), 10000);
      if (res && res.success) {
        if (res.clickedCount > 0) showStatus(`Кликнуто на ${res.clickedCount} раскрывашек`, true);
        else showStatus('Раскрывашки не найдены', false);
      } else {
        showStatus('Ошибка при клике', false);
      }
    } catch (err) {
      log('Expand error', err);
      showStatus('Ошибка: обновите страницу', false);
    } finally {
      expandButton.disabled = false;
    }
  }

  function displayResults(results) {
    resultsList.innerHTML = '';
    if (!results || results.length === 0) { resultsList.innerHTML = '<div>Текст с указанным цветом не найден</div>'; return; }
    results.forEach((r, i) => {
      const item = document.createElement('div');
      item.className = 'result-item';
      item.textContent = (r.text || '').substring(0,120) + ((r.text || '').length > 120 ? '...' : '');
      item.title = r.text || '';
      item.style.borderLeftColor = r.color || '#007bff';
      item.addEventListener('click', async () => {
        try { await withTimeout(sendMessageToTab(currentTab.id, { action: 'highlightElement', index: i }), 2000); } catch (e) { log('Highlight error', e); }
      });
      resultsList.appendChild(item);
    });
  }

  // bind
  findButton.addEventListener('click', handleFind);
  getColorButton.addEventListener('click', handleGetColor);
  expandButton.addEventListener('click', handleExpand);

  // initialize immediately but swallow errors
  try {
    const tab = await init();
    if (tab) {
      log('Initialized for tab', tab.id);
      updateColorPreview(colorInput.value);
      // try get color but don't block UI
      try { await handleGetColor(); } catch (e) { log('Initial getColor failed', e); }
    }
  } catch (e) {
    log('Initial init failed', e);
  }
})();