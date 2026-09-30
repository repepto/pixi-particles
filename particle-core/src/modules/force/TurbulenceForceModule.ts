import type { IForceModule } from "../../contracts/IForceModule.js";
import type { DirectionVector } from "../../types/CommonTypes.js";
import { valueNoise2d } from "../../utils/math.js";

export type TurbulenceForceConfig = {
    amplitudeX: number;
    amplitudeY: number;
    spatialScale: number;
    timeScale: number;
    seed?: number;
};

export class TurbulenceForceModule implements IForceModule {
    private readonly amplitudeX: number;
    private readonly amplitudeY: number;
    private readonly spatialScale: number;
    private readonly timeScale: number;
    private readonly seed: number;

    public constructor(config: TurbulenceForceConfig) {
        this.amplitudeX = config.amplitudeX;
        this.amplitudeY = config.amplitudeY;
        this.spatialScale = config.spatialScale;
        this.timeScale = config.timeScale;
        this.seed = config.seed ?? 1;
    }

    public evaluate(particleAge: number, x: number, y: number, out: DirectionVector): void {
        const noiseX = valueNoise2d(x * this.spatialScale + particleAge * this.timeScale, y * this.spatialScale, this.seed);
        const noiseY = valueNoise2d(x * this.spatialScale, y * this.spatialScale + particleAge * this.timeScale, this.seed + 17);

        out.x = (noiseX * 2 - 1) * this.amplitudeX;
        out.y = (noiseY * 2 - 1) * this.amplitudeY;
    }
}
