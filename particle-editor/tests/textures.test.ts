import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { Texture, TextureSource, type Renderer } from "pixi.js";
import { getBuiltinParticleTexture } from "../src/textures/BuiltinTextures";
import { loadTextureAssetFromFiles } from "../src/textures/RasterTextureLoader";

function mockImageLoading(t: TestContext): void {
    const previousImage = Object.getOwnPropertyDescriptor(globalThis, "Image");
    const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");

    class TestImage {
        width = 16;
        height = 16;
        onload: (() => void) | null = null;

        set src(_value: string) {
            queueMicrotask(() => this.onload?.());
        }
    }

    Object.defineProperty(globalThis, "Image", { configurable: true, value: TestImage });
    Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage() {} }) }) },
    });

    t.after(() => {
        if (previousImage) Object.defineProperty(globalThis, "Image", previousImage);
        else Reflect.deleteProperty(globalThis, "Image");
        if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument);
        else Reflect.deleteProperty(globalThis, "document");
    });
}

function createTexture(): Texture {
    return new Texture({ source: new TextureSource({ width: 32, height: 16 }) });
}

test("uploaded image releases its texture and source exactly once", async (t) => {
    mockImageLoading(t);
    const texture = createTexture();
    const source = texture.source;
    const destroySource = t.mock.method(source, "destroy");
    t.mock.method(Texture, "from", () => texture);

    const asset = await loadTextureAssetFromFiles([new File(["image"], "particle.png")]);
    asset.destroy();
    asset.destroy();

    assert.equal(texture.destroyed, true);
    assert.equal(source.destroyed, true);
    assert.equal(destroySource.mock.callCount(), 1);
});

test("sequence releases every frame before destroying the shared atlas source once", async (t) => {
    mockImageLoading(t);
    const atlas = createTexture();
    const source = atlas.source;
    const destroySource = t.mock.method(source, "destroy");
    t.mock.method(Texture, "from", () => atlas);

    const asset = await loadTextureAssetFromFiles([
        new File(["image"], "frame10.png"),
        new File(["image"], "frame2.png"),
    ]);

    assert.deepEqual(asset.fileNames, ["frame2.png", "frame10.png"]);
    assert.equal(asset.textures.length, 2);
    assert.ok(asset.textures.every((texture) => texture.source === source));
    source.on("destroy", () => assert.ok(asset.textures.every((texture) => texture.destroyed)));

    asset.destroy();
    asset.destroy();

    assert.ok(asset.textures.every((texture) => texture.destroyed));
    assert.equal(atlas.destroyed, true);
    assert.equal(source.destroyed, true);
    assert.equal(destroySource.mock.callCount(), 1);
});

test("an empty texture selection fails with an actionable error", async () => {
    await assert.rejects(loadTextureAssetFromFiles([]), /at least one texture image/);
});

test("builtin textures are cached per renderer and recreated after disposal", () => {
    const firstRenderer = { generateTexture: createTexture } as unknown as Renderer;
    const secondRenderer = { generateTexture: createTexture } as unknown as Renderer;
    const first = getBuiltinParticleTexture(firstRenderer, "circle");
    const second = getBuiltinParticleTexture(secondRenderer, "circle");

    assert.equal(getBuiltinParticleTexture(firstRenderer, "circle"), first);
    assert.notEqual(first, second);
    first.destroy(true);

    const replacement = getBuiltinParticleTexture(firstRenderer, "circle");
    assert.notEqual(replacement, first);
    replacement.destroy(true);
    second.destroy(true);
});
