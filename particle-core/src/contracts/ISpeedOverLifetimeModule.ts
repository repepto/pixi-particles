export type ISpeedOverLifetimeModule = {
    createRandomOffsets(out?: number[]): number[];
    evaluate(t: number, randomOffsets?: number[]): number;
};
