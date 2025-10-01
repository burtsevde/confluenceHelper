// === Вспомогательные функции ===
async function getActiveTab() {
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
    alert(message);
}

// === При загрузке popup сразу пробуем получить цвет выделенного текста ===
document.addEventListener("DOMContentLoaded", async () => {
    let tab = await getActiveTab();

    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return null;
            const node = sel.getRangeAt(0).startContainer.parentElement;
            if (!node) return null;
            return window.getComputedStyle(node).color;
        }
    }).then((results) => {
        const color = results[0].result;
        if (color) {
            const hex = rgbToHex(color);
            document.getElementById("colorInput").value = hex;
            document.getElementById("colorPicker").value = hex;
        } else {
            showError("Ошибка: текст не выделен!");
        }
    });
});

// === 1. Получить цвет вручную (кнопкой) ===
document.getElementById("getColorButton").addEventListener("click", async () => {
    let tab = await getActiveTab();
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return null;
            const node = sel.getRangeAt(0).startContainer.parentElement;
            if (!node) return null;
            return window.getComputedStyle(node).color;
        }
    }).then((results) => {
        const color = results[0].result;
        if (color) {
            const hex = rgbToHex(color);
            document.getElementById("colorInput").value = hex;
            document.getElementById("colorPicker").value = hex;
        } else {
            showError("Ошибка: текст не выделен!");
        }
    });
});

// === 2. Найти текст по цвету ===
document.getElementById("findButton").addEventListener("click", async () => {
    const color = document.getElementById("colorInput").value.trim().toLowerCase();
    let tab = await getActiveTab();

    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        args: [color],
        func: (searchColor) => {
            document.querySelectorAll(".color-text-finder-highlight").forEach(el => {
                el.style.backgroundColor = "";
                el.style.outline = "";
                el.classList.remove("color-text-finder-highlight");
            });

            const results = [];

            function rgbToHex(rgb) {
                const match = rgb.match(/\d+/g);
                if (!match) return rgb;
                return "#" + match.map(x => parseInt(x).toString(16).padStart(2, "0")).join("");
            }

            const nodes = document.querySelectorAll("body *:not(script):not(style):not(noscript)");
            nodes.forEach(node => {
                const style = window.getComputedStyle(node);
                if (style.color) {
                    if (style.color === searchColor || rgbToHex(style.color).toLowerCase() === searchColor) {
                        if (node.innerText.trim()) {
                            results.push(node.innerText.trim());
                            node.classList.add("color-text-finder-highlight");
                            node.style.backgroundColor = "yellow";
                            node.style.outline = "2px solid blue";
                        }
                    }
                }
            });

            return results.slice(0, 50);
        }
    }).then((res) => {
        const list = document.getElementById("resultsList");
        list.innerHTML = "";
        const items = res[0].result;
        if (items && items.length) {
            items.forEach((txt, idx) => {
                const div = document.createElement("div");
                div.className = "result-item";
                div.textContent = txt;

                div.addEventListener("click", async () => {
                    let tab = await getActiveTab();
                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        args: [idx],
                        func: (index) => {
                            const highlighted = document.querySelectorAll(".color-text-finder-highlight");
                            if (highlighted[index]) {
                                highlighted[index].scrollIntoView({ behavior: "smooth", block: "center" });
                                highlighted[index].style.transition = "background-color 0.5s";
                                highlighted[index].style.backgroundColor = "orange";
                                setTimeout(() => {
                                    highlighted[index].style.backgroundColor = "yellow";
                                }, 1500);
                            }
                        }
                    });
                });

                list.appendChild(div);
            });
        } else {
            const div = document.createElement("div");
            div.textContent = "Ничего не найдено.";
            list.appendChild(div);
        }
    });
});

// === 3. Кликнуть раскрывашки ===
document.getElementById("expandButton").addEventListener("click", async () => {
    let tab = await getActiveTab();
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
            const elems = document.querySelectorAll('[id*="expand-button"]');
            elems.forEach(el => el.click());
            return elems.length;
        }
    }).then((res) => {
        const msg = document.getElementById("expandStatus");
        msg.textContent = `Кликнуто элементов: ${res[0].result}`;
        msg.style.display = "block";
        msg.className = "status-message status-success";
        setTimeout(() => { msg.style.display = "none"; }, 3000);
    });
});
