import { createHash } from "node:crypto";
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const core = join(root, "particle-core");
const editor = join(root, "particle-editor");
const npmCli = process.env.npm_execpath;

function npm(cwd, ...args) {
    const result = npmCli
        ? spawnSync(process.execPath, [npmCli, ...args], { cwd, stdio: "inherit" })
        : spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", args, { cwd, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`npm ${args.join(" ")} failed in ${relative(root, cwd)}.`);
}

async function packCore() {
    npm(core, "pack", "--quiet");
    const manifest = JSON.parse(await readFile(join(core, "package.json"), "utf8"));
    const fileName = `${manifest.name.replace(/^@/, "").replaceAll("/", "-")}-${manifest.version}.tgz`;
    const dependency = `file:../particle-core/${fileName}`;
    const tarball = await readFile(join(core, fileName));
    const editorManifest = JSON.parse(await readFile(join(editor, "package.json"), "utf8"));
    const lock = JSON.parse(await readFile(join(editor, "package-lock.json"), "utf8"));

    // A local tarball can change without a version bump during development.
    // Update only its lock entry so npm ci verifies the newly built bytes.
    editorManifest.dependencies[manifest.name] = dependency;
    lock.packages[""].dependencies[manifest.name] = dependency;
    lock.packages[`node_modules/${manifest.name}`] = {
        version: manifest.version,
        resolved: dependency,
        integrity: `sha512-${createHash("sha512").update(tarball).digest("base64")}`,
        license: manifest.license,
        peerDependencies: manifest.peerDependencies,
        engines: manifest.engines,
    };
    await writeFile(join(editor, "package.json"), JSON.stringify(editorManifest, null, 2) + "\n");
    await writeFile(join(editor, "package-lock.json"), JSON.stringify(lock, null, 2) + "\n");
    return fileName;
}

function installEditor() {
    npm(editor, "ci", "--no-audit", "--no-fund");
}

function check() {
    npm(core, "run", "check");
    npm(editor, "run", "check");
}

async function archive(fileName) {
    const require = createRequire(join(editor, "package.json"));
    const JSZip = require("jszip");
    const zip = new JSZip();
    const excluded = new Set([".git", ".idea", ".ai", ".vite", ".npmrc", ".DS_Store", "__MACOSX", "node_modules", "dist"]);
    async function add(directory) {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
            if (excluded.has(entry.name) || entry.name.startsWith("._") || entry.name === ".env" || entry.name.startsWith(".env.")) continue;
            const path = join(directory, entry.name);
            if (entry.isDirectory()) await add(path);
            else if (entry.isFile()) {
                if (entry.name.endsWith(".tgz") && path !== join(core, fileName)) continue;
                zip.file(`particle-system/${relative(root, path).split("\\").join("/")}`, await readFile(path));
            }
        }
    }
    for (const directory of [core, editor, join(root, "scripts"), join(root, ".github")]) await add(directory);
    for (const name of ["README.md", "LICENSE", "package.json", ".gitignore", ".nvmrc"]) {
        zip.file(`particle-system/${name}`, await readFile(join(root, name)));
    }
    const destination = join(root, "release", "particle-system-showcase.zip");
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
    console.log(`\nReady to share: ${destination}`);
}

try {
    switch (process.argv[2]) {
        case "setup":
            npm(core, "ci", "--no-audit", "--no-fund");
            await packCore();
            installEditor();
            break;
        case "check":
            check();
            break;
        case "build":
            await packCore();
            installEditor();
            npm(editor, "run", "build");
            break;
        case "release": {
            const fileName = await packCore();
            installEditor();
            check();
            npm(editor, "run", "build");
            await archive(fileName);
            break;
        }
        default:
            throw new Error("Use npm run setup, check, build or release.");
    }
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
}
