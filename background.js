// background.js - для совместимости с Safari
console.log('Confluence Helper background script loaded');

// Обработчик сообщений для Safari
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  
  if (request.action === 'getActiveTab') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ tab: tabs[0] });
    });
    return true;
  }
  
  return false;
});

// Листенер для установки расширения
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed:', details.reason);
});

// Листенер для обновления расширения
chrome.runtime.onUpdateAvailable.addListener(() => {
  console.log('Update available');
});