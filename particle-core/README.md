# @particle/core

Modular 2D particle effects for PixiJS 8. Distributed as compiled ESM with TypeScript declarations. PixiJS is a peer dependency.

## Install the local package

```sh
npm install ./particle-core-1.0.5.tgz pixi.js@8.18.1
```

In the full project, `npm run setup` builds this tarball and installs it into the editor. To create just the package from this directory:

```sh
npm ci
npm pack
```

`npm pack` runs the TypeScript build automatically.

## Use an effect

```ts
import { Application, Texture } from "pixi.js";
import {
    ParticleSystem,
    DotEmitterModule,
    ConstantModule,
    RandomRangeModule,
    ConeDirectionModule,
    CurveModule,
} from "@particle/core";

const app = new Application();
await app.init({ resizeTo: window, background: "#151821" });
document.body.appendChild(app.canvas);

const effect = new ParticleSystem({
    name: "fountain",
    texture: Texture.WHITE,
    maxParticles: 500,
    emission: { rate: 100 },
    modules: {
        emitter: new DotEmitterModule(0, 0),
        lifetime: new RandomRangeModule(1, 2),
        startSpeed: new RandomRangeModule(60, 140),
        startSize: new ConstantModule(3),
        direction: new ConeDirectionModule(-110, -70),
        gravity: new ConstantModule(90),
        alphaOverLifetime: new CurveModule([
            { t: 0, value: 1 },
            { t: 1, value: 0 },
        ]),
    },
}, app.ticker);

effect.setPosition(app.screen.width / 2, app.screen.height / 2);
app.stage.addChild(effect.container);

// When the effect is no longer needed:
// effect.destroy();
```

Passing a ticker starts automatic updates. Without a ticker, call `effect.update(dt)` yourself, where `dt` is in **seconds**. Do not use both update mechanisms for the same effect. Cone direction angles use degrees; initial rotation uses radians and angular velocity uses radians per second. Curve positions are normalized lifetime values from 0 to 1.

## Lifecycle

- `play()` resumes playback and enables emission.
- `stop()` pauses playback and detaches the ticker listener; `stop(false)` preserves the emission flag.
- `startEmission()` / `stopEmission()` control emission while existing particles can continue moving.
- `clear()` removes live particles without resetting the emission timeline.
- `restart()` clears particles, resets the emission timeline and prewarm state, and starts again.
- `playBurstByDemand()` emits the configured `burstByDemand` count.
- `destroy()` detaches the ticker and disposes the system and its owned built-in textures.

Textures supplied by the caller remain caller-owned. Destroy them only after every system using them has been removed.

## Load an exported configuration

```ts
import { Assets } from "pixi.js";
import { ParticleSystem, type SerializedConfig } from "@particle/core";

// For raster/sequence configurations, preload each filename as an Assets alias:
// await Assets.load({ alias: "spark.png", src: "/textures/spark.png" });

async function addEffect(config: SerializedConfig) {
    const effect = await ParticleSystem.fromSerializedConfig(
        config,
        app.renderer,
        app.ticker,
    );
    app.stage.addChild(effect.container);
    return effect;
}
```

Built-in texture configurations need no asset preload. Raster and sequence textures must already exist in the Pixi Assets cache under their exported filenames. Validate data from external sources before passing it to the engine; the editor validates its configuration imports.

## Apply an editor diff

`Save for Diff` and `Get Diff` in the editor produce a `SerializedConfigPatch`. Apply it with merge enabled:

```ts
await effect.updateConfigFromSerialized({
    base: { startSpeed: null },
    emission: { rate: 40 },
}, true);
```

`null` removes an optional setting; omitted keys retain their values. Objects merge recursively and arrays replace their previous values. Changing `texture.source` replaces the texture variant. Removing required settings rejects the patch and preserves the previous configuration. Systems created with `fromSerializedConfig` retain the serialized descriptors needed for nested patches; for runtime-created systems, supply complete descriptors when replacing modules.

## Development

```sh
npm run check
npm run build
```

`maxParticles` is the fixed pool capacity chosen at construction. Create a new system to change that capacity. Updating configurations is intended for authoring and occasional runtime changes, not as a per-frame operation.
