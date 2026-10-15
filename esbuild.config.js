import { build } from "esbuild";
import { promises as fs } from "fs";
import { execFileSync } from "child_process";

const targets = ["chrome", "firefox", "safari"];

async function bundle(target) {
    const outdir = `dist/${target}`;
    await fs.mkdir(outdir, { recursive: true });

    const entries = {
        "page-actions": "src/page-actions.js",
        popup: "src/popup.js",
        launcher: "src/launcher.js"
    };

    for (const [name, entry] of Object.entries(entries)) {
        await build({
            entryPoints: [entry],
            bundle: true,
            format: "iife",
            minify: true,
            outfile: `${outdir}/${name}.js`
        });
    }

    // копируем статику
    await fs.copyFile(`manifest.${target}.json`, `${outdir}/manifest.json`);
    await fs.copyFile("popup.html", `${outdir}/popup.html`);
    await fs.copyFile("launcher.html", `${outdir}/launcher.html`);
    await fs.copyFile("privacy.html", `${outdir}/privacy.html`);
    if (target === "chrome") {
        await fs.copyFile("README.md", `${outdir}/README.md`);
    }

    // иконки
    await fs.cp("icons", `${outdir}/icons`, { recursive: true });

    // zip
    if (process.platform === "win32") {
        execFileSync("powershell.exe", [
            "-NoProfile", "-NonInteractive", "-Command",
            `Compress-Archive -Path '${outdir}/*' -DestinationPath 'dist/${target}.zip' -Force`
        ]);
    } else {
        execFileSync("zip", ["-r", `../${target}.zip`, "."], { cwd: outdir });
    }
    console.log(`✅ ${target} build done`);
}

async function main() {
    await fs.rm("dist", { recursive: true, force: true });
    for (const target of targets) {
        await bundle(target);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
