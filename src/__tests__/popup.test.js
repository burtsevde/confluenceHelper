/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// замокаем chrome API
import "../__mocks__/chrome";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const html = fs.readFileSync(path.resolve(__dirname, "../../popup.html"), "utf8");

describe("popup.js", () => {
    let colorInput, colorPicker, findButton, getColorButton, expandButton, resultsList;

    beforeEach(() => {
        document.body.innerHTML = html;

        // мокаем alert
        jest.spyOn(window, 'alert').mockImplementation(() => {});

        // очищаем моки chrome
        chrome.scripting.executeScript.mockClear();
        chrome.tabs.query.mockClear();

        // элементы из popup.html
        colorInput = document.getElementById("colorInput");
        colorPicker = document.getElementById("colorPicker");
        findButton = document.getElementById("findButton");
        getColorButton = document.getElementById("getColorButton");
        expandButton = document.getElementById("expandButton");
        resultsList = document.getElementById("resultsList");

        // подключаем popup.js после рендера DOM
        const code = fs.readFileSync(path.resolve(__dirname, "../popup.js"), "utf8");
        const script = document.createElement("script");
        script.textContent = code;
        document.body.appendChild(script);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // Вспомогательная функция для ожидания всех промисов
    const flushPromises = () => new Promise(resolve => setTimeout(resolve, 10));

    test("При загрузке popup пытается получить цвет выделенного текста", async () => {
        // simulate DOMContentLoaded
        document.dispatchEvent(new Event("DOMContentLoaded"));

        // ждём resolve скрипта (getActiveTab + executeScript + then)
        await flushPromises();

        expect(chrome.scripting.executeScript).toHaveBeenCalled();
        expect(colorInput.value).toBe("#ff0000");
        expect(colorPicker.value).toBe("#ff0000");
    });

    test("Кнопка 'Получить цвет' обновляет селекторы", async () => {
        getColorButton.click();
        await Promise.resolve();

        expect(colorInput.value).toBe("#ff0000");
        expect(colorPicker.value).toBe("#ff0000");
    });

    test("Кнопка 'Найти текст' запускает поиск", async () => {
        chrome.scripting.executeScript.mockResolvedValueOnce([{ result: ["Текст 1", "Текст 2"] }]);
        colorInput.value = "#ff0000";
        findButton.click();
        await Promise.resolve();
        await Promise.resolve(); // extra tick for the .then() in findButton

        expect(chrome.scripting.executeScript).toHaveBeenCalledWith(
            expect.objectContaining({
                args: ["#ff0000"],
            })
        );
    });

    test("Кнопка 'Кликнуть раскрывашки' выполняет скрипт и показывает статус", async () => {
        chrome.scripting.executeScript.mockResolvedValueOnce([{ result: 5 }]);

        expandButton.click();
        await flushPromises();

        expect(chrome.scripting.executeScript).toHaveBeenCalled();
        const status = document.getElementById("expandStatus");
        expect(status.textContent).toBe("Кликнуто элементов: 5");
        expect(status.style.display).toBe("block");
    });

    test("Ошибка, если текст не выделен при получении цвета", async () => {
        chrome.scripting.executeScript.mockResolvedValueOnce([{ result: null }]);

        getColorButton.click();
        await flushPromises();

        expect(window.alert).toHaveBeenCalledWith("Ошибка: текст не выделен!");
    });

    test("Поиск текста: отображение результатов и клик по результату", async () => {
        const mockResults = ["Результат 1", "Результат 2"];
        chrome.scripting.executeScript.mockResolvedValueOnce([{ result: mockResults }]);

        colorInput.value = "#ff0000";
        findButton.click();

        await flushPromises();

        const items = resultsList.querySelectorAll(".result-item");
        expect(items.length).toBe(2);
        expect(items[0].textContent).toBe("Результат 1");

        // Клик по результату
        items[0].click();
        await flushPromises();

        expect(chrome.scripting.executeScript).toHaveBeenLastCalledWith(
            expect.objectContaining({
                args: [0],
                func: expect.any(Function)
            })
        );
    });

    test("Поиск текста: ничего не найдено", async () => {
        chrome.scripting.executeScript.mockResolvedValueOnce([{ result: [] }]);

        colorInput.value = "#000000";
        findButton.click();

        await flushPromises();

        expect(resultsList.textContent).toBe("Ничего не найдено.");
    });

    test("rgbToHex правильно конвертирует цвета из scripting.executeScript", async () => {
        chrome.scripting.executeScript.mockResolvedValueOnce([{ result: "rgb(255, 0, 0)" }]);

        getColorButton.click();
        await flushPromises();

        expect(colorInput.value).toBe("#ff0000");
    });
});
