import assert from "node:assert/strict";
import test from "node:test";
import { Container, Texture, TextureSource, Ticker } from "pixi.js";
import { createDefaultEditorConfig } from "../src/config/defaults";
import { PreviewController } from "../src/preview/PreviewController";
import type { UploadedTextureAsset } from "../src/textures/RasterTextureLoader";

function createPreview() {
    const ticker = new Ticker();
    const stage = new Container();
    const controller = new PreviewController(
        { clientWidth: 800, clientHeight: 600 } as HTMLElement,
        {} as HTMLElement,
        () => "system",
    );
    // Exercise the controller with Pixi containers and ticker, without a GPU or DOM.
    Object.assign(controller, {
        app: {
            stage,
            ticker,
            renderer: { generateTexture() { throw new Error("Texture generation failed"); } },
        },
    });
    const texture = new Texture({ source: new TextureSource({ width: 16, height: 16 }) });
    const asset: UploadedTextureAsset = {
        texture,
        textures: [texture],
        fileNames: ["particle.png"],
        isSequence: false,
        destroy: () => texture.destroy(true),
    };
    const config = { ...createDefaultEditorConfig(), maxParticles: 16 };

    return { controller, ticker, stage, asset, config };
}

test("replacing and removing a preview destroys containers and detaches ticker listeners", async () => {
    const { controller, ticker, stage, asset, config } = createPreview();
    await controller.applyConfig("system", config, asset);
    const original = stage.children[0];
    assert.equal(ticker.count, 1);

    await controller.applyConfig("system", config, asset);
    const replacement = stage.children[0];
    assert.equal(original.destroyed, true);
    assert.equal(stage.children.length, 1);
    assert.notEqual(replacement, original);
    assert.equal(ticker.count, 1);
    assert.equal(asset.texture.destroyed, false);

    controller.removeSystem("system");
    controller.removeSystem("system");
    assert.equal(replacement.destroyed, true);
    assert.equal(stage.children.length, 0);
    assert.equal(ticker.count, 0);
    assert.equal(asset.texture.destroyed, false);

    asset.destroy();
    ticker.destroy();
    stage.destroy();
});

test("failed replacement preserves the existing preview and ticker listener", async () => {
    const { controller, ticker, stage, asset, config } = createPreview();
    await controller.applyConfig("system", config, asset);
    const original = stage.children[0];

    await assert.rejects(controller.applyConfig("system", config, null), /Texture generation failed/);
    assert.equal(stage.children[0], original);
    assert.equal(original.destroyed, false);
    assert.equal(ticker.count, 1);

    controller.removeSystem("system");
    asset.destroy();
    ticker.destroy();
    stage.destroy();
});

test("a disabled system stays hidden and paused after replacement", async () => {
    const { controller, ticker, stage, asset, config } = createPreview();
    await controller.applyConfig("system", config, asset);
    controller.setEnabled("system", false);

    await controller.applyConfig("system", config, asset);
    assert.equal(stage.children[0].visible, false);
    assert.equal(ticker.count, 0);

    controller.removeSystem("system");
    asset.destroy();
    ticker.destroy();
    stage.destroy();
});
