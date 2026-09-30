import assert from "node:assert/strict";
import test from "node:test";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import JSZip from "jszip";
import { createConfigArchive, createUniqueConfigFileNames, readConfigArchive } from "../src/config/archive";
import { buildConfigDiff, parseSerializedConfig, toEditorConfig } from "../src/config/serialization";

function example(name = "Sparks") {
    return {
        name,
        maxParticles: 300,
        texture: { source: "builtin", kind: "star" },
        emission: { emitterType: "dot", emitterX: 0, emitterY: 0, rate: 10, directionMin: -120, directionMax: -60 },
        base: { lifetime: { min: 1, max: 2 } },
    };
}

test("ZIP export retains systems with duplicate, sanitized and case-only names", async () => {
    const names = ["fire", "fire", "fire (2)", "FIRE", "a/b", "a:b", "   "];
    const configs = names.map((name, index) => ({ ...example(name.trim() || "particle system"), maxParticles: 100 + index }));
    const archive = createConfigArchive(configs);
    const bytes = await archive.generateAsync({ type: "uint8array" });
    const zip = await JSZip.loadAsync(bytes);
    const entries = Object.values(zip.files).filter((entry) => !entry.dir);
    assert.equal(entries.length, names.length);
    assert.equal(new Set(entries.map((entry) => entry.name.toLowerCase())).size, names.length);
    const restored = await readConfigArchive(bytes);
    assert.deepEqual(restored.map((item) => item.maxParticles).sort(), configs.map((item) => item.maxParticles).sort());
    assert.deepEqual(restored.map((item) => item.name).sort(), configs.map((item) => item.name).sort());
});

test("archive filenames cannot create directories and are unique after sanitizing", () => {
    const names = createUniqueConfigFileNames(["a/b", "a:b", "a_b (2)", "A_B", "..", " "]);
    assert.deepEqual(names, ["a_b.json", "a_b (2).json", "a_b (2) (2).json", "A_B (3).json", "_.json", "particle system.json"]);
});

test("an archive with a malformed later entry fails as a whole", async () => {
    const zip = new JSZip();
    zip.file("01-valid.json", JSON.stringify(example()));
    zip.file("02-invalid.json", JSON.stringify({ ...example(), base: { lifetime: { min: 2, max: 1 } } }));
    await assert.rejects(readConfigArchive(await zip.generateAsync({ type: "uint8array" })), /02-invalid.json.*min <= max/);
});

test("invalid JSON and archives without configs return actionable errors", async () => {
    const invalid = new JSZip().file("broken.json", "{");
    await assert.rejects(readConfigArchive(await invalid.generateAsync({ type: "uint8array" })), /Cannot import broken.json/);
    const empty = new JSZip().file("readme.txt", "No config");
    await assert.rejects(readConfigArchive(await empty.generateAsync({ type: "uint8array" })), /contains no JSON/);
});

test("import validates nested data before it reaches forms or runtime modules", () => {
    for (const value of [null, [], "config", { ...example(), maxParticles: Infinity }, { ...example(), maxParticles: 1.5 },
        { ...example(), texture: { source: "builtin", kind: "unknown" } },
        { ...example(), overLifetime: { size: [{ t: 0, value: "huge" }] } },
        { ...example(), base: { lifetime: 1, startColors: ['\" onfocus=\"alert(1)'] } },
        { ...example(), texture: { source: "sequence", fileNames: [] } },
    ]) assert.throws(() => parseSerializedConfig(value));
});

test("import converts typed providers, numeric colors, timeline and texture sequence", () => {
    const serialized = parseSerializedConfig({
        ...example(),
        texture: { source: "sequence", fileNames: ["spark-01.png", "spark-02.png"], randomStart: true, frameRate: 24 },
        emission: { ...example().emission, burst: 0, bursts: [{ time: 0, count: 12 }], duration: 2, loop: false },
        simulation: { prewarm: 0.75 },
        base: { lifetime: 2, startSpeed: { min: 10, max: 20 }, startColors: [0xFF8800, "#ABCDEF"] },
        overLifetime: { color: [{ t: 0, color: 0x0000FF }, { t: 1, color: "#FFFFFF" }] },
    });
    const config = toEditorConfig(serialized);
    assert.equal(config.lifetimeMode, "constant");
    assert.equal(config.lifetimeConst, 2);
    assert.equal(config.enableStartSpeed, true);
    assert.equal(config.speedMin, 10);
    assert.equal(config.enableBurst, true);
    assert.equal(config.burst, 0);
    assert.equal(config.loop, false);
    assert.deepEqual(config.timelineBursts, [{ time: 0, count: 12 }]);
    assert.equal(config.prewarm, 0.75);
    assert.equal(config.sequenceFrameRate, 24);
    assert.equal(config.sequenceRandomStart, true);
    assert.deepEqual(config.startColors, ["#ff8800", "#ABCDEF"]);
    assert.deepEqual(config.colorCurve, [{ t: 0, color: "#0000ff" }, { t: 1, color: "#FFFFFF" }]);
    config.timelineBursts[0].count = 99;
    assert.equal(serialized.emission.bursts?.[0].count, 12, "the editor must not mutate its source document");
});

test("each import starts from independent defaults with disabled omitted modules", () => {
    const first = toEditorConfig(parseSerializedConfig(example()));
    first.sizeCurve[0].value = 100;
    first.enableGravity = true;
    const second = toEditorConfig(parseSerializedConfig(example()));
    assert.notEqual(second.sizeCurve[0].value, 100);
    assert.equal(second.enableGravity, false);
});

test("configuration diff retains removal of optional serializer fields after JSON encoding", () => {
    const previous = parseSerializedConfig({ ...example(), emission: { ...example().emission, burst: 12 }, base: { lifetime: 1, startSpeed: 100 } });
    const current = parseSerializedConfig({ ...example(), emission: { ...example().emission, rate: 20, burst: undefined }, base: { lifetime: 1, startSpeed: undefined } });
    assert.deepEqual(JSON.parse(JSON.stringify(buildConfigDiff(previous, current))), {
        emission: { rate: 20, burst: null }, base: { startSpeed: null },
    });
    assert.equal(buildConfigDiff(current, current), undefined);
});

test("texture variant changes emit a replacement without stale fields or deletion markers", () => {
    const previous = parseSerializedConfig(example());
    const current = parseSerializedConfig({ ...example(), texture: { source: "raster", fileName: "spark.png" } });
    assert.deepEqual(buildConfigDiff(previous, current), { texture: { source: "raster", fileName: "spark.png" } });
});

test("omitted optional properties use the core defaults, independent of the demo scene", () => {
    const config = toEditorConfig(parseSerializedConfig({ ...example(), emission: { ...example().emission, emitterType: "circle", duration: 0 } }));
    assert.equal(config.simulationSpace, "local");
    assert.equal(config.blendMode, "normal");
    assert.equal(config.loop, false);
    assert.equal(config.duration, 0);
    assert.equal(config.enableDurationLoop, true);
    assert.equal(config.emitterRadius, 0);
    assert.equal(config.enableStartSpeed, false);
    assert.equal(config.enableStartSize, false);
    assert.equal(config.enableGravity, false);
});

test("every bundled JSON and ZIP preset passes import validation", async () => {
    const directory = fileURLToPath(new URL("../presets/", import.meta.url));
    let checked = 0;
    for (const entry of await readdir(directory, { recursive: true, withFileTypes: true })) {
        if (!entry.isFile() || !/\.(json|zip)$/i.test(entry.name)) continue;
        const path = join(entry.parentPath, entry.name);
        const data = await readFile(path);
        if (/\.zip$/i.test(entry.name)) {
            const configs = await readConfigArchive(data);
            for (const config of configs) toEditorConfig(config);
        } else {
            toEditorConfig(parseSerializedConfig(JSON.parse(data.toString()), path));
        }
        checked++;
    }
    assert.ok(checked > 0, "preset coverage must not silently disappear");
});
