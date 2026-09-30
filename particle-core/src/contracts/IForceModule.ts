import type { DirectionVector } from "../types/CommonTypes.js";

export type IForceModule = {
    evaluate(particleAge: number, x: number, y: number, out: DirectionVector): void;
};
