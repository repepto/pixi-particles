import { type Renderer } from "pixi.js";
import {
    BounceModule,
    BoxEmitterModule,
    CircleEmitterModule,
    ColorGradientModule,
    ConeDirectionModule,
    ConstantColorModule,
    ConstantModule,
    CurveModule,
    DotEmitterModule,
    FlickeringOverLifetimeModule,
    ParticleSystem,
    RandomPickColorModule,
    RandomRangeModule,
    SpeedOverLifetimeModule,
    TurbulenceForceModule,
    VectorCurveModule,
    type INumberProvider,
    type ParticleSystemConfig,
} from "pixi-particle";
import type { EditorConfig } from "./types";
import type { EditorSerializedConfig } from "./serialization";
import { getBuiltinParticleTexture } from "../textures/BuiltinTextures";
import type { UploadedTextureAsset } from "../textures/RasterTextureLoader";
import { hexColorToNumber } from "../utils/color";

export function createNumberProvider(mode: "constant" | "min-max", constantValue: number, min: number, max: number): INumberProvider {
    if (mode === "constant") {
        return new ConstantModule(constantValue);
    }

    return new RandomRangeModule(min, max);
}

export function buildRuntimeConfig(config: EditorConfig, uploadedTextureAsset: UploadedTextureAsset | null, renderer: Renderer): ParticleSystemConfig {
    let emitter;

    if (config.emitterType === "dot") {
        emitter = new DotEmitterModule(config.emitterX, config.emitterY, config.emitterRandomizePosition);
    } else if (config.emitterType === "circle") {
        emitter = new CircleEmitterModule(config.emitterX, config.emitterY, config.emitterRadius, config.emitterAlongShape, config.emitterRandomizePosition);
    } else {
        emitter = new BoxEmitterModule(config.emitterX, config.emitterY, config.emitterWidth, config.emitterHeight, config.emitterAlongShape, config.emitterRandomizePosition);
    }

    const modules: ParticleSystemConfig["modules"] = {
        emitter,
        lifetime: createNumberProvider(config.lifetimeMode, config.lifetimeConst, config.lifetimeMin, config.lifetimeMax),
        direction: new ConeDirectionModule(config.directionMin, config.directionMax),
    };

    if (config.enableStartSpeed) {
        modules.startSpeed = createNumberProvider(config.startSpeedMode, config.speedConst, config.speedMin, config.speedMax);
    }

    if (config.enableSpeedOverLifetime) {
        modules.speedOverLifetime = new SpeedOverLifetimeModule({
            curve: config.speedCurve,
            fade: config.speedOverLifetimeFade,
        });
    }

    if (config.enableStartRotation) {
        modules.startRotation = createNumberProvider(config.startRotationMode, config.rotationConst, config.rotationMin, config.rotationMax);
    }

    if (config.enableAngularVelocity) {
        modules.angularVelocity = createNumberProvider(config.angularVelocityMode, config.angularVelocityConst, config.angularVelocityMin, config.angularVelocityMax);
    }

    if (config.angleKeepDirection) {
        modules.angleKeepDirection = true;
    }

    if (config.enableStartSize) {
        modules.startSize = createNumberProvider(config.startSizeMode, config.sizeConst, config.sizeMin, config.sizeMax);
    }

    if (config.enableStartAlpha) {
        modules.startAlpha = createNumberProvider(config.startAlphaMode, config.alphaConst, config.alphaMin, config.alphaMax);
    }

    if (config.enableStartColor) {
        const colors = config.startColors.map(hexColorToNumber);
        modules.startColor = colors.length === 1
            ? new ConstantColorModule(colors[0])
            : new RandomPickColorModule(colors);
    }

    if (config.enableBounce) {
        modules.bounce = new BounceModule({
            mode: config.bounceMode,
            box: config.bounceMode === "box"
                ? {
                    x: config.bounceBoxX,
                    y: config.bounceBoxY,
                    width: config.bounceBoxWidth,
                    height: config.bounceBoxHeight,
                }
                : undefined,
            damping: {
                min: config.bounceDampingMin,
                max: config.bounceDampingMax,
            },
        }, () => ({ x: 0, y: 0, width: renderer.screen.width, height: renderer.screen.height }));
    }

    if (config.enableSizeOverLifetime) {
        modules.sizeOverLifetime = new CurveModule(config.sizeCurve);
    }

    if (config.enableAlphaOverLifetime) {
        modules.alphaOverLifetime = new CurveModule(config.alphaCurve);
    }

    if (config.enableScaleXYOverLifetime) {
        modules.scaleXYOverLifetime = new VectorCurveModule({
            x: config.scaleXCurve,
            y: config.scaleYCurve,
        });
    }

    if (config.enableFlickeringOverLifetime) {
        modules.flickeringOverLifetime = new FlickeringOverLifetimeModule({
            gap: config.flickeringGap,
            min: config.flickeringMin,
            max: config.flickeringMax,
            randomGapOffset: config.flickeringRandomGapOffset,
            randomMinMaxOffset: config.flickeringRandomMinMaxOffset,
            fade: config.flickeringFade,
            startTime: config.flickeringStartTime,
            endTime: config.flickeringEndTime,
        });
    }

    if (config.enableColorOverLifetime) {
        modules.colorOverLifetime = new ColorGradientModule(config.colorCurve.map((point) => ({
            t: point.t,
            color: hexColorToNumber(point.color),
        })));
    }

    if (config.enableVelocityOverLifetime) {
        modules.velocityOverLifetime = new VectorCurveModule({
            x: config.velocityXCurve,
            y: config.velocityYCurve,
        });
    }

    if (config.enableGravity) {
        modules.gravity = new ConstantModule(config.gravity);
    }

    if (config.enableForce) {
        modules.force = new TurbulenceForceModule({
            amplitudeX: config.forceAmplitudeX,
            amplitudeY: config.forceAmplitudeY,
            spatialScale: config.forceSpatialScale,
            timeScale: config.forceTimeScale,
            seed: config.forceSeed,
        });
    }

    const emission: ParticleSystemConfig["emission"] = {
        rate: config.rate,
    };

    if (config.enableBurst) {
        emission.burst = config.burst;
    }

    if (config.enableBurstByDemand) {
        emission.burstByDemand = config.burstByDemand;
    }

    if (config.enableDurationLoop) {
        emission.duration = config.duration;
        emission.loop = config.loop;
    }

    if (config.enableTimelineBursts) {
        emission.bursts = config.timelineBursts.map((item) => ({ time: item.time, count: item.count }));
    }

    return {
        name: config.name,
        texture: uploadedTextureAsset?.texture ?? getBuiltinParticleTexture(renderer, config.textureKind),
        textureSequence: uploadedTextureAsset?.isSequence ? uploadedTextureAsset.textures : undefined,
        textureSequenceFps: uploadedTextureAsset?.isSequence ? config.sequenceFrameRate : undefined,
        textureSequenceRandomStart: uploadedTextureAsset?.isSequence ? config.sequenceRandomStart : undefined,
        maxParticles: config.maxParticles,
        simulationSpace: config.simulationSpace,
        blendMode: config.blendMode,
        emission,
        simulation: config.enablePrewarm ? { prewarm: { prewarm: config.prewarm } } : undefined,
        modules,
    };
}

export function buildSerializableConfig(
    config: EditorConfig,
    uploadedTextureInfo: { fileNames: string[]; isSequence: boolean; editorFolderKey?: string | null } | null,
): EditorSerializedConfig {
    const runtimeTexture: EditorSerializedConfig["texture"] = uploadedTextureInfo
        ? uploadedTextureInfo.isSequence
            ? {
                source: "sequence",
                fileNames: uploadedTextureInfo.fileNames,
                randomStart: config.sequenceRandomStart,
                frameRate: config.sequenceFrameRate,
                editorFolderKey: uploadedTextureInfo.editorFolderKey ?? undefined,
            }
            : {
                source: "raster",
                fileName: uploadedTextureInfo.fileNames[0],
                editorFolderKey: uploadedTextureInfo.editorFolderKey ?? undefined,
            }
        : { source: "builtin", kind: config.textureKind };

    return {
        name: config.name,
        maxParticles: config.maxParticles,
        simulationSpace: config.simulationSpace,
        blendMode: config.blendMode,
        texture: runtimeTexture,
        emission: {
            emitterType: config.emitterType,
            emitterX: config.emitterX,
            emitterY: config.emitterY,
            emitterWidth: config.emitterWidth,
            emitterHeight: config.emitterHeight,
            emitterRadius: config.emitterRadius,
            emitterAlongShape: config.emitterAlongShape ? true : undefined,
            emitterRandomizePosition: config.emitterRandomizePosition || undefined,
            rate: config.rate,
            directionMin: config.directionMin,
            directionMax: config.directionMax,
            burst: config.enableBurst ? config.burst : undefined,
            burstByDemand: config.enableBurstByDemand ? config.burstByDemand : undefined,
            duration: config.enableDurationLoop ? config.duration : undefined,
            loop: config.enableDurationLoop ? config.loop : undefined,
            bursts: config.enableTimelineBursts ? config.timelineBursts : undefined,
        },
        simulation: config.enablePrewarm ? {
            prewarm: {
                prewarm: config.prewarm,
            },
        } : undefined,
        base: {
            lifetime: config.lifetimeMode === "constant" ? config.lifetimeConst : { min: config.lifetimeMin, max: config.lifetimeMax },
            startSpeed: config.enableStartSpeed ? (config.startSpeedMode === "constant" ? config.speedConst : { min: config.speedMin, max: config.speedMax }) : undefined,
            startRotation: config.enableStartRotation ? (config.startRotationMode === "constant" ? config.rotationConst : { min: config.rotationMin, max: config.rotationMax }) : undefined,
            angularVelocity: config.enableAngularVelocity ? (config.angularVelocityMode === "constant" ? config.angularVelocityConst : { min: config.angularVelocityMin, max: config.angularVelocityMax }) : undefined,
            angleKeepDirection: config.angleKeepDirection ? true : undefined,
            startSize: config.enableStartSize ? (config.startSizeMode === "constant" ? config.sizeConst : { min: config.sizeMin, max: config.sizeMax }) : undefined,
            startAlpha: config.enableStartAlpha ? (config.startAlphaMode === "constant" ? config.alphaConst : { min: config.alphaMin, max: config.alphaMax }) : undefined,
            startColors: config.enableStartColor ? config.startColors : undefined,
            bounce: config.enableBounce ? {
                mode: config.bounceMode,
                box: config.bounceMode === "box" ? {
                    x: config.bounceBoxX,
                    y: config.bounceBoxY,
                    width: config.bounceBoxWidth,
                    height: config.bounceBoxHeight,
                } : undefined,
                damping: {
                    min: config.bounceDampingMin,
                    max: config.bounceDampingMax,
                },
            } : undefined,
        },
        overLifetime: {
            size: config.enableSizeOverLifetime ? config.sizeCurve : undefined,
            speed: config.enableSpeedOverLifetime ? { curve: config.speedCurve, fade: config.speedOverLifetimeFade } : undefined,
            alpha: config.enableAlphaOverLifetime ? config.alphaCurve : undefined,
            scaleXY: config.enableScaleXYOverLifetime ? { x: config.scaleXCurve, y: config.scaleYCurve } : undefined,
            flickering: config.enableFlickeringOverLifetime ? {
                gap: config.flickeringGap,
                min: config.flickeringMin,
                max: config.flickeringMax,
                randomGapOffset: config.flickeringRandomGapOffset,
                randomMinMaxOffset: config.flickeringRandomMinMaxOffset,
                fade: config.flickeringFade,
                startTime: config.flickeringStartTime,
                endTime: config.flickeringEndTime,
            } : undefined,
            color: config.enableColorOverLifetime ? config.colorCurve : undefined,
            velocity: config.enableVelocityOverLifetime ? { x: config.velocityXCurve, y: config.velocityYCurve } : undefined,
        },
        forces: {
            gravity: config.enableGravity ? config.gravity : undefined,
            turbulence: config.enableForce ? {
                amplitudeX: config.forceAmplitudeX,
                amplitudeY: config.forceAmplitudeY,
                spatialScale: config.forceSpatialScale,
                timeScale: config.forceTimeScale,
                seed: config.forceSeed,
            } : undefined,
        }
    };
}
