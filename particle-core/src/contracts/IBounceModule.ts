import type { ParticleState } from "../types/ParticleState.js";

export type BounceMode = "screen" | "box";

export type BounceBoxConfig = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type BounceDampingConfig = {
    min: number;
    max: number;
};

export type BounceModuleConfig = {
    mode: BounceMode;
    box?: BounceBoxConfig;
    damping?: BounceDampingConfig;
};

export type BounceBoundsProvider = () => BounceBoxConfig | undefined;

export interface IBounceModule {
    apply(state: ParticleState, offsetX: number, offsetY: number): void;
}
