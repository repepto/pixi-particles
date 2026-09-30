import type { Rectangle, Texture } from "pixi.js";
import type { IColorOverLifetimeModule } from "../contracts/IColorOverLifetimeModule.js";
import type { IColorProvider } from "../contracts/IColorProvider.js";
import type { IBounceModule } from "../contracts/IBounceModule.js";
import type { ICurveModule } from "../contracts/ICurveModule.js";
import type { IDirectionModule } from "../contracts/IDirectionModule.js";
import type { IEmitterModule } from "../contracts/IEmitterModule.js";
import type { IForceModule } from "../contracts/IForceModule.js";
import type { IFlickeringOverLifetimeModule } from "../contracts/IFlickeringOverLifetimeModule.js";
import type { INumberProvider } from "../contracts/INumberProvider.js";
import type { ISpeedOverLifetimeModule } from "../contracts/ISpeedOverLifetimeModule.js";
import type { IVelocityOverLifetimeModule } from "../contracts/IVelocityOverLifetimeModule.js";

export type BurstPointConfig = {
    time: number;
    count: number;
};

export type EmissionConfig = {
    rate: number;
    burst?: number;
    burstByDemand?: number;
    duration?: number;
    loop?: boolean;
    bursts?: BurstPointConfig[];
};

export type SimulationSpace = "local" | "world";
export type BlendModeName = "normal" | "add" | "screen" | "multiply";

export type ParticleModulesConfig = {
    emitter: IEmitterModule;
    lifetime: INumberProvider;
    startSpeed?: INumberProvider;
    startRotation?: INumberProvider;
    angularVelocity?: INumberProvider;
    angleKeepDirection?: boolean;
    startSize?: INumberProvider;
    startAlpha?: INumberProvider;
    startColor?: IColorProvider;
    direction?: IDirectionModule;
    sizeOverLifetime?: ICurveModule;
    scaleXYOverLifetime?: IVelocityOverLifetimeModule;
    alphaOverLifetime?: ICurveModule;
    flickeringOverLifetime?: IFlickeringOverLifetimeModule;
    colorOverLifetime?: IColorOverLifetimeModule;
    velocityOverLifetime?: IVelocityOverLifetimeModule;
    speedOverLifetime?: ISpeedOverLifetimeModule;
    gravity?: INumberProvider;
    force?: IForceModule;
    bounce?: IBounceModule;
};

export type SimulationPrewarmConfig = number | {
    prewarm?: number;
    duration?: number;
};

export type SimulationConfig = {
    prewarm?: SimulationPrewarmConfig;
};

export type ParticleSystemConfig = {
    name: string;
    texture: Texture;
    textureSequence?: Texture[];
    textureSequenceFps?: number;
    textureSequenceRandomStart?: boolean;
    maxParticles: number;
    emission: EmissionConfig;
    simulation?: SimulationConfig;
    modules: ParticleModulesConfig;
    boundsArea?: Rectangle;
    simulationSpace?: SimulationSpace;
    blendMode?: BlendModeName;
};
