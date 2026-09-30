import type { ParticleState } from "../../types/ParticleState.js";
import type { BounceBoundsProvider, BounceModuleConfig, IBounceModule } from "../../contracts/IBounceModule.js";

export class BounceModule implements IBounceModule {
    public readonly mode: BounceModuleConfig["mode"];
    public readonly box?: BounceModuleConfig["box"];
    public readonly damping?: BounceModuleConfig["damping"];

    public constructor(
        config: BounceModuleConfig,
        private readonly screenBoundsProvider?: BounceBoundsProvider,
    ) {
        this.mode = config.mode;
        this.box = config.box;
        this.damping = config.damping;
    }

    public apply(state: ParticleState, offsetX: number, offsetY: number): void {
        const bounds = this.mode === "screen"
            ? this.screenBoundsProvider?.()
            : this.box;

        if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
            return;
        }

        const minX = bounds.x;
        const minY = bounds.y;
        const maxX = bounds.x + bounds.width;
        const maxY = bounds.y + bounds.height;
        const worldX = state.x + offsetX;
        const worldY = state.y + offsetY;

        if (worldX < minX) {
            state.x = minX - offsetX;
            state.vx = this.applyDamping(Math.abs(state.vx));
            state.directionX = Math.abs(state.directionX);
        } else if (worldX > maxX) {
            state.x = maxX - offsetX;
            state.vx = -this.applyDamping(Math.abs(state.vx));
            state.directionX = -Math.abs(state.directionX);
        }

        if (worldY < minY) {
            state.y = minY - offsetY;
            state.vy = this.applyDamping(Math.abs(state.vy));
            state.directionY = Math.abs(state.directionY);
        } else if (worldY > maxY) {
            state.y = maxY - offsetY;
            state.vy = -this.applyDamping(Math.abs(state.vy));
            state.directionY = -Math.abs(state.directionY);
        }
    }

    private applyDamping(value: number): number {
        const min = this.damping?.min ?? 0;
        const max = this.damping?.max ?? 0;

        if (min === 0 && max === 0) {
            return value;
        }

        const from = Math.min(min, max);
        const to = Math.max(min, max);
        const damping = from + Math.random() * (to - from);

        return damping !== 0 ? value / damping : value;
    }
}
