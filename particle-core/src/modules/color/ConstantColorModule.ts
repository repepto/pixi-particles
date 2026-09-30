import type { IColorProvider } from "../../contracts/IColorProvider.js";

export class ConstantColorModule implements IColorProvider {
    public constructor(
        private readonly color: number,
    ) {
    }

    public get(): number {
        return this.color;
    }
}
