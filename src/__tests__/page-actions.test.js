/**
 * @jest-environment jsdom
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const script = fs.readFileSync(path.resolve(testDir, "../page-actions.js"), "utf8");

beforeEach(() => {
    document.body.innerHTML = "";
    window.eval(script);
});

test("поиск учитывает прямой текст вложенных элементов по одному разу", () => {
    document.body.innerHTML = `
        <div style="color: rgb(255, 0, 0)">Родитель <span>Потомок</span> и продолжение</div>
        <div style="color: blue">Другой цвет</div>
        <script>const text = "не искать";</script>`;

    const result = window.ConfluencePageActions.findMatchesByColor("#ff0000");

    expect(result).toEqual({ matches: ["Родитель и продолжение", "Потомок"], totalCount: 2 });
    expect(document.querySelectorAll(".color-text-finder-highlight")).toHaveLength(2);
});

test("ограничение 150 действует до подсветки, общее число сохраняется", () => {
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < 152; index++) {
        const element = document.createElement("span");
        element.style.color = "rgb(255, 0, 0)";
        element.textContent = `Совпадение ${index}`;
        fragment.append(element);
    }
    document.body.append(fragment);

    const result = window.ConfluencePageActions.findMatchesByColor("#ff0000");

    expect(result.totalCount).toBe(152);
    expect(result.matches).toHaveLength(150);
    expect(document.querySelectorAll(".color-text-finder-highlight")).toHaveLength(150);
    expect(result.matches[149]).toBe("Совпадение 149");
});
