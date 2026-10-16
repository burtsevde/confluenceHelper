import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const browser = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const html = await readFile(path.join(root, "popup.html"), "utf8");
const actions = await readFile(path.join(root, "dist/chrome/page-actions.js"), "utf8");
const popup = await readFile(path.join(root, "dist/chrome/popup.js"), "utf8");
const directory = await mkdtemp(path.join(tmpdir(), "confluence-helper-screenshots-"));

function runChrome(page, output) {
    const result = spawnSync(browser, [
        "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
        "--no-default-browser-check", "--force-device-scale-factor=1",
        "--window-size=500,680", "--virtual-time-budget=1500",
        `--user-data-dir=${path.join(directory, `profile-${output}`)}`,
        `--screenshot=${path.join(root, "screenshots", output)}`,
        `${pathToFileURL(page).href}?tabId=1`,
    ], { encoding: "utf8", timeout: 20000 });
    if (result.error || result.status !== 0) throw result.error || new Error(result.stderr);
}

try {
    for (const [number, scenario] of [[1, "color"], [2, "results"]]) {
        const mock = `
            localStorage.setItem("lastSelectedColor", "#ae2e24");
            window.chrome = {
                tabs: {
                    get: async () => ({ id: 1, title: "Тестовая страница — Confluence" }),
                    query: async () => [{ id: 1 }],
                },
                scripting: {
                    executeScript: async ({ args, target }) => {
                        if (args?.length) return [{ frameId: 0, result: {
                            matches: ["Описание задачи", "Нужно проверить настройки проекта", "Уведомления проекта"],
                            totalCount: 3,
                        }}];
                        if (target.frameIds) return [{ result: null }];
                        return [{ frameId: 0, result: "rgb(174, 46, 36)" }];
                    },
                },
            };
        `;
        const interaction = scenario === "color"
            ? `document.getElementById("getColorButton").click();`
            : `document.getElementById("findButton").click();
               setTimeout(() => document.querySelectorAll(".result-item")[1]?.click(), 100);`;
        const page = html.replace(
            /<script src="page-actions\.js"><\/script>\s*<script src="popup\.js"><\/script>/,
            `<script>${mock}</script><script>${actions}</script><script>${popup}</script>
             <script>window.addEventListener("load", () => { ${interaction} });</script>`,
        );
        if (page === html) throw new Error("Popup scripts were not replaced");
        const pagePath = path.join(directory, `scenario-${number}.html`);
        await writeFile(pagePath, page);
        runChrome(pagePath, `Screenshot_${number}.png`);
        console.log(`Updated screenshots/Screenshot_${number}.png`);
    }
} finally {
    const resolved = path.resolve(directory);
    if (!resolved.startsWith(path.resolve(tmpdir()) + path.sep)) throw new Error("Unsafe temporary path");
    await rm(resolved, { recursive: true, force: true });
}
