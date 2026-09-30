import type { IEmitterModule } from "../../contracts/IEmitterModule.js";
import type { SpawnPosition } from "../../types/CommonTypes.js";

export class CircleEmitterModule implements IEmitterModule {
    public constructor(
        private readonly x: number,
        private readonly y: number,
        private readonly radius: number,
        private readonly alongShape: boolean = false,
        private readonly randomizePosition: number = 0,
    ) {
    }

    public getSpawnPosition(out: SpawnPosition): void {
        const angle = Math.random() * Math.PI * 2;
        const distance = this.alongShape ? this.radius : Math.sqrt(Math.random()) * this.radius;

        out.x = this.x + Math.cos(angle) * distance;
        out.y = this.y + Math.sin(angle) * distance;

        this.applyRandomizePosition(out);
    }

    private applyRandomizePosition(out: SpawnPosition): void {
        if (this.randomizePosition <= 0) {
            return;
        }

        out.x += (Math.random() * 2 - 1) * this.randomizePosition;
        out.y += (Math.random() * 2 - 1) * this.randomizePosition;
    }
}
