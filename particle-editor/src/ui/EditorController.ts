import type { CurvePoint } from "pixi-particle";
import { createConfigArchive, readConfigArchive } from "../config/archive";
import { buildConfigDiff, getExpectedTextureNames, parseSerializedConfig, toEditorConfig, type EditorSerializedConfig } from "../config/serialization";
import { createDefaultEditorConfig } from "../config/defaults";
import { buildSerializableConfig } from "../config/runtime";
import type { ColorKeyPoint, EditorConfig, TimelineBurstPoint } from "../config/types";
import { PreviewController } from "../preview/PreviewController";
import { getDirectoryHandle, getTextureFiles, saveDirectoryHandle, saveTextureFiles } from "../textures/AssetHandleStorage";
import { loadTextureAssetFromFiles, type UploadedTextureAsset } from "../textures/RasterTextureLoader";
import { getById, getInputChecked, getInputNumber, getInputValue } from "../utils/dom";
import { createEditorLayout } from "./template";

const OPTIONAL_IDS = [
    "enableBurst",
    "enableBurstByDemand",
    "enableDurationLoop",
    "enableTimelineBursts",
    "enablePrewarm",
    "enableStartSpeed",
    "enableSpeedOverLifetime",
    "enableStartRotation",
    "enableAngularVelocity",
    "enableStartSize",
    "enableStartAlpha",
    "enableStartColor",
    "enableBounce",
    "enableSizeOverLifetime",
    "enableAlphaOverLifetime",
    "enableScaleXYOverLifetime",
    "enableFlickeringOverLifetime",
    "enableColorOverLifetime",
    "enableVelocityOverLifetime",
    "enableGravity",
    "enableForce",
] as const;

type ParticleSystemListEntry = {
    id: string;
    name: string;
    enabled: boolean;
    config: EditorConfig;
    uploadedTextureAsset: UploadedTextureAsset | null;
    uploadedTextureFolderKey: string | null;
};

export class EditorController {
    private previewBackgroundUrl: string | null = null;
    private config: EditorConfig;
    private readonly preview: PreviewController;
    private uploadedTextureAsset: UploadedTextureAsset | null = null;
    private uploadedTextureFolderKey: string | null = null;
    private readonly systems: ParticleSystemListEntry[];
    private currentSystemId: string;
    private configForDiff: EditorSerializedConfig | null = null;
    private importInProgress = false;
    private textureOperation = 0;

    public constructor(private readonly root: HTMLElement) {
        const initialSystem = this.createSystemEntry();
        this.systems = [initialSystem];
        this.currentSystemId = initialSystem.id;
        this.config = initialSystem.config;
        this.uploadedTextureAsset = initialSystem.uploadedTextureAsset;
        this.uploadedTextureFolderKey = initialSystem.uploadedTextureFolderKey;
        this.root.innerHTML = createEditorLayout(this.config);
        this.preview = new PreviewController(getById("canvasArea"), getById("canvasWrap"), () => this.currentSystemId);
        this.initStaticValues();
        this.attachEvents();
        this.renderDynamicEditors();
        this.syncVisibility();
        this.renderSystemsPanel();
    }

    public async init(): Promise<void> {
        await this.preview.init();
        await this.applyConfig();
    }

    private initStaticValues(): void {
        getById<HTMLSelectElement>("textureKind").value = this.config.textureKind;
        getById<HTMLSelectElement>("emitterType").value = this.config.emitterType;
        getById<HTMLSelectElement>("blendMode").value = this.config.blendMode;
        getById<HTMLSelectElement>("lifetimeMode").value = this.config.lifetimeMode;
        getById<HTMLSelectElement>("startSpeedMode").value = this.config.startSpeedMode;
        getById<HTMLSelectElement>("startRotationMode").value = this.config.startRotationMode;
        getById<HTMLSelectElement>("angularVelocityMode").value = this.config.angularVelocityMode;
        getById<HTMLSelectElement>("startSizeMode").value = this.config.startSizeMode;
        getById<HTMLSelectElement>("startAlphaMode").value = this.config.startAlphaMode;
        const sequenceRandomStartInput = document.getElementById("sequenceRandomStart") as HTMLInputElement | null;
        if (sequenceRandomStartInput) {
            sequenceRandomStartInput.checked = this.config.sequenceRandomStart;
        }
        const sequenceFrameRateInput = document.getElementById("sequenceFrameRate") as HTMLInputElement | null;
        if (sequenceFrameRateInput) {
            sequenceFrameRateInput.value = String(this.config.sequenceFrameRate);
        }
    }

    private attachEvents(): void {
        this.root.addEventListener("click", (event) => {
            const target = event.target as HTMLElement;
            const removeSystemId = target.dataset.removeSystemId;

            if (target.id === "addSystemButton") {
                this.run(this.handleAddSystem());
                return;
            }

            if (removeSystemId) {
                this.run(this.handleRemoveSystem(removeSystemId));
                return;
            }

            const systemElement = target.closest<HTMLElement>("[data-system-id]");

            if (systemElement && !target.closest("input") && !target.closest("button")) {
                this.switchCurrentSystem(systemElement.dataset.systemId ?? "");
                return;
            }

            if ((target.id.startsWith("add") && target.id.endsWith("Button")) || target.dataset.removeKind) {
                // Rendering any dynamic editor must retain edits in every other group.
                this.syncDynamicStateFromInputs();
            }

            if (target.id === "addTimelineBurstButton") {
                this.config.timelineBursts.push({ time: 0, count: 10 });
                this.renderTimelineBurstEditor();
                return;
            }

            if (target.id === "addStartColorButton") {
                this.config.startColors = this.readStartColorInputs();
                this.config.startColors.push("#FFFFFF");
                this.renderStartColorEditor();
                return;
            }

            if (target.id === "addSizeCurveButton") {
                this.config.sizeCurve.push({ t: 1, value: 1 });
                this.renderCurveEditor("sizeCurveEditor", this.config.sizeCurve, "sizeCurve");
                return;
            }

            if (target.id === "addSpeedCurveButton") {
                this.config.speedCurve = this.readSpeedCurveInputs();
                this.config.speedCurve.push({ t: 1, value: 0, randomOffset: 0 });
                this.renderSpeedCurveEditor();
                return;
            }

            if (target.id === "addAlphaCurveButton") {
                this.config.alphaCurve.push({ t: 1, value: 1 });
                this.renderCurveEditor("alphaCurveEditor", this.config.alphaCurve, "alphaCurve");
                return;
            }

            if (target.id === "addColorCurveButton") {
                this.config.colorCurve = this.readColorCurveInputs();
                this.config.colorCurve.push({ t: 1, color: "#FFFFFF" });
                this.renderColorCurveEditor();
                return;
            }

            if (target.id === "addScaleXCurveButton") {
                this.config.scaleXCurve.push({ t: 1, value: 1 });
                this.renderCurveEditor("scaleXCurveEditor", this.config.scaleXCurve, "scaleXCurve");
                return;
            }

            if (target.id === "addScaleYCurveButton") {
                this.config.scaleYCurve.push({ t: 1, value: 1 });
                this.renderCurveEditor("scaleYCurveEditor", this.config.scaleYCurve, "scaleYCurve");
                return;
            }

            if (target.id === "addVelocityXKeyButton") {
                this.config.velocityXCurve.push({ t: 1, value: 0 });
                this.renderCurveEditor("velocityXCurveEditor", this.config.velocityXCurve, "velocityXCurve");
                return;
            }

            if (target.id === "addVelocityYKeyButton") {
                this.config.velocityYCurve.push({ t: 1, value: 0 });
                this.renderCurveEditor("velocityYCurveEditor", this.config.velocityYCurve, "velocityYCurve");
                return;
            }

            const removeIndex = target.dataset.removeIndex;
            const removeKind = target.dataset.removeKind;

            if (removeIndex === undefined || !removeKind) {
                return;
            }

            const index = Number(removeIndex);
            const list = this.getDynamicList(removeKind);

            if (list.length <= 1) {
                return;
            }

            list.splice(index, 1);
            this.renderDynamicEditors();
        });

        this.root.addEventListener("change", (event) => {
            const target = event.target as HTMLInputElement | HTMLSelectElement;
            const systemEnabledId = target.dataset.systemEnabledId;
            const systemNameId = target.dataset.systemNameId;

            if (systemEnabledId) {
                const system = this.getSystemById(systemEnabledId);

                if (system) {
                    system.enabled = (target as HTMLInputElement).checked;
                    this.preview.setEnabled(system.id, system.enabled);
                    this.renderSystemsPanel();
                }

                return;
            }

            if (systemNameId) {
                const system = this.getSystemById(systemNameId);

                if (system) {
                    system.name = target.value || "particle system";
                    system.config.name = system.name;
                }

                return;
            }

            if (target.id === "textureUpload") {
                this.run(this.handleTextureUpload());
                return;
            }

            if (target.id === "sequenceRandomStart") {
                this.config.sequenceRandomStart = getInputChecked("sequenceRandomStart");

                if (this.uploadedTextureAsset?.isSequence) {
                    this.run(this.applyConfig());
                }

                this.syncVisibility();
                return;
            }

            if (target.id === "sequenceFrameRate") {
                this.config.sequenceFrameRate = Math.max(1, Number(getInputValue("sequenceFrameRate")) || 1);

                if (this.uploadedTextureAsset?.isSequence) {
                    this.run(this.applyConfig());
                }

                this.syncVisibility();
                return;
            }

            if (OPTIONAL_IDS.includes(target.id as typeof OPTIONAL_IDS[number]) || target.id.endsWith("Mode") || target.id === "emitterType") {
                this.syncVisibility();
            }
        });

        getById<HTMLButtonElement>("applyConfigButton").addEventListener("click", () => {
            this.run(this.applyConfig());
        });
        getById<HTMLButtonElement>("resetTextureButton").addEventListener("click", () => {
            this.run(this.resetUploadedTexture());
        });
        getById<HTMLButtonElement>("saveForDiffButton").addEventListener("click", () => {
            this.syncDynamicStateFromInputs();
            this.syncStaticStateFromInputs();
            this.configForDiff = buildSerializableConfig(this.config, this.getUploadedTextureInfo());
        });
        getById<HTMLButtonElement>("getConfigButton").addEventListener("click", () => {
            this.syncDynamicStateFromInputs();
            this.syncStaticStateFromInputs();
            const output = buildSerializableConfig(this.config, this.getUploadedTextureInfo());
            getById<HTMLElement>("configOutput").textContent = JSON.stringify(output, null, 4);
            getById<HTMLElement>("configOutputPanel").hidden = false;
        });
        getById<HTMLButtonElement>("getDiffButton").addEventListener("click", () => {
            this.syncDynamicStateFromInputs();
            this.syncStaticStateFromInputs();
            const currentConfig = buildSerializableConfig(this.config, this.getUploadedTextureInfo());
            const diff = buildConfigDiff(this.configForDiff, currentConfig);
            getById<HTMLElement>("configOutput").textContent = JSON.stringify(diff ?? {}, null, 4);
            getById<HTMLElement>("configOutputPanel").hidden = false;
        });
        getById<HTMLButtonElement>("loadConfigButton").addEventListener("click", () => {
            getById<HTMLInputElement>("loadConfigInput").click();
        });
        getById<HTMLInputElement>("loadConfigInput").addEventListener("change", () => {
            this.run(this.handleLoadConfig());
        });
        getById<HTMLButtonElement>("getConfigsButton").addEventListener("click", () => {
            this.run(this.handleGetConfigs());
        });
        getById<HTMLButtonElement>("loadConfigsZipButton").addEventListener("click", () => {
            getById<HTMLInputElement>("loadConfigsZipInput").click();
        });
        getById<HTMLInputElement>("loadConfigsZipInput").addEventListener("change", () => {
            this.run(this.handleLoadConfigsFromZip());
        });
        getById<HTMLButtonElement>("setBackgroundButton").addEventListener("click", () => {
            getById<HTMLInputElement>("backgroundUploadInput").click();
        });
        getById<HTMLInputElement>("backgroundUploadInput").addEventListener("change", () => {
            this.handleBackgroundUpload();
        });
        getById<HTMLButtonElement>("clearBackgroundButton").addEventListener("click", () => {
            this.clearBackground();
        });
        getById<HTMLButtonElement>("copyConfigButton").addEventListener("click", async () => {
            const text = getById<HTMLElement>("configOutput").textContent ?? "";

            if (!text) {
                return;
            }

            await navigator.clipboard.writeText(text);
        });
        getById<HTMLButtonElement>("clearConfigButton").addEventListener("click", () => {
            getById<HTMLElement>("configOutput").textContent = "";
            getById<HTMLElement>("configOutputPanel").hidden = true;
        });
        getById<HTMLButtonElement>("playButton").addEventListener("click", () => this.preview.play(this.currentSystemId));
        getById<HTMLButtonElement>("stopButton").addEventListener("click", () => this.preview.stop(this.currentSystemId));
        getById<HTMLButtonElement>("playAllButton").addEventListener("click", () => this.preview.playAll());
        getById<HTMLButtonElement>("stopAllButton").addEventListener("click", () => this.preview.stopAll());
        getById<HTMLButtonElement>("clearButton").addEventListener("click", () => this.preview.clear());

        const canvasWrap = getById<HTMLElement>("canvasWrap");
        const dropOverlay = getById<HTMLElement>("dropOverlay");

        canvasWrap.addEventListener("dragover", (event) => {
            event.preventDefault();
            dropOverlay.classList.add("visible");
        });
        canvasWrap.addEventListener("dragleave", () => {
            dropOverlay.classList.remove("visible");
        });
        canvasWrap.addEventListener("drop", (event) => {
            event.preventDefault();
            dropOverlay.classList.remove("visible");
            const files = [...(event.dataTransfer?.files ?? [])].filter((file) => this.isSupportedTextureFile(file));

            if (files.length === 0) {
                return;
            }

            const input = getById<HTMLInputElement>("textureUpload");
            const transfer = new DataTransfer();

            for (const file of files) {
                transfer.items.add(file);
            }

            input.files = transfer.files;
            this.run(this.handleTextureUpload());
        });
    }

    private async handleTextureUpload(): Promise<void> {
        if (this.importInProgress) return;
        const fileInput = getById<HTMLInputElement>("textureUpload");
        const files = [...(fileInput.files ?? [])].filter((file) => this.isSupportedTextureFile(file));
        if (!files.length) return;
        this.syncDynamicStateFromInputs();
        this.syncStaticStateFromInputs();
        const system = this.getCurrentSystem();
        const operation = ++this.textureOperation;
        let stagedAsset: UploadedTextureAsset | null = null;
        try {
            const folderKey = this.createTextureFolderKey(files);
            await saveTextureFiles(folderKey, files);
            const capturedFolderKey = await this.captureTextureDirectoryHandle(files, folderKey);
            stagedAsset = await loadTextureAssetFromFiles(files);
            if (operation !== this.textureOperation || !this.getSystemById(system.id)) return;
            await this.preview.applyConfig(system.id, system.config, stagedAsset);
            const oldAsset = system.uploadedTextureAsset;
            system.uploadedTextureAsset = stagedAsset;
            system.uploadedTextureFolderKey = capturedFolderKey ?? folderKey;
            stagedAsset = null;
            oldAsset?.destroy();
            this.preview.setEnabled(system.id, system.enabled);
            if (this.currentSystemId === system.id) {
                this.uploadedTextureAsset = system.uploadedTextureAsset;
                this.uploadedTextureFolderKey = system.uploadedTextureFolderKey;
                this.syncVisibility();
            }
        } finally {
            stagedAsset?.destroy();
        }
    }

    private async resetUploadedTexture(): Promise<void> {
        if (this.importInProgress) return;
        ++this.textureOperation;
        this.syncDynamicStateFromInputs();
        this.syncStaticStateFromInputs();
        const system = this.getCurrentSystem();
        const oldAsset = system.uploadedTextureAsset;
        await this.preview.applyConfig(system.id, system.config, null);
        const fileInput = getById<HTMLInputElement>("textureUpload");
        fileInput.value = "";
        this.setCurrentUploadedTexture(null, null);
        oldAsset?.destroy();
        this.preview.setEnabled(system.id, system.enabled);
        this.syncVisibility();
    }

    private async applyConfig(): Promise<void> {
        this.syncDynamicStateFromInputs();
        this.syncStaticStateFromInputs();
        const currentSystem = this.getCurrentSystem();
        await this.preview.applyConfig(currentSystem.id, this.config, this.uploadedTextureAsset);
        this.preview.setEnabled(currentSystem.id, currentSystem.enabled);
        this.syncVisibility();
    }

    private syncStaticStateFromInputs(): void {
        this.config.maxParticles = getInputNumber("maxParticles");
        this.config.simulationSpace = getInputValue("simulationSpace") as EditorConfig["simulationSpace"];
        this.config.textureKind = getInputValue("textureKind") as EditorConfig["textureKind"];
        this.config.emitterType = getInputValue("emitterType") as EditorConfig["emitterType"];
        this.config.emitterX = getInputNumber("emitterX");
        this.config.emitterY = getInputNumber("emitterY");
        this.config.emitterWidth = getInputNumber("emitterWidth");
        this.config.emitterHeight = getInputNumber("emitterHeight");
        this.config.emitterRadius = getInputNumber("emitterRadius");
        this.config.emitterAlongShape = Boolean((document.getElementById("emitterAlongShape") as HTMLInputElement | null)?.checked);
        this.config.emitterRandomizePosition = getInputNumber("emitterRandomizePosition");
        this.config.rate = getInputNumber("rate");
        this.config.directionMin = getInputNumber("directionMin");
        this.config.directionMax = getInputNumber("directionMax");
        this.config.enablePrewarm = getInputChecked("enablePrewarm");
        this.config.prewarm = getInputNumber("prewarm");
        this.config.blendMode = getInputValue("blendMode") as EditorConfig["blendMode"];
        this.config.sequenceRandomStart = Boolean((document.getElementById("sequenceRandomStart") as HTMLInputElement | null)?.checked);
        this.config.enableBurst = getInputChecked("enableBurst");
        this.config.burst = getInputNumber("burst");
        this.config.enableBurstByDemand = getInputChecked("enableBurstByDemand");
        this.config.burstByDemand = getInputNumber("burstByDemand");
        this.config.enableDurationLoop = getInputChecked("enableDurationLoop");
        this.config.duration = getInputNumber("duration");
        this.config.loop = getInputValue("loop") === "true";
        this.config.enableTimelineBursts = getInputChecked("enableTimelineBursts");
        this.config.lifetimeMode = getInputValue("lifetimeMode") as EditorConfig["lifetimeMode"];
        this.config.lifetimeConst = getInputNumber("lifetimeConst");
        this.config.lifetimeMin = getInputNumber("lifetimeMin");
        this.config.lifetimeMax = getInputNumber("lifetimeMax");
        this.config.enableStartSpeed = getInputChecked("enableStartSpeed");
        this.config.enableSpeedOverLifetime = getInputChecked("enableSpeedOverLifetime");
        this.config.speedOverLifetimeFade = getInputChecked("speedOverLifetimeFade");
        this.config.startSpeedMode = getInputValue("startSpeedMode") as EditorConfig["startSpeedMode"];
        this.config.speedConst = getInputNumber("speedConst");
        this.config.speedMin = getInputNumber("speedMin");
        this.config.speedMax = getInputNumber("speedMax");
        this.config.enableStartRotation = getInputChecked("enableStartRotation");
        this.config.startRotationMode = getInputValue("startRotationMode") as EditorConfig["startRotationMode"];
        this.config.rotationConst = getInputNumber("rotationConst");
        this.config.rotationMin = getInputNumber("rotationMin");
        this.config.rotationMax = getInputNumber("rotationMax");
        this.config.enableAngularVelocity = getInputChecked("enableAngularVelocity");
        this.config.angularVelocityMode = getInputValue("angularVelocityMode") as EditorConfig["angularVelocityMode"];
        this.config.angularVelocityConst = getInputNumber("angularVelocityConst");
        this.config.angularVelocityMin = getInputNumber("angularVelocityMin");
        this.config.angularVelocityMax = getInputNumber("angularVelocityMax");
        this.config.angleKeepDirection = getInputChecked("angleKeepDirection");
        this.config.enableStartSize = getInputChecked("enableStartSize");
        this.config.startSizeMode = getInputValue("startSizeMode") as EditorConfig["startSizeMode"];
        this.config.sizeConst = getInputNumber("sizeConst");
        this.config.sizeMin = getInputNumber("sizeMin");
        this.config.sizeMax = getInputNumber("sizeMax");
        this.config.enableStartAlpha = getInputChecked("enableStartAlpha");
        this.config.startAlphaMode = getInputValue("startAlphaMode") as EditorConfig["startAlphaMode"];
        this.config.alphaConst = getInputNumber("alphaConst");
        this.config.alphaMin = getInputNumber("alphaMin");
        this.config.alphaMax = getInputNumber("alphaMax");
        this.config.enableStartColor = getInputChecked("enableStartColor");
        this.config.enableBounce = getInputChecked("enableBounce");
        this.config.bounceMode = getInputValue("bounceMode") as EditorConfig["bounceMode"];
        this.config.bounceBoxX = getInputNumber("bounceBoxX");
        this.config.bounceBoxY = getInputNumber("bounceBoxY");
        this.config.bounceBoxWidth = getInputNumber("bounceBoxWidth");
        this.config.bounceBoxHeight = getInputNumber("bounceBoxHeight");
        this.config.bounceDampingMin = getInputNumber("bounceDampingMin");
        this.config.bounceDampingMax = getInputNumber("bounceDampingMax");
        this.config.enableSizeOverLifetime = getInputChecked("enableSizeOverLifetime");
        this.config.enableAlphaOverLifetime = getInputChecked("enableAlphaOverLifetime");
        this.config.enableScaleXYOverLifetime = getInputChecked("enableScaleXYOverLifetime");
        this.config.enableFlickeringOverLifetime = getInputChecked("enableFlickeringOverLifetime");
        this.config.flickeringGap = getInputNumber("flickeringGap");
        this.config.flickeringMin = getInputNumber("flickeringMin");
        this.config.flickeringMax = getInputNumber("flickeringMax");
        this.config.flickeringRandomGapOffset = getInputNumber("flickeringRandomGapOffset");
        this.config.flickeringRandomMinMaxOffset = getInputNumber("flickeringRandomMinMaxOffset");
        this.config.flickeringFade = getInputChecked("flickeringFade");
        this.config.flickeringStartTime = getInputNumber("flickeringStartTime");
        this.config.flickeringEndTime = getInputNumber("flickeringEndTime");
        this.config.enableColorOverLifetime = getInputChecked("enableColorOverLifetime");
        this.config.enableVelocityOverLifetime = getInputChecked("enableVelocityOverLifetime");
        this.config.enableGravity = getInputChecked("enableGravity");
        this.config.gravity = getInputNumber("gravity");
        this.config.enableForce = getInputChecked("enableForce");
        this.config.forceAmplitudeX = getInputNumber("forceAmplitudeX");
        this.config.forceAmplitudeY = getInputNumber("forceAmplitudeY");
        this.config.forceSpatialScale = getInputNumber("forceSpatialScale");
        this.config.forceTimeScale = getInputNumber("forceTimeScale");
        this.config.forceSeed = getInputNumber("forceSeed");
    }

    private syncDynamicStateFromInputs(): void {
        this.config.timelineBursts = this.readTimelineInputs();
        this.config.startColors = this.readStartColorInputs();
        this.config.sizeCurve = this.readCurveInputs("sizeCurve");
        this.config.speedCurve = this.readSpeedCurveInputs();
        this.config.alphaCurve = this.readCurveInputs("alphaCurve");
        this.config.scaleXCurve = this.readCurveInputs("scaleXCurve");
        this.config.scaleYCurve = this.readCurveInputs("scaleYCurve");
        this.config.colorCurve = this.readColorCurveInputs();
        this.config.velocityXCurve = this.readCurveInputs("velocityXCurve");
        this.config.velocityYCurve = this.readCurveInputs("velocityYCurve");
    }

    private readTimelineInputs(): TimelineBurstPoint[] {
        return [...this.root.querySelectorAll<HTMLElement>("[data-timeline-index]")].map((element) => ({
            time: Number((element.querySelector('[data-field="time"]') as HTMLInputElement).value),
            count: Number((element.querySelector('[data-field="count"]') as HTMLInputElement).value),
        }));
    }

    private readStartColorInputs(): string[] {
        return [...this.root.querySelectorAll<HTMLElement>("[data-start-color-index]")].map((element) => (element.querySelector('[data-field="color"]') as HTMLInputElement).value);
    }

    private readCurveInputs(prefix: string): CurvePoint[] {
        return [...this.root.querySelectorAll<HTMLElement>(`[data-curve-group="${prefix}"]`)].map((element) => ({
            t: Number((element.querySelector('[data-field="t"]') as HTMLInputElement).value),
            value: Number((element.querySelector('[data-field="value"]') as HTMLInputElement).value),
        }));
    }

    private readSpeedCurveInputs(): CurvePoint[] {
        return [...this.root.querySelectorAll<HTMLElement>(`[data-curve-group="speedCurve"]`)].map((element) => ({
            t: Number((element.querySelector('[data-field="t"]') as HTMLInputElement).value),
            value: Number((element.querySelector('[data-field="value"]') as HTMLInputElement).value),
            randomOffset: Number((element.querySelector('[data-field="randomOffset"]') as HTMLInputElement).value),
        }));
    }

    private readColorCurveInputs(): ColorKeyPoint[] {
        return [...this.root.querySelectorAll<HTMLElement>("[data-color-curve-index]")].map((element) => ({
            t: Number((element.querySelector('[data-field="t"]') as HTMLInputElement).value),
            color: (element.querySelector('[data-field="color"]') as HTMLInputElement).value,
        }));
    }

    private syncVisibility(): void {
        for (const id of OPTIONAL_IDS) {
            const content = getById<HTMLElement>(`${id}Content`);
            content.hidden = !getInputChecked(id);
        }

        const emitterType = getInputValue("emitterType");
        for (const element of this.root.querySelectorAll<HTMLElement>(".emitter-box-only")) {
            element.hidden = emitterType !== "box";
        }
        for (const element of this.root.querySelectorAll<HTMLElement>(".emitter-circle-only")) {
            element.hidden = emitterType !== "circle";
        }
        for (const element of this.root.querySelectorAll<HTMLElement>(".emitter-shape-only")) {
            element.hidden = emitterType !== "box" && emitterType !== "circle";
        }

        this.toggleModeGroup("lifetimeMode", getInputValue("lifetimeMode"));
        this.toggleModeGroup("startSpeedMode", getInputValue("startSpeedMode"));
        this.toggleModeGroup("startRotationMode", getInputValue("startRotationMode"));
        this.toggleModeGroup("angularVelocityMode", getInputValue("angularVelocityMode"));
        this.toggleModeGroup("startSizeMode", getInputValue("startSizeMode"));
        this.toggleModeGroup("startAlphaMode", getInputValue("startAlphaMode"));

        const bounceMode = getInputValue("bounceMode");
        for (const element of this.root.querySelectorAll<HTMLElement>(".bounce-box-only")) {
            element.hidden = bounceMode !== "box";
        }

        const hasUploadedTexture = Boolean(this.uploadedTextureAsset);
        getById<HTMLElement>("textureBuiltinField").hidden = hasUploadedTexture;
        getById<HTMLButtonElement>("resetTextureButton").hidden = !hasUploadedTexture;
        const sequenceRandomStartField = document.getElementById("sequenceRandomStartField") as HTMLElement | null;
        if (sequenceRandomStartField) {
            sequenceRandomStartField.hidden = !Boolean(this.uploadedTextureAsset?.isSequence);
        }
        const sequenceFrameRateField = document.getElementById("sequenceFrameRateField") as HTMLElement | null;
        if (sequenceFrameRateField) {
            sequenceFrameRateField.hidden = !Boolean(this.uploadedTextureAsset?.isSequence);
        }
        const textureStatus = getById<HTMLElement>("textureStatus");
        textureStatus.hidden = !hasUploadedTexture;
        textureStatus.textContent = hasUploadedTexture
            ? this.uploadedTextureAsset?.isSequence
                ? `Using uploaded sequence: ${this.uploadedTextureAsset.fileNames.length} frames`
                : `Using uploaded texture: ${this.uploadedTextureAsset?.fileNames[0] ?? "file"}`
            : "Drop image(s) into preview or use upload to override builtin texture. Multiple files become a frame sequence.";
    }

    private toggleModeGroup(modeId: string, value: string): void {
        for (const element of this.root.querySelectorAll<HTMLElement>(`.${modeId}-constant-only`)) {
            element.hidden = value !== "constant";
        }
        for (const element of this.root.querySelectorAll<HTMLElement>(`.${modeId}-range-only`)) {
            element.hidden = value !== "min-max";
        }
    }

    private renderDynamicEditors(): void {
        this.renderTimelineBurstEditor();
        this.renderStartColorEditor();
        this.renderCurveEditor("sizeCurveEditor", this.config.sizeCurve, "sizeCurve");
        this.renderSpeedCurveEditor();
        this.renderCurveEditor("alphaCurveEditor", this.config.alphaCurve, "alphaCurve");
        this.renderCurveEditor("scaleXCurveEditor", this.config.scaleXCurve, "scaleXCurve");
        this.renderCurveEditor("scaleYCurveEditor", this.config.scaleYCurve, "scaleYCurve");
        this.renderColorCurveEditor();
        this.renderCurveEditor("velocityXCurveEditor", this.config.velocityXCurve, "velocityXCurve");
        this.renderCurveEditor("velocityYCurveEditor", this.config.velocityYCurve, "velocityYCurve");
    }

    private renderTimelineBurstEditor(): void {
        getById<HTMLElement>("timelineBurstsEditor").innerHTML = this.config.timelineBursts.map((item, index) => `
<div class="dynamic-row" data-timeline-index="${index}">
    <input data-field="time" type="number" step="0.01" value="${item.time}" />
    <input data-field="count" type="number" step="1" value="${item.count}" />
    <button class="button-danger" type="button" data-remove-kind="timelineBursts" data-remove-index="${index}">Remove</button>
</div>`).join("");
    }

    private renderStartColorEditor(): void {
        getById<HTMLElement>("startColorEditor").innerHTML = this.config.startColors.map((color, index) => `
<div class="dynamic-row" data-start-color-index="${index}">
    <input data-field="color" type="color" value="${color}" />
    <button class="button-danger" type="button" data-remove-kind="startColors" data-remove-index="${index}">Remove</button>
</div>`).join("");
    }

    private renderCurveEditor(containerId: string, points: CurvePoint[], groupName: string): void {
        getById<HTMLElement>(containerId).innerHTML = points.map((point, index) => `
<div class="dynamic-row" data-curve-group="${groupName}" data-curve-index="${index}">
    <input data-field="t" type="number" step="0.01" value="${point.t}" />
    <input data-field="value" type="number" step="0.01" value="${point.value}" />
    <button class="button-danger" type="button" data-remove-kind="${groupName}" data-remove-index="${index}">Remove</button>
</div>`).join("");
    }

    private renderSpeedCurveEditor(): void {
        getById<HTMLElement>("speedCurveEditor").innerHTML = this.config.speedCurve.map((point, index) => `
<div class="dynamic-row" data-curve-group="speedCurve" data-curve-index="${index}">
    <input data-field="t" type="number" step="0.01" value="${point.t}" />
    <input data-field="value" type="number" step="0.01" value="${point.value}" />
    <input data-field="randomOffset" type="number" step="0.01" value="${point.randomOffset ?? 0}" />
    <button class="button-danger" type="button" data-remove-kind="speedCurve" data-remove-index="${index}">Remove</button>
</div>`).join("");
    }

    private renderColorCurveEditor(): void {
        getById<HTMLElement>("colorCurveEditor").innerHTML = this.config.colorCurve.map((point, index) => `
<div class="dynamic-row" data-color-curve-index="${index}">
    <input data-field="t" type="number" step="0.01" value="${point.t}" />
    <input data-field="color" type="color" value="${point.color}" />
    <button class="button-danger" type="button" data-remove-kind="colorCurve" data-remove-index="${index}">Remove</button>
</div>`).join("");
    }

    private getDynamicList(kind: string): TimelineBurstPoint[] | string[] | CurvePoint[] | ColorKeyPoint[] {
        if (kind === "timelineBursts") {
            return this.config.timelineBursts;
        }
        if (kind === "startColors") {
            return this.config.startColors;
        }
        if (kind === "sizeCurve") {
            return this.config.sizeCurve;
        }
        if (kind === "speedCurve") {
            return this.config.speedCurve;
        }
        if (kind === "alphaCurve") {
            return this.config.alphaCurve;
        }
        if (kind === "scaleXCurve") {
            return this.config.scaleXCurve;
        }
        if (kind === "scaleYCurve") {
            return this.config.scaleYCurve;
        }
        if (kind === "colorCurve") {
            return this.config.colorCurve;
        }
        if (kind === "velocityXCurve") {
            return this.config.velocityXCurve;
        }

        return this.config.velocityYCurve;
    }


    private createSystemEntry(): ParticleSystemListEntry {
        const config = createDefaultEditorConfig();

        return {
            id: this.createSystemId(),
            name: config.name,
            enabled: true,
            config,
            uploadedTextureAsset: null,
            uploadedTextureFolderKey: null,
        };
    }

    private createSystemId(): string {
        return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `system-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    private getCurrentSystem(): ParticleSystemListEntry {
        const system = this.getSystemById(this.currentSystemId);

        if (!system) {
            throw new Error("Missing current particle system");
        }

        return system;
    }

    private getSystemById(systemId: string): ParticleSystemListEntry | undefined {
        return this.systems.find((system) => system.id === systemId);
    }

    private setCurrentUploadedTexture(asset: UploadedTextureAsset | null, folderKey: string | null): void {
        this.uploadedTextureAsset = asset;
        this.uploadedTextureFolderKey = folderKey;

        const currentSystem = this.getCurrentSystem();
        currentSystem.uploadedTextureAsset = asset;
        currentSystem.uploadedTextureFolderKey = folderKey;
    }

    private async handleAddSystem(): Promise<void> {
        this.syncDynamicStateFromInputs();
        this.syncStaticStateFromInputs();

        const system = this.createSystemEntry();
        this.systems.push(system);
        await this.preview.applyConfig(system.id, system.config, system.uploadedTextureAsset);
        this.preview.setEnabled(system.id, system.enabled);
        this.switchCurrentSystem(system.id, false);
    }

    private async handleRemoveSystem(systemId: string): Promise<void> {
        if (this.systems.length <= 1) {
            return;
        }

        const index = this.systems.findIndex((system) => system.id === systemId);

        if (index === -1) {
            return;
        }

        const wasCurrent = this.currentSystemId === systemId;
        const [removed] = this.systems.splice(index, 1);
        this.preview.removeSystem(systemId);
        removed.uploadedTextureAsset?.destroy();

        if (wasCurrent) {
            const fallback = this.systems[Math.max(0, index - 1)] ?? this.systems[0];
            this.switchCurrentSystem(fallback.id, false);
        } else {
            this.renderSystemsPanel();
        }
    }

    private switchCurrentSystem(systemId: string, persistCurrent = true): void {
        if (!systemId || this.currentSystemId === systemId) {
            return;
        }

        if (persistCurrent) {
            this.syncDynamicStateFromInputs();
            this.syncStaticStateFromInputs();
        }

        const nextSystem = this.getSystemById(systemId);

        if (!nextSystem) {
            return;
        }

        this.currentSystemId = systemId;
        this.config = nextSystem.config;
        this.uploadedTextureAsset = nextSystem.uploadedTextureAsset;
        this.uploadedTextureFolderKey = nextSystem.uploadedTextureFolderKey;
        getById<HTMLInputElement>("textureUpload").value = "";
        this.populateInputsFromConfig();
        this.renderDynamicEditors();
        this.syncVisibility();
        this.renderSystemsPanel();
    }

    private renderSystemsPanel(): void {
        const container = getById<HTMLElement>("systemsList");
        container.innerHTML = this.systems.map((system) => `
<div class="system-item ${system.id === this.currentSystemId ? "current" : ""}" data-system-id="${system.id}">
    <label class="toggle"><input type="checkbox" data-system-enabled-id="${system.id}" ${system.enabled ? "checked" : ""} /></label>
    <input class="system-item-name" type="text" data-system-name-id="${system.id}" value="${this.escapeHtml(system.name)}" />
    <button class="button-danger system-remove-button" type="button" data-remove-system-id="${system.id}" ${this.systems.length <= 1 ? "disabled" : ""}>Remove</button>
</div>`).join("");
    }

    private escapeHtml(value: string): string {
        return value
            .replaceAll("&", "&amp;")
            .replaceAll("\"", "&quot;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;");
    }

    private getUploadedTextureInfo(): { fileNames: string[]; isSequence: boolean; editorFolderKey?: string | null } | null {
        return this.getUploadedTextureInfoForSystem(this.getCurrentSystem());
    }

    private isSupportedTextureFile(file: File): boolean {
        return /\.(png|jpe?g|webp)$/i.test(file.name);
    }

    private async handleGetConfigs(): Promise<void> {
        this.syncDynamicStateFromInputs();
        this.syncStaticStateFromInputs();
        const configs = this.systems.map((system) => buildSerializableConfig(system.config, this.getUploadedTextureInfoForSystem(system)));
        const blob = await createConfigArchive(configs).generateAsync({ type: "blob" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = "particle-configs.zip";
        link.click();
        URL.revokeObjectURL(url);
    }

    private async handleLoadConfigsFromZip(): Promise<void> {
        const input = getById<HTMLInputElement>("loadConfigsZipInput");
        const archiveFile = input.files?.[0];
        if (!archiveFile || this.importInProgress) return;

        this.importInProgress = true;
        ++this.textureOperation;
        const staged: ParticleSystemListEntry[] = [];
        try {
            const configs = await readConfigArchive(archiveFile);
            // Parse all files first, then load all resources before replacing working state.
            for (const config of configs) {
                const system = this.createSystemEntry();
                staged.push(system);
                system.config = toEditorConfig(config);
                system.name = system.config.name;
                const texture = await this.loadSerializedTexture(config);
                system.uploadedTextureAsset = texture.asset;
                system.uploadedTextureFolderKey = texture.folderKey;
                await this.preview.applyConfig(system.id, system.config, system.uploadedTextureAsset);
                this.preview.setEnabled(system.id, false);
            }

            for (const oldSystem of this.systems) {
                this.preview.removeSystem(oldSystem.id);
                oldSystem.uploadedTextureAsset?.destroy();
            }
            this.systems.splice(0, this.systems.length, ...staged);
            for (const system of staged) this.preview.setEnabled(system.id, system.enabled);
            this.switchCurrentSystem(staged[0].id, false);
            this.configForDiff = null;
        } catch (error) {
            for (const system of staged) {
                this.preview.removeSystem(system.id);
                system.uploadedTextureAsset?.destroy();
            }
            this.showError(error);
        } finally {
            this.importInProgress = false;
            input.value = "";
        }
    }

    private getUploadedTextureInfoForSystem(system: ParticleSystemListEntry): { fileNames: string[]; isSequence: boolean; editorFolderKey?: string | null } | null {
        if (!system.uploadedTextureAsset) return null;
        return {
            fileNames: [...system.uploadedTextureAsset.fileNames],
            isSequence: system.uploadedTextureAsset.isSequence,
            editorFolderKey: system.uploadedTextureFolderKey,
        };
    }

    private async loadSerializedTexture(config: EditorSerializedConfig, selectedFiles: File[] = []): Promise<{ asset: UploadedTextureAsset | null; folderKey: string | null }> {
        const names = getExpectedTextureNames(config);
        if (!names.length) return { asset: null, folderKey: null };
        const editorFolderKey = config.texture.editorFolderKey ?? null;
        const selectedTextures = this.matchTextureFilesByName(selectedFiles, names);
        const files = selectedTextures
            ?? await this.restoreTextureFilesFromCache(editorFolderKey, names)
            ?? await this.restoreTextureFilesFromStoredFolder(editorFolderKey, names);
        if (!files) {
            throw new Error(`Missing texture file(s): ${names.join(", ")}. Load the JSON together with all its images to restore the effect.`);
        }
        const folderKey = editorFolderKey ?? this.createTextureFolderKey(files);
        if (selectedTextures) await saveTextureFiles(folderKey, selectedTextures);
        return { asset: await loadTextureAssetFromFiles(files), folderKey };
    }

    private async handleLoadConfig(): Promise<void> {
        const input = getById<HTMLInputElement>("loadConfigInput");
        const selectedFiles = [...(input.files ?? [])];
        if (!selectedFiles.length || this.importInProgress) return;
        const configFile = selectedFiles.find((candidate) => /\.json$/i.test(candidate.name) || candidate.type === "application/json");
        if (!configFile) {
            this.showError(new Error("Load Config expects a JSON file. You can select the JSON together with texture images in one chooser."));
            input.value = "";
            return;
        }

        this.importInProgress = true;
        ++this.textureOperation;
        let stagedAsset: UploadedTextureAsset | null = null;
        try {
            const system = this.getCurrentSystem();
            const parsed = parseSerializedConfig(JSON.parse(await configFile.text()), configFile.name);
            const config = toEditorConfig(parsed);
            const texture = await this.loadSerializedTexture(parsed, selectedFiles.filter((file) => this.isSupportedTextureFile(file)));
            stagedAsset = texture.asset;
            if (!this.getSystemById(system.id)) throw new Error("The target system was removed while loading its configuration.");
            await this.preview.applyConfig(system.id, config, stagedAsset);
            const oldAsset = system.uploadedTextureAsset;
            system.config = config;
            system.name = config.name;
            system.uploadedTextureAsset = stagedAsset;
            system.uploadedTextureFolderKey = texture.folderKey;
            stagedAsset = null; // Ownership transferred to the editor after preview construction succeeded.
            oldAsset?.destroy();
            this.preview.setEnabled(system.id, system.enabled);
            if (this.currentSystemId === system.id) {
                this.config = config;
                this.uploadedTextureAsset = system.uploadedTextureAsset;
                this.uploadedTextureFolderKey = system.uploadedTextureFolderKey;
                this.populateInputsFromConfig();
                this.renderDynamicEditors();
                this.syncVisibility();
            }
            this.renderSystemsPanel();
            this.configForDiff = null;
        } catch (error) {
            stagedAsset?.destroy();
            this.showError(error);
        } finally {
            this.importInProgress = false;
            input.value = "";
        }
    }

    private matchTextureFilesByName(files: File[], expectedNames: string[]): File[] | null {
        const filesByName = new Map(files.map((file) => [file.name, file]));
        const result: File[] = [];
        for (const name of expectedNames) {
            const file = filesByName.get(name);
            if (!file) return null;
            result.push(file);
        }
        return result.length ? result : null;
    }

    private showError(error: unknown): void {
        const status = getById<HTMLElement>("textureStatus");
        status.textContent = error instanceof Error ? error.message : String(error);
        status.hidden = false;
    }

    private run(operation: Promise<void>): void {
        void operation.catch((error: unknown) => this.showError(error));
    }

    private populateInputsFromConfig(): void {
        this.assignNumber("maxParticles", this.config.maxParticles);
        this.assignString("simulationSpace", this.config.simulationSpace);
        this.assignString("textureKind", this.config.textureKind);
        this.assignString("emitterType", this.config.emitterType);
        this.assignNumber("emitterX", this.config.emitterX);
        this.assignNumber("emitterY", this.config.emitterY);
        this.assignNumber("emitterWidth", this.config.emitterWidth);
        this.assignNumber("emitterHeight", this.config.emitterHeight);
        this.assignNumber("emitterRadius", this.config.emitterRadius);
        this.setCheckbox("emitterAlongShape", this.config.emitterAlongShape);
        this.assignNumber("emitterRandomizePosition", this.config.emitterRandomizePosition);
        this.assignNumber("rate", this.config.rate);
        this.assignNumber("directionMin", this.config.directionMin);
        this.assignNumber("directionMax", this.config.directionMax);
        this.setCheckbox("enablePrewarm", this.config.enablePrewarm);
        this.assignNumber("prewarm", this.config.prewarm);
        this.assignString("blendMode", this.config.blendMode);
        this.assignNumber("sequenceFrameRate", this.config.sequenceFrameRate);
        this.setCheckbox("sequenceRandomStart", this.config.sequenceRandomStart);
        this.setCheckbox("enableBurst", this.config.enableBurst);
        this.assignNumber("burst", this.config.burst);
        this.setCheckbox("enableBurstByDemand", this.config.enableBurstByDemand);
        this.assignNumber("burstByDemand", this.config.burstByDemand);
        this.setCheckbox("enableDurationLoop", this.config.enableDurationLoop);
        this.assignNumber("duration", this.config.duration);
        this.assignString("loop", String(this.config.loop));
        this.setCheckbox("enableTimelineBursts", this.config.enableTimelineBursts);
        this.assignString("lifetimeMode", this.config.lifetimeMode);
        this.assignNumber("lifetimeConst", this.config.lifetimeConst);
        this.assignNumber("lifetimeMin", this.config.lifetimeMin);
        this.assignNumber("lifetimeMax", this.config.lifetimeMax);
        this.setCheckbox("enableStartSpeed", this.config.enableStartSpeed);
        this.setCheckbox("enableSpeedOverLifetime", this.config.enableSpeedOverLifetime);
        this.setCheckbox("speedOverLifetimeFade", this.config.speedOverLifetimeFade);
        this.assignString("startSpeedMode", this.config.startSpeedMode);
        this.assignNumber("speedConst", this.config.speedConst);
        this.assignNumber("speedMin", this.config.speedMin);
        this.assignNumber("speedMax", this.config.speedMax);
        this.setCheckbox("enableStartRotation", this.config.enableStartRotation);
        this.assignString("startRotationMode", this.config.startRotationMode);
        this.assignNumber("rotationConst", this.config.rotationConst);
        this.assignNumber("rotationMin", this.config.rotationMin);
        this.assignNumber("rotationMax", this.config.rotationMax);
        this.setCheckbox("enableAngularVelocity", this.config.enableAngularVelocity);
        this.assignString("angularVelocityMode", this.config.angularVelocityMode);
        this.assignNumber("angularVelocityConst", this.config.angularVelocityConst);
        this.assignNumber("angularVelocityMin", this.config.angularVelocityMin);
        this.assignNumber("angularVelocityMax", this.config.angularVelocityMax);
        this.setCheckbox("angleKeepDirection", this.config.angleKeepDirection);
        this.setCheckbox("enableStartSize", this.config.enableStartSize);
        this.assignString("startSizeMode", this.config.startSizeMode);
        this.assignNumber("sizeConst", this.config.sizeConst);
        this.assignNumber("sizeMin", this.config.sizeMin);
        this.assignNumber("sizeMax", this.config.sizeMax);
        this.setCheckbox("enableStartAlpha", this.config.enableStartAlpha);
        this.assignString("startAlphaMode", this.config.startAlphaMode);
        this.assignNumber("alphaConst", this.config.alphaConst);
        this.assignNumber("alphaMin", this.config.alphaMin);
        this.assignNumber("alphaMax", this.config.alphaMax);
        this.setCheckbox("enableStartColor", this.config.enableStartColor);
        this.setCheckbox("enableBounce", this.config.enableBounce);
        this.assignString("bounceMode", this.config.bounceMode);
        this.assignNumber("bounceBoxX", this.config.bounceBoxX);
        this.assignNumber("bounceBoxY", this.config.bounceBoxY);
        this.assignNumber("bounceBoxWidth", this.config.bounceBoxWidth);
        this.assignNumber("bounceBoxHeight", this.config.bounceBoxHeight);
        this.assignNumber("bounceDampingMin", this.config.bounceDampingMin);
        this.assignNumber("bounceDampingMax", this.config.bounceDampingMax);
        this.setCheckbox("enableSizeOverLifetime", this.config.enableSizeOverLifetime);
        this.setCheckbox("enableAlphaOverLifetime", this.config.enableAlphaOverLifetime);
        this.setCheckbox("enableScaleXYOverLifetime", this.config.enableScaleXYOverLifetime);
        this.setCheckbox("enableFlickeringOverLifetime", this.config.enableFlickeringOverLifetime);
        this.assignNumber("flickeringGap", this.config.flickeringGap);
        this.assignNumber("flickeringMin", this.config.flickeringMin);
        this.assignNumber("flickeringMax", this.config.flickeringMax);
        this.assignNumber("flickeringRandomGapOffset", this.config.flickeringRandomGapOffset);
        this.assignNumber("flickeringRandomMinMaxOffset", this.config.flickeringRandomMinMaxOffset);
        this.setCheckbox("flickeringFade", this.config.flickeringFade);
        this.assignNumber("flickeringStartTime", this.config.flickeringStartTime);
        this.assignNumber("flickeringEndTime", this.config.flickeringEndTime);
        this.setCheckbox("enableColorOverLifetime", this.config.enableColorOverLifetime);
        this.setCheckbox("enableVelocityOverLifetime", this.config.enableVelocityOverLifetime);
        this.setCheckbox("enableGravity", this.config.enableGravity);
        this.assignNumber("gravity", this.config.gravity);
        this.setCheckbox("enableForce", this.config.enableForce);
        this.assignNumber("forceAmplitudeX", this.config.forceAmplitudeX);
        this.assignNumber("forceAmplitudeY", this.config.forceAmplitudeY);
        this.assignNumber("forceSpatialScale", this.config.forceSpatialScale);
        this.assignNumber("forceTimeScale", this.config.forceTimeScale);
        this.assignNumber("forceSeed", this.config.forceSeed);
    }

    private setCheckbox(id: string, value: boolean): void {
        const element = document.getElementById(id) as HTMLInputElement | null;

        if (element) {
            element.checked = value;
        }
    }


    private async restoreTextureFilesFromCache(editorFolderKey: string | null, expectedTextureNames: string[]): Promise<File[] | null> {
        if (!editorFolderKey) {
            return null;
        }

        try {
            const cachedFiles = await getTextureFiles(editorFolderKey);

            if (!cachedFiles || cachedFiles.length === 0) {
                return null;
            }

            return this.matchTextureFilesByName(cachedFiles, expectedTextureNames);
        } catch {
            return null;
        }
    }

    private async restoreTextureFilesFromStoredFolder(editorFolderKey: string | null, expectedTextureNames: string[]): Promise<File[] | null> {
        if (!editorFolderKey) {
            return null;
        }

        try {
            const handle = await getDirectoryHandle(editorFolderKey);

            if (!handle) {
                return null;
            }

            const permission = await handle.queryPermission({ mode: "read" });
            const finalPermission = permission === "granted" ? permission : await handle.requestPermission({ mode: "read" });

            if (finalPermission !== "granted") {
                return null;
            }

            const files = await Promise.all(expectedTextureNames.map(async (fileName) => {
                const fileHandle = await handle.getFileHandle(fileName);
                return await fileHandle.getFile();
            }));

            return files;
        } catch {
            return null;
        }
    }

    private async captureTextureDirectoryHandle(files: File[], folderKey: string): Promise<string | null> {
        if (!this.canUseDirectoryPicker() || files.length === 0) {
            return null;
        }

        try {
            const handle = await window.showDirectoryPicker();
            const permission = await handle.requestPermission({ mode: "read" });

            if (permission !== "granted") {
                return null;
            }

            const fileNames = new Set(files.map((file) => file.name));

            for (const fileName of fileNames) {
                await handle.getFileHandle(fileName);
            }

            await saveDirectoryHandle(folderKey, handle);
            getById<HTMLElement>("textureStatus").textContent = `Texture folder remembered for ${files.length} file(s).`;
            return folderKey;
        } catch {
            return null;
        }
    }

    private createTextureFolderKey(files: File[]): string {
        const normalizedNames = [...files]
            .map((file) => file.name)
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
            .join("|");
        const randomPart = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

        return `texture-folder:${randomPart}:${normalizedNames}`;
    }

    private canUseDirectoryPicker(): boolean {
        return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
    }

    private assignNumber(id: string, value: unknown): void {
        const element = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
        if (element && typeof value === "number") element.value = String(value);
    }

    private assignString(id: string, value: unknown): void {
        const element = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
        if (element && typeof value === "string") element.value = value;
    }

    private handleBackgroundUpload(): void {
        const input = getById<HTMLInputElement>("backgroundUploadInput");
        const file = input.files?.[0];

        if (!file) {
            return;
        }

        if (this.previewBackgroundUrl) {
            URL.revokeObjectURL(this.previewBackgroundUrl);
        }

        this.previewBackgroundUrl = URL.createObjectURL(file);

        const canvasWrap = document.querySelector(".canvas-wrap") as HTMLElement | null;

        if (canvasWrap) {
            canvasWrap.style.backgroundImage = `url(${this.previewBackgroundUrl})`;
            canvasWrap.style.backgroundSize = "cover";
            canvasWrap.style.backgroundPosition = "center";
        }
    }

    private clearBackground(): void {
        if (this.previewBackgroundUrl) {
            URL.revokeObjectURL(this.previewBackgroundUrl);
            this.previewBackgroundUrl = null;
        }

        const canvasWrap = document.querySelector(".canvas-wrap") as HTMLElement | null;
        const input = document.getElementById("backgroundUploadInput") as HTMLInputElement | null;

        if (canvasWrap) {
            canvasWrap.style.backgroundImage = "";
            canvasWrap.style.backgroundSize = "";
            canvasWrap.style.backgroundPosition = "";
        }

        if (input) {
            input.value = "";
        }
    }

}
