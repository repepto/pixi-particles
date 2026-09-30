import type { DirectionVector } from "../types/CommonTypes.js";

export type IVelocityOverLifetimeModule = {
    evaluate(t: number, out: DirectionVector): void;
};
