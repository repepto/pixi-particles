import type { IEmitterModule } from "../../contracts/IEmitterModule.js";
import type { SpawnPosition } from "../../types/CommonTypes.js";

export class BoxEmitterModule implements IEmitterModule {
    public constructor(
        private readonly x: number,
        private readonly y: number,
        private readonly width: number,
        private readonly height: number,
        private readonly alongShape: boolean = false,
        private readonly randomizePosition: number = 0,
    ) {
    }

    public getSpawnPosition(out: SpawnPosition): void {
        if (this.alongShape) {
            this.getContourSpawnPosition(out);
        } else {
            out.x = this.x + (Math.random() - 0.5) * this.width;
            out.y = this.y + (Math.random() - 0.5) * this.height;
        }

        this.applyRandomizePosition(out);
    }

    private getContourSpawnPosition(out: SpawnPosition): void {
        const halfWidth = this.width * 0.5;
        const halfHeight = this.height * 0.5;
        const width = Math.abs(this.width);
        const height = Math.abs(this.height);
        const perimeter = width * 2 + height * 2;

        if (perimeter <= 0) {
            out.x = this.x;
            out.y = this.y;
            return;
        }

        let distance = Math.random() * perimeter;

        if (distance < width) {
            out.x = this.x - halfWidth + distance;
            out.y = this.y - halfHeight;
            return;
        }

        distance -= width;

        if (distance < height) {
            out.x = this.x + halfWidth;
            out.y = this.y - halfHeight + distance;
            return;
        }

        distance -= height;

        if (distance < width) {
            out.x = this.x + halfWidth - distance;
            out.y = this.y + halfHeight;
            return;
        }

        distance -= width;
        out.x = this.x - halfWidth;
        out.y = this.y + halfHeight - distance;
    }

    private applyRandomizePosition(out: SpawnPosition): void {
        if (this.randomizePosition <= 0) {
            return;
        }

        out.x += (Math.random() * 2 - 1) * this.randomizePosition;
        out.y += (Math.random() * 2 - 1) * this.randomizePosition;
    }
}
