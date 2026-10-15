// === Вспомогательные функции ===
async function getActiveTab() {
    const sourceTabId = Number(new URLSearchParams(window.location.search).get("tabId"));
    if (sourceTabId > 0) return { id: sourceTabId };

    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
}

function rgbToHex(color) {
    if (!color) return "";
    if (!color.startsWith("rgb")) return color;
    const rgb = color.match(/\d+/g).map(Number);
    return "#" + rgb.map(x => x.toString(16).padStart(2, "0")).join("");
}

function showError(message) {
    const status = document.getElementById("errorStatus");
    status.textContent = message;
    status.style.display = "block";
}

function clearError() {
    const status = document.getElementById("errorStatus");
    status.textContent = "";
    status.style.display = "none";
}

function setColor(color, { updateInput = true, persist = true } = {}) {
    const hex = rgbToHex(color.trim()).toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(hex)) return;

    if (updateInput) document.getElementById("colorInput").value = hex;
    document.getElementById("colorPicker").value = hex;
    if (persist) localStorage.setItem("lastSelectedColor", hex);
}

const savedColor = localStorage.getItem("lastSelectedColor");
if (savedColor) setColor(savedColor, { persist: false });

const sourceTabId = Number(new URLSearchParams(window.location.search).get("tabId"));
if (sourceTabId > 0) {
    chrome.tabs.get(sourceTabId).then(tab => {
        const label = document.getElementById("sourceTabLabel");
        label.textContent = `Вкладка: ${tab.title || tab.url || sourceTabId}`;
        label.title = tab.title || tab.url || "";
    }).catch(() => {
        document.getElementById("sourceTabLabel").textContent = "Вкладка недоступна";
    });
}

document.getElementById("colorPicker").addEventListener("input", (event) => {
    setColor(event.target.value);
});

document.getElementById("colorInput").addEventListener("input", (event) => {
    setColor(event.target.value, { updateInput: false });
});

// === 1. Получить цвет вручную (кнопкой) ===
document.getElementById("getColorButton").addEventListener("click", async () => {
    clearError();
    let tab = await getActiveTab();
    chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: window.ConfluencePageActions.readSelectedColor,
    }).then((results) => {
        const color = results.find(({ result }) => result)?.result;
        if (color) {
            setColor(color);
        } else {
            showError("Ошибка: текст не выделен!");
        }
    }).catch((error) => showError(`Ошибка: ${error.message}`));
});

let resultItems = [];
let selectedResultIndex = -1;
let totalMatches = 0;

function updateResultsSummary() {
    const shown = resultItems.length;
    const position = selectedResultIndex < 0 ? "" : ` · ${selectedResultIndex + 1} из ${shown}`;
    document.getElementById("resultsSummary").textContent = totalMatches > shown
        ? `Показано: ${shown} из ${totalMatches}${position}`
        : `Найдено: ${totalMatches}${position}`;
}

async function selectResult(position) {
    if (!resultItems.length) return;
    clearError();

    selectedResultIndex = (position + resultItems.length) % resultItems.length;
    updateResultsSummary();
    const rows = document.querySelectorAll("#resultsList .result-item");
    rows.forEach((row, index) => {
        row.classList.toggle("selected", index === selectedResultIndex);
        row.setAttribute("aria-selected", index === selectedResultIndex ? "true" : "false");
        row.tabIndex = index === selectedResultIndex ? 0 : -1;
    });

    const selectedRow = rows[selectedResultIndex];
    selectedRow.focus({ preventScroll: true });
    selectedRow.scrollIntoView({ block: "nearest" });

    const { frameId, index } = resultItems[selectedResultIndex];
    const tab = await getActiveTab();
    chrome.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [frameId] },
        args: [index],
        func: window.ConfluencePageActions.focusHighlightedMatch,
    }).catch((error) => showError(`Ошибка: ${error.message}`));
}

document.getElementById("upButton").addEventListener("click", () => {
    selectResult(selectedResultIndex === -1 ? resultItems.length - 1 : selectedResultIndex - 1);
});

document.getElementById("downButton").addEventListener("click", () => {
    selectResult(selectedResultIndex + 1);
});

document.querySelector(".container").addEventListener("keydown", (event) => {
    if (!(event.target instanceof Element) || event.ctrlKey || event.altKey || event.metaKey ||
        event.target.closest("input, textarea, select, [contenteditable]")) return;

    const row = event.target.closest("#resultsList .result-item");
    if (row && !event.shiftKey) {
        if (event.code === "Enter") {
            event.preventDefault();
            row.click();
            return;
        }
        if (event.code === "ArrowDown" || event.code === "ArrowUp") {
            event.preventDefault();
            const index = Array.from(row.parentElement.children).indexOf(row);
            selectResult(index + (event.code === "ArrowDown" ? 1 : -1));
            return;
        }
    }

    if (!event.shiftKey) return;

    const buttonId = event.code === "KeyG" ? "downButton" :
        event.code === "KeyD" ? "upButton" : null;
    if (!buttonId) return;

    const button = document.getElementById(buttonId);
    if (button.disabled) return;
    event.preventDefault();
    button.click();
});

// === 2. Найти текст по цвету ===
document.getElementById("findButton").addEventListener("click", async () => {
    clearError();
    const findButton = document.getElementById("findButton");
    const list = document.getElementById("resultsList");
    const color = document.getElementById("colorInput").value.trim().toLowerCase();
    resultItems = [];
    selectedResultIndex = -1;
    totalMatches = 0;
    list.replaceChildren();
    list.setAttribute("aria-busy", "true");
    document.getElementById("resultsSummary").textContent = "Ищем…";
    findButton.disabled = true;
    findButton.textContent = "Ищем…";
    document.getElementById("upButton").disabled = true;
    document.getElementById("downButton").disabled = true;
    try {
        const tab = await getActiveTab();
        const res = await chrome.scripting.executeScript({
            target: { tabId: tab.id, allFrames: true },
            args: [color],
            func: window.ConfluencePageActions.findMatchesByColor,
        });
        totalMatches = res.reduce((sum, { result }) => sum + (result?.totalCount || 0), 0);
        resultItems = res.flatMap(({ frameId, result }) =>
            result?.matches?.map((txt, index) => ({ txt, frameId, index })) || []
        );
        updateResultsSummary();
        document.getElementById("upButton").disabled = resultItems.length === 0;
        document.getElementById("downButton").disabled = resultItems.length === 0;
        if (resultItems.length) {
            resultItems.forEach(({ txt }, position) => {
                const div = document.createElement("div");
                div.className = "result-item";
                div.textContent = txt;
                div.tabIndex = position === 0 ? 0 : -1;
                div.setAttribute("role", "option");
                div.setAttribute("aria-selected", "false");
                div.addEventListener("click", () => selectResult(position));

                list.appendChild(div);
            });
        } else {
            const div = document.createElement("div");
            div.className = "empty-state";
            div.textContent = "Совпадений нет. Проверьте цвет или выделите текст на странице и нажмите «Получить цвет».";
            list.appendChild(div);
        }
    } catch (error) {
        document.getElementById("resultsSummary").textContent = "Поиск не выполнен";
        showError(`Ошибка поиска: ${error.message}`);
    } finally {
        list.setAttribute("aria-busy", "false");
        findButton.disabled = false;
        findButton.textContent = "Найти текст";
    }
});

// === 3. Кликнуть раскрывашки ===
document.getElementById("expandButton").addEventListener("click", async () => {
    clearError();
    let tab = await getActiveTab();
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: window.ConfluencePageActions.expandButtons,
    }).then((res) => {
        const msg = document.getElementById("expandStatus");
        msg.textContent = `Кликнуто элементов: ${res[0].result}`;
        msg.style.display = "block";
        msg.className = "status-message status-success";
        setTimeout(() => { msg.style.display = "none"; }, 3000);
    }).catch((error) => showError(`Ошибка: ${error.message}`));
});
