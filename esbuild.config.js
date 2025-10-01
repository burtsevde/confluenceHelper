import { build } from "esbuild";
import { promises as fs } from "fs";
import { execSync } from "child_process";

const targets = ["chrome", "firefox", "safari"];

async function bundle(target) {
    const outdir = `dist/${target}`;
    await fs.mkdir(outdir, { recursive: true });

    const entries = {
        popup: "src/popup.js"
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
    await fs.copyFile("privacy.html", `${outdir}/privacy.html`);

    // иконки
    execSync(`cp -r icons ${outdir}/`);

    // zip
    execSync(`cd ${outdir} && zip -r ${target}.zip .`);
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
