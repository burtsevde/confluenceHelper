console.log('Confluence Helper content script loaded');

let foundElements = [];

// Универсальная функция для отправки сообщений
function sendMessageToExtension(message) {
  return new Promise((resolve, reject) => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    } else {
      // Fallback для Safari
      const event = new CustomEvent('ExtensionMessage', {
        detail: { message, resolve, reject }
      });
      document.dispatchEvent(event);
    }
  });
}

// Функция для получения цвета выделенного текста
function getSelectedTextColor() {
    try {
        const selection = window.getSelection();
        
        if (!selection.rangeCount || selection.isCollapsed) {
            console.log('Ничего не выделено');
            return null;
        }
        
        const range = selection.getRangeAt(0);
        let element = range.startContainer;
        
        // Если выделение начинается с текстового узла
        if (element.nodeType === Node.TEXT_NODE) {
            element = element.parentElement;
        }
        
        // Получаем вычисленный стиль
        const computedStyle = window.getComputedStyle(element);
        const color = computedStyle.color;
        
        console.log('Цвет выделенного текста:', color);
        return color;
        
    } catch (error) {
        console.error('Error getting selected text color:', error);
        return null;
    }
}

// Функция для нормализации цвета
function normalizeColor(color) {
    if (!color) return '';
    
    if (color.startsWith('rgb')) {
        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(,\s*[\d.]+)?\)/i);
        if (match) {
            const r = parseInt(match[1]).toString(16).padStart(2, '0');
            const g = parseInt(match[2]).toString(16).padStart(2, '0');
            const b = parseInt(match[3]).toString(16).padStart(2, '0');
            return `#${r}${g}${b}`.toLowerCase();
        }
    }
    
    if (color.startsWith('#')) {
        if (color.length === 4) {
            return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`.toLowerCase();
        }
        return color.toLowerCase();
    }
    
    return color;
}

// Функция для получения вычисленного цвета элемента
function getElementColor(element) {
    try {
        const style = window.getComputedStyle(element);
        return style.color;
    } catch (error) {
        return '';
    }
}

// Рекурсивный поиск элементов с текстом
function findTextElements(node, elements = []) {
    if (node.nodeType === Node.ELEMENT_NODE) {
        const style = window.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return elements;
        }

        if (node.textContent && node.textContent.trim() && 
            node.offsetWidth > 0 && node.offsetHeight > 0) {
            elements.push(node);
        }

        for (const child of node.children) {
            findTextElements(child, elements);
        }
    }
    return elements;
}

// Поиск текста по цвету
function findTextByColor(targetColor) {
    foundElements = [];
    foundTextElements = [];
    const normalizedTargetColor = normalizeColor(targetColor);
    
    console.log('Searching for color:', normalizedTargetColor);
    
    if (!normalizedTargetColor) {
        return [];
    }

    const textElements = findTextElements(document.body);
    
    textElements.forEach(element => {
        try {
            const elementColor = getElementColor(element);
            const normalizedElementColor = normalizeColor(elementColor);
            
            if (normalizedElementColor === normalizedTargetColor) {
                const text = element.textContent.trim();
                if (text && text.length > 0) {
                    if (!foundTextElements.includes(text)){
                        foundElements.push({
                            element: element,
                            text: text,
                            color: elementColor,
                            originalColor: normalizedElementColor
                        });
                        foundTextElements.push(text);
                    }
                    
                }
            }
        } catch (error) {
            console.log('Error processing element:', error);
        }
    });
    
    console.log('Found elements:', foundElements.length);
    return foundElements;
}

// Клик на раскрывашки
function clickExpandButtons() {
    try {
        console.log('Looking for expand buttons...');
        
        const expandButtons = document.querySelectorAll('[id*="expand-button"]');
        let clickedCount = 0;
        
        console.log('Found expand buttons:', expandButtons.length);
        
        if (expandButtons.length === 0) {
            const alternativeSelectors = [
                'button[class*="expand"]',
                '[class*="expand-button"]',
                '[aria-label*="expand"]',
                '[aria-label*="раскрыть"]',
                '[onclick*="expand"]',
                '[onclick*="show"]',
                '.expand-btn',
                '.toggle-btn',
                '[role="button"][aria-expanded]'
            ];
            
            for (const selector of alternativeSelectors) {
                const buttons = document.querySelectorAll(selector);
                console.log(`Selector "${selector}":`, buttons.length);
                
                buttons.forEach(button => {
                    try {
                        if (button.offsetWidth > 0 && button.offsetHeight > 0 && 
                            window.getComputedStyle(button).display !== 'none') {
                            button.click();
                            clickedCount++;
                            console.log('Clicked on button with selector:', selector);
                        }
                    } catch (error) {
                        console.log('Error clicking button:', error);
                    }
                });
            }
        } else {
            expandButtons.forEach(button => {
                try {
                    if (button.offsetWidth > 0 && button.offsetHeight > 0 && 
                        window.getComputedStyle(button).display !== 'none') {
                        button.click();
                        clickedCount++;
                        console.log('Clicked on expand button:', button.id);
                    }
                } catch (error) {
                    console.log('Error clicking button:', error);
                }
            });
        }
        
        console.log('Total clicked:', clickedCount);
        return clickedCount;
    } catch (error) {
        console.error('Error in clickExpandButtons:', error);
        return 0;
    }
}

// Подсветка найденного элемента
function highlightElement(index) {
    document.querySelectorAll('.color-finder-highlight').forEach(el => {
        el.classList.remove('color-finder-highlight');
        el.style.backgroundColor = '';
    });
    
    if (foundElements[index] && foundElements[index].element) {
        const element = foundElements[index].element;
        element.classList.add('color-finder-highlight');
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        element.style.transition = 'background-color 0.3s ease';
        element.style.backgroundColor = '#ffff00';
        
        setTimeout(() => {
            element.style.backgroundColor = '';
        }, 2000);
    }
}

// Стили для подсветки
const style = document.createElement('style');
style.textContent = `
  .color-finder-highlight {
    border: 3px solid #ff0000 !important;
    border-radius: 3px !important;
    position: relative;
    z-index: 10000 !important;
  }
  
  .color-finder-highlight::before {
    content: 'Найден';
    position: absolute;
    top: -25px;
    right: 0;
    background: #ff0000;
    color: white;
    padding: 2px 8px;
    font-size: 12px;
    border-radius: 3px;
    font-weight: bold;
    z-index: 10001;
  }
`;
document.head.appendChild(style);

// Универсальный обработчик сообщений
function handleExtensionMessage(request, sendResponse) {
    console.log('Received message:', request.action);
    
    try {
        switch (request.action) {
            case 'ping':
                sendResponse({ success: true, message: 'pong' });
                break;
                
            case 'getSelectedColor':
                const selectedColor = getSelectedTextColor();
                sendResponse({ 
                    success: true, 
                    color: selectedColor 
                });
                break;
                
            case 'findTextByColor':
                const results = findTextByColor(request.color);
                sendResponse({ 
                    success: true, 
                    results: results.map(r => ({ 
                        text: r.text, 
                        color: r.color 
                    })) 
                });
                break;
                
            case 'clickExpandButtons':
                const clickedCount = clickExpandButtons();
                sendResponse({ 
                    success: true, 
                    clickedCount: clickedCount 
                });
                break;
                
            case 'highlightElement':
                highlightElement(request.index);
                sendResponse({ success: true });
                break;
                
            default:
                sendResponse({ success: false, error: 'Unknown action' });
        }
    } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({ success: false, error: error.message });
    }
    
    return true;
}

// Обработчик для Chrome
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        return handleExtensionMessage(request, sendResponse);
    });
}

// Обработчик для Safari
document.addEventListener('ExtensionMessage', (event) => {
    const { message, resolve, reject } = event.detail;
    handleExtensionMessage(message, (response) => {
        resolve(response);
    });
});

// Инициализация для Safari
if (typeof safari !== 'undefined') {
    console.log('Running in Safari extension');
}