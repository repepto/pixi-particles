import type { FlickeringOverLifetimeState, IFlickeringOverLifetimeModule } from "../../contracts/IFlickeringOverLifetimeModule.js";
import { clamp, lerp } from "../../utils/math.js";

export type FlickeringOverLifetimeConfig = {
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

export class FlickeringOverLifetimeModule implements IFlickeringOverLifetimeModule {
    public readonly gap: number;
    public readonly min: number;
    public readonly max: number;
    public readonly randomGapOffset: number;
    public readonly randomMinMaxOffset: number;
    public readonly fade: boolean;
    public readonly startTime: number;
    public readonly endTime: number;

    public constructor(config: FlickeringOverLifetimeConfig = {}) {
        this.gap = Math.max(0.0001, config.gap ?? 0.2);
        this.min = clamp(config.min ?? 0, 0, 1);
        this.max = clamp(config.max ?? 1, 0, 1);
        this.randomGapOffset = Math.max(0, config.randomGapOffset ?? 0);
        this.randomMinMaxOffset = Math.max(0, config.randomMinMaxOffset ?? 0);
        this.fade = config.fade ?? false;
        this.startTime = clamp(config.startTime ?? config.timeFrom ?? 0, 0, 1);
        this.endTime = clamp(config.endTime ?? config.timeTo ?? 1, 0, 1);
    }

    public initState(state: FlickeringOverLifetimeState): void {
        state.flickeringElapsed = 0;
        state.flickeringGap = this.createGap();
        state.flickeringTargetIsMax = true;
        state.flickeringFromAlpha = this.createAlpha(this.max);
        state.flickeringToAlpha = state.flickeringFromAlpha;
    }

    public evaluate(dt: number, normalizedLifetime: number, state: FlickeringOverLifetimeState, fallbackAlpha: number): number {
        if (normalizedLifetime < this.startTime || normalizedLifetime > this.endTime) {
            return fallbackAlpha;
        }

        state.flickeringElapsed += dt;

        while (state.flickeringElapsed >= state.flickeringGap) {
            state.flickeringElapsed -= state.flickeringGap;
            state.flickeringFromAlpha = state.flickeringToAlpha;
            state.flickeringTargetIsMax = !state.flickeringTargetIsMax;
            state.flickeringToAlpha = this.createAlpha(state.flickeringTargetIsMax ? this.max : this.min);
            state.flickeringGap = this.createGap();
        }

        if (!this.fade) {
            return state.flickeringToAlpha;
        }

        return lerp(state.flickeringFromAlpha, state.flickeringToAlpha, clamp(state.flickeringElapsed / state.flickeringGap, 0, 1));
    }

    private createGap(): number {
        return this.gap + (this.randomGapOffset > 0 ? Math.random() * this.randomGapOffset : 0);
    }

    private createAlpha(value: number): number {
        if (this.randomMinMaxOffset <= 0) {
            return value;
        }

        return clamp(value + (Math.random() * 2 - 1) * this.randomMinMaxOffset, 0, 1);
    }
}
