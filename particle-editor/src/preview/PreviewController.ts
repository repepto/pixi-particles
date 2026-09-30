import { Application } from "pixi.js";
import { ParticleSystem } from "@particle/core";
import type { EditorConfig } from "../config/types";
import { buildRuntimeConfig } from "../config/runtime";
import type { UploadedTextureAsset } from "../textures/RasterTextureLoader";

type PreviewSystemEntry = {
    particleSystem: ParticleSystem;
    enabled: boolean;
    position: { x: number; y: number };
};

export class PreviewController {
    private app: Application | null = null;
    private readonly particleSystems = new Map<string, PreviewSystemEntry>();
    private pointerDown = false;

    public constructor(
        private readonly canvasArea: HTMLElement,
        private readonly canvasWrap: HTMLElement,
        private readonly getActiveSystemId: () => string,
    ) {
    }

    public async init(): Promise<void> {
        this.app = new Application();
        await this.app.init({
            resizeTo: this.canvasArea,
            backgroundAlpha: 0,
            antialias: true,
        });

        this.canvasArea.appendChild(this.app.canvas);
        this.attachPointerEvents();
    }

    public async applyConfig(systemId: string, config: EditorConfig, uploadedTextureAsset: UploadedTextureAsset | null): Promise<void> {
        if (!this.app) {
            return;
        }

        const existing = this.particleSystems.get(systemId);
        const enabled = existing?.enabled ?? true;
        const position = existing?.position ?? this.getCenterPosition();

        // Keep the current preview usable if the replacement config cannot be built.
        const runtimeConfig = buildRuntimeConfig(config, uploadedTextureAsset, this.app.renderer);
        const particleSystem = new ParticleSystem(runtimeConfig, this.app.ticker);

        particleSystem.setPosition(position.x, position.y);
        this.app.stage.addChild(particleSystem.container);

        if (existing) {
            existing.particleSystem.destroy();
        }

        this.particleSystems.set(systemId, {
            particleSystem,
            enabled,
            position,
        });

        this.setEnabled(systemId, enabled);
    }

    public removeSystem(systemId: string): void {
        if (!this.app) {
            return;
        }

        const existing = this.particleSystems.get(systemId);

        if (!existing) {
            return;
        }

        existing.particleSystem.destroy();
        this.particleSystems.delete(systemId);
    }

    public setEnabled(systemId: string, enabled: boolean): void {
        const entry = this.particleSystems.get(systemId);

        if (!entry) {
            return;
        }

        entry.enabled = enabled;
        entry.particleSystem.container.visible = enabled;

        if (enabled) {
            entry.particleSystem.play();
        } else {
            entry.particleSystem.stop(false);
        }
    }

    public play(systemId: string): void {
        const entry = this.particleSystems.get(systemId);

        if (!entry || !entry.enabled) {
            return;
        }

        this.playEntry(entry);
    }

    public stop(systemId: string): void {
        const entry = this.particleSystems.get(systemId);

        if (!entry) {
            return;
        }

        entry.particleSystem.stop(false);
    }

    public playAll(): void {
        for (const entry of this.particleSystems.values()) {
            if (entry.enabled) {
                this.playEntry(entry);
            }
        }
    }

    public stopAll(): void {
        for (const entry of this.particleSystems.values()) {
            if (entry.enabled) {
                entry.particleSystem.stop(false);
            }
        }
    }

    public clear(): void {
        for (const entry of this.particleSystems.values()) {
            entry.particleSystem.clear();
        }
    }

    public resetToCenter(systemId: string): void {
        const entry = this.particleSystems.get(systemId);

        if (!entry) {
            return;
        }

        const position = this.getCenterPosition();
        entry.position = position;
        entry.particleSystem.setPosition(position.x, position.y);
    }

    public setPositionForSystem(systemId: string, x: number, y: number): void {
        const entry = this.particleSystems.get(systemId);

        if (!entry) {
            return;
        }

        entry.position = { x, y };
        entry.particleSystem.setPosition(x, y);
    }

    private playEntry(entry: PreviewSystemEntry): void {
        if (this.shouldRestartBeforePlay(entry)) {
            entry.particleSystem.restart();
            return;
        }

        entry.particleSystem.play();
    }

    private shouldRestartBeforePlay(entry: PreviewSystemEntry): boolean {
        const emission = entry.particleSystem.config.emission;

        return emission.duration !== undefined && emission.duration >= 0 && emission.loop === false;
    }

    private attachPointerEvents(): void {
        this.canvasWrap.style.cursor = "crosshair";
        this.canvasWrap.style.touchAction = "none";

        this.canvasWrap.addEventListener("pointerdown", (event) => {
            this.pointerDown = true;
            this.updatePointerPosition(event);
        });

        this.canvasWrap.addEventListener("pointermove", (event) => {
            if (!this.pointerDown) {
                return;
            }

            this.updatePointerPosition(event);
        });

        const release = () => {
            this.pointerDown = false;
        };

        this.canvasWrap.addEventListener("pointerup", release);
        this.canvasWrap.addEventListener("pointercancel", release);
        this.canvasWrap.addEventListener("pointerleave", () => {
            if (!this.pointerDown) {
                return;
            }

            release();
        });
    }

    private updatePointerPosition(event: PointerEvent): void {
        const rect = this.canvasArea.getBoundingClientRect();
        const localX = event.clientX - rect.left;
        const localY = event.clientY - rect.top;
        const activeSystemId = this.getActiveSystemId();

        this.setPositionForSystem(activeSystemId, localX, localY);
    }

    private getCenterPosition(): { x: number; y: number } {
        return {
            x: this.canvasArea.clientWidth * 0.5,
            y: this.canvasArea.clientHeight * 0.5,
        };
    }
}
