export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

export function inverseLerp(a: number, b: number, value: number): number {
    if (a === b) {
        return 0;
    }

    return (value - a) / (b - a);
}

export function fract(value: number): number {
    return value - Math.floor(value);
}

export function hash2d(x: number, y: number, seed: number): number {
    const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;

    return fract(value);
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);

    return t * t * (3 - 2 * t);
}

export function valueNoise2d(x: number, y: number, seed: number): number {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = x0 + 1;
    const y1 = y0 + 1;
    const sx = smoothstep(0, 1, x - x0);
    const sy = smoothstep(0, 1, y - y0);
    const n00 = hash2d(x0, y0, seed);
    const n10 = hash2d(x1, y0, seed);
    const n01 = hash2d(x0, y1, seed);
    const n11 = hash2d(x1, y1, seed);
    const ix0 = lerp(n00, n10, sx);
    const ix1 = lerp(n01, n11, sx);

    return lerp(ix0, ix1, sy);
}
