import { Graphics, type Renderer, type Texture } from "pixi.js";
import type { TextureKind } from "../config/types";

// Generated render textures belong to the renderer that created them.
const cache = new WeakMap<Renderer, Map<TextureKind, Texture>>();

function drawStar(graphics: Graphics, radius: number, innerRadius: number, spikes: number): void {
    const step = Math.PI / spikes;

    graphics.moveTo(0, -radius);

    for (let i = 0; i < spikes * 2; i++) {
        const currentRadius = i % 2 === 0 ? innerRadius : radius;
        const angle = -Math.PI / 2 + step * (i + 1);

        graphics.lineTo(Math.cos(angle) * currentRadius, Math.sin(angle) * currentRadius);
    }

    graphics.closePath();
}

export function getBuiltinParticleTexture(renderer: Renderer, kind: TextureKind): Texture {
    let rendererCache = cache.get(renderer);

    if (!rendererCache) {
        rendererCache = new Map();
        cache.set(renderer, rendererCache);
    }

    const cached = rendererCache.get(kind);

    if (cached && !cached.destroyed) {
        return cached;
    }

    const graphics = new Graphics();

    if (kind === "circle") {
        graphics.circle(0, 0, 24);
        graphics.fill({ color: 0xFFFFFF });
    } else if (kind === "soft-circle") {
        graphics.circle(0, 0, 28);
        graphics.fill({ color: 0xFFFFFF, alpha: 0.18 });
        graphics.circle(0, 0, 20);
        graphics.fill({ color: 0xFFFFFF, alpha: 0.45 });
        graphics.circle(0, 0, 12);
        graphics.fill({ color: 0xFFFFFF, alpha: 1 });
    } else if (kind === "square") {
        graphics.rect(-20, -20, 40, 40);
        graphics.fill({ color: 0xFFFFFF });
    } else if (kind === "diamond") {
        graphics.moveTo(0, -26);
        graphics.lineTo(22, 0);
        graphics.lineTo(0, 26);
        graphics.lineTo(-22, 0);
        graphics.closePath();
        graphics.fill({ color: 0xFFFFFF });
    } else {
        drawStar(graphics, 28, 12, 5);
        graphics.fill({ color: 0xFFFFFF });
    }

    try {
        const texture = renderer.generateTexture(graphics);

        rendererCache.set(kind, texture);

        return texture;
    } finally {
        graphics.destroy();
    }
}
