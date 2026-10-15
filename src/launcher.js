async function openAppWindow() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("Не удалось определить активную вкладку");

    await chrome.windows.create({
        url: chrome.runtime.getURL(`popup.html?tabId=${tab.id}`),
        type: "popup",
        width: 420,
        height: 620,
        focused: true,
    });
    window.close();
}

openAppWindow().catch((error) => {
    document.body.textContent = `Не удалось открыть окно: ${error.message}`;
});
