(function () {
  'use strict';
  const browserAPI = (typeof browser !== 'undefined') ? browser : (typeof chrome !== 'undefined' ? chrome : null);
  if (!browserAPI) return;

  console.log('Confluence Helper background script loaded');

  // respond to getActiveTab for popup
  function handleMessage(request, sender, sendResponse) {
    if (request && request.action === 'getActiveTab') {
      // Query active tab
      const q = () => {
        if (browserAPI.tabs && browserAPI.tabs.query.length === 1) {
          // chrome callback style
          browserAPI.tabs.query({ active: true, currentWindow: true }, (tabs) => sendResponse({ tab: tabs[0] }));
        } else {
          // promise style
          browserAPI.tabs.query({ active: true, currentWindow: true }).then(tabs => sendResponse({ tab: tabs[0] }));
        }
      };
      q();
      return true; // indicate async
    }
    return false;
  }

  if (browserAPI.runtime && browserAPI.runtime.onMessage) {
    browserAPI.runtime.onMessage.addListener(handleMessage);
  }

  if (browserAPI.runtime && browserAPI.runtime.onInstalled) {
    browserAPI.runtime.onInstalled.addListener(() => console.log('Extension installed/updated'));
  }
})();
