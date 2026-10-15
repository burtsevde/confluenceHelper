import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const candidates = process.platform === "win32"
    ? [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    ]
    : ["google-chrome", "chromium", "chromium-browser"];
const script = await readFile(new URL("../dist/chrome/page-actions.js", import.meta.url), "utf8");
const directory = await mkdtemp(path.join(tmpdir(), "confluence-helper-browser-"));

try {
    const htmlPath = path.join(directory, "test.html");
    await writeFile(htmlPath, `<!doctype html><meta charset="utf-8"><title>RUNNING</title>
<div id="nested" style="color: rgb(255, 0, 0)">Родитель <span>Потомок</span> и продолжение</div>
<iframe id="frame" srcdoc="<span style='color: rgb(255, 0, 0)'>Текст во фрейме</span>"></iframe>
<script>${script}</script>
<script>
window.addEventListener("load", () => {
    try {
        const search = window.ConfluencePageActions.findMatchesByColor;
        const rootResult = search("#ff0000");
        if (rootResult.totalCount !== 2 || rootResult.matches.join("|") !== "Родитель и продолжение|Потомок")
            throw new Error("nested text: " + JSON.stringify(rootResult));

        const frame = document.getElementById("frame").contentWindow;
        const frameResult = frame.eval("(" + search.toString() + ")('#ff0000')");
        if (frameResult.totalCount !== 1 || frameResult.matches[0] !== "Текст во фрейме")
            throw new Error("frame: " + JSON.stringify(frameResult));

        const batch = document.createDocumentFragment();
        for (let index = 0; index < 152; index++) {
            const element = document.createElement("span");
            element.style.color = "rgb(255, 0, 0)";
            element.textContent = "Найдено " + index;
            batch.append(element);
        }
        document.body.append(batch);
        const many = search("#ff0000");
        if (many.totalCount !== 154 || many.matches.length !== 150 ||
            document.querySelectorAll(".color-text-finder-highlight").length !== 150)
            throw new Error("limit: " + JSON.stringify({ total: many.totalCount, shown: many.matches.length }));
        document.title = "BROWSER_TEST_PASS";
    } catch (error) {
        document.title = "BROWSER_TEST_FAIL: " + error.message;
    }
});
</script>`);

    let result;
    for (const browser of [process.env.CHROME_PATH, ...candidates].filter(Boolean)) {
        result = spawnSync(browser, [
            "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
            `--user-data-dir=${path.join(directory, "profile")}`,
            "--virtual-time-budget=3000", "--dump-dom", pathToFileURL(htmlPath).href,
        ], { encoding: "utf8", timeout: 20000 });
        if (!result.error?.code || result.error.code !== "ENOENT") break;
    }

    if (result?.error) throw result.error;
    const title = result.stdout.match(/<title>([^<]*)<\/title>/)?.[1];
    if (title !== "BROWSER_TEST_PASS") {
        throw new Error(`Browser test failed: ${title || result.stderr || result.stdout}`);
    }
    console.log("Browser test passed: nested text, frame, 150-result limit");
} finally {
    await rm(directory, { recursive: true, force: true });
}
