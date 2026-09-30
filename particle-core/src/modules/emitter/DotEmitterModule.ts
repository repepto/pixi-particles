import type { IEmitterModule } from "../../contracts/IEmitterModule.js";
import type { SpawnPosition } from "../../types/CommonTypes.js";

export class DotEmitterModule implements IEmitterModule {
    public constructor(
        private readonly x: number = 0,
        private readonly y: number = 0,
        private readonly randomizePosition: number = 0,
    ) {
    }

    public getSpawnPosition(out: SpawnPosition): void {
        out.x = this.x;
        out.y = this.y;

        if (this.randomizePosition <= 0) {
            return;
        }

        out.x += (Math.random() * 2 - 1) * this.randomizePosition;
        out.y += (Math.random() * 2 - 1) * this.randomizePosition;
    }
}
