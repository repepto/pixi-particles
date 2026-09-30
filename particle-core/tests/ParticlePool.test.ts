import assert from "node:assert/strict";
import { test } from "node:test";
import { ParticlePool } from "../src/system/ParticlePool.js";

test("pool recycles only released indices and keeps dense active membership after middle removal", () => {
    const pool = new ParticlePool(4);
    assert.deepEqual([pool.acquire(), pool.acquire(), pool.acquire(), pool.acquire()], [0, 1, 2, 3]);
    assert.equal(pool.acquire(), -1);
    assert.equal(pool.getActiveCount(), 4);

    const released = pool.releaseByActiveListIndex(1);
    assert.equal(released, 1);
    assert.deepEqual(Array.from({ length: pool.getActiveCount() }, (_, index) => pool.getActiveIndexAt(index)), [0, 3, 2]);
    assert.equal(pool.acquire(), released);
    assert.equal(pool.getActiveCount(), 4);
    assert.equal(new Set(Array.from({ length: 4 }, (_, index) => pool.getActiveIndexAt(index))).size, 4);

    while (pool.getActiveCount() > 0) pool.releaseByActiveListIndex(0);
    assert.equal(pool.getActiveCount(), 0);
    const recycled = [pool.acquire(), pool.acquire(), pool.acquire(), pool.acquire()];
    assert.deepEqual(recycled.sort(), [0, 1, 2, 3]);
    assert.equal(pool.acquire(), -1);
});
