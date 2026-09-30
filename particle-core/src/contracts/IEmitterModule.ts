import type { SpawnPosition } from "../types/CommonTypes.js";

export type IEmitterModule = {
    getSpawnPosition(out: SpawnPosition): void;
};
