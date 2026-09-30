import assert from "node:assert/strict";
import { test } from "node:test";
import { Assets, Texture, TextureSource } from "pixi.js";
import type { ParticleSystemConfig } from "../src/config/ParticleSystemConfig.js";
import { ConstantModule } from "../src/modules/value/ConstantModule.js";
import { DotEmitterModule } from "../src/modules/emitter/DotEmitterModule.js";
import { ParticleSystem, type SerializedConfig } from "../src/system/ParticleSystem.js";
import { MultiParticleSystem } from "../src/system/MultiParticleSystem.js";

function config(emission: ParticleSystemConfig["emission"]): ParticleSystemConfig {
    return {
        name: "test",
        texture: Texture.EMPTY,
        maxParticles: 128,
        emission,
        modules: { emitter: new DotEmitterModule(), lifetime: new ConstantModule(100) },
    };
}

function visibleParticles(system: ParticleSystem) {
    return system.particleContainer.particleChildren.filter((particle) => particle.alpha > 0);
}

test("timeline includes zero and boundary bursts exactly once", (t) => {
    const system = new ParticleSystem(config({ rate: 0, bursts: [{ time: 0, count: 2 }, { time: 0.5, count: 3 }] }));
    t.after(() => system.destroy());
    system.update(0.25);
    assert.equal(visibleParticles(system).length, 2);
    system.update(0.25);
    assert.equal(visibleParticles(system).length, 5);
    system.update(0.25);
    assert.equal(visibleParticles(system).length, 5);
});

test("crossing a finite duration preserves final bursts and only emits rate for the active interval", (t) => {
    const system = new ParticleSystem(config({
        rate: 10,
        duration: 1,
        bursts: [{ time: 0, count: 2 }, { time: 0.75, count: 3 }, { time: 1, count: 4 }, { time: 1.1, count: 7 }],
    }));
    t.after(() => system.destroy());
    system.update(1.25);
    assert.equal(visibleParticles(system).length, 19);
    system.update(1);
    assert.equal(visibleParticles(system).length, 19);
});

test("timeline particles are aged from their event timestamp", (t) => {
    const runtime = config({ rate: 0, duration: 1, bursts: [{ time: 0.9, count: 1 }] });
    runtime.modules.lifetime = new ConstantModule(0.2);
    const system = new ParticleSystem(runtime);
    t.after(() => system.destroy());
    system.update(1);
    assert.equal(visibleParticles(system).length, 1);
    system.update(0.11);
    assert.equal(visibleParticles(system).length, 0);
});

test("replacing a live timeline does not replay the already reached boundary", (t) => {
    const emission = { rate: 0, bursts: [{ time: 0.5, count: 3 }, { time: 1, count: 2 }] };
    const system = new ParticleSystem(config(emission));
    t.after(() => system.destroy());
    system.update(0.5);
    system.updateConfig({ emission }, true);
    system.update(0.5);
    assert.equal(visibleParticles(system).length, 5);
});

test("a long frame preserves every crossed loop and its remainder", (t) => {
    const emission = { rate: 4, duration: 1, loop: true, burst: 2, bursts: [
        { time: 0, count: 3 }, { time: 0.75, count: 5 }, { time: 1, count: 7 },
    ] };
    const whole = new ParticleSystem(config(emission));
    const stepped = new ParticleSystem(config(emission));
    t.after(() => { whole.destroy(); stepped.destroy(); });
    whole.update(2.25);
    for (let i = 0; i < 9; i++) stepped.update(0.25);
    assert.equal(visibleParticles(whole).length, 48);
    assert.equal(visibleParticles(whole).length, visibleParticles(stepped).length);
    whole.update(0.5);
    assert.equal(visibleParticles(whole).length, 55);
});

test("restart clears old particles and repeats the initial and timeline bursts", (t) => {
    const system = new ParticleSystem(config({ rate: 0, duration: 0.5, burst: 2, bursts: [{ time: 0, count: 3 }, { time: 0.25, count: 4 }] }));
    t.after(() => system.destroy());
    system.update(1);
    assert.equal(visibleParticles(system).length, 9);
    system.stop();
    system.restart();
    assert.equal(visibleParticles(system).length, 0);
    system.update(0.1);
    assert.equal(visibleParticles(system).length, 5);
    system.update(0.2);
    assert.equal(visibleParticles(system).length, 9);
});

test("restart resets the fractional rate accumulator and reapplies prewarm", (t) => {
    const runtime = config({ rate: 4 });
    runtime.simulation = { prewarm: 0.5 };
    const system = new ParticleSystem(runtime);
    t.after(() => system.destroy());
    system.update(0.2);
    assert.equal(visibleParticles(system).length, 2);
    system.restart();
    system.update(0.1);
    assert.equal(visibleParticles(system).length, 2);
});

test("zero duration emits its opening burst once even when loop is enabled", (t) => {
    const system = new ParticleSystem(config({ rate: 10, duration: 0, loop: true, burst: 2, bursts: [{ time: 0, count: 3 }] }));
    t.after(() => system.destroy());
    system.update(1);
    system.update(1);
    assert.equal(visibleParticles(system).length, 5);
});

test("stopping emission skips elapsed timeline events instead of replaying them on resume", (t) => {
    const system = new ParticleSystem(config({ rate: 0, bursts: [{ time: 0.5, count: 3 }, { time: 1, count: 2 }] }));
    t.after(() => system.destroy());
    system.stopEmission();
    system.update(0.75);
    system.startEmission();
    system.update(0.25);
    assert.equal(visibleParticles(system).length, 2);
});

test("merging simulation space reparents the container and uses the new spawn coordinates", (t) => {
    const system = new ParticleSystem(config({ rate: 0, burst: 1 }));
    t.after(() => system.destroy());
    const localParent = system.particleContainer.parent;
    system.setPosition(30, 40);
    system.updateConfig({ simulationSpace: "world" }, true);
    assert.equal(system.particleContainer.parent, system.container);
    system.update(0.01);
    assert.equal(visibleParticles(system)[0].x, 30);
    assert.equal(visibleParticles(system)[0].y, 40);
    system.updateConfig({ simulationSpace: "local" }, true);
    assert.equal(system.particleContainer.parent, localParent);
    system.restart();
    system.update(0.01);
    assert.equal(visibleParticles(system)[0].x, 0);
});

test("invalid frame deltas do not corrupt the emission clock", (t) => {
    const system = new ParticleSystem(config({ rate: 10 }));
    t.after(() => system.destroy());
    system.update(Number.NaN);
    system.update(Number.POSITIVE_INFINITY);
    system.update(-1);
    system.update(0.1);
    assert.equal(visibleParticles(system).length, 1);
});

function serialized(): SerializedConfig {
    return {
        name: "builtin",
        maxParticles: 4,
        texture: { source: "builtin", kind: "circle" },
        emission: { rate: 0, burst: 1, emitterType: "dot", emitterX: 0, emitterY: 0, directionMin: 0, directionMax: 0 },
        base: { lifetime: 100 },
    };
}

function newTexture(): Texture {
    return new Texture({ source: new TextureSource({ width: 8, height: 8 }) });
}

test("replacing generated textures releases superseded ownership and updates the renderer texture", async (t) => {
    const generated: Texture[] = [];
    const renderer = { generateTexture: () => {
        const texture = newTexture();
        generated.push(texture);
        return texture;
    } };
    const system = await ParticleSystem.fromSerializedConfig(serialized(), renderer);
    t.after(() => { if (!system.container.destroyed) system.destroy(); });
    system.update(0.01);
    // Reproduce Pixi's cached texture after the first render.
    system.particleContainer.texture = generated[0];
    await system.updateConfigFromSerialized({ texture: { source: "builtin", kind: "star" } }, true);
    assert.equal(generated[0].destroyed, true);
    assert.equal(generated[1].destroyed, false);
    assert.equal(system.particleContainer.texture, generated[1]);
    assert.ok(system.particleContainer.particleChildren.every((particle) => particle.texture === generated[1]));
    system.destroy();
    assert.equal(generated[1].destroyed, true);
});

test("switching an owned built-in to a caller texture never destroys the caller texture", async () => {
    const owned = newTexture();
    const external = newTexture();
    const system = await ParticleSystem.fromSerializedConfig(serialized(), { generateTexture: () => owned });
    try {
        system.updateConfig({ texture: external }, true);
        assert.equal(owned.destroyed, true);
        assert.equal(external.destroyed, false);
        system.destroy();
        assert.equal(external.destroyed, false);
    } finally {
        external.destroy(true);
    }
});

test("multi-system restart repeats every child effect", (t) => {
    const system = new MultiParticleSystem([config({ rate: 0, burst: 2, duration: 0.1 }), config({ rate: 0, burst: 3, duration: 0.1 })]);
    t.after(() => system.destroy());
    system.update(1);
    system.restart();
    system.update(0.01);
    const count = system.container.children.flatMap((child) => child.children)
        .flatMap((child) => child.children)
        .flatMap((child) => "particleChildren" in child ? child.particleChildren as Array<{ alpha: number }> : [])
        .filter((particle) => particle.alpha > 0).length;
    assert.equal(count, 5);
});

test("a failed serialized texture update leaves the previous configuration usable", async (t) => {
    const system = await ParticleSystem.fromSerializedConfig(serialized(), { generateTexture: newTexture });
    t.after(() => system.destroy());
    await assert.rejects(
        system.updateConfigFromSerialized({ texture: { source: "sequence", fileNames: [] } }, true),
        /at least one frame/,
    );
    await system.updateConfigFromSerialized({ name: "still usable" }, true);
    assert.equal(system.config.name, "still usable");
    system.update(0.01);
    assert.equal(visibleParticles(system).length, 1);
});

test("JSON merge patches disable optional providers and complete module groups", async (t) => {
    const initial = serialized();
    initial.base.startSpeed = { min: 20, max: 30 };
    initial.base.startAlpha = 0.5;
    initial.overLifetime = { size: [{ t: 0, value: 1 }, { t: 1, value: 0 }], alpha: [{ t: 0, value: 1 }] };
    initial.forces = { gravity: 20, turbulence: { amplitudeX: 1, amplitudeY: 2, spatialScale: 3, timeScale: 4 } };
    const system = await ParticleSystem.fromSerializedConfig(initial, { generateTexture: newTexture });
    t.after(() => system.destroy());
    await system.updateConfigFromSerialized({ base: { startSpeed: null }, overLifetime: { size: null }, forces: null }, true);
    assert.equal(system.config.modules.startSpeed, undefined);
    assert.equal(system.config.modules.startAlpha?.get(), 0.5);
    assert.equal(system.config.modules.sizeOverLifetime, undefined);
    assert.ok(system.config.modules.alphaOverLifetime);
    assert.equal(system.config.modules.gravity, undefined);
    assert.equal(system.config.modules.force, undefined);
    await system.updateConfigFromSerialized({ overLifetime: null }, true);
    assert.equal(system.config.modules.alphaOverLifetime, undefined);
});

test("deep patches preserve required siblings and replace curve arrays", async (t) => {
    const initial = serialized();
    initial.base.startSpeed = { min: 20, max: 30 };
    initial.overLifetime = { velocity: { x: [{ t: 0, value: 1 }], y: [{ t: 0, value: 2 }] } };
    const system = await ParticleSystem.fromSerializedConfig(initial, { generateTexture: newTexture });
    t.after(() => system.destroy());
    await system.updateConfigFromSerialized({ base: { startSpeed: { min: 30 } }, overLifetime: { velocity: { x: [{ t: 0, value: 5 }] } } }, true);
    assert.equal(system.config.modules.startSpeed?.get(), 30);
    const velocity = { x: 0, y: 0 };
    system.config.modules.velocityOverLifetime?.evaluate(0, velocity);
    assert.deepEqual(velocity, { x: 5, y: 2 });
});

test("required-field deletion is rejected without modifying the live system", async (t) => {
    const system = await ParticleSystem.fromSerializedConfig(serialized(), { generateTexture: newTexture });
    t.after(() => system.destroy());
    for (const patch of [
        { name: null }, { maxParticles: null }, { texture: null }, { texture: { kind: null } },
        { emission: { rate: null } }, { base: { lifetime: null } },
        { base: { lifetime: { min: null, max: 1 } } },
    ]) {
        await assert.rejects(system.updateConfigFromSerialized(patch as never, true), /required field cannot be removed/);
    }
    assert.equal(system.config.name, "builtin");
    assert.equal(system.config.modules.lifetime.get(), 100);
    system.update(0.01);
    assert.equal(visibleParticles(system).length, 1);
});

test("runtime-created systems can apply optional module deletion patches", (t) => {
    const runtime = config({ rate: 0, burst: 1 });
    runtime.modules.startSpeed = new ConstantModule(30);
    runtime.modules.gravity = new ConstantModule(10);
    const system = new ParticleSystem(runtime);
    t.after(() => system.destroy());
    return system.updateConfigFromSerialized({ base: { startSpeed: null }, forces: null }, true).then(() => {
        assert.equal(system.config.modules.startSpeed, undefined);
        assert.equal(system.config.modules.gravity, undefined);
    });
});

test("texture source changes replace the variant and do not keep obsolete required fields", async (t) => {
    const external = newTexture();
    Assets.cache.set("patch-test-texture", external);
    const system = await ParticleSystem.fromSerializedConfig(serialized(), { generateTexture: newTexture });
    t.after(() => { system.destroy(); Assets.cache.remove("patch-test-texture"); external.destroy(true); });
    const original = system.config.texture;
    await system.updateConfigFromSerialized({ texture: { source: "raster", fileName: "patch-test-texture" } }, true);
    assert.equal(system.config.texture, external);
    assert.equal(original.destroyed, true);
    await assert.rejects(system.updateConfigFromSerialized({ texture: { source: "builtin" } }, true), /texture.kind: required/);
    assert.equal(system.config.texture, external);
    await system.updateConfigFromSerialized({ texture: { source: "builtin", kind: "star" } }, true);
    assert.notEqual(system.config.texture, external);
    assert.equal(external.destroyed, false);
});
