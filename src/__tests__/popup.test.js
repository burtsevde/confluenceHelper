/**
 * @jest-environment jsdom
 */
import fs from "fs";
import path from "path";

// замокаем chrome API
import "../__mocks__/chrome";

const html = fs.readFileSync(path.resolve(__dirname, "../../popup.html"), "utf8");

describe("popup.js", () => {
    let colorInput, colorPicker, findButton, getColorButton, expandButton, resultsList;

    beforeEach(() => {
        document.body.innerHTML = html;

        // элементы из popup.html
        colorInput = document.getElementById("colorInput");
        colorPicker = document.getElementById("colorPicker");
        findButton = document.getElementById("findButton");
        getColorButton = document.getElementById("getColorButton");
        expandButton = document.getElementById("expandButton");
        resultsList = document.getElementById("resultsList");

        // подключаем popup.js после рендера DOM
        jest.isolateModules(() => {
            require("../popup.js");
        });
    });

    test("При загрузке popup пытается получить цвет выделенного текста", async () => {
        // simulate DOMContentLoaded
        document.dispatchEvent(new Event("DOMContentLoaded"));

        // ждём resolve скрипта
        await Promise.resolve();

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
        colorInput.value = "#ff0000";
        findButton.click();
        await Promise.resolve();

        expect(chrome.scripting.executeScript).toHaveBeenCalledWith(
            expect.objectContaining({
                args: ["#ff0000"],
            })
        );
    });

    test("Кнопка 'Кликнуть раскрывашки' выполняет скрипт", async () => {
        expandButton.click();
        await Promise.resolve();

        expect(chrome.scripting.executeScript).toHaveBeenCalled();
    });
});
