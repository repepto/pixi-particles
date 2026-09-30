import type { SimulationConfig } from "./ParticleSystemConfig.js";

type SerializedNumberProvider = number | {
    min: number;
    max: number;
};

type SerializedCurvePoint = {
    t: number;
    value: number;
    randomOffset?: number;
};

type SerializedColorPoint = {
    t: number;
    color: string | number;
};

type SerializedVelocityCurve = {
    x: SerializedCurvePoint[];
    y: SerializedCurvePoint[];
};

type SerializedSpeedOverLifetime = {
    curve: SerializedCurvePoint[];
    fade?: boolean;
};

type SerializedScaleXYCurve = {
    x: SerializedCurvePoint[];
    y: SerializedCurvePoint[];
};

type SerializedBounce = {
    mode: "screen" | "box";
    box?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    damping?: {
        min: number;
        max: number;
    };
};

type SerializedFlickeringOverLifetime = {
    gap?: number;
    min?: number;
    max?: number;
    randomGapOffset?: number;
    randomMinMaxOffset?: number;
    fade?: boolean;
    startTime?: number;
    endTime?: number;
    timeFrom?: number;
    timeTo?: number;
};

export type SerializedConfig = {
    name: string;
    maxParticles: number;
    simulationSpace?: "local" | "world";
    blendMode?: "normal" | "add" | "screen" | "multiply";
    texture: {
        source: "builtin";
        kind: "circle" | "soft-circle" | "square" | "diamond" | "star";
    } | {
        source: "raster";
        fileName: string;
    } | {
        source: "sequence";
        fileNames: string[];
        randomStart?: boolean;
        frameRate?: number;
    };
    emission: {
        emitterType: "dot" | "circle" | "box";
        emitterX: number;
        emitterY: number;
        emitterWidth?: number;
        emitterHeight?: number;
        emitterRadius?: number;
        emitterAlongShape?: boolean;
        emitterRandomizePosition?: number;
        rate: number;
        burst?: number;
        burstByDemand?: number;
        duration?: number;
        loop?: boolean;
        bursts?: { time: number; count: number }[];
        directionMin: number;
        directionMax: number;
    };
    simulation?: SimulationConfig;
    base: {
        lifetime: SerializedNumberProvider;
        startSpeed?: SerializedNumberProvider;
        startRotation?: SerializedNumberProvider;
        angularVelocity?: SerializedNumberProvider;
        angleKeepDirection?: boolean;
        startSize?: SerializedNumberProvider;
        startAlpha?: SerializedNumberProvider;
        startColors?: Array<string | number>;
        bounce?: SerializedBounce;
    };
    overLifetime?: {
        size?: SerializedCurvePoint[];
        alpha?: SerializedCurvePoint[];
        color?: SerializedColorPoint[];
        velocity?: SerializedVelocityCurve;
        speed?: SerializedSpeedOverLifetime;
        scaleXY?: SerializedScaleXYCurve;
        flickering?: SerializedFlickeringOverLifetime;
    };
    forces?: {
        gravity?: number;
        turbulence?: {
            amplitudeX: number;
            amplitudeY: number;
            spatialScale: number;
            timeScale: number;
            seed?: number;
        };
    };
    boundsArea?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
};


/** Deep merge patch: null deletes optional properties; arrays replace their entire value. */
type ConfigPatch<T> = T extends readonly unknown[] ? T : T extends object ? {
    [K in keyof T]?: ConfigPatch<NonNullable<T[K]>> | ({} extends Pick<T, K> ? null : never);
} : T;

export type SerializedConfigPatch = ConfigPatch<SerializedConfig>;
