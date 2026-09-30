import JSZip from "jszip";
import { parseSerializedConfig, type EditorSerializedConfig } from "./serialization";

/** Reserve every generated name, including suffixes and case-only collisions. */
export function createUniqueConfigFileNames(names: readonly string[]): string[] {
    const reserved = new Set<string>();
    return names.map((name) => {
        const base = (name.trim() || "particle system").replace(/[\\/:*?"<>|\x00-\x1f]+/g, "_").replace(/\.+$/, "_");
        let candidate = base;
        let suffix = 2;
        while (reserved.has(candidate.toLowerCase())) candidate = `${base} (${suffix++})`;
        reserved.add(candidate.toLowerCase());
        return `${candidate}.json`;
    });
}

export function createConfigArchive(configs: readonly Record<string, unknown>[]): JSZip {
    const zip = new JSZip();
    const fileNames = createUniqueConfigFileNames(configs.map((config) => typeof config.name === "string" ? config.name : "particle system"));
    configs.forEach((config, index) => zip.file(fileNames[index], JSON.stringify(config, null, 4)));
    return zip;
}

/** Nothing is returned until every JSON entry has parsed and passed validation. */
export async function readConfigArchive(data: Blob | ArrayBuffer | Uint8Array): Promise<EditorSerializedConfig[]> {
    const zip = await JSZip.loadAsync(data);
    const entries = Object.values(zip.files)
        .filter((entry) => !entry.dir && /\.json$/i.test(entry.name) && !entry.name.startsWith("__MACOSX/"))
        .sort((a, b) => a.name.localeCompare(b.name));
    if (!entries.length) throw new Error("The archive contains no JSON particle configurations.");
    return Promise.all(entries.map(async (entry) => {
        try {
            return parseSerializedConfig(JSON.parse(await entry.async("text")), entry.name);
        } catch (error) {
            throw new Error(`Cannot import ${entry.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }));
}
