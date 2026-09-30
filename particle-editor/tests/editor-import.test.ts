import assert from "node:assert/strict";
import test from "node:test";
import { createConfigArchive } from "../src/config/archive";
import { EditorController } from "../src/ui/EditorController";
import { createDefaultEditorConfig } from "../src/config/defaults";

function example(name: string) {
    return {
        name, maxParticles: 20, texture: { source: "builtin", kind: "circle" },
        emission: { emitterType: "dot", emitterX: 0, emitterY: 0, rate: 10, directionMin: 0, directionMax: 90 },
        base: { lifetime: 1 },
    };
}

type TestSystem = { id: string; name: string; uploadedTextureAsset: { destroy(): void } | null };
type ImportHarness = {
    systems: TestSystem[];
    currentSystemId: string;
    importInProgress: boolean;
    handleLoadConfigsFromZip(): Promise<void>;
};

async function createHarness(failOn?: string) {
    const bytes = await createConfigArchive([example("First"), example("Second")]).generateAsync({ type: "uint8array" });
    const input = { files: [bytes], value: "selected.zip" };
    const status = { textContent: "", hidden: true };
    const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
    Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: { getElementById: (id: string) => id === "loadConfigsZipInput" ? input : status },
    });

    const destroyed: string[] = [];
    const removed: string[] = [];
    const activated: string[] = [];
    const previous = { id: "original", name: "Original", config: createDefaultEditorConfig(), uploadedTextureAsset: { destroy: () => destroyed.push("original") } };
    const controller = Object.assign(Object.create(EditorController.prototype), {
        systems: [previous], currentSystemId: previous.id, importInProgress: false, textureOperation: 0,
        preview: {
            applyConfig: async (_id: string, config: { name: string }) => {
                if (config.name === failOn) throw new Error("Texture upload failed");
            },
            removeSystem: (id: string) => removed.push(id),
            setEnabled: (id: string, enabled: boolean) => { if (enabled) activated.push(id); },
        },
        loadSerializedTexture: async (config: { name: string }) => ({ asset: { destroy: () => destroyed.push(config.name) }, folderKey: null }),
        switchCurrentSystem: (id: string) => { controller.currentSystemId = id; },
    }) as ImportHarness;

    return {
        controller, previous, input, status, destroyed, removed, activated,
        restoreDocument() {
            if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
            else Reflect.deleteProperty(globalThis, "document");
        },
    };
}

test("failed ZIP staging preserves the working project and releases all staged resources", async () => {
    const harness = await createHarness("Second");
    try {
        await harness.controller.handleLoadConfigsFromZip();
        assert.deepEqual(harness.controller.systems, [harness.previous]);
        assert.equal(harness.controller.currentSystemId, "original");
        assert.equal(harness.removed.includes("original"), false);
        assert.deepEqual(harness.destroyed, ["First", "Second"]);
        assert.equal(harness.activated.length, 0);
        assert.match(harness.status.textContent, /Texture upload failed/);
        assert.equal(harness.status.hidden, false);
        assert.equal(harness.controller.importInProgress, false);
        assert.equal(harness.input.value, "");
    } finally {
        harness.restoreDocument();
    }
});

test("successful ZIP staging replaces the whole project and retains committed textures", async () => {
    const harness = await createHarness();
    try {
        await harness.controller.handleLoadConfigsFromZip();
        assert.deepEqual(harness.controller.systems.map((system) => system.name), ["First", "Second"]);
        assert.deepEqual(harness.removed, ["original"]);
        assert.deepEqual(harness.destroyed, ["original"]);
        assert.equal(harness.activated.length, 2);
        assert.equal(harness.controller.currentSystemId, harness.controller.systems[0].id);
    } finally {
        harness.restoreDocument();
    }
});
