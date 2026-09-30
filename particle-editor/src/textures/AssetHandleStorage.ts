const DB_NAME = "particle-editor-assets";
const HANDLE_STORE_NAME = "handles";
const FILE_STORE_NAME = "files";
const DB_VERSION = 2;

export async function saveDirectoryHandle(key: string, handle: FileSystemDirectoryHandle): Promise<void> {
    const db = await openDb();

    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(HANDLE_STORE_NAME, "readwrite");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("Failed to save directory handle."));
        tx.objectStore(HANDLE_STORE_NAME).put(handle, key);
    });

    db.close();
}

export async function getDirectoryHandle(key: string): Promise<FileSystemDirectoryHandle | null> {
    const db = await openDb();

    const handle = await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
        const tx = db.transaction(HANDLE_STORE_NAME, "readonly");
        const request = tx.objectStore(HANDLE_STORE_NAME).get(key);

        request.onsuccess = () => {
            resolve((request.result as FileSystemDirectoryHandle | undefined) ?? null);
        };
        request.onerror = () => reject(request.error ?? new Error("Failed to read directory handle."));
    });

    db.close();
    return handle;
}

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;

            if (!db.objectStoreNames.contains(HANDLE_STORE_NAME)) {
                db.createObjectStore(HANDLE_STORE_NAME);
            }

            if (!db.objectStoreNames.contains(FILE_STORE_NAME)) {
                db.createObjectStore(FILE_STORE_NAME);
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB."));
    });
}


export async function saveTextureFiles(key: string, files: File[]): Promise<void> {
    const db = await openDb();

    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(FILE_STORE_NAME, "readwrite");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("Failed to save texture files."));
        tx.objectStore(FILE_STORE_NAME).put(files, key);
    });

    db.close();
}

export async function getTextureFiles(key: string): Promise<File[] | null> {
    const db = await openDb();

    const files = await new Promise<File[] | null>((resolve, reject) => {
        const tx = db.transaction(FILE_STORE_NAME, "readonly");
        const request = tx.objectStore(FILE_STORE_NAME).get(key);

        request.onsuccess = () => {
            const result = request.result as File[] | undefined;
            resolve(Array.isArray(result) ? result : null);
        };
        request.onerror = () => reject(request.error ?? new Error("Failed to read texture files."));
    });

    db.close();
    return files;
}
