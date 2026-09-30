import type { ICurveModule } from "../../contracts/ICurveModule.js";
import type { CurvePoint } from "../../types/CommonTypes.js";
import { clamp, inverseLerp, lerp } from "../../utils/math.js";

export class CurveModule implements ICurveModule {
    private readonly points: CurvePoint[];

    public constructor(points: CurvePoint[]) {
        if (points.length === 0) {
            throw new Error("CurveModule requires at least one point.");
        }

        this.points = [...points].sort((a, b) => a.t - b.t);
    }

    public evaluate(t: number): number {
        const clampedT = clamp(t, 0, 1);

        if (clampedT <= this.points[0].t) {
            return this.points[0].value;
        }

        const lastPoint = this.points[this.points.length - 1];

        if (clampedT >= lastPoint.t) {
            return lastPoint.value;
        }

        const segmentIndex = this.findSegmentIndex(clampedT);
        const a = this.points[segmentIndex];
        const b = this.points[segmentIndex + 1];
        const localT = inverseLerp(a.t, b.t, clampedT);

        return lerp(a.value, b.value, localT);
    }

    private findSegmentIndex(t: number): number {
        let low = 1;
        let high = this.points.length - 1;

        while (low < high) {
            const mid = (low + high) >> 1;

            if (this.points[mid].t < t) {
                low = mid + 1;
            } else {
                high = mid;
            }
        }

        return low - 1;
    }
}
