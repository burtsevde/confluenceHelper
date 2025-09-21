document.addEventListener('DOMContentLoaded', function() {
  const colorPicker = document.getElementById('colorPicker');
  const colorInput = document.getElementById('colorInput');
  const findButton = document.getElementById('findButton');
  const expandButton = document.getElementById('expandButton');
  const getColorButton = document.getElementById('getColorButton');
  const resultsList = document.getElementById('resultsList');
  const expandStatus = document.getElementById('expandStatus');

  let currentTab = null;

  // Универсальная функция отправки сообщений
  async function sendMessageToTab(tabId, message) {
    return new Promise((resolve, reject) => {
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.sendMessage) {
        chrome.tabs.sendMessage(tabId, message, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      } else {
        // Fallback для Safari
        const event = new CustomEvent('TabMessage', {
          detail: { tabId, message, resolve, reject }
        });
        document.dispatchEvent(event);
      }
    });
  }

  // Универсальная функция получения активной вкладки
  async function getActiveTab() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          resolve(tabs[0]);
        });
      } else if (typeof safari !== 'undefined') {
        // Для Safari
        safari.extension.addEventListener('message', function handler(event) {
          if (event.name === 'activeTabResponse') {
            safari.extension.removeEventListener('message', handler);
            resolve(event.message.tab);
          }
        });
        safari.extension.dispatchMessage('getActiveTab');
      } else {
        resolve(null);
      }
    });
  }

  // Инициализация
  async function init() {
    try {
      currentTab = await getActiveTab();
      if (!currentTab) {
        throw new Error('Не удалось получить активную вкладку');
      }
      
      await validateContentScript();
      return currentTab;
    } catch (error) {
      console.error('Init error:', error);
      showStatus('Ошибка инициализации. Обновите страницу.', false);
      return null;
    }
  }

  // Проверка и инъекция content script
  async function validateContentScript() {
    try {
      await sendMessageToTab(currentTab.id, { action: 'ping' });
      console.log('Content script is loaded');
      return true;
    } catch (error) {
      console.log('Content script not responding, injecting...');
      try {
        if (typeof chrome !== 'undefined' && chrome.scripting) {
          await chrome.scripting.executeScript({
            target: { tabId: currentTab.id },
            files: ['content.js']
          });
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        return true;
      } catch (injectError) {
        console.error('Failed to inject content script:', injectError);
        throw new Error('Не удалось загрузить скрипт на страницу');
      }
    }
  }

  // Показать статус сообщение
  function showStatus(message, isSuccess = true) {
    expandStatus.textContent = message;
    expandStatus.className = `status-message ${isSuccess ? 'status-success' : 'status-error'}`;
    expandStatus.style.display = 'block';
    
    setTimeout(() => {
      expandStatus.style.display = 'none';
    }, 4000);
  }

  // Обновить preview цвета
  function updateColorPreview(color) {
    if (!color) return;
    
    const hexColor = rgbToHex(color);
    colorInput.value = hexColor;
    colorPicker.value = hexColor;
  }

  // Конвертация RGB в HEX
  function rgbToHex(rgb) {
    if (rgb.startsWith('#')) {
      return rgb;
    }
    
    const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(,\s*[\d.]+)?\)/i);
    if (match) {
      const r = parseInt(match[1]);
      const g = parseInt(match[2]);
      const b = parseInt(match[3]);
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    
    return rgb;
  }

  // Валидация цвета
  function isValidColor(color) {
    const hexRegex = /^#([0-9A-F]{3}){1,2}$/i;
    const rgbRegex = /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i;
    const rgbaRegex = /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\)$/i;
    return hexRegex.test(color) || rgbRegex.test(color) || rgbaRegex.test(color);
  }

  // Остальной код popup.js остается без изменений...
  // [Здесь должен быть остальной код из вашего popup.js]

  // Синхронизация color picker и текстового поля
  colorPicker.addEventListener('input', (e) => {
    colorInput.value = e.target.value;
    updateColorPreview(e.target.value);
  });

  colorInput.addEventListener('input', (e) => {
    if (e.target.value.match(/^#[0-9A-F]{6}$/i)) {
      colorPicker.value = e.target.value;
      updateColorPreview(e.target.value);
    }
  });

  // Кнопка поиска текста по цвету
  findButton.addEventListener('click', async () => {
    const color = colorInput.value.trim();
    
    if (!isValidColor(color)) {
      alert('Пожалуйста, введите корректный цвет в формате #RRGGBB или rgb(r,g,b)');
      return;
    }

    try {
      if (!currentTab) currentTab = await init();
      if (!currentTab) return;
      
      // await validateContentScript();
      
      const response = await sendMessageWithTimeout({
        action: 'findTextByColor',
        color: color
      }, 3000);

      if (response && response.results) {
        displayResults(response.results);
        showStatus(`Найдено ${response.results.length} элементов`, true);
      } else {
        resultsList.innerHTML = '<div>Текст с указанным цветом не найден</div>';
        showStatus('Текст не найден', false);
      }
    } catch (error) {
      console.error('Search error:', error);
      showStatus('Ошибка поиска. Обновите страницу.', false);
    }
  });

  async function getColor() {
    try {
      if (!currentTab) currentTab = await init();
      if (!currentTab) return;
      
      // await validateContentScript();
      
      const response = await sendMessageWithTimeout({
        action: 'getSelectedColor'
      }, 3000);

      if (response && response.success) {
        if (response.color) {
          updateColorPreview(response.color);
          showStatus('Цвет выделенного текста получен!', true);
          
          // Копируем в буфер обмена
          try {
            const hexColor = rgbToHex(response.color);
            await navigator.clipboard.writeText(hexColor);
            console.log('Цвет скопирован в буфер обмена:', hexColor);
          } catch (copyError) {
            console.log('Не удалось скопировать в буфер обмена');
          }
        } else {
          showStatus('Сначала выделите текст на странице', false);
        }
      } else {
        showStatus('Ошибка получения цвета', false);
      }
    } catch (error) {
      console.error('Get color error:', error);
      if (error.message.includes('Timeout')) {
        showStatus('Таймаут. Попробуйте обновить страницу.', false);
      } else {
        showStatus('Ошибка получения цвета', false);
      }
    }
  }

  // Кнопка получения цвета выделенного текста
  getColorButton.addEventListener('click', async () => {
    getColor();
  });

  // Кнопка клика на раскрывашки
  expandButton.addEventListener('click', async () => {
    try {
      if (!currentTab) currentTab = await init();
      if (!currentTab) return;
      
      // await validateContentScript();
      
      const response = await sendMessageWithTimeout({
        action: 'clickExpandButtons'
      }, 2000);

      if (response && response.success) {
        if (response.clickedCount > 0) {
          showStatus(`Кликнуто на ${response.clickedCount} раскрывашек`, true);
        } else {
          showStatus('Раскрывашки не найдены', false);
        }
      } else {
        showStatus('Ошибка при клике', false);
      }
    } catch (error) {
      console.error('Expand error:', error);
      showStatus('Ошибка: обновите страницу', false);
    }
  });

  // Функция отправки сообщения с таймаутом
  async function sendMessageWithTimeout(message, timeoutMs = 3000) {
    return Promise.race([
      sendMessageToTab(currentTab.id, message),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  // Отображение результатов
  function displayResults(results) {
    resultsList.innerHTML = '';
    
    if (results.length === 0) {
      resultsList.innerHTML = '<div>Текст с указанным цветом не найден</div>';
      return;
    }

    results.forEach((result, index) => {
      const item = document.createElement('div');
      item.className = 'result-item';
      item.textContent = result.text.substring(0, 120) + (result.text.length > 120 ? '...' : '');
      item.title = result.text;
      item.style.borderLeftColor = result.color;
      
      item.addEventListener('click', async () => {
        try {
          await sendMessageWithTimeout({
            action: 'highlightElement',
            index: index
          }, 1000);
        } catch (error) {
          console.error('Highlight error:', error);
        }
      });

      resultsList.appendChild(item);
    });
  }

  // Инициализируем при загрузке
  init().then(tab => {
    if (tab) {
      console.log('Extension initialized for tab:', tab.id);
      updateColorPreview(colorInput.value);
      getColor();
    }
  });
});