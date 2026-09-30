import type { DirectionVector } from "../types/CommonTypes.js";

export type IDirectionModule = {
    getDirection(out: DirectionVector): void;
};
