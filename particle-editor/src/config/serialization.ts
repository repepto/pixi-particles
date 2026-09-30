import type { SerializedConfig, SerializedConfigPatch } from "pixi-particle";
import { createDefaultEditorConfig } from "./defaults";
import type { EditorConfig } from "./types";

export type EditorSerializedConfig = Omit<SerializedConfig, "texture"> & {
    texture: SerializedConfig["texture"] & { editorFolderKey?: string };
};

type Validator = (value: unknown, path: string) => void;

function invalid(path: string, expected: string): never {
    throw new Error(`${path}: expected ${expected}.`);
}

function object(fields: Record<string, Validator>): Validator {
    return (value, path) => {
        if (!isRecord(value)) invalid(path, "an object");
        for (const [key, validate] of Object.entries(fields)) validate(value[key], `${path}.${key}`);
    };
}

function optional(validate: Validator): Validator {
    return (value, path) => { if (value !== undefined) validate(value, path); };
}

function number(min = -Infinity, max = Infinity, integer = false): Validator {
    return (value, path) => {
        if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
            invalid(path, `${integer ? "an integer" : "a finite number"} between ${min} and ${max}`);
        }
    };
}

const text: Validator = (value, path) => {
    if (typeof value !== "string" || !value.trim()) invalid(path, "a non-empty string");
};
const boolean: Validator = (value, path) => { if (typeof value !== "boolean") invalid(path, "a boolean"); };
const choice = (...values: string[]): Validator => (value, path) => {
    if (typeof value !== "string" || !values.includes(value)) invalid(path, values.join(" or "));
};
const array = (validate: Validator): Validator => (value, path) => {
    if (!Array.isArray(value) || value.length === 0) invalid(path, "a non-empty array");
    value.forEach((item, index) => validate(item, `${path}[${index}]`));
};
const color: Validator = (value, path) => {
    if (typeof value === "number") return number(0, 0xFFFFFF, true)(value, path);
    if (typeof value !== "string" || !/^#[\da-f]{6}$/i.test(value)) invalid(path, "a #RRGGBB color or a 24-bit integer");
};
const provider = (minimum = -Infinity): Validator => (value, path) => {
    if (typeof value === "number") return number(minimum)(value, path);
    object({ min: number(minimum), max: number(minimum) })(value, path);
    const range = value as { min: number; max: number };
    if (range.min > range.max) invalid(path, "a range with min <= max");
};
const curve = array(object({ t: number(), value: number(), randomOffset: optional(number()) }));
const vectorCurve = object({ x: curve, y: curve });
const prewarm: Validator = (value, path) => {
    if (typeof value === "number") return number(0)(value, path);
    object({ prewarm: optional(number(0)), duration: optional(number(0)) })(value, path);
};
const texture: Validator = (value, path) => {
    object({ source: choice("builtin", "raster", "sequence"), editorFolderKey: optional(text) })(value, path);
    const data = value as Record<string, unknown>;
    if (data.source === "builtin") object({ kind: choice("circle", "soft-circle", "square", "diamond", "star") })(value, path);
    if (data.source === "raster") object({ fileName: text })(value, path);
    if (data.source === "sequence") object({ fileNames: array(text), randomStart: optional(boolean), frameRate: optional(number(Number.MIN_VALUE)) })(value, path);
};

const validateConfig = object({
    name: text,
    maxParticles: number(1, Infinity, true),
    simulationSpace: optional(choice("world", "local")),
    blendMode: optional(choice("normal", "add", "screen", "multiply")),
    texture,
    emission: object({
        emitterType: choice("dot", "circle", "box"), emitterX: number(), emitterY: number(),
        emitterWidth: optional(number(0)), emitterHeight: optional(number(0)), emitterRadius: optional(number(0)),
        emitterAlongShape: optional(boolean), emitterRandomizePosition: optional(number(0)),
        rate: number(0), directionMin: number(), directionMax: number(),
        burst: optional(number(0, Infinity, true)), burstByDemand: optional(number(0, Infinity, true)),
        duration: optional(number(0)), loop: optional(boolean),
        bursts: optional(array(object({ time: number(0), count: number(0, Infinity, true) }))),
    }),
    simulation: optional(object({ prewarm: optional(prewarm) })),
    base: object({
        lifetime: provider(Number.MIN_VALUE), startSpeed: optional(provider()), startRotation: optional(provider()),
        angularVelocity: optional(provider()), angleKeepDirection: optional(boolean),
        startSize: optional(provider(0)), startAlpha: optional(provider(0)), startColors: optional(array(color)),
        bounce: optional(object({
            mode: choice("screen", "box"),
            box: optional(object({ x: number(), y: number(), width: number(0), height: number(0) })),
            damping: optional(object({ min: number(0), max: number(0) })),
        })),
    }),
    overLifetime: optional(object({
        size: optional(curve), alpha: optional(curve), scaleXY: optional(vectorCurve), velocity: optional(vectorCurve),
        color: optional(array(object({ t: number(), color }))),
        speed: optional(object({ curve, fade: optional(boolean) })),
        flickering: optional(object({
            gap: optional(number(0)), min: optional(number()), max: optional(number()),
            randomGapOffset: optional(number(0)), randomMinMaxOffset: optional(number(0)), fade: optional(boolean),
            startTime: optional(number(0)), endTime: optional(number(0)), timeFrom: optional(number(0)), timeTo: optional(number(0)),
        })),
    })),
    forces: optional(object({
        gravity: optional(number()),
        turbulence: optional(object({ amplitudeX: number(), amplitudeY: number(), spatialScale: number(), timeScale: number(), seed: optional(number()) })),
    })),
    boundsArea: optional(object({ x: number(), y: number(), width: number(0), height: number(0) })),
});

/** Validate at the file boundary, before touching editor or preview state. */
export function parseSerializedConfig(value: unknown, path = "config"): EditorSerializedConfig {
    validateConfig(value, path);
    return value as EditorSerializedConfig;
}

type NumericKey = { [K in keyof EditorConfig]: EditorConfig[K] extends number ? K : never }[keyof EditorConfig];

const providers = {
    lifetime: { mode: "lifetimeMode", constant: "lifetimeConst", min: "lifetimeMin", max: "lifetimeMax", enable: null },
    startSpeed: { mode: "startSpeedMode", constant: "speedConst", min: "speedMin", max: "speedMax", enable: "enableStartSpeed" },
    startRotation: { mode: "startRotationMode", constant: "rotationConst", min: "rotationMin", max: "rotationMax", enable: "enableStartRotation" },
    angularVelocity: { mode: "angularVelocityMode", constant: "angularVelocityConst", min: "angularVelocityMin", max: "angularVelocityMax", enable: "enableAngularVelocity" },
    startSize: { mode: "startSizeMode", constant: "sizeConst", min: "sizeMin", max: "sizeMax", enable: "enableStartSize" },
    startAlpha: { mode: "startAlphaMode", constant: "alphaConst", min: "alphaMin", max: "alphaMax", enable: "enableStartAlpha" },
} as const;

function toHexColor(value: string | number): string {
    return typeof value === "string" ? value : `#${value.toString(16).padStart(6, "0")}`;
}

/** Pure conversion keeps file loading independent from the live form. */
export function toEditorConfig(root: EditorSerializedConfig): EditorConfig {
    const config = createDefaultEditorConfig();
    const { emission, base } = root;
    const overLifetime = root.overLifetime ?? {};
    const forces = root.forces ?? {};
    const assignNumber = (key: NumericKey, value: number | undefined): void => {
        if (value !== undefined) config[key] = value;
    };

    config.name = root.name;
    config.maxParticles = root.maxParticles;
    config.simulationSpace = root.simulationSpace ?? "local";
    config.blendMode = root.blendMode ?? "normal";
    if (root.texture.source === "builtin") config.textureKind = root.texture.kind;
    if (root.texture.source === "sequence") {
        config.sequenceRandomStart = root.texture.randomStart ?? false;
        config.sequenceFrameRate = root.texture.frameRate ?? config.sequenceFrameRate;
    }
    config.emitterType = emission.emitterType;
    config.emitterWidth = emission.emitterWidth ?? 0;
    config.emitterHeight = emission.emitterHeight ?? 0;
    config.emitterRadius = emission.emitterRadius ?? 0;
    for (const key of ["emitterX", "emitterY", "emitterWidth", "emitterHeight", "emitterRadius", "emitterRandomizePosition", "rate", "directionMin", "directionMax", "burst", "burstByDemand", "duration"] as const) {
        assignNumber(key, emission[key]);
    }
    config.emitterAlongShape = emission.emitterAlongShape ?? false;
    config.enableBurst = emission.burst !== undefined;
    config.enableBurstByDemand = emission.burstByDemand !== undefined;
    config.enableDurationLoop = emission.duration !== undefined;
    config.loop = emission.loop ?? false;
    config.enableTimelineBursts = emission.bursts !== undefined;
    config.timelineBursts = emission.bursts?.map((point) => ({ ...point })) ?? config.timelineBursts;
    config.enablePrewarm = root.simulation?.prewarm !== undefined;
    const warmup = root.simulation?.prewarm;
    config.prewarm = typeof warmup === "number" ? warmup : warmup?.duration ?? warmup?.prewarm ?? 0;

    for (const prefix of Object.keys(providers) as Array<keyof typeof providers>) {
        const keys = providers[prefix];
        const value = base[prefix];
        if (keys.enable) config[keys.enable] = value !== undefined;
        if (typeof value === "number") {
            config[keys.mode] = "constant";
            config[keys.constant] = value;
        } else if (value) {
            config[keys.mode] = "min-max";
            config[keys.min] = value.min;
            config[keys.max] = value.max;
        }
    }
    config.angleKeepDirection = base.angleKeepDirection ?? false;
    config.enableStartColor = base.startColors !== undefined;
    config.startColors = base.startColors?.map(toHexColor) ?? config.startColors;
    config.enableBounce = base.bounce !== undefined;
    if (base.bounce) {
        config.bounceMode = base.bounce.mode;
        config.bounceBoxWidth = base.bounce.box?.width ?? 0;
        config.bounceBoxHeight = base.bounce.box?.height ?? 0;
        assignNumber("bounceBoxX", base.bounce.box?.x);
        assignNumber("bounceBoxY", base.bounce.box?.y);
        assignNumber("bounceBoxWidth", base.bounce.box?.width);
        assignNumber("bounceBoxHeight", base.bounce.box?.height);
        assignNumber("bounceDampingMin", base.bounce.damping?.min);
        assignNumber("bounceDampingMax", base.bounce.damping?.max);
    }
    config.enableSizeOverLifetime = overLifetime.size !== undefined;
    config.sizeCurve = overLifetime.size?.map((point) => ({ ...point })) ?? config.sizeCurve;
    config.enableAlphaOverLifetime = overLifetime.alpha !== undefined;
    config.alphaCurve = overLifetime.alpha?.map((point) => ({ ...point })) ?? config.alphaCurve;
    config.enableSpeedOverLifetime = overLifetime.speed !== undefined;
    config.speedCurve = overLifetime.speed?.curve.map((point) => ({ ...point })) ?? config.speedCurve;
    config.speedOverLifetimeFade = overLifetime.speed?.fade ?? true;
    config.enableScaleXYOverLifetime = overLifetime.scaleXY !== undefined;
    config.scaleXCurve = overLifetime.scaleXY?.x.map((point) => ({ ...point })) ?? config.scaleXCurve;
    config.scaleYCurve = overLifetime.scaleXY?.y.map((point) => ({ ...point })) ?? config.scaleYCurve;
    config.enableVelocityOverLifetime = overLifetime.velocity !== undefined;
    config.velocityXCurve = overLifetime.velocity?.x.map((point) => ({ ...point })) ?? config.velocityXCurve;
    config.velocityYCurve = overLifetime.velocity?.y.map((point) => ({ ...point })) ?? config.velocityYCurve;
    config.enableColorOverLifetime = overLifetime.color !== undefined;
    config.colorCurve = overLifetime.color?.map((point) => ({ t: point.t, color: toHexColor(point.color) })) ?? config.colorCurve;
    const flickering = overLifetime.flickering;
    config.enableFlickeringOverLifetime = flickering !== undefined;
    if (flickering) {
        assignNumber("flickeringGap", flickering.gap);
        assignNumber("flickeringMin", flickering.min);
        assignNumber("flickeringMax", flickering.max);
        assignNumber("flickeringRandomGapOffset", flickering.randomGapOffset);
        assignNumber("flickeringRandomMinMaxOffset", flickering.randomMinMaxOffset);
        assignNumber("flickeringStartTime", flickering.startTime ?? flickering.timeFrom);
        assignNumber("flickeringEndTime", flickering.endTime ?? flickering.timeTo);
        config.flickeringFade = flickering.fade ?? false;
    }
    config.enableGravity = forces.gravity !== undefined;
    assignNumber("gravity", forces.gravity);
    config.enableForce = forces.turbulence !== undefined;
    if (forces.turbulence) {
        assignNumber("forceAmplitudeX", forces.turbulence.amplitudeX);
        assignNumber("forceAmplitudeY", forces.turbulence.amplitudeY);
        assignNumber("forceSpatialScale", forces.turbulence.spatialScale);
        assignNumber("forceTimeScale", forces.turbulence.timeScale);
        config.forceSeed = forces.turbulence.seed ?? 1;
    }
    return config;
}

export function getExpectedTextureNames(config: EditorSerializedConfig): string[] {
    return config.texture.source === "sequence" ? [...config.texture.fileNames]
        : config.texture.source === "raster" ? [config.texture.fileName] : [];
}

export function buildConfigDiff(previous: EditorSerializedConfig | null, current: EditorSerializedConfig): SerializedConfigPatch | undefined {
    // Both inputs share the validated serialization shape; recursion only removes optional fields.
    return diffValues(previous, current) as SerializedConfigPatch | undefined;
}

function diffValues(previous: unknown, current: unknown): unknown {
    if (isRecord(previous) && isRecord(current)) {
        if (typeof previous.source === "string" && typeof current.source === "string" && previous.source !== current.source) {
            return current;
        }
        const result: Record<string, unknown> = {};
        const keys = new Set([...Object.keys(previous), ...Object.keys(current)]);
        for (const key of keys) {
            // Optional serializer fields exist with undefined until JSON encoding.
            const before = previous[key];
            const after = current[key];
            const diff = after === undefined ? (before === undefined ? undefined : null) : diffValues(before, after);
            if (diff !== undefined) result[key] = diff;
        }
        return Object.keys(result).length ? result : undefined;
    }
    if (Array.isArray(previous) && Array.isArray(current)) {
        return JSON.stringify(previous) === JSON.stringify(current) ? undefined : current;
    }
    return Object.is(previous, current) ? undefined : current;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
