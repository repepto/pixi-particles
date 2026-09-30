import { Rectangle, Texture } from "pixi.js";

export type UploadedTextureAsset = {
    texture: Texture;
    textures: Texture[];
    fileNames: string[];
    isSequence: boolean;
    destroy(): void;
};

export async function loadTextureAssetFromFiles(files: File[]): Promise<UploadedTextureAsset> {
    if (files.length === 0) {
        throw new Error("Select at least one texture image.");
    }

    const normalizedFiles = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));

    if (normalizedFiles.length <= 1) {
        return createSingleTextureAsset(normalizedFiles[0]);
    }

    return createSequenceTextureAsset(normalizedFiles);
}

async function createSingleTextureAsset(file: File): Promise<UploadedTextureAsset> {
    const objectUrl = URL.createObjectURL(file);

    try {
        const image = await loadImage(objectUrl);
        const texture = Texture.from(image);
        let destroyed = false;

        return {
            texture,
            textures: [texture],
            fileNames: [file.name],
            isSequence: false,
            destroy(): void {
                if (destroyed) {
                    return;
                }

                destroyed = true;
                texture.destroy(true);
            },
        };
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}

async function createSequenceTextureAsset(files: File[]): Promise<UploadedTextureAsset> {
    const frames = await Promise.all(files.map(loadFrameImage));
    const frameWidth = Math.max(...frames.map((frame) => frame.width));
    const frameHeight = Math.max(...frames.map((frame) => frame.height));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
        throw new Error("Failed to create 2D canvas context.");
    }

    canvas.width = frameWidth * frames.length;
    canvas.height = frameHeight;

    for (let index = 0; index < frames.length; index++) {
        const image = frames[index];
        const offsetX = index * frameWidth + (frameWidth - image.width) * 0.5;
        const offsetY = (frameHeight - image.height) * 0.5;
        context.drawImage(image, offsetX, offsetY);
    }

    const atlasTexture = Texture.from(canvas);
    const textures = frames.map((_, index) => new Texture({
        source: atlasTexture.source,
        frame: new Rectangle(index * frameWidth, 0, frameWidth, frameHeight),
    }));
    let destroyed = false;

    return {
        texture: textures[0],
        textures,
        fileNames: files.map((file) => file.name),
        isSequence: true,
        destroy(): void {
            if (destroyed) {
                return;
            }

            destroyed = true;

            // Every frame shares the atlas source; release it once after the views.
            for (const texture of textures) {
                texture.destroy(false);
            }

            atlasTexture.destroy(true);
        },
    };
}

async function loadFrameImage(file: File): Promise<HTMLImageElement> {
    const objectUrl = URL.createObjectURL(file);

    try {
        return await loadImage(objectUrl);
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();

        image.onload = () => {
            resolve(image);
        };

        image.onerror = () => {
            reject(new Error("Failed to load image."));
        };

        image.src = src;
    });
}
