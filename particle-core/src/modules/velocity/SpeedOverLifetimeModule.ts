import type { ISpeedOverLifetimeModule } from "../../contracts/ISpeedOverLifetimeModule.js";
import type { CurvePoint } from "../../types/CommonTypes.js";
import { clamp, inverseLerp, lerp } from "../../utils/math.js";

export type SpeedOverLifetimeConfig = {
    curve: CurvePoint[];
    fade?: boolean;
};

export class SpeedOverLifetimeModule implements ISpeedOverLifetimeModule {
    private readonly points: CurvePoint[];
    private readonly fade: boolean;

    public constructor(config: SpeedOverLifetimeConfig) {
        if (config.curve.length === 0) {
            throw new Error("SpeedOverLifetimeModule requires at least one point.");
        }

        this.points = [...config.curve].sort((a, b) => a.t - b.t);
        this.fade = config.fade ?? true;
    }

    public createRandomOffsets(out: number[] = []): number[] {
        out.length = this.points.length;

        for (let i = 0; i < this.points.length; i++) {
            const randomOffset = this.points[i].randomOffset ?? 0;

            out[i] = randomOffset <= 0
                ? 0
                : -randomOffset + Math.random() * randomOffset * 2;
        }

        return out;
    }

    public evaluate(t: number, randomOffsets?: number[]): number {
        const clampedT = clamp(t, 0, 1);

        if (clampedT <= this.points[0].t) {
            return this.getPointValue(0, randomOffsets);
        }

        const lastPoint = this.points[this.points.length - 1];

        if (clampedT >= lastPoint.t) {
            return this.getPointValue(this.points.length - 1, randomOffsets);
        }

        const segmentIndex = this.findSegmentIndex(clampedT);
        const a = this.points[segmentIndex];
        const b = this.points[segmentIndex + 1];

        if (!this.fade) {
            return clampedT < b.t
                ? this.getPointValue(segmentIndex, randomOffsets)
                : this.getPointValue(segmentIndex + 1, randomOffsets);
        }

        const localT = inverseLerp(a.t, b.t, clampedT);

        return lerp(this.getPointValue(segmentIndex, randomOffsets), this.getPointValue(segmentIndex + 1, randomOffsets), localT);
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

    private getPointValue(index: number, randomOffsets?: number[]): number {
        return this.points[index].value + (randomOffsets?.[index] ?? 0);
    }
}
