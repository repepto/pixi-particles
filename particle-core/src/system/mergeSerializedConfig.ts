import type { SerializedConfig, SerializedConfigPatch } from "../config/SerializedConfig.js";

type ObjectValue = Record<string, unknown>;

function isObject(value: unknown): value is ObjectValue {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Null and explicit undefined remove keys; arrays and changed texture variants replace their value. */
export function mergeSerializedConfig(base: SerializedConfig, patch: SerializedConfigPatch): SerializedConfig {
    function merge(previous: unknown, update: unknown): unknown {
        if (!isObject(update)) return structuredClone(update);
        const result: ObjectValue = isObject(previous)
            && !(typeof update.source === "string" && update.source !== previous.source)
            ? structuredClone(previous)
            : {};
        for (const [key, value] of Object.entries(update)) {
            if (value === null || value === undefined) delete result[key];
            else result[key] = merge(result[key], value);
        }
        return result;
    }
    const merged = merge(base, patch);
    validateSerializedConfig(merged);
    return merged;
}

type Shape = { required: string[]; children?: Record<string, Shape> };
const range: Shape = { required: ["min", "max"] };
const box: Shape = { required: ["x", "y", "width", "height"] };
const vector: Shape = { required: ["x", "y"] };
const shape: Shape = {
    required: ["name", "maxParticles", "texture", "emission", "base"],
    children: {
        texture: { required: ["source"] },
        emission: { required: ["emitterType", "emitterX", "emitterY", "rate", "directionMin", "directionMax"] },
        base: {
            required: ["lifetime"],
            children: {
                lifetime: range, startSpeed: range, startRotation: range, angularVelocity: range, startSize: range, startAlpha: range,
                bounce: { required: ["mode"], children: { box, damping: range } },
            },
        },
        overLifetime: { required: [], children: { velocity: vector, scaleXY: vector, speed: { required: ["curve"] } } },
        forces: { required: [], children: { turbulence: { required: ["amplitudeX", "amplitudeY", "spatialScale", "timeScale"] } } },
        boundsArea: box,
    },
};

function checkShape(value: unknown, schema: Shape, path: string, partial: boolean): void {
    // Number providers can be constants instead of range objects.
    if (schema === range && typeof value === "number") return;
    if (!isObject(value)) throw new Error(`${path}: expected an object.`);
    for (const key of schema.required) {
        if ((key in value || !partial) && (value[key] === undefined || value[key] === null)) {
            throw new Error(`${path}.${key}: required field cannot be removed.`);
        }
    }
    for (const [key, child] of Object.entries(schema.children ?? {})) {
        if (value[key] !== undefined && value[key] !== null) checkShape(value[key], child, `${path}.${key}`, partial);
    }
}

/** Check structural requirements before allocating textures or mutating a running system. */
export function validateSerializedConfig(value: unknown): asserts value is SerializedConfig {
    checkShape(value, shape, "config", false);
    const config = value as SerializedConfig;
    const texture = config.texture;
    const required = texture.source === "builtin" ? ["kind"]
        : texture.source === "raster" ? ["fileName"]
        : texture.source === "sequence" ? ["fileNames"] : undefined;
    if (!required) throw new Error("config.texture.source: expected builtin, raster or sequence.");
    checkShape(texture, { required }, "config.texture", false);
    if (texture.source === "sequence" && !Array.isArray(texture.fileNames)) {
        throw new Error("config.texture.fileNames: expected an array.");
    }

    const checkArray = (items: unknown, required: string[], path: string): void => {
        if (items === undefined) return;
        if (!Array.isArray(items)) throw new Error(`${path}: expected an array.`);
        items.forEach((item, index) => checkShape(item, { required }, `${path}[${index}]`, false));
    };
    checkArray(config.emission.bursts, ["time", "count"], "config.emission.bursts");
    for (const key of ["size", "alpha"] as const) {
        checkArray(config.overLifetime?.[key], ["t", "value"], `config.overLifetime.${key}`);
    }
    checkArray(config.overLifetime?.color, ["t", "color"], "config.overLifetime.color");
    checkArray(config.overLifetime?.speed?.curve, ["t", "value"], "config.overLifetime.speed.curve");
    for (const key of ["velocity", "scaleXY"] as const) {
        for (const axis of ["x", "y"] as const) {
            checkArray(config.overLifetime?.[key]?.[axis], ["t", "value"], `config.overLifetime.${key}.${axis}`);
        }
    }
}

export function validateSerializedPatch(patch: SerializedConfigPatch): void {
    checkShape(patch, shape, "config", true);
}

/** Convert deletion markers to explicit undefined for systems constructed from runtime modules. */
export function normalizeSerializedPatch(patch: SerializedConfigPatch): Partial<SerializedConfig> {
    validateSerializedPatch(patch);
    // Custom runtime modules have no serialized descriptor to merge into. Replacements
    // must therefore include their required members; optional deletions still work.
    for (const section of ["base", "overLifetime", "forces"] as const) {
        const update: unknown = patch[section];
        if (!isObject(update)) continue;
        for (const [key, moduleShape] of Object.entries(shape.children?.[section].children ?? {})) {
            if (update[key] !== undefined && update[key] !== null) {
                checkShape(update[key], moduleShape, `config.${section}.${key}`, false);
            }
        }
    }
    if (patch.boundsArea) checkShape(patch.boundsArea, box, "config.boundsArea", false);
    if (patch.texture) {
        const source = patch.texture.source;
        const required = source === "builtin" ? ["source", "kind"]
            : source === "raster" ? ["source", "fileName"]
            : source === "sequence" ? ["source", "fileNames"] : ["source"];
        checkShape(patch.texture, { required }, "config.texture", false);
    }
    function normalize(value: unknown): unknown {
        if (value === null) return undefined;
        if (!isObject(value)) return value;
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
    }
    const normalized = normalize(patch) as Partial<SerializedConfig>;
    if (patch.overLifetime === null) {
        normalized.overLifetime = Object.fromEntries([
            "size", "alpha", "color", "velocity", "speed", "scaleXY", "flickering",
        ].map((key) => [key, undefined]));
    }
    if (patch.forces === null) normalized.forces = { gravity: undefined, turbulence: undefined };
    return normalized;
}
