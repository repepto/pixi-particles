import type { IColorOverLifetimeModule } from "../../contracts/IColorOverLifetimeModule.js";
import type { ColorPoint, RgbColor } from "../../types/CommonTypes.js";
import { lerpColor } from "../../utils/color.js";
import { clamp, inverseLerp } from "../../utils/math.js";

export class ColorGradientModule implements IColorOverLifetimeModule {
    private readonly points: ColorPoint[];
    private readonly tempColorA: RgbColor = { r: 0, g: 0, b: 0 };
    private readonly tempColorB: RgbColor = { r: 0, g: 0, b: 0 };
    private readonly tempColorResult: RgbColor = { r: 0, g: 0, b: 0 };

    public constructor(points: ColorPoint[]) {
        if (points.length === 0) {
            throw new Error("ColorGradientModule requires at least one point.");
        }

        this.points = [...points].sort((a, b) => a.t - b.t);
    }

    public evaluate(t: number): number {
        const clampedT = clamp(t, 0, 1);

        if (clampedT <= this.points[0].t) {
            return this.points[0].color;
        }

        const lastPoint = this.points[this.points.length - 1];

        if (clampedT >= lastPoint.t) {
            return lastPoint.color;
        }

        const segmentIndex = this.findSegmentIndex(clampedT);
        const a = this.points[segmentIndex];
        const b = this.points[segmentIndex + 1];
        const localT = inverseLerp(a.t, b.t, clampedT);

        return lerpColor(a.color, b.color, localT, this.tempColorA, this.tempColorB, this.tempColorResult);
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
