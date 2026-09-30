import { Container, Ticker } from "pixi.js";
import type { ParticleSystemConfig } from "../config/ParticleSystemConfig.js";
import type { IParticleSystem, ParticleSystemRenderer } from "../contracts/IParticleSystem.js";
import { ParticleSystem, type SerializedConfig, type SerializedConfigPatch } from "./ParticleSystem.js";

export class MultiParticleSystem implements IParticleSystem<ParticleSystemConfig[], SerializedConfig[], Partial<ParticleSystemConfig>[], SerializedConfigPatch[]> {
    public readonly container: Container;

    private readonly systems: ParticleSystem[];

    public constructor(
        configs: ParticleSystemConfig[],
        ticker?: Ticker,
    ) {
        this.container = new Container();
        this.systems = configs.map((config) => new ParticleSystem(config, ticker));

        for (const system of this.systems) {
            this.container.addChild(system.container);
        }
    }

    public static async fromSerializedConfig(configs: SerializedConfig[], renderer: ParticleSystemRenderer, ticker?: Ticker): Promise<MultiParticleSystem> {
        return await MultiParticleSystem.fromSerializedMultipleConfig(configs, renderer, ticker);
    }

    public static async fromSerializedMultipleConfig(configs: SerializedConfig[], renderer: ParticleSystemRenderer, ticker?: Ticker): Promise<MultiParticleSystem> {
        const runtimeConfigs = await Promise.all(
            configs.map(async (config) => await ParticleSystem.fromSerializedConfig(config, renderer, ticker)),
        );
        const system = new MultiParticleSystem([], ticker);

        for (const particleSystem of runtimeConfigs) {
            system.systems.push(particleSystem);
            system.container.addChild(particleSystem.container);
        }

        return system;
    }

    public get config(): ParticleSystemConfig[] {
        return this.systems.map((system) => system.config);
    }

    public setPosition(x: number, y: number): void {
        for (const system of this.systems) {
            system.setPosition(x, y);
        }
    }

    public startEmission(): void {
        for (const system of this.systems) {
            system.startEmission();
        }
    }

    public stopEmission(): void {
        for (const system of this.systems) {
            system.stopEmission();
        }
    }

    public playBurstByDemand(): void {
        for (const system of this.systems) {
            system.playBurstByDemand();
        }
    }

    public play(emit = true): void {
        for (const system of this.systems) {
            system.play(emit);
        }
    }

    public restart(): void {
        for (const system of this.systems) {
            system.restart();
        }
    }

    public stop(emitStop = true, clear = false): void {
        for (const system of this.systems) {
            system.stop(emitStop, clear);
        }
    }

    public clear(): void {
        for (const system of this.systems) {
            system.clear();
        }
    }

    public destroy(): void {
        for (const system of this.systems) {
            system.destroy();
        }

        this.container.destroy();
    }

    public update(dt: number): void {
        for (const system of this.systems) {
            system.update(dt);
        }
    }

    public updateConfig(partials: Partial<ParticleSystemConfig>[], merge = false): void {
        for (const partial of partials) {
            if (!partial.name) {
                continue;
            }

            const system = this.systems.find((item) => item.config.name === partial.name);

            if (!system) {
                continue;
            }

            system.updateConfig(partial, merge);
        }
    }

    public async updateConfigFromSerialized(partials: SerializedConfigPatch[], merge = false): Promise<void> {
        for (const partial of partials) {
            if (!partial.name) {
                continue;
            }

            const system = this.systems.find((item) => item.config.name === partial.name);

            if (!system) {
                continue;
            }

            await system.updateConfigFromSerialized(partial, merge);
        }
    }
}
