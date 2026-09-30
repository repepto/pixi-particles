import { Rectangle } from "pixi.js";
import type { ParticleSystemConfig } from "../config/ParticleSystemConfig.js";
import { BoxEmitterModule } from "../modules/emitter/BoxEmitterModule.js";
import { CircleEmitterModule } from "../modules/emitter/CircleEmitterModule.js";
import { DotEmitterModule } from "../modules/emitter/DotEmitterModule.js";
import { ConstantColorModule } from "../modules/color/ConstantColorModule.js";
import { RandomPickColorModule } from "../modules/color/RandomPickColorModule.js";
import { ConstantModule } from "../modules/value/ConstantModule.js";
import { ConeDirectionModule } from "../modules/direction/ConeDirectionModule.js";
import { CurveModule } from "../modules/curve/CurveModule.js";
import { ColorGradientModule } from "../modules/color/ColorGradientModule.js";
import { VectorCurveModule } from "../modules/velocity/VectorCurveModule.js";
import { SpeedOverLifetimeModule } from "../modules/velocity/SpeedOverLifetimeModule.js";
import { BounceModule } from "../modules/velocity/BounceModule.js";
import { TurbulenceForceModule } from "../modules/force/TurbulenceForceModule.js";
import { FlickeringOverLifetimeModule } from "../modules/alpha/FlickeringOverLifetimeModule.js";
import type { SerializedConfig } from "../config/SerializedConfig.js";
import type { ParticleSystemRenderer } from "../contracts/IParticleSystem.js";
import { validateSerializedConfig } from "./mergeSerializedConfig.js";
import { buildRuntimeTextureConfig, createNumberProvider, parseColor } from "./serializedConfigHelpers.js";

export async function buildRuntimeConfigFromSerialized(
    config: SerializedConfig,
    renderer: ParticleSystemRenderer,
): Promise<ParticleSystemConfig> {
    validateSerializedConfig(config);
    const screenBoundsProvider = () => renderer.screen ? { x: 0, y: 0, width: renderer.screen.width, height: renderer.screen.height } : undefined;
    const textureConfig = buildRuntimeTextureConfig(config.texture, renderer);

    let emitter;

    if (config.emission.emitterType === "dot") {
        emitter = new DotEmitterModule(config.emission.emitterX, config.emission.emitterY, config.emission.emitterRandomizePosition ?? 0);
    } else if (config.emission.emitterType === "circle") {
        emitter = new CircleEmitterModule(
            config.emission.emitterX,
            config.emission.emitterY,
            config.emission.emitterRadius ?? 0,
            config.emission.emitterAlongShape ?? false,
            config.emission.emitterRandomizePosition ?? 0,
        );
    } else {
        emitter = new BoxEmitterModule(
            config.emission.emitterX,
            config.emission.emitterY,
            config.emission.emitterWidth ?? 0,
            config.emission.emitterHeight ?? 0,
            config.emission.emitterAlongShape ?? false,
            config.emission.emitterRandomizePosition ?? 0,
        );
    }

    const modules: ParticleSystemConfig["modules"] = {
        emitter,
        lifetime: createNumberProvider(config.base.lifetime),
        direction: new ConeDirectionModule(config.emission.directionMin, config.emission.directionMax),
    };

    if (config.base.startSpeed !== undefined) {
        modules.startSpeed = createNumberProvider(config.base.startSpeed);
    }

    if (config.base.startRotation !== undefined) {
        modules.startRotation = createNumberProvider(config.base.startRotation);
    }

    if (config.base.angularVelocity !== undefined) {
        modules.angularVelocity = createNumberProvider(config.base.angularVelocity);
    }

    if (config.base.angleKeepDirection) {
        modules.angleKeepDirection = true;
    }

    if (config.base.startSize !== undefined) {
        modules.startSize = createNumberProvider(config.base.startSize);
    }

    if (config.base.startAlpha !== undefined) {
        modules.startAlpha = createNumberProvider(config.base.startAlpha);
    }

    if (config.base.bounce) {
        modules.bounce = new BounceModule(config.base.bounce, screenBoundsProvider);
    }

    if (config.base.startColors?.length) {
        const colors = config.base.startColors.map(parseColor);

        modules.startColor = colors.length === 1
            ? new ConstantColorModule(colors[0])
            : new RandomPickColorModule(colors);
    }

    if (config.overLifetime?.size?.length) {
        modules.sizeOverLifetime = new CurveModule(config.overLifetime.size);
    }

    if (config.overLifetime?.alpha?.length) {
        modules.alphaOverLifetime = new CurveModule(config.overLifetime.alpha);
    }

    if (config.overLifetime?.scaleXY) {
        modules.scaleXYOverLifetime = new VectorCurveModule({
            x: config.overLifetime.scaleXY.x,
            y: config.overLifetime.scaleXY.y,
        });
    }

    if (config.overLifetime?.flickering) {
        modules.flickeringOverLifetime = new FlickeringOverLifetimeModule(config.overLifetime.flickering);
    }

    if (config.overLifetime?.color?.length) {
        modules.colorOverLifetime = new ColorGradientModule(
            config.overLifetime.color.map((point) => ({
                t: point.t,
                color: parseColor(point.color),
            })),
        );
    }

    if (config.overLifetime?.velocity) {
        modules.velocityOverLifetime = new VectorCurveModule({
            x: config.overLifetime.velocity.x,
            y: config.overLifetime.velocity.y,
        });
    }

    if (config.overLifetime?.speed?.curve?.length) {
        modules.speedOverLifetime = new SpeedOverLifetimeModule(config.overLifetime.speed);
    }

    if (config.forces?.gravity !== undefined) {
        modules.gravity = new ConstantModule(config.forces.gravity);
    }

    if (config.forces?.turbulence) {
        modules.force = new TurbulenceForceModule({
            amplitudeX: config.forces.turbulence.amplitudeX,
            amplitudeY: config.forces.turbulence.amplitudeY,
            spatialScale: config.forces.turbulence.spatialScale,
            timeScale: config.forces.turbulence.timeScale,
            seed: config.forces.turbulence.seed,
        });
    }

    return {
        name: config.name,
        texture: textureConfig.texture,
        textureSequence: textureConfig.textureSequence,
        textureSequenceFps: textureConfig.textureSequenceFps,
        textureSequenceRandomStart: textureConfig.textureSequenceRandomStart,
        maxParticles: config.maxParticles,
        emission: {
            rate: config.emission.rate,
            burst: config.emission.burst,
            burstByDemand: config.emission.burstByDemand,
            duration: config.emission.duration,
            loop: config.emission.loop,
            bursts: config.emission.bursts,
        },
        simulation: config.simulation,
        boundsArea: config.boundsArea
            ? new Rectangle(config.boundsArea.x, config.boundsArea.y, config.boundsArea.width, config.boundsArea.height)
            : undefined,
        simulationSpace: config.simulationSpace,
        blendMode: config.blendMode,
        modules,
    };
}
