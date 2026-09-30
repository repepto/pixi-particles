import { Assets, Graphics, type Texture as TextureType } from "pixi.js";
import type { ParticleSystemConfig } from "../config/ParticleSystemConfig.js";
import type { SerializedConfig } from "../config/SerializedConfig.js";
import type { ParticleSystemRenderer } from "../contracts/IParticleSystem.js";
import { ConstantModule } from "../modules/value/ConstantModule.js";
import { RandomRangeModule } from "../modules/value/RandomRangeModule.js";

export function parseColor(value: string | number): number {
    if (typeof value === "number") {
        return value;
    }

    if (value.startsWith("#")) {
        return Number(`0x${value.slice(1)}`);
    }

    return Number(value);
}

function buildBuiltinParticleTexture(
    renderer: ParticleSystemRenderer,
    kind: "circle" | "soft-circle" | "square" | "diamond" | "star",
): TextureType {
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
        const radius = 28;
        const innerRadius = 12;
        const spikes = 5;
        const step = Math.PI / spikes;

        graphics.moveTo(0, -radius);

        for (let i = 0; i < spikes * 2; i++) {
            const currentRadius = i % 2 === 0 ? innerRadius : radius;
            const angle = -Math.PI / 2 + step * (i + 1);

            graphics.lineTo(Math.cos(angle) * currentRadius, Math.sin(angle) * currentRadius);
        }

        graphics.closePath();
        graphics.fill({ color: 0xFFFFFF });
    }

    try {
        return renderer.generateTexture(graphics);
    } finally {
        graphics.destroy();
    }
}

export function createNumberProvider(value: number | { min: number; max: number }) {
    if (typeof value === "number") {
        return new ConstantModule(value);
    }

    return new RandomRangeModule(value.min, value.max);
}

type RuntimeTextureConfig = Pick<ParticleSystemConfig, "texture" | "textureSequence" | "textureSequenceFps" | "textureSequenceRandomStart">;

/** Assets must be loaded by the application; only generated built-ins belong to the system. */
export function buildRuntimeTextureConfig(texture: SerializedConfig["texture"], renderer?: ParticleSystemRenderer): RuntimeTextureConfig {
    const singleTexture = (value: TextureType): RuntimeTextureConfig => ({
        texture: value,
        textureSequence: undefined,
        textureSequenceFps: undefined,
        textureSequenceRandomStart: undefined,
    });
    const getTexture = (fileName: string): TextureType => {
        const loaded = Assets.get<TextureType>(fileName);
        if (!loaded) {
            throw new Error(`Particle texture "${fileName}" is not loaded. Load it with Assets.load() before creating the system.`);
        }
        return loaded;
    };

    if (texture.source === "builtin") {
        if (!renderer) {
            throw new Error("Cannot apply builtin texture from serialized config without renderer.");
        }
        return singleTexture(buildBuiltinParticleTexture(renderer, texture.kind));
    }

    if (texture.source === "raster") {
        return singleTexture(getTexture(texture.fileName));
    }

    if (texture.fileNames.length === 0) {
        throw new Error("A particle texture sequence must contain at least one frame.");
    }
    const frames = texture.fileNames.map(getTexture);
    return {
        texture: frames[0],
        textureSequence: frames,
        textureSequenceFps: texture.frameRate ?? 12,
        textureSequenceRandomStart: texture.randomStart ?? false,
    };
}
