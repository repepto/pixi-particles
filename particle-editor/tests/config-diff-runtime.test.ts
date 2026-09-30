import assert from "node:assert/strict";
import test from "node:test";
import { ParticleSystem } from "pixi-particle";
import { Texture, TextureSource } from "pixi.js";
import { createDefaultEditorConfig } from "../src/config/defaults";
import { buildSerializableConfig } from "../src/config/runtime";
import { buildConfigDiff } from "../src/config/serialization";

test("Get Diff can disable modules in the installed core while preserving unrelated configuration", async () => {
    const config = { ...createDefaultEditorConfig(), enableStartSpeed: true, enableAlphaOverLifetime: true, maxParticles: 20 };
    const previous = buildSerializableConfig(config, null);
    const current = buildSerializableConfig({ ...config, enableStartSpeed: false, enableAlphaOverLifetime: false }, null);
    const diff = buildConfigDiff(previous, current);
    assert.ok(diff);
    assert.deepEqual(JSON.parse(JSON.stringify(diff)), { base: { startSpeed: null }, overLifetime: { alpha: null } });

    const textures: Texture[] = [];
    const renderer = {
        generateTexture() {
            const texture = new Texture({ source: new TextureSource({ width: 16, height: 16 }) });
            textures.push(texture);
            return texture;
        },
    };
    const system = await ParticleSystem.fromSerializedConfig(previous, renderer);
    try {
        assert.ok(system.config.modules.startSpeed);
        assert.ok(system.config.modules.alphaOverLifetime);
        await system.updateConfigFromSerialized(diff, true);
        assert.equal(system.config.modules.startSpeed, undefined);
        assert.equal(system.config.modules.alphaOverLifetime, undefined);
        assert.equal(system.config.emission.rate, previous.emission.rate);
        assert.equal(system.config.maxParticles, previous.maxParticles);
    } finally {
        system.destroy();
        for (const texture of textures) if (!texture.destroyed) texture.destroy(true);
    }
});
