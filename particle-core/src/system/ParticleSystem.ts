import { Container, Particle, ParticleContainer, Rectangle, Texture, Ticker } from "pixi.js";
import type { BurstPointConfig, ParticleSystemConfig, SimulationConfig } from "../config/ParticleSystemConfig.js";
import type { DirectionVector, SpawnPosition } from "../types/CommonTypes.js";
import type { ParticleState } from "../types/ParticleState.js";
import { ParticlePool } from "./ParticlePool.js";
import { BoxEmitterModule } from "../modules/emitter/BoxEmitterModule.js";
import { CircleEmitterModule } from "../modules/emitter/CircleEmitterModule.js";
import { DotEmitterModule } from "../modules/emitter/DotEmitterModule.js";
import { ConstantColorModule } from "../modules/color/ConstantColorModule.js";
import { RandomPickColorModule } from "../modules/color/RandomPickColorModule.js";
import { ConstantModule } from "../modules/value/ConstantModule.js";
import { ConeDirectionModule } from "../modules/direction/ConeDirectionModule.js";
import { CurveModule } from "../modules/curve/CurveModule.js";
import { ColorGradientModule } from "../modules/color/ColorGradientModule.js";
import { VectorCurveModule } from "../modules/velocity/VectorCurveModule.js";
import { SpeedOverLifetimeModule } from "../modules/velocity/SpeedOverLifetimeModule.js";
import { BounceModule } from "../modules/velocity/BounceModule.js";
import { TurbulenceForceModule } from "../modules/force/TurbulenceForceModule.js";
import { FlickeringOverLifetimeModule } from "../modules/alpha/FlickeringOverLifetimeModule.js";
import { buildRuntimeConfigFromSerialized } from "./buildRuntimeConfigFromSerialized.js";
import type { IParticleSystem, ParticleSystemRenderer } from "../contracts/IParticleSystem.js";
import type { SerializedConfig, SerializedConfigPatch } from "../config/SerializedConfig.js";
import { mergeSerializedConfig, normalizeSerializedPatch, validateSerializedPatch } from "./mergeSerializedConfig.js";
import { buildRuntimeTextureConfig, createNumberProvider, parseColor } from "./serializedConfigHelpers.js";

export type { SerializedConfig, SerializedConfigPatch } from "../config/SerializedConfig.js";

export class ParticleSystem implements IParticleSystem<ParticleSystemConfig, SerializedConfig, Partial<ParticleSystemConfig>, SerializedConfigPatch> {
    private static readonly PREWARM_WARNING_THRESHOLD = 3;

    public readonly container: Container;
    public readonly particleContainer: ParticleContainer;

    private readonly emitterContainer: Container;
    private readonly particles: Particle[] = [];
    private readonly states: ParticleState[] = [];
    private readonly pool: ParticlePool;
    private readonly tempSpawnPosition: SpawnPosition = { x: 0, y: 0 };
    private readonly tempDirection: DirectionVector = { x: 1, y: 0 };
    private readonly tempVelocityOverLifetime: DirectionVector = { x: 0, y: 0 };
    private readonly tempScaleXYOverLifetime: DirectionVector = { x: 1, y: 1 };
    private readonly tempForce: DirectionVector = { x: 0, y: 0 };
    private readonly screenBoundsProvider = () => this.renderer && "screen" in this.renderer && this.renderer.screen
        ? { x: 0, y: 0, width: this.renderer.screen.width, height: this.renderer.screen.height }
        : undefined;
    private bursts: BurstPointConfig[];
    private nextBurstIndex = 0;
    private textureSequence: Texture[] | null;

    private renderer?: ParticleSystemRenderer;
    private serializedConfig?: SerializedConfig;
    private ownedBuiltinTextures: Texture[] = [];
    private pendingOwnedBuiltinTextures: Texture[] | null = null;

    private elapsed = 0;
    private spawnAccumulator = 0;
    private emittedInitialBurst = false;
    private prewarmed = false;
    private prewarming = false;
    private warnedLargePrewarm = false;
    private playing = true;
    private emitting = true;
    private readonly ticker?: Ticker;
    private readonly tickerListener?: (ticker: Ticker) => void;
    private attachedToTicker = false;

    public constructor(
        private _config: ParticleSystemConfig,
        ticker?: Ticker,
    ) {
        this.ticker = ticker;
        this.tickerListener = ticker ? ((sharedTicker: Ticker) => {
            this.update(sharedTicker.deltaMS / 1000);
        }) : undefined;
        this.container = new Container();
        this.particleContainer = new ParticleContainer({
            dynamicProperties: {
                position: true,
                rotation: true,
                vertex: true,
                color: true,
            },
            boundsArea: this._config.boundsArea ?? new Rectangle(-99999, -99999, 199998, 199998),
        });
        this.emitterContainer = new Container();
        this.pool = new ParticlePool(this._config.maxParticles);
        this.bursts = [...(this._config.emission.bursts ?? [])].sort((a, b) => a.time - b.time);
        this.textureSequence = this._config.textureSequence?.length ? this._config.textureSequence : null;
        this.warnLargePrewarmIfNeeded();

        this.container.addChild(this.emitterContainer);

        if ((this._config.simulationSpace ?? "local") === "local") {
            this.emitterContainer.addChild(this.particleContainer);
        } else {
            this.container.addChild(this.particleContainer);
        }

        this.particleContainer.blendMode = this._config.blendMode as never;

        this.preallocate(this._config.texture);
        this.attachToTickerIfNeeded();
    }


    public static async fromSerializedConfig(config: SerializedConfig, renderer: ParticleSystemRenderer, ticker?: Ticker): Promise<ParticleSystem> {
        const runtimeConfig = await buildRuntimeConfigFromSerialized(config, renderer);
        const system = new ParticleSystem(runtimeConfig, ticker);

        system.renderer = renderer;
        system.serializedConfig = structuredClone(config);

        if (config.texture.source === "builtin") {
            system.ownedBuiltinTextures = [runtimeConfig.texture];
        }

        return system;
    }

    public get config(): ParticleSystemConfig {
        return this._config;
    }

    public setPosition(x: number, y: number): void {
        this.emitterContainer.position.set(x, y);
    }

    public startEmission(): void {
        this.emitting = true;
    }

    public stopEmission(): void {
        this.emitting = false;
    }

    public playBurstByDemand(): void {
        const burstByDemand = this._config.emission.burstByDemand ?? 0;

        if (burstByDemand <= 0) {
            return;
        }

        for (let i = 0; i < burstByDemand; i++) {
            this.spawnParticle();
        }
    }

    public play(emit = true): void {
        if (emit) {
            this.startEmission();
        }

        this.playing = true;
        this.attachToTickerIfNeeded();
    }

    /** Clear particles and replay the effect, including prewarm and all timeline bursts. */
    public restart(): void {
        this.resetSimulationState();
        this.play();
    }

    public updateConfig(partial: Partial<ParticleSystemConfig>, merge = false): void {
        partial = this.sanitizeRuntimeConfigUpdate(partial, merge);

        if (merge) {
            const previousConfig = this._config;
            // Simulation is applied separately so reset checks can compare previous and next state.
            const { simulation: _simulation, ...partialWithoutSimulation } = partial;

            this._config = {
                ...this._config,
                ...partialWithoutSimulation,
                emission: {
                    ...this._config.emission,
                    ...partial.emission,
                },
                modules: {
                    ...this._config.modules,
                    ...partial.modules,
                },
            };

            this.applyRuntimeConfigChanges(partial, previousConfig);

            return;
        }

        this.replaceRuntimeConfig(partial as ParticleSystemConfig);
    }

    public async updateConfigFromSerialized(partial: SerializedConfigPatch, merge = false): Promise<void> {
        validateSerializedPatch(partial);
        partial = this.sanitizeSerializedConfigUpdate(partial, merge);

        if (merge && this.serializedConfig && this.renderer) {
            const nextSerializedConfig = mergeSerializedConfig(this.serializedConfig, partial);
            const runtimeConfig = await buildRuntimeConfigFromSerialized(nextSerializedConfig, this.renderer);
            this.serializedConfig = nextSerializedConfig;

            this.pendingOwnedBuiltinTextures = this.serializedConfig.texture.source === "builtin"
                ? [runtimeConfig.texture]
                : [];

            this.updateConfig(runtimeConfig, false);

            return;
        }

        if (!merge && this.renderer) {
            const nextSerializedConfig = structuredClone(partial as SerializedConfig);
            const runtimeConfig = await buildRuntimeConfigFromSerialized(nextSerializedConfig, this.renderer);
            this.serializedConfig = nextSerializedConfig;

            this.pendingOwnedBuiltinTextures = this.serializedConfig.texture.source === "builtin"
                ? [runtimeConfig.texture]
                : [];

            this.updateConfig(runtimeConfig, false);

            return;
        }

        this.updateConfig(await this.buildRuntimePartialConfigFromSerialized(normalizeSerializedPatch(partial)), merge);
    }

    public stop(emitStop = true, clear = false): void {
        if (emitStop) {
            this.stopEmission();
        }

        this.playing = false;
        this.detachFromTicker();

        if (clear) {
            this.clear();
        }
    }

    public clear(): void {
        while (this.pool.getActiveCount() > 0) {
            this.despawnByActiveListIndex(this.pool.getActiveCount() - 1);
        }
    }

    public destroy(): void {
        this.stop(true, true);
        this.destroyOwnedBuiltinTextures();
        this.container.destroy({ children: true });
    }

    public update(dt: number): void {
        if (!Number.isFinite(dt) || dt <= 0) {
            return;
        }

        if (this.playing && !this.prewarmed && !this.prewarming) {
            this.applyPrewarm();
        }

        if (!this.playing && !this.prewarmed) {
            this.stepParticles(dt);
            return;
        }

        this.stepSimulation(dt);
    }

    private stepSimulation(dt: number): void {
        if (!this.playing) {
            this.stepParticles(dt);
            return;
        }

        const duration = this._config.emission.duration ?? -1;
        if (!Number.isFinite(duration) || duration < 0) {
            this.advanceEmission(dt);
            return;
        }

        // A zero-duration effect can burst once, but cannot form a repeating zero-length loop.
        if (duration === 0) {
            if (this.elapsed === 0) {
                this.emitInitialBurstIfNeeded();
                this.emitTimelineBursts(0, 0);
            }
            this.elapsed += dt;
            this.stepParticles(dt);
            return;
        }

        let remaining = dt;
        while (remaining > 0) {
            if (this.elapsed >= duration) {
                if (!this._config.emission.loop) {
                    this.elapsed += remaining;
                    this.stepParticles(remaining);
                    return;
                }
                this.elapsed = 0;
                this.spawnAccumulator = 0;
                this.emittedInitialBurst = false;
                this.nextBurstIndex = 0;
            }

            const step = Math.min(remaining, duration - this.elapsed);
            this.advanceEmission(step);
            remaining -= step;
        }
    }

    /** Split at timeline events so a burst is only aged for the time after its timestamp. */
    private advanceEmission(dt: number): void {
        const endTime = this.elapsed + dt;
        this.emitInitialBurstIfNeeded();
        this.emitTimelineBursts(this.elapsed, this.elapsed);

        while (this.nextBurstIndex < this.bursts.length && this.bursts[this.nextBurstIndex].time <= endTime) {
            const burstTime = this.bursts[this.nextBurstIndex].time;
            const step = burstTime - this.elapsed;
            this.emitRate(step);
            this.stepParticles(step);
            this.elapsed = burstTime;
            this.emitTimelineBursts(burstTime, burstTime);
        }

        const step = endTime - this.elapsed;
        this.emitRate(step);
        this.stepParticles(step);
        this.elapsed = endTime;
    }

    private stepParticles(dt: number): void {
        let i = 0;

        let sequenceTextureChanged = false;

        while (i < this.pool.getActiveCount()) {
            const particleIndex = this.pool.getActiveIndexAt(i);
            const state = this.states[particleIndex];
            const particle = this.particles[particleIndex];

            state.age += dt;

            if (state.age >= state.lifetime) {
                this.despawnByActiveListIndex(i);
                continue;
            }

            const normalizedLifetime = state.age / state.lifetime;

            if (this._config.modules.speedOverLifetime) {
                const speed = this._config.modules.speedOverLifetime.evaluate(normalizedLifetime, state.speedOverLifetimeRandomOffsets);
                const lengthSq = state.vx * state.vx + state.vy * state.vy;

                if (lengthSq > 0.000000000001) {
                    const invLength = 1 / Math.sqrt(lengthSq);

                    state.directionX = state.vx * invLength;
                    state.directionY = state.vy * invLength;
                }

                state.vx = state.directionX * speed;
                state.vy = state.directionY * speed;
            }

            if (this._config.modules.velocityOverLifetime) {
                this._config.modules.velocityOverLifetime.evaluate(normalizedLifetime, this.tempVelocityOverLifetime);
                state.vx += this.tempVelocityOverLifetime.x * dt;
                state.vy += this.tempVelocityOverLifetime.y * dt;
            }

            if (this._config.modules.gravity) {
                state.vy += this._config.modules.gravity.get() * dt;
            }

            if (this._config.modules.force) {
                this._config.modules.force.evaluate(state.age, state.x, state.y, this.tempForce);
                state.vx += this.tempForce.x * dt;
                state.vy += this.tempForce.y * dt;
            }

            state.x += state.vx * dt;
            state.y += state.vy * dt;

            if (this._config.modules.bounce) {
                const useLocalOffset = (this._config.simulationSpace ?? "local") === "local";
                this._config.modules.bounce.apply(
                    state,
                    useLocalOffset ? this.emitterContainer.x : 0,
                    useLocalOffset ? this.emitterContainer.y : 0,
                );
            }

            state.rotation += state.angularVelocity * dt;

            if (this._config.modules.angleKeepDirection) {
                state.rotation = Math.atan2(state.vy, state.vx);
            }

            particle.x = state.x;
            particle.y = state.y;
            particle.rotation = state.rotation;

            const sizeMultiplier = this._config.modules.sizeOverLifetime?.evaluate(normalizedLifetime) ?? 1;
            const alphaMultiplier = this._config.modules.alphaOverLifetime?.evaluate(normalizedLifetime) ?? 1;
            const size = state.startSize * sizeMultiplier;

            if (this._config.modules.scaleXYOverLifetime) {
                this._config.modules.scaleXYOverLifetime.evaluate(normalizedLifetime, this.tempScaleXYOverLifetime);
            } else {
                this.tempScaleXYOverLifetime.x = 1;
                this.tempScaleXYOverLifetime.y = 1;
            }

            particle.scaleX = size * this.tempScaleXYOverLifetime.x;
            particle.scaleY = size * this.tempScaleXYOverLifetime.y;

            const alpha = state.startAlpha * alphaMultiplier;
            particle.alpha = this._config.modules.flickeringOverLifetime
                ? this._config.modules.flickeringOverLifetime.evaluate(dt, normalizedLifetime, state, alpha)
                : alpha;
            particle.tint = this._config.modules.colorOverLifetime
                ? this._config.modules.colorOverLifetime.evaluate(normalizedLifetime)
                : state.startColor;

            if (this.textureSequence && this.textureSequence.length > 0) {
                const fps = this._config.textureSequenceFps ?? 12;
                const frameIndex = (
                    Math.floor(state.age * fps) + state.sequenceFrameOffset
                ) % this.textureSequence.length;

                if (particle.texture !== this.textureSequence[frameIndex]) {
                    particle.texture = this.textureSequence[frameIndex];
                    sequenceTextureChanged = true;
                }
            }

            i++;
        }

        if (sequenceTextureChanged) {
            this.particleContainer.update();
        }
    }


    private applyPrewarm(): void {
        this.prewarmed = true;

        const prewarm = this.getEffectivePrewarmDuration(this._config.simulation);

        if (prewarm <= 0) {
            return;
        }

        const step = 1 / 60;
        let remaining = prewarm;

        this.prewarming = true;

        try {
            while (remaining > 0) {
                const dt = Math.min(step, remaining);
                this.stepSimulation(dt);
                remaining -= dt;
            }
        } finally {
            this.prewarming = false;
        }
    }

    private getPrewarmDuration(simulation: SimulationConfig | undefined): number {
        const prewarm = simulation?.prewarm;

        if (typeof prewarm === "number") {
            return Math.max(0, prewarm);
        }

        // `prewarm.prewarm` is kept for backward compatibility with older serialized configs.
        return Math.max(0, prewarm?.duration ?? prewarm?.prewarm ?? 0);
    }

    private getEffectivePrewarmDuration(simulation: SimulationConfig | undefined): number {
        return this.getPrewarmDuration(simulation);
    }

    private shouldResetSimulationStateForPrewarm(previousSimulation: SimulationConfig | undefined, nextSimulation: SimulationConfig | undefined): boolean {
        return this.getEffectivePrewarmDuration(previousSimulation) !== this.getEffectivePrewarmDuration(nextSimulation);
    }

    private resetSimulationState(): void {
        this.clear();
        this.elapsed = 0;
        this.spawnAccumulator = 0;
        this.emittedInitialBurst = false;
        this.nextBurstIndex = 0;
        this.prewarmed = false;
        this.prewarming = false;
        this.warnedLargePrewarm = false;
    }

    private warnLargePrewarmIfNeeded(): void {
        const prewarm = this.getEffectivePrewarmDuration(this._config.simulation);

        if (this.warnedLargePrewarm || prewarm <= ParticleSystem.PREWARM_WARNING_THRESHOLD) {
            return;
        }

        this.warnedLargePrewarm = true;
        console.warn(`[ParticleSystem] Large prewarm duration (${prewarm}s) is simulated synchronously and may cause a first-frame stall.`);
    }

    private attachToTickerIfNeeded(): void {
        if (!this.ticker || !this.tickerListener || !this.playing || this.attachedToTicker) {
            return;
        }

        this.ticker.add(this.tickerListener);
        this.attachedToTicker = true;
    }

    private detachFromTicker(): void {
        if (!this.ticker || !this.tickerListener || !this.attachedToTicker) {
            return;
        }

        this.ticker.remove(this.tickerListener);
        this.attachedToTicker = false;
    }

    private preallocate(texture: Texture): void {
        for (let i = 0; i < this._config.maxParticles; i++) {
            const particle = new Particle({
                texture: this.textureSequence?.[0] ?? texture,
                x: 0,
                y: 0,
                scaleX: 0,
                scaleY: 0,
                rotation: 0,
                alpha: 0,
                tint: 0xFFFFFF,
                anchorX: 0.5,
                anchorY: 0.5,
            });

            this.particles.push(particle);
            this.particleContainer.addParticle(particle);
            this.states.push({
                active: false,
                age: 0,
                lifetime: 1,
                x: 0,
                y: 0,
                vx: 0,
                vy: 0,
                directionX: 1,
                directionY: 0,
                rotation: 0,
                angularVelocity: 0,
                startSize: 1,
                startAlpha: 1,
                startColor: 0xFFFFFF,
                sequenceFrameOffset: 0,
                speedOverLifetimeRandomOffsets: [],
                flickeringElapsed: 0,
                flickeringGap: 0.2,
                flickeringFromAlpha: 1,
                flickeringToAlpha: 1,
                flickeringTargetIsMax: true,
            });
        }

        this.particleContainer.update();
    }

    private emitInitialBurstIfNeeded(): void {
        if (!this.emitting) {
            return;
        }

        const burst = this._config.emission.burst ?? 0;

        if (burst <= 0 || this.emittedInitialBurst) {
            return;
        }

        this.emittedInitialBurst = true;

        for (let i = 0; i < burst; i++) {
            this.spawnParticle();
        }
    }

    private emitTimelineBursts(fromTime: number, toTime: number): void {
        while (this.nextBurstIndex < this.bursts.length && this.bursts[this.nextBurstIndex].time < fromTime) {
            this.nextBurstIndex++;
        }

        while (this.nextBurstIndex < this.bursts.length) {
            const burst = this.bursts[this.nextBurstIndex];

            if (burst.time > toTime) {
                break;
            }

            if (this.emitting) {
                for (let i = 0; i < burst.count; i++) {
                    this.spawnParticle();
                }
            }

            this.nextBurstIndex++;
        }
    }

    private emitRate(dt: number): void {
        if (!this.emitting) {
            return;
        }

        const rate = this._config.emission.rate;

        if (!Number.isFinite(rate) || rate <= 0) {
            return;
        }

        this.spawnAccumulator += rate * dt;

        while (this.spawnAccumulator >= 1 - 1e-10) {
            this.spawnAccumulator -= 1;
            this.spawnParticle();
        }
    }

    private spawnParticle(): void {
        const particleIndex = this.pool.acquire();

        if (particleIndex < 0) {
            return;
        }

        const state = this.states[particleIndex];
        const particle = this.particles[particleIndex];

        this._config.modules.emitter.getSpawnPosition(this.tempSpawnPosition);

        if (this._config.modules.direction) {
            this._config.modules.direction.getDirection(this.tempDirection);
        } else {
            this.tempDirection.x = 1;
            this.tempDirection.y = 0;
        }

        const lifetime = Math.max(0.0001, this._config.modules.lifetime.get());
        const speed = this._config.modules.startSpeed?.get() ?? 0;
        const startRotation = this._config.modules.startRotation?.get() ?? 0;
        const angularVelocity = this._config.modules.angularVelocity?.get() ?? 0;
        const startSize = this._config.modules.startSize?.get() ?? 1;
        const startAlpha = this._config.modules.startAlpha?.get() ?? 1;
        const startColor = this._config.modules.startColor?.get() ?? 0xFFFFFF;
        let x = this.tempSpawnPosition.x;
        let y = this.tempSpawnPosition.y;

        if ((this._config.simulationSpace ?? "local") === "world") {
            x += this.emitterContainer.x;
            y += this.emitterContainer.y;
        }

        state.active = true;
        state.age = 0;
        state.lifetime = lifetime;
        state.x = x;
        state.y = y;
        state.vx = this.tempDirection.x * speed;
        state.vy = this.tempDirection.y * speed;
        state.directionX = this.tempDirection.x;
        state.directionY = this.tempDirection.y;
        state.rotation = startRotation;
        state.angularVelocity = angularVelocity;
        state.startSize = startSize;
        state.startAlpha = startAlpha;
        state.startColor = startColor;
        state.sequenceFrameOffset = this.textureSequence && this.textureSequence.length > 0
            ? this._config.textureSequenceRandomStart
                ? Math.floor(Math.random() * this.textureSequence.length)
                : 0
            : 0;
        if (this._config.modules.speedOverLifetime) {
            state.speedOverLifetimeRandomOffsets = this._config.modules.speedOverLifetime.createRandomOffsets(state.speedOverLifetimeRandomOffsets);
        } else {
            state.speedOverLifetimeRandomOffsets.length = 0;
        }

        this._config.modules.flickeringOverLifetime?.initState(state);

        if (this._config.modules.angleKeepDirection) {
            state.rotation = Math.atan2(state.vy, state.vx);
        }

        particle.x = state.x;
        particle.y = state.y;
        particle.rotation = state.rotation;
        particle.scaleX = startSize;
        particle.scaleY = startSize;
        particle.alpha = startAlpha;
        particle.tint = startColor;

        if (this.textureSequence && this.textureSequence.length > 0) {
            particle.texture = this.textureSequence[state.sequenceFrameOffset];
        }
    }

    private despawnByActiveListIndex(activeListIndex: number): void {
        const particleIndex = this.pool.releaseByActiveListIndex(activeListIndex);
        const state = this.states[particleIndex];
        const particle = this.particles[particleIndex];

        state.active = false;
        state.age = 0;
        state.directionX = 1;
        state.directionY = 0;
        state.flickeringElapsed = 0;
        state.flickeringGap = 0.2;
        state.flickeringFromAlpha = 1;
        state.flickeringToAlpha = 1;
        state.flickeringTargetIsMax = true;
        particle.alpha = 0;
        particle.scaleX = 0;
        particle.scaleY = 0;
        particle.tint = 0xFFFFFF;
        if (this.textureSequence && this.textureSequence.length > 0) {
            particle.texture = this.textureSequence[0];
        }
    }

    private applyRuntimeConfigChanges(partial: Partial<ParticleSystemConfig>, previousConfig: ParticleSystemConfig): void {
        const textureChanged = Object.prototype.hasOwnProperty.call(partial, "texture")
            || Object.prototype.hasOwnProperty.call(partial, "textureSequence");
        const previousSimulationSpace = previousConfig.simulationSpace ?? "local";
        const previousSimulation = previousConfig.simulation;

        if (Object.prototype.hasOwnProperty.call(partial, "texture") && partial.texture) {
            this._config.texture = partial.texture;
        }

        if (Object.prototype.hasOwnProperty.call(partial, "textureSequence")) {
            this.textureSequence = partial.textureSequence?.length ? partial.textureSequence : null;
            this._config.textureSequence = partial.textureSequence;
        }

        if (Object.prototype.hasOwnProperty.call(partial, "textureSequenceFps")) {
            this._config.textureSequenceFps = partial.textureSequenceFps;
        }

        if (Object.prototype.hasOwnProperty.call(partial, "textureSequenceRandomStart")) {
            this._config.textureSequenceRandomStart = partial.textureSequenceRandomStart;
        }

        if (partial.emission) {
            if (partial.emission.rate !== undefined) {
                this._config.emission.rate = partial.emission.rate;
                this.spawnAccumulator = 0;
            }

            if (Object.prototype.hasOwnProperty.call(partial.emission, "burst")) {
                this._config.emission.burst = partial.emission.burst;
            }

            if (Object.prototype.hasOwnProperty.call(partial.emission, "burstByDemand")) {
                this._config.emission.burstByDemand = partial.emission.burstByDemand;
            }

            if (Object.prototype.hasOwnProperty.call(partial.emission, "loop")) {
                this._config.emission.loop = partial.emission.loop;
            }

            if (Object.prototype.hasOwnProperty.call(partial.emission, "duration")) {
                this._config.emission.duration = partial.emission.duration;
            }

            if (Object.prototype.hasOwnProperty.call(partial.emission, "bursts")) {
                this._config.emission.bursts = partial.emission.bursts;
                this.bursts = [...(partial.emission.bursts ?? [])].sort((a, b) => a.time - b.time);
                this.resetBurstCursor();
            }
        }

        if (partial.modules) {
            this._config.modules = {
                ...this._config.modules,
                ...partial.modules,
            };
        }

        if (Object.prototype.hasOwnProperty.call(partial, "simulation")) {
            this._config.simulation = partial.simulation
                ? {
                    ...this._config.simulation,
                    ...partial.simulation,
                }
                : undefined;

            if (this.shouldResetSimulationStateForPrewarm(previousSimulation, this._config.simulation)) {
                this.resetSimulationState();
            } else {
                this.warnedLargePrewarm = false;
            }

            this.warnLargePrewarmIfNeeded();
        }

        if (Object.prototype.hasOwnProperty.call(partial, "boundsArea")) {
            this._config.boundsArea = partial.boundsArea;
            this.particleContainer.boundsArea = partial.boundsArea ?? new Rectangle(-99999, -99999, 199998, 199998);
        }

        if (Object.prototype.hasOwnProperty.call(partial, "blendMode")) {
            this._config.blendMode = partial.blendMode;
            this.particleContainer.blendMode = (partial.blendMode ?? "normal") as never;
        }

        if ((this._config.simulationSpace ?? "local") !== previousSimulationSpace) {
            this.updateParticleContainerParent();
        }

        if (textureChanged) {
            this.refreshParticleTextures();
            this.commitPendingOwnedBuiltinTextures();
        }
    }


    private replaceRuntimeConfig(nextConfig: ParticleSystemConfig): void {
        const previousSimulationSpace = this._config.simulationSpace;
        const shouldResetForPrewarm = this.shouldResetSimulationStateForPrewarm(this._config.simulation, nextConfig.simulation);

        this._config = nextConfig;
        this.textureSequence = nextConfig.textureSequence?.length ? nextConfig.textureSequence : null;
        this.bursts = [...(nextConfig.emission.bursts ?? [])].sort((a, b) => a.time - b.time);
        this.resetBurstCursor();
        if (shouldResetForPrewarm) {
            this.resetSimulationState();
        } else {
            this.warnedLargePrewarm = false;
        }

        this.warnLargePrewarmIfNeeded();

        this.particleContainer.boundsArea = nextConfig.boundsArea ?? new Rectangle(-99999, -99999, 199998, 199998);
        this.particleContainer.blendMode = (nextConfig.blendMode ?? "normal") as never;

        const nextSimulationSpace = nextConfig.simulationSpace ?? "local";
        const prevSimulation = previousSimulationSpace ?? "local";

        if (nextSimulationSpace !== prevSimulation) {
            this.updateParticleContainerParent();
        }

        this.refreshParticleTextures();
        this.commitPendingOwnedBuiltinTextures();
    }

    private resetBurstCursor(): void {
        this.nextBurstIndex = 0;
        if (this.elapsed > 0) {
            while (this.nextBurstIndex < this.bursts.length && this.bursts[this.nextBurstIndex].time <= this.elapsed) {
                this.nextBurstIndex++;
            }
        }
    }

    private updateParticleContainerParent(): void {
        const parent = (this._config.simulationSpace ?? "local") === "local"
            ? this.emitterContainer
            : this.container;
        // Pixi removes a child from its previous parent when reparenting it.
        parent.addChild(this.particleContainer);
    }

    private refreshParticleTextures(): void {
        const defaultTexture = this.textureSequence?.[0] ?? this._config.texture;
        // ParticleContainer caches its shared texture on first render.
        this.particleContainer.texture = defaultTexture;

        for (let i = 0; i < this.particles.length; i++) {
            const state = this.states[i];
            const particle = this.particles[i];

            if (!state.active) {
                particle.texture = defaultTexture;
                continue;
            }

            if (this.textureSequence && this.textureSequence.length > 0) {
                const fps = this._config.textureSequenceFps ?? 12;
                const frameIndex = (Math.floor(state.age * fps) + state.sequenceFrameOffset) % this.textureSequence.length;

                particle.texture = this.textureSequence[frameIndex];
            } else {
                particle.texture = this._config.texture;
            }
        }

        this.particleContainer.update();
    }

    private async buildRuntimePartialConfigFromSerialized(partial: Partial<SerializedConfig>): Promise<Partial<ParticleSystemConfig>> {
        const runtimePartial: Partial<ParticleSystemConfig> = {};
        const modulesPartial: Partial<ParticleSystemConfig["modules"]> = {};
        const emissionPartial: Partial<ParticleSystemConfig["emission"]> = {};

        if (partial.name !== undefined) {
            runtimePartial.name = partial.name;
        }

        if (partial.maxParticles !== undefined) {
            runtimePartial.maxParticles = partial.maxParticles;
        }

        if (Object.prototype.hasOwnProperty.call(partial, "simulationSpace")) {
            runtimePartial.simulationSpace = partial.simulationSpace;
        }

        if (Object.prototype.hasOwnProperty.call(partial, "blendMode")) {
            runtimePartial.blendMode = partial.blendMode;
        }

        if (Object.prototype.hasOwnProperty.call(partial, "texture") && partial.texture) {
            const texturePartial = await this.buildRuntimeTexturePartialFromSerialized(partial.texture);

            Object.assign(runtimePartial, texturePartial);
        }

        if (partial.emission) {
            if (partial.emission.rate !== undefined) {
                emissionPartial.rate = partial.emission.rate;
            }

            if (Object.prototype.hasOwnProperty.call(partial.emission, "burst")) {
                emissionPartial.burst = partial.emission.burst;
            }

            if (Object.prototype.hasOwnProperty.call(partial.emission, "burstByDemand")) {
                emissionPartial.burstByDemand = partial.emission.burstByDemand;
            }

            if (Object.prototype.hasOwnProperty.call(partial.emission, "duration")) {
                emissionPartial.duration = partial.emission.duration;
            }

            if (Object.prototype.hasOwnProperty.call(partial.emission, "loop")) {
                emissionPartial.loop = partial.emission.loop;
            }

            if (Object.prototype.hasOwnProperty.call(partial.emission, "bursts")) {
                emissionPartial.bursts = partial.emission.bursts;
            }

            if (Object.prototype.hasOwnProperty.call(partial.emission, "directionMin") || Object.prototype.hasOwnProperty.call(partial.emission, "directionMax")) {
                const currentRange = this.getCurrentDirectionRange();

                modulesPartial.direction = new ConeDirectionModule(
                    partial.emission.directionMin ?? currentRange.min,
                    partial.emission.directionMax ?? currentRange.max,
                );
            }

            if (this.hasEmitterUpdate(partial.emission)) {
                const currentEmitter = this.getCurrentEmitterConfig();
                const emitterType = partial.emission.emitterType ?? currentEmitter.emitterType;
                const emitterX = partial.emission.emitterX ?? currentEmitter.emitterX;
                const emitterY = partial.emission.emitterY ?? currentEmitter.emitterY;
                const emitterWidth = partial.emission.emitterWidth ?? currentEmitter.emitterWidth;
                const emitterHeight = partial.emission.emitterHeight ?? currentEmitter.emitterHeight;
                const emitterRadius = partial.emission.emitterRadius ?? currentEmitter.emitterRadius;
                const emitterAlongShape = partial.emission.emitterAlongShape ?? currentEmitter.emitterAlongShape ?? false;
                const emitterRandomizePosition = partial.emission.emitterRandomizePosition ?? currentEmitter.emitterRandomizePosition ?? 0;

                if (emitterType === "dot") {
                    modulesPartial.emitter = new DotEmitterModule(emitterX, emitterY, emitterRandomizePosition);
                } else if (emitterType === "circle") {
                    modulesPartial.emitter = new CircleEmitterModule(emitterX, emitterY, emitterRadius ?? 0, emitterAlongShape, emitterRandomizePosition);
                } else {
                    modulesPartial.emitter = new BoxEmitterModule(emitterX, emitterY, emitterWidth ?? 0, emitterHeight ?? 0, emitterAlongShape, emitterRandomizePosition);
                }
            }
        }

        if (Object.prototype.hasOwnProperty.call(partial, "simulation")) {
            runtimePartial.simulation = partial.simulation;
        }

        if (partial.base) {
            if (partial.base.lifetime !== undefined) {
                modulesPartial.lifetime = createNumberProvider(partial.base.lifetime);
            }

            if (Object.prototype.hasOwnProperty.call(partial.base, "startSpeed")) {
                modulesPartial.startSpeed = partial.base.startSpeed === undefined ? undefined : createNumberProvider(partial.base.startSpeed);
            }

            if (Object.prototype.hasOwnProperty.call(partial.base, "startRotation")) {
                modulesPartial.startRotation = partial.base.startRotation === undefined ? undefined : createNumberProvider(partial.base.startRotation);
            }

            if (Object.prototype.hasOwnProperty.call(partial.base, "angularVelocity")) {
                modulesPartial.angularVelocity = partial.base.angularVelocity === undefined ? undefined : createNumberProvider(partial.base.angularVelocity);
            }

            if (Object.prototype.hasOwnProperty.call(partial.base, "angleKeepDirection")) {
                modulesPartial.angleKeepDirection = partial.base.angleKeepDirection;
            }

            if (Object.prototype.hasOwnProperty.call(partial.base, "startSize")) {
                modulesPartial.startSize = partial.base.startSize === undefined ? undefined : createNumberProvider(partial.base.startSize);
            }

            if (Object.prototype.hasOwnProperty.call(partial.base, "startAlpha")) {
                modulesPartial.startAlpha = partial.base.startAlpha === undefined ? undefined : createNumberProvider(partial.base.startAlpha);
            }

            if (Object.prototype.hasOwnProperty.call(partial.base, "bounce")) {
                modulesPartial.bounce = partial.base.bounce
                    ? new BounceModule(partial.base.bounce, this.screenBoundsProvider)
                    : undefined;
            }

            if (Object.prototype.hasOwnProperty.call(partial.base, "startColors")) {
                const startColors = partial.base.startColors ?? [];

                if (startColors.length > 0) {
                    const colors = startColors.map(parseColor);

                    modulesPartial.startColor = colors.length === 1
                        ? new ConstantColorModule(colors[0])
                        : new RandomPickColorModule(colors);
                } else {
                    modulesPartial.startColor = undefined;
                }
            }
        }

        if (partial.overLifetime && Object.prototype.hasOwnProperty.call(partial.overLifetime, "size")) {
            modulesPartial.sizeOverLifetime = partial.overLifetime.size?.length
                ? new CurveModule(partial.overLifetime.size)
                : undefined;
        }

        if (partial.overLifetime && Object.prototype.hasOwnProperty.call(partial.overLifetime, "alpha")) {
            modulesPartial.alphaOverLifetime = partial.overLifetime.alpha?.length
                ? new CurveModule(partial.overLifetime.alpha)
                : undefined;
        }

        if (partial.overLifetime && Object.prototype.hasOwnProperty.call(partial.overLifetime, "scaleXY")) {
            modulesPartial.scaleXYOverLifetime = partial.overLifetime.scaleXY
                ? new VectorCurveModule({
                    x: partial.overLifetime.scaleXY.x,
                    y: partial.overLifetime.scaleXY.y,
                })
                : undefined;
        }

        if (partial.overLifetime && Object.prototype.hasOwnProperty.call(partial.overLifetime, "flickering")) {
            modulesPartial.flickeringOverLifetime = partial.overLifetime.flickering
                ? new FlickeringOverLifetimeModule(partial.overLifetime.flickering)
                : undefined;
        }

        if (partial.overLifetime && Object.prototype.hasOwnProperty.call(partial.overLifetime, "color")) {
            modulesPartial.colorOverLifetime = partial.overLifetime.color?.length
                ? new ColorGradientModule(
                    partial.overLifetime.color.map((point) => ({
                        t: point.t,
                        color: parseColor(point.color),
                    })),
                )
                : undefined;
        }

        if (partial.overLifetime && Object.prototype.hasOwnProperty.call(partial.overLifetime, "velocity")) {
            modulesPartial.velocityOverLifetime = partial.overLifetime.velocity
                ? new VectorCurveModule({
                    x: partial.overLifetime.velocity.x,
                    y: partial.overLifetime.velocity.y,
                })
                : undefined;
        }

        if (partial.overLifetime && Object.prototype.hasOwnProperty.call(partial.overLifetime, "speed")) {
            modulesPartial.speedOverLifetime = partial.overLifetime.speed?.curve?.length
                ? new SpeedOverLifetimeModule(partial.overLifetime.speed)
                : undefined;
        }

        if (partial.forces) {
            if (Object.prototype.hasOwnProperty.call(partial.forces, "gravity")) {
                modulesPartial.gravity = partial.forces.gravity !== undefined
                    ? new ConstantModule(partial.forces.gravity)
                    : undefined;
            }

            if (Object.prototype.hasOwnProperty.call(partial.forces, "turbulence")) {
                modulesPartial.force = partial.forces.turbulence
                    ? new TurbulenceForceModule({
                        amplitudeX: partial.forces.turbulence.amplitudeX,
                        amplitudeY: partial.forces.turbulence.amplitudeY,
                        spatialScale: partial.forces.turbulence.spatialScale,
                        timeScale: partial.forces.turbulence.timeScale,
                        seed: partial.forces.turbulence.seed,
                    })
                    : undefined;
            }
        }

        if (Object.keys(emissionPartial).length > 0) {
            runtimePartial.emission = emissionPartial as ParticleSystemConfig["emission"];
        }

        if (Object.keys(modulesPartial).length > 0) {
            runtimePartial.modules = modulesPartial as ParticleSystemConfig["modules"];
        }

        if (Object.prototype.hasOwnProperty.call(partial, "boundsArea")) {
            runtimePartial.boundsArea = partial.boundsArea
                ? new Rectangle(
                    partial.boundsArea.x,
                    partial.boundsArea.y,
                    partial.boundsArea.width,
                    partial.boundsArea.height,
                )
                : undefined;
        }

        return runtimePartial;
    }

    private async buildRuntimeTexturePartialFromSerialized(texture: SerializedConfig["texture"]): Promise<Partial<ParticleSystemConfig>> {
        const textureConfig = buildRuntimeTextureConfig(texture, this.renderer);
        this.pendingOwnedBuiltinTextures = texture.source === "builtin" ? [textureConfig.texture] : [];
        return textureConfig;
    }

    private hasEmitterUpdate(emission: Partial<SerializedConfig["emission"]>): boolean {
        return Object.prototype.hasOwnProperty.call(emission, "emitterType")
            || Object.prototype.hasOwnProperty.call(emission, "emitterX")
            || Object.prototype.hasOwnProperty.call(emission, "emitterY")
            || Object.prototype.hasOwnProperty.call(emission, "emitterWidth")
            || Object.prototype.hasOwnProperty.call(emission, "emitterHeight")
            || Object.prototype.hasOwnProperty.call(emission, "emitterRadius")
            || Object.prototype.hasOwnProperty.call(emission, "emitterAlongShape")
            || Object.prototype.hasOwnProperty.call(emission, "emitterRandomizePosition");
    }

    private getCurrentDirectionRange(): { min: number; max: number } {
        const directionModule = this._config.modules.direction;

        if (directionModule instanceof ConeDirectionModule) {
            const directionData = directionModule as unknown as { minAngleDeg: number; maxAngleDeg: number };

            return {
                min: directionData.minAngleDeg,
                max: directionData.maxAngleDeg,
            };
        }

        return { min: 0, max: 0 };
    }

    private getCurrentEmitterConfig(): {
        emitterType: "dot" | "circle" | "box";
        emitterX: number;
        emitterY: number;
        emitterWidth?: number;
        emitterHeight?: number;
        emitterRadius?: number;
        emitterAlongShape?: boolean;
        emitterRandomizePosition?: number;
    } {
        const emitterModule = this._config.modules.emitter;

        if (emitterModule instanceof DotEmitterModule) {
            const emitterData = emitterModule as unknown as { x: number; y: number; randomizePosition?: number };

            return {
                emitterType: "dot",
                emitterX: emitterData.x,
                emitterY: emitterData.y,
                emitterRandomizePosition: emitterData.randomizePosition ?? 0,
            };
        }

        if (emitterModule instanceof CircleEmitterModule) {
            const emitterData = emitterModule as unknown as { x: number; y: number; radius: number; alongShape?: boolean; randomizePosition?: number };

            return {
                emitterType: "circle",
                emitterX: emitterData.x,
                emitterY: emitterData.y,
                emitterRadius: emitterData.radius,
                emitterAlongShape: emitterData.alongShape ?? false,
                emitterRandomizePosition: emitterData.randomizePosition ?? 0,
            };
        }

        const emitterData = emitterModule as unknown as { x: number; y: number; width: number; height: number; alongShape?: boolean; randomizePosition?: number };

        return {
            emitterType: "box",
            emitterX: emitterData.x,
            emitterY: emitterData.y,
            emitterWidth: emitterData.width,
            emitterHeight: emitterData.height,
            emitterAlongShape: emitterData.alongShape ?? false,
            emitterRandomizePosition: emitterData.randomizePosition ?? 0,
        };
    }

    private sanitizeRuntimeConfigUpdate(partial: Partial<ParticleSystemConfig>, merge: boolean): Partial<ParticleSystemConfig> {
        if (!Object.prototype.hasOwnProperty.call(partial, "maxParticles") || partial.maxParticles === undefined) {
            return partial;
        }

        if (partial.maxParticles !== this._config.maxParticles) {
            console.warn("[ParticleSystem] maxParticles is init-only and will be ignored in runtime update.");
        }

        if (merge) {
            const { maxParticles: _ignored, ...rest } = partial;
            return rest;
        }

        return {
            ...partial,
            maxParticles: this._config.maxParticles,
        };
    }

    private sanitizeSerializedConfigUpdate(partial: SerializedConfigPatch, merge: boolean): SerializedConfigPatch {
        if (!Object.prototype.hasOwnProperty.call(partial, "maxParticles") || partial.maxParticles === undefined) {
            return partial;
        }

        if (partial.maxParticles !== this._config.maxParticles) {
            console.warn("[ParticleSystem] maxParticles is init-only and will be ignored in serialized runtime update.");
        }

        if (merge) {
            const { maxParticles: _ignored, ...rest } = partial;
            return rest;
        }

        return {
            ...partial,
            maxParticles: this._config.maxParticles,
        };
    }

    private commitPendingOwnedBuiltinTextures(): void {
        const referencedTextures = new Set(this.textureSequence ?? [this._config.texture]);
        for (const texture of this.ownedBuiltinTextures) {
            if (!referencedTextures.has(texture)) {
                texture.destroy(true);
            }
        }

        this.ownedBuiltinTextures = [
            ...this.ownedBuiltinTextures.filter((texture) => referencedTextures.has(texture)),
            ...(this.pendingOwnedBuiltinTextures ?? []),
        ];
        this.pendingOwnedBuiltinTextures = null;
    }

    private destroyOwnedBuiltinTextures(): void {
        for (const texture of this.ownedBuiltinTextures) {
            texture.destroy(true);
        }

        this.ownedBuiltinTextures = [];

        if (this.pendingOwnedBuiltinTextures) {
            for (const texture of this.pendingOwnedBuiltinTextures) {
                texture.destroy(true);
            }

            this.pendingOwnedBuiltinTextures = null;
        }
    }


}
