export type FlickeringOverLifetimeState = {
    flickeringElapsed: number;
    flickeringGap: number;
    flickeringFromAlpha: number;
    flickeringToAlpha: number;
    flickeringTargetIsMax: boolean;
};

export type IFlickeringOverLifetimeModule = {
    readonly gap: number;
    readonly min: number;
    readonly max: number;
    readonly randomGapOffset: number;
    readonly randomMinMaxOffset: number;
    readonly fade: boolean;
    readonly startTime: number;
    readonly endTime: number;
    initState(state: FlickeringOverLifetimeState): void;
    evaluate(dt: number, normalizedLifetime: number, state: FlickeringOverLifetimeState, fallbackAlpha: number): number;
};
