import type { IDirectionModule } from "../../contracts/IDirectionModule.js";
import type { DirectionVector } from "../../types/CommonTypes.js";

export class ConeDirectionModule implements IDirectionModule {
    public constructor(
        private readonly minAngleDeg: number,
        private readonly maxAngleDeg: number,
    ) {
    }

    public getDirection(out: DirectionVector): void {
        const angleDeg = this.minAngleDeg + Math.random() * (this.maxAngleDeg - this.minAngleDeg);
        const angleRad = angleDeg * Math.PI / 180;

        out.x = Math.cos(angleRad);
        out.y = Math.sin(angleRad);
    }
}
