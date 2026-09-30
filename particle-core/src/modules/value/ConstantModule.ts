import type { INumberProvider } from "../../contracts/INumberProvider.js";

export class ConstantModule implements INumberProvider {
    public constructor(
        private readonly value: number,
    ) {
    }

    public get(): number {
        return this.value;
    }
}
