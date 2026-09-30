export class ParticlePool {
    private readonly freeIndices: number[] = [];
    private readonly activeIndices: number[] = [];

    public constructor(size: number) {
        for (let i = 0; i < size; i++) {
            this.freeIndices.push(size - 1 - i);
        }
    }

    public acquire(): number {
        if (this.freeIndices.length === 0) {
            return -1;
        }

        const particleIndex = this.freeIndices.pop() as number;

        this.activeIndices.push(particleIndex);

        return particleIndex;
    }

    public releaseByActiveListIndex(activeListIndex: number): number {
        const particleIndex = this.activeIndices[activeListIndex];
        const lastIndex = this.activeIndices.length - 1;

        this.activeIndices[activeListIndex] = this.activeIndices[lastIndex];
        this.activeIndices.pop();
        this.freeIndices.push(particleIndex);

        return particleIndex;
    }

    public getActiveCount(): number {
        return this.activeIndices.length;
    }

    public getActiveIndexAt(index: number): number {
        return this.activeIndices[index];
    }
}
