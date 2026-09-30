import type { IColorProvider } from "../../contracts/IColorProvider.js";

export class RandomPickColorModule implements IColorProvider {
    public constructor(
        private readonly colors: number[],
    ) {
        if (colors.length === 0) {
            throw new Error("RandomPickColorModule requires at least one color.");
        }
    }

    public get(): number {
        const index = Math.floor(Math.random() * this.colors.length);

        return this.colors[index];
    }
}
