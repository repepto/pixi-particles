import type { IVelocityOverLifetimeModule } from "../../contracts/IVelocityOverLifetimeModule.js";
import type { CurvePoint, DirectionVector } from "../../types/CommonTypes.js";
import { CurveModule } from "../curve/CurveModule.js";

export type VectorCurveConfig = {
    x: CurvePoint[];
    y: CurvePoint[];
};

export class VectorCurveModule implements IVelocityOverLifetimeModule {
    private readonly xCurve: CurveModule;
    private readonly yCurve: CurveModule;

    public constructor(config: VectorCurveConfig) {
        this.xCurve = new CurveModule(config.x);
        this.yCurve = new CurveModule(config.y);
    }

    public evaluate(t: number, out: DirectionVector): void {
        out.x = this.xCurve.evaluate(t);
        out.y = this.yCurve.evaluate(t);
    }
}
