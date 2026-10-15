/**
 * @jest-environment jsdom
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { jest } from "@jest/globals";

// замокаем chrome API
import "../__mocks__/chrome";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.resolve(testDir, "../../popup.html"), "utf8");
const popupScript = fs.readFileSync(path.resolve(testDir, "../popup.js"), "utf8");
const pageActionsScript = fs.readFileSync(path.resolve(testDir, "../page-actions.js"), "utf8");
const launcherScript = fs.readFileSync(path.resolve(testDir, "../launcher.js"), "utf8");

describe("popup.js", () => {
    let colorInput, colorPicker, findButton, getColorButton, expandButton, resultsList, upButton, downButton;

    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        window.history.replaceState({}, "", "/");
        document.body.innerHTML = html;
        HTMLElement.prototype.scrollIntoView = jest.fn();

        // элементы из popup.html
        colorInput = document.getElementById("colorInput");
        colorPicker = document.getElementById("colorPicker");
        findButton = document.getElementById("findButton");
        getColorButton = document.getElementById("getColorButton");
        expandButton = document.getElementById("expandButton");
        resultsList = document.getElementById("resultsList");
        upButton = document.getElementById("upButton");
        downButton = document.getElementById("downButton");

        // подключаем popup.js после рендера DOM
        window.eval(pageActionsScript);
        window.eval(popupScript);
    });

    test("При загрузке popup не проверяет выделенный текст", async () => {
        document.dispatchEvent(new Event("DOMContentLoaded"));
        await Promise.resolve();

        expect(chrome.tabs.query).not.toHaveBeenCalled();
        expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
        expect(colorInput.value).toBe("#ff0000");
        expect(colorPicker.value).toBe("#ff0000");
    });

    test("Кнопка 'Получить цвет' находит выделение во фрейме", async () => {
        chrome.scripting.executeScript.mockResolvedValueOnce([
            { frameId: 0, result: null },
            { frameId: 7, result: "rgb(0, 128, 255)" },
        ]);
        getColorButton.click();
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(chrome.scripting.executeScript).toHaveBeenCalledWith(
            expect.objectContaining({ target: { tabId: 1, allFrames: true } })
        );
        expect(colorInput.value).toBe("#0080ff");
        expect(colorPicker.value).toBe("#0080ff");
        expect(localStorage.getItem("lastSelectedColor")).toBe("#0080ff");
    });

    test("Ошибка отсутствующего выделения отображается в окне без alert", async () => {
        const alert = jest.spyOn(window, "alert").mockImplementation(() => {});
        chrome.scripting.executeScript.mockResolvedValueOnce([{ frameId: 0, result: null }]);

        getColorButton.click();
        await new Promise(resolve => setTimeout(resolve, 0));

        const status = document.getElementById("errorStatus");
        expect(status.textContent).toBe("Ошибка: текст не выделен!");
        expect(status.style.display).toBe("block");
        expect(alert).not.toHaveBeenCalled();
        alert.mockRestore();
    });

    test("Длинная ошибка сохраняется целиком и исчезает после успешного действия", async () => {
        const message = `Ошибка доступа к странице: ${"оченьдлинныйтекст".repeat(20)}`;
        chrome.scripting.executeScript.mockRejectedValueOnce(new Error(message));
        getColorButton.click();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(document.getElementById("errorStatus").textContent).toBe(`Ошибка: ${message}`);

        chrome.scripting.executeScript.mockResolvedValueOnce([{ frameId: 0, result: "#123456" }]);
        getColorButton.click();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(document.getElementById("errorStatus").style.display).toBe("none");
    });

    test("Сохраняет выбранный цвет и восстанавливает его при новом открытии", () => {
        colorPicker.value = "#123abc";
        colorPicker.dispatchEvent(new Event("input"));
        expect(colorInput.value).toBe("#123abc");
        expect(localStorage.getItem("lastSelectedColor")).toBe("#123abc");

        document.body.innerHTML = html;
        window.eval(pageActionsScript);
        window.eval(popupScript);
        expect(document.getElementById("colorInput").value).toBe("#123abc");
        expect(document.getElementById("colorPicker").value).toBe("#123abc");
    });

    test("Сохраняет цвет, введённый вручную", () => {
        colorInput.value = "#abcdef";
        colorInput.dispatchEvent(new Event("input"));

        expect(colorPicker.value).toBe("#abcdef");
        expect(localStorage.getItem("lastSelectedColor")).toBe("#abcdef");
    });

    test("Получение цвета требует выделения, а не только курсора", async () => {
        const selected = document.createElement("span");
        selected.textContent = "текст Jira";
        selected.style.color = "rgb(12, 34, 56)";
        document.body.appendChild(selected);

        chrome.scripting.executeScript.mockResolvedValueOnce([{ frameId: 0, result: "#ff0000" }]);
        getColorButton.click();
        await new Promise(resolve => setTimeout(resolve, 0));
        const injected = chrome.scripting.executeScript.mock.calls[0][0].func;
        expect(injected()).toBeNull();

        const range = document.createRange();
        range.selectNodeContents(selected);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        expect(injected()).toBe("rgb(12, 34, 56)");
        window.getSelection().removeAllRanges();
    });

    test("Кнопка 'Найти текст' запускает поиск", async () => {
        colorInput.value = "#ff0000";
        chrome.scripting.executeScript.mockResolvedValueOnce([
            { frameId: 0, result: { matches: [], totalCount: 0 } },
            { frameId: 7, result: { matches: ["текст Jira"], totalCount: 1 } },
        ]);
        findButton.click();
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(chrome.scripting.executeScript).toHaveBeenCalledWith(
            expect.objectContaining({
                target: { tabId: 1, allFrames: true },
                args: ["#ff0000"],
            })
        );
        expect(resultsList.textContent).toBe("текст Jira");
        expect(document.getElementById("resultsSummary").textContent).toBe("Найдено: 1");

        resultsList.firstElementChild.click();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(chrome.scripting.executeScript).toHaveBeenLastCalledWith(
            expect.objectContaining({ target: { tabId: 1, frameIds: [7] }, args: [0] })
        );
        expect(document.getElementById("resultsSummary").textContent).toBe("Найдено: 1 · 1 из 1");
    });

    test("Отдельное окно выполняет поиск в исходной вкладке", async () => {
        window.history.replaceState({}, "", "/popup.html?tabId=42");
        document.body.innerHTML = html;
        window.eval(popupScript);
        await Promise.resolve();
        expect(chrome.tabs.get).toHaveBeenCalledWith(42);
        expect(document.getElementById("sourceTabLabel").textContent).toBe("Вкладка: Задача Jira");
        document.getElementById("findButton").click();
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(chrome.tabs.query).not.toHaveBeenCalled();
        expect(chrome.scripting.executeScript).toHaveBeenCalledWith(
            expect.objectContaining({ target: { tabId: 42, allFrames: true } })
        );
    });

    test("Кнопки перемещают выбор по списку и зацикливают его", async () => {
        chrome.scripting.executeScript.mockResolvedValueOnce([
            { frameId: 0, result: { matches: ["первый", "второй"], totalCount: 2 } },
            { frameId: 7, result: { matches: ["третий"], totalCount: 3 } },
        ]);
        findButton.click();
        await new Promise(resolve => setTimeout(resolve, 0));

        const rows = resultsList.querySelectorAll(".result-item");
        expect(upButton.disabled).toBe(false);
        expect(downButton.disabled).toBe(false);
        expect(document.getElementById("resultsSummary").textContent).toBe("Показано: 3 из 5");

        rows[0].click();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(rows[0].classList.contains("selected")).toBe(true);

        upButton.click();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(rows[2].classList.contains("selected")).toBe(true);
        expect(document.getElementById("resultsSummary").textContent).toBe("Показано: 3 из 5 · 3 из 3");
        expect(document.activeElement).toBe(rows[2]);
        expect(chrome.scripting.executeScript).toHaveBeenLastCalledWith(
            expect.objectContaining({ target: { tabId: 1, frameIds: [7] }, args: [0] })
        );

        downButton.click();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(rows[0].classList.contains("selected")).toBe(true);
        expect(document.activeElement).toBe(rows[0]);
        expect(chrome.scripting.executeScript).toHaveBeenLastCalledWith(
            expect.objectContaining({ target: { tabId: 1, frameIds: [0] }, args: [0] })
        );

        rows[1].click();
        downButton.click();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(rows[2].classList.contains("selected")).toBe(true);
    });

    test("Кнопки навигации выключены при пустом поиске", async () => {
        findButton.click();
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(upButton.disabled).toBe(true);
        expect(downButton.disabled).toBe(true);
        expect(resultsList.textContent).toBe(
            "Совпадений нет. Проверьте цвет или выделите текст на странице и нажмите «Получить цвет»."
        );
        expect(document.getElementById("resultsSummary").textContent).toBe("Найдено: 0");
    });

    test("Во время поиска показывает состояние и блокирует повторный запуск", async () => {
        let finishSearch;
        chrome.scripting.executeScript.mockImplementationOnce(() => new Promise(resolve => {
            finishSearch = resolve;
        }));

        findButton.click();
        expect(findButton.disabled).toBe(true);
        expect(findButton.textContent).toBe("Ищем…");
        expect(document.getElementById("resultsSummary").textContent).toBe("Ищем…");
        expect(resultsList.getAttribute("aria-busy")).toBe("true");
        await new Promise(resolve => setTimeout(resolve, 0));
        findButton.click();
        expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(1);

        finishSearch([{ frameId: 0, result: { matches: ["готово"], totalCount: 1 } }]);
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(findButton.disabled).toBe(false);
        expect(findButton.textContent).toBe("Найти текст");
        expect(resultsList.getAttribute("aria-busy")).toBe("false");
        expect(resultsList.textContent).toBe("готово");
    });

    test("Ошибка поиска завершает ожидание и предлагает повторить", async () => {
        chrome.scripting.executeScript.mockRejectedValueOnce(new Error("Нет доступа к странице"));
        findButton.click();
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(findButton.disabled).toBe(false);
        expect(document.getElementById("resultsSummary").textContent).toBe("Поиск не выполнен");
        expect(document.getElementById("errorStatus").textContent).toBe("Ошибка поиска: Нет доступа к странице");
        expect(resultsList.getAttribute("aria-busy")).toBe("false");
    });

    test("Стрелки переключают результаты, Enter выбирает строку", async () => {
        chrome.scripting.executeScript.mockResolvedValueOnce([
            { frameId: 0, result: { matches: ["первый", "второй", "третий"], totalCount: 3 } },
        ]);
        findButton.click();
        await new Promise(resolve => setTimeout(resolve, 0));
        const rows = resultsList.querySelectorAll(".result-item");
        expect(rows[0].tabIndex).toBe(0);
        expect(rows[1].tabIndex).toBe(-1);

        rows[0].focus();
        rows[0].dispatchEvent(new KeyboardEvent("keydown", {
            code: "ArrowDown", bubbles: true, cancelable: true,
        }));
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(document.activeElement).toBe(rows[1]);
        expect(rows[1].getAttribute("aria-selected")).toBe("true");

        rows[1].dispatchEvent(new KeyboardEvent("keydown", {
            code: "ArrowUp", bubbles: true, cancelable: true,
        }));
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(document.activeElement).toBe(rows[0]);

        rows[2].focus();
        rows[2].dispatchEvent(new KeyboardEvent("keydown", {
            code: "Enter", bubbles: true, cancelable: true,
        }));
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(rows[2].getAttribute("aria-selected")).toBe("true");
        expect(document.getElementById("resultsSummary").textContent).toBe("Найдено: 3 · 3 из 3");

        colorInput.dispatchEvent(new KeyboardEvent("keydown", {
            code: "ArrowDown", bubbles: true, cancelable: true,
        }));
        expect(rows[2].getAttribute("aria-selected")).toBe("true");
    });

    test("Shift+G и Shift+D переключают совпадения, но не мешают вводу цвета", async () => {
        chrome.scripting.executeScript.mockResolvedValueOnce([
            { frameId: 0, result: { matches: ["первый", "второй", "третий"], totalCount: 3 } },
        ]);
        findButton.click();
        await new Promise(resolve => setTimeout(resolve, 0));
        const rows = resultsList.querySelectorAll(".result-item");
        rows[0].click();

        rows[0].dispatchEvent(new KeyboardEvent("keydown", {
            code: "KeyG", key: "G", shiftKey: true, bubbles: true, cancelable: true,
        }));
        expect(rows[1].classList.contains("selected")).toBe(true);

        rows[1].dispatchEvent(new KeyboardEvent("keydown", {
            code: "KeyD", key: "D", shiftKey: true, bubbles: true, cancelable: true,
        }));
        expect(rows[0].classList.contains("selected")).toBe(true);

        rows[0].dispatchEvent(new KeyboardEvent("keydown", {
            code: "KeyD", key: "D", shiftKey: true, bubbles: true, cancelable: true,
        }));
        expect(rows[2].classList.contains("selected")).toBe(true);

        colorInput.dispatchEvent(new KeyboardEvent("keydown", {
            code: "KeyG", key: "G", shiftKey: true, bubbles: true, cancelable: true,
        }));
        expect(rows[2].classList.contains("selected")).toBe(true);
    });

    test("Кнопка 'Кликнуть раскрывашки' выполняет скрипт", async () => {
        chrome.scripting.executeScript.mockResolvedValueOnce([{ result: 0 }]);
        expandButton.click();
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(chrome.scripting.executeScript).toHaveBeenCalled();
    });
});

test("Кнопка расширения открывает отдельное окно для исходной вкладки", async () => {
    jest.clearAllMocks();
    const close = jest.spyOn(window, "close").mockImplementation(() => {});
    document.body.innerHTML = "";

    window.eval(launcherScript);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(chrome.windows.create).toHaveBeenCalledWith({
        url: "chrome-extension://test/popup.html?tabId=1",
        type: "popup",
        width: 420,
        height: 620,
        focused: true,
    });
    expect(close).toHaveBeenCalled();
    close.mockRestore();
});
