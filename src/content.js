import { normalizeColor } from './utils.js';


(function () {
  'use strict';

  console.log('Confluence Helper content script loaded');

  let foundElements = [];

  function getSelectedTextColor() {
    try {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount || selection.isCollapsed) return null;
      const range = selection.getRangeAt(0);
      let element = range.startContainer;
      if (element.nodeType === Node.TEXT_NODE) element = element.parentElement;
      if (!element) return null;
      const computedStyle = window.getComputedStyle(element);
      return computedStyle ? computedStyle.color : null;
    } catch (e) { console.error('getSelectedTextColor error', e); return null; }
  }

  function getElementColor(element) {
    try { return window.getComputedStyle(element).color; } catch (e) { return ''; }
  }

  function findTextElements(node, elements = []) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return elements;
      if (node.textContent && node.textContent.trim() && node.offsetWidth > 0 && node.offsetHeight > 0) elements.push(node);
      for (const child of node.children) findTextElements(child, elements);
    }
    return elements;
  }

  function findTextByColor(targetColor) {
    foundElements = [];
    const normalizedTargetColor = normalizeColor(targetColor);
    if (!normalizedTargetColor) return [];
    const textElements = findTextElements(document.body);
    const seen = new Set();
    textElements.forEach(el => {
      try {
        const color = getElementColor(el);
        if (normalizeColor(color) === normalizedTargetColor) {
          const text = el.textContent.trim();
          if (text && !seen.has(text)) { seen.add(text); foundElements.push({ element: el, text, color, originalColor: normalizeColor(color) }); }
        }
      } catch (e) { /* ignore */ }
    });
    return foundElements;
  }

  function clickExpandButtons() {
    try {
      const selectors = ['[id*="expand-button"]','button[class*="expand"]','[class*="expand-button"]','[aria-label*="expand"]','[aria-label*="раскрыть"]','[onclick*="expand"]','[onclick*="show"]','.expand-btn','.toggle-btn','[role="button"][aria-expanded]'];
      let clicked = 0;
      selectors.forEach(sel => {
        const list = document.querySelectorAll(sel);
        list.forEach(btn => {
          try { if (btn.offsetWidth > 0 && btn.offsetHeight > 0 && window.getComputedStyle(btn).display !== 'none') { btn.click(); clicked++; } } catch (e) {}
        });
      });
      return clicked;
    } catch (e) { console.error(e); return 0; }
  }

  function highlightElement(index) {
    document.querySelectorAll('.color-finder-highlight').forEach(el => { el.classList.remove('color-finder-highlight'); el.style.backgroundColor = ''; });
    if (foundElements[index] && foundElements[index].element) {
      const element = foundElements[index].element;
      element.classList.add('color-finder-highlight');
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.style.transition = 'background-color 0.3s ease';
      element.style.backgroundColor = '#ffff00';
      setTimeout(() => { element.style.backgroundColor = ''; }, 2000);
    }
  }

  const style = document.createElement('style');
  style.textContent = `
    .color-finder-highlight { border: 3px solid #ff0000 !important; border-radius: 3px !important; position: relative; z-index: 10000 !important; }
    .color-finder-highlight::before { content: 'Найден'; position: absolute; top: -25px; right: 0; background: #ff0000; color: white; padding: 2px 8px; font-size: 12px; border-radius: 3px; font-weight: bold; z-index: 10001; }
  `;
  document.head.appendChild(style);

  // message handler
  function handleExtensionMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'ping': return sendResponse({ success: true, message: 'pong' });
        case 'getSelectedColor': return sendResponse({ success: true, color: getSelectedTextColor() });
        case 'findTextByColor': {
          const results = findTextByColor(request.color || '');
          return sendResponse({ success: true, results: results.map(r => ({ text: r.text, color: r.color })) });
        }
        case 'clickExpandButtons': {
          const clicked = clickExpandButtons();
          return sendResponse({ success: true, clickedCount: clicked });
        }
        case 'highlightElement': {
          highlightElement(request.index);
          return sendResponse({ success: true });
        }
        default:
          return sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (e) {
      console.error('Error handling message', e);
      return sendResponse({ success: false, error: e && e.message ? e.message : String(e) });
    }
  }

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
      // return true if we'll respond asynchronously (we don't need async here)
      handleExtensionMessage(req, sender, sendResponse);
      return true;
    });
  }

  // Safari fallback: listen for custom DOM events (existing in original repo)
  document.addEventListener('ExtensionMessage', (event) => {
    const { message, resolve } = event.detail || {};
    try {
      handleExtensionMessage(message, null, (resp) => resolve(resp));
    } catch (e) {
      resolve({ success: false, error: e.message });
    }
  });
})();