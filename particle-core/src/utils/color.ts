import type { RgbColor } from "../types/CommonTypes.js";

export function splitColor(color: number, out: RgbColor): void {
    out.r = (color >> 16) & 0xFF;
    out.g = (color >> 8) & 0xFF;
    out.b = color & 0xFF;
}

export function packColor(color: RgbColor): number {
    return ((color.r & 0xFF) << 16) | ((color.g & 0xFF) << 8) | (color.b & 0xFF);
}

export function lerpColor(colorA: number, colorB: number, t: number, outA: RgbColor, outB: RgbColor, outResult: RgbColor): number {
    splitColor(colorA, outA);
    splitColor(colorB, outB);

    outResult.r = Math.round(outA.r + (outB.r - outA.r) * t);
    outResult.g = Math.round(outA.g + (outB.g - outA.g) * t);
    outResult.b = Math.round(outA.b + (outB.b - outA.b) * t);

    return packColor(outResult);
}
