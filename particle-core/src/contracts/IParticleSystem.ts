import type { Container, Graphics, Ticker, Texture as TextureType } from "pixi.js";
import type { ParticleSystemConfig } from "../config/ParticleSystemConfig.js";
import type { SerializedConfig, SerializedConfigPatch } from "../config/SerializedConfig.js";

export type ParticleSystemRenderer = {
    generateTexture: (graphics: Graphics) => TextureType;
    screen?: { width: number; height: number };
};

export interface IParticleSystem<
    TConfig = ParticleSystemConfig,
    TSerializedConfig = SerializedConfig,
    TRuntimeUpdate = Partial<TConfig>,
    TSerializedUpdate = TSerializedConfig extends SerializedConfig ? SerializedConfigPatch : Partial<TSerializedConfig>,
> {
    readonly container: Container;
    readonly config: TConfig;

    setPosition(x: number, y: number): void;
    startEmission(): void;
    stopEmission(): void;
    playBurstByDemand(): void;
    play(emit?: boolean): void;
    restart(): void;
    stop(emitStop?: boolean, clear?: boolean): void;
    clear(): void;
    destroy(): void;
    update(dt: number): void;
    updateConfig(partial: TRuntimeUpdate, merge?: boolean): void;
    updateConfigFromSerialized(partial: TSerializedUpdate, merge?: boolean): Promise<void>;
}

export type ParticleSystemFactory<TSystem> = {
    fromSerializedConfig(config: SerializedConfig, renderer: ParticleSystemRenderer, ticker?: Ticker): Promise<TSystem>;
};
