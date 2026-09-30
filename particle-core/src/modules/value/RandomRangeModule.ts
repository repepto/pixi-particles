import type { INumberProvider } from "../../contracts/INumberProvider.js";

export class RandomRangeModule implements INumberProvider {
    public constructor(
        private readonly min: number,
        private readonly max: number,
    ) {
    }

    public get(): number {
        return this.min + Math.random() * (this.max - this.min);
    }
}
