import type { EditorConfig } from "../config/types";

export function createEditorLayout(config: EditorConfig): string {
    return `
<div class="app-shell">
    <aside class="sidebar">
        <section class="section">
            <div class="section-title-row"><h2>System</h2></div>
            <div class="grid">
                <div class="field"><label for="maxParticles">maxParticles</label><input id="maxParticles" type="number" value="${config.maxParticles}" /></div>
                <div class="field"><label for="simulationSpace">simulationSpace</label><select id="simulationSpace"><option value="world" ${config.simulationSpace === "world" ? "selected" : ""}>world</option><option value="local" ${config.simulationSpace === "local" ? "selected" : ""}>local</option></select></div>
            </div>
        </section>

        <section class="section">
            <div class="section-title-row"><h2>Render</h2></div>
            <div class="grid">
                <div class="field texture-field" id="textureBuiltinField"><label for="textureKind">texture</label><select id="textureKind"><option value="circle">circle</option><option value="soft-circle">soft-circle</option><option value="square">square</option><option value="diamond">diamond</option><option value="star">star</option></select></div>
                <div class="field"><label>upload texture / sequence</label><input id="textureUpload" type="file" accept=".png,.jpg,.jpeg,.webp" multiple /></div>
                <div class="field"><label>&nbsp;</label><button id="resetTextureButton" class="button-secondary" type="button">Reset Texture</button></div>
            </div>
            <div class="hint" id="textureStatus" hidden></div>
            <div class="field" id="sequenceRandomStartField" hidden><label class="toggle"><input id="sequenceRandomStart" type="checkbox" />random start frame for sequence</label></div>
            <div class="field sequence-frame-rate-field" id="sequenceFrameRateField" hidden><label for="sequenceFrameRate">sequence frame rate</label><input id="sequenceFrameRate" type="number" step="1" min="1" value="12" /></div>
            <div class="subsection"><div class="field"><h3 class="section-title">Blend mode</h3><select id="blendMode"><option value="normal">normal</option><option value="add">add</option><option value="screen">screen</option><option value="multiply">multiply</option></select></div></div>
        </section>

        <section class="section">
            <div class="section-title-row"><h2>Simulation</h2></div>
            <div class="subsection"><div class="section-title-row"><h3 class="section-title">Prewarm</h3><label class="toggle"><input id="enablePrewarm" type="checkbox" ${config.enablePrewarm ? "checked" : ""} />enabled</label></div><div id="enablePrewarmContent" class="optional-content"><div class="grid"><div class="field"><label for="prewarm">prewarm</label><input id="prewarm" type="number" step="0.01" min="0" value="${config.prewarm}" /></div></div></div></div>
        </section>

        <section class="section">
            <div class="section-title-row"><h2>Emitter and Emission</h2></div>
            <div class="grid">
                <div class="field"><label for="emitterType">emitter type</label><select id="emitterType"><option value="box">box</option><option value="dot">dot</option><option value="circle">circle</option></select></div>
                <div class="field"><label for="rate">rate</label><input id="rate" type="number" step="0.01" value="${config.rate}" /></div>
                <div class="field"><label for="emitterX">emitter x</label><input id="emitterX" type="number" step="0.01" value="${config.emitterX}" /></div>
                <div class="field"><label for="emitterY">emitter y</label><input id="emitterY" type="number" step="0.01" value="${config.emitterY}" /></div>
                <div class="field emitter-box-only"><label for="emitterWidth">emitter width</label><input id="emitterWidth" type="number" step="0.01" value="${config.emitterWidth}" /></div>
                <div class="field emitter-box-only"><label for="emitterHeight">emitter height</label><input id="emitterHeight" type="number" step="0.01" value="${config.emitterHeight}" /></div>
                <div class="field emitter-circle-only"><label for="emitterRadius">emitter radius</label><input id="emitterRadius" type="number" step="0.01" value="${config.emitterRadius}" /></div>
                <div class="field emitter-shape-only"><label class="toggle"><input id="emitterAlongShape" type="checkbox" ${config.emitterAlongShape ? "checked" : ""} />along the shape</label></div>
                <div class="field"><label for="emitterRandomizePosition">randomize position</label><input id="emitterRandomizePosition" type="number" step="0.01" min="0" value="${config.emitterRandomizePosition}" /></div>
                <div class="field"><label for="directionMin">direction minAngleDeg</label><input id="directionMin" type="number" step="0.01" value="${config.directionMin}" /></div>
                <div class="field"><label for="directionMax">direction maxAngleDeg</label><input id="directionMax" type="number" step="0.01" value="${config.directionMax}" /></div>
            </div>
            <div class="subsection">
                <div class="section-title-row"><h3 class="section-title">Initial Burst</h3><label class="toggle"><input id="enableBurst" type="checkbox" ${config.enableBurst ? "checked" : ""} />enabled</label></div>
                <div id="enableBurstContent" class="optional-content"><div class="grid"><div class="field"><label for="burst">burst count</label><input id="burst" type="number" value="${config.burst}" /></div></div></div>
            </div>
            <div class="subsection">
                <div class="section-title-row"><h3 class="section-title">Burst By Demand</h3><label class="toggle"><input id="enableBurstByDemand" type="checkbox" ${config.enableBurstByDemand ? "checked" : ""} />enabled</label></div>
                <div id="enableBurstByDemandContent" class="optional-content"><div class="grid"><div class="field"><label for="burstByDemand">burst count</label><input id="burstByDemand" type="number" value="${config.burstByDemand}" /></div></div></div>
            </div>
            <div class="subsection">
                <div class="section-title-row"><h3 class="section-title">Duration and Loop</h3><label class="toggle"><input id="enableDurationLoop" type="checkbox" ${config.enableDurationLoop ? "checked" : ""} />enabled</label></div>
                <div id="enableDurationLoopContent" class="optional-content"><div class="grid"><div class="field"><label for="duration">duration</label><input id="duration" type="number" step="0.01" value="${config.duration}" /></div><div class="field"><label for="loop">loop</label><select id="loop"><option value="true" ${config.loop ? "selected" : ""}>true</option><option value="false" ${!config.loop ? "selected" : ""}>false</option></select></div></div></div>
            </div>
            <div class="subsection">
                <div class="section-title-row"><h3 class="section-title">Timeline Bursts</h3><label class="toggle"><input id="enableTimelineBursts" type="checkbox" ${config.enableTimelineBursts ? "checked" : ""} />enabled</label></div>
                <div id="enableTimelineBurstsContent" class="optional-content"><div id="timelineBurstsEditor"></div><button id="addTimelineBurstButton" class="button-secondary" type="button">Add Burst</button></div>
            </div>
        </section>

        <section class="section">
            <div class="section-title-row"><h2>Particle Base</h2></div>
            <div class="subsection" style="margin-top:0;padding-top:0;border-top:0;"><div class="section-title-row"><h3 class="section-title">Lifetime</h3></div><div class="grid"><div class="field"><label for="lifetimeMode">mode</label><select id="lifetimeMode"><option value="constant">constant</option><option value="min-max">min-max</option></select></div><div class="field lifetimeMode-constant-only"><label for="lifetimeConst">lifetime</label><input id="lifetimeConst" type="number" step="0.01" value="${config.lifetimeConst}" /></div><div class="field lifetimeMode-range-only"><label for="lifetimeMin">lifetime min</label><input id="lifetimeMin" type="number" step="0.01" value="${config.lifetimeMin}" /></div><div class="field lifetimeMode-range-only"><label for="lifetimeMax">lifetime max</label><input id="lifetimeMax" type="number" step="0.01" value="${config.lifetimeMax}" /></div></div></div>
            ${createNumberModuleSection("Start Size", "enableStartSize", "startSizeMode", "sizeConst", "sizeMin", "sizeMax", config.enableStartSize, config.startSizeMode, config.sizeConst, config.sizeMin, config.sizeMax)}
            ${createNumberModuleSection("Start Speed", "enableStartSpeed", "startSpeedMode", "speedConst", "speedMin", "speedMax", config.enableStartSpeed, config.startSpeedMode, config.speedConst, config.speedMin, config.speedMax)}
            ${createNumberModuleSection("Start Rotation", "enableStartRotation", "startRotationMode", "rotationConst", "rotationMin", "rotationMax", config.enableStartRotation, config.startRotationMode, config.rotationConst, config.rotationMin, config.rotationMax)}
            ${createNumberModuleSection("Angular Velocity", "enableAngularVelocity", "angularVelocityMode", "angularVelocityConst", "angularVelocityMin", "angularVelocityMax", config.enableAngularVelocity, config.angularVelocityMode, config.angularVelocityConst, config.angularVelocityMin, config.angularVelocityMax)}
            <div class="subsection"><div class="section-title-row"><h3 class="section-title">Angle Keep Direction</h3><label class="toggle"><input id="angleKeepDirection" type="checkbox" ${config.angleKeepDirection ? "checked" : ""} />enabled</label></div></div>
            ${createNumberModuleSection("Start Alpha", "enableStartAlpha", "startAlphaMode", "alphaConst", "alphaMin", "alphaMax", config.enableStartAlpha, config.startAlphaMode, config.alphaConst, config.alphaMin, config.alphaMax)}
            <div class="subsection"><div class="section-title-row"><h3 class="section-title">Start Color</h3><label class="toggle"><input id="enableStartColor" type="checkbox" ${config.enableStartColor ? "checked" : ""} />enabled</label></div><div id="enableStartColorContent" class="optional-content"><div id="startColorEditor"></div><button id="addStartColorButton" class="button-secondary" type="button">Add Color</button></div></div>
            <div class="subsection"><div class="section-title-row"><h3 class="section-title">Bounce</h3><label class="toggle"><input id="enableBounce" type="checkbox" ${config.enableBounce ? "checked" : ""} />enabled</label></div><div id="enableBounceContent" class="optional-content"><div class="grid"><div class="field"><label for="bounceMode">mode</label><select id="bounceMode"><option value="screen" ${config.bounceMode === "screen" ? "selected" : ""}>screen</option><option value="box" ${config.bounceMode === "box" ? "selected" : ""}>box</option></select></div><div class="field bounce-box-only"><label for="bounceBoxX">box x</label><input id="bounceBoxX" type="number" step="0.01" value="${config.bounceBoxX}" /></div><div class="field bounce-box-only"><label for="bounceBoxY">box y</label><input id="bounceBoxY" type="number" step="0.01" value="${config.bounceBoxY}" /></div><div class="field bounce-box-only"><label for="bounceBoxWidth">box width</label><input id="bounceBoxWidth" type="number" step="0.01" value="${config.bounceBoxWidth}" /></div><div class="field bounce-box-only"><label for="bounceBoxHeight">box height</label><input id="bounceBoxHeight" type="number" step="0.01" value="${config.bounceBoxHeight}" /></div><div class="field"><label for="bounceDampingMin">damping min</label><input id="bounceDampingMin" type="number" step="0.01" min="0" value="${config.bounceDampingMin}" /></div><div class="field"><label for="bounceDampingMax">damping max</label><input id="bounceDampingMax" type="number" step="0.01" min="0" value="${config.bounceDampingMax}" /></div></div></div></div>
        </section>

        <section class="section">
            <div class="section-title-row"><h2>Particle Over Lifetime</h2></div>
            ${createCurveSection("Size Over Lifetime", "enableSizeOverLifetime", "sizeCurveEditor", config.enableSizeOverLifetime, "Add Key")}
            <div class="subsection"><div class="section-title-row"><h3 class="section-title">Speed Over Lifetime</h3><label class="toggle"><input id="enableSpeedOverLifetime" type="checkbox" ${config.enableSpeedOverLifetime ? "checked" : ""} />enabled</label></div><div id="enableSpeedOverLifetimeContent" class="optional-content"><div class="field"><label class="toggle"><input id="speedOverLifetimeFade" type="checkbox" ${config.speedOverLifetimeFade ? "checked" : ""} />fade</label></div><div id="speedCurveEditor"></div><button id="addSpeedCurveButton" class="button-secondary" type="button">Add Speed Key</button></div></div>
            <div class="subsection"><div class="section-title-row"><h3 class="section-title">Velocity Over Lifetime</h3><label class="toggle"><input id="enableVelocityOverLifetime" type="checkbox" ${config.enableVelocityOverLifetime ? "checked" : ""} />enabled</label></div><div id="enableVelocityOverLifetimeContent" class="optional-content"><div class="subsection" style="margin-top:0;padding-top:0;border-top:0;"><h3 class="section-title">X curve</h3><div id="velocityXCurveEditor"></div><button id="addVelocityXKeyButton" class="button-secondary" type="button">Add X Key</button></div><div class="subsection"><h3 class="section-title">Y curve</h3><div id="velocityYCurveEditor"></div><button id="addVelocityYKeyButton" class="button-secondary" type="button">Add Y Key</button></div></div></div>
            ${createCurveSection("Alpha Over Lifetime", "enableAlphaOverLifetime", "alphaCurveEditor", config.enableAlphaOverLifetime, "Add Key")}
            ${createCurveSection("Color Over Lifetime", "enableColorOverLifetime", "colorCurveEditor", config.enableColorOverLifetime, "Add Color Key")}
            <div class="subsection"><div class="section-title-row"><h3 class="section-title">Scale X/Y Over Lifetime</h3><label class="toggle"><input id="enableScaleXYOverLifetime" type="checkbox" ${config.enableScaleXYOverLifetime ? "checked" : ""} />enabled</label></div><div id="enableScaleXYOverLifetimeContent" class="optional-content"><h4>Scale X</h4><div id="scaleXCurveEditor"></div><button id="addScaleXCurveButton" class="button-secondary" type="button">Add X Key</button><h4>Scale Y</h4><div id="scaleYCurveEditor"></div><button id="addScaleYCurveButton" class="button-secondary" type="button">Add Y Key</button></div></div>
            <div class="subsection"><div class="section-title-row"><h3 class="section-title">Flickering Over Lifetime</h3><label class="toggle"><input id="enableFlickeringOverLifetime" type="checkbox" ${config.enableFlickeringOverLifetime ? "checked" : ""} />enabled</label></div><div id="enableFlickeringOverLifetimeContent" class="optional-content"><div class="grid"><div class="field"><label for="flickeringGap">gap</label><input id="flickeringGap" type="number" step="0.01" min="0.0001" value="${config.flickeringGap}" /></div><div class="field"><label for="flickeringMin">min</label><input id="flickeringMin" type="number" step="0.01" min="0" max="1" value="${config.flickeringMin}" /></div><div class="field"><label for="flickeringMax">max</label><input id="flickeringMax" type="number" step="0.01" min="0" max="1" value="${config.flickeringMax}" /></div><div class="field"><label for="flickeringRandomGapOffset">random gap offset</label><input id="flickeringRandomGapOffset" type="number" step="0.01" min="0" value="${config.flickeringRandomGapOffset}" /></div><div class="field"><label for="flickeringRandomMinMaxOffset">random min/max offset</label><input id="flickeringRandomMinMaxOffset" type="number" step="0.01" min="0" value="${config.flickeringRandomMinMaxOffset}" /></div><div class="field"><label class="toggle"><input id="flickeringFade" type="checkbox" ${config.flickeringFade ? "checked" : ""} />fade</label></div><div class="field"><label for="flickeringStartTime">start time</label><input id="flickeringStartTime" type="number" step="0.01" min="0" max="1" value="${config.flickeringStartTime}" /></div><div class="field"><label for="flickeringEndTime">end time</label><input id="flickeringEndTime" type="number" step="0.01" min="0" max="1" value="${config.flickeringEndTime}" /></div></div></div></div>
        </section>

        <section class="section">
            <div class="section-title-row"><h2>Motion and Forces</h2></div>
            <div class="subsection"><div class="section-title-row"><h3 class="section-title">Gravity</h3><label class="toggle"><input id="enableGravity" type="checkbox" ${config.enableGravity ? "checked" : ""} />enabled</label></div><div id="enableGravityContent" class="optional-content"><div class="grid"><div class="field"><label for="gravity">gravity</label><input id="gravity" type="number" step="0.01" value="${config.gravity}" /></div></div></div></div>
            <div class="subsection"><div class="section-title-row"><h3 class="section-title">Turbulence Force</h3><label class="toggle"><input id="enableForce" type="checkbox" ${config.enableForce ? "checked" : ""} />enabled</label></div><div id="enableForceContent" class="optional-content"><div class="grid"><div class="field"><label for="forceAmplitudeX">force amplitudeX</label><input id="forceAmplitudeX" type="number" step="0.01" value="${config.forceAmplitudeX}" /></div><div class="field"><label for="forceAmplitudeY">force amplitudeY</label><input id="forceAmplitudeY" type="number" step="0.01" value="${config.forceAmplitudeY}" /></div><div class="field"><label for="forceSpatialScale">force spatialScale</label><input id="forceSpatialScale" type="number" step="0.0001" value="${config.forceSpatialScale}" /></div><div class="field"><label for="forceTimeScale">force timeScale</label><input id="forceTimeScale" type="number" step="0.01" value="${config.forceTimeScale}" /></div><div class="field"><label for="forceSeed">force seed</label><input id="forceSeed" type="number" value="${config.forceSeed}" /></div></div></div></div>
        </section>

        <div class="actions"><button id="applyConfigButton" class="button-primary" type="button">Apply Config</button><div style="height:8px;"></div><button id="saveForDiffButton" class="button-secondary" type="button">Save for Diff</button><div style="height:8px;"></div><button id="getConfigButton" class="button-secondary" type="button">Get Config</button>
            <div style="height: 8px;"></div>
            <button id="getDiffButton" class="button-secondary" type="button">Get Diff</button>
            <div style="height: 8px;"></div>
            <button id="loadConfigButton" class="button-secondary" type="button">Load Config</button>
            <input id="loadConfigInput" type="file" accept=".json,application/json,.png,.jpg,.jpeg,.webp" multiple hidden /><div id="configOutputPanel" class="config-output-panel" hidden><div class="config-output-toolbar"><button id="copyConfigButton" class="icon-button" type="button" aria-label="Copy config" title="Copy config"><span class="icon-copy" aria-hidden="true"></span></button><button id="clearConfigButton" class="icon-button" type="button" aria-label="Close config" title="Close config">×</button></div><pre id="configOutput" class="config-output"></pre></div></div>
    </aside>
    <main class="preview"><div class="preview-header"><span>Pixi preview area with live particle playback.</span><div class="preview-actions"><button id="playButton" class="button-secondary" type="button">Play</button><button id="stopButton" class="button-secondary" type="button">Stop</button><button id="playAllButton" class="button-secondary" type="button">Play All</button><button id="stopAllButton" class="button-secondary" type="button">Stop All</button><button id="clearButton" class="button-secondary" type="button">Clear</button></div></div><div id="canvasWrap" class="canvas-wrap"><div id="canvasArea"></div><div class="overlay-actions">
                <button id="setBackgroundButton" class="button-secondary overlay-button" type="button">Set Background</button>
                <button id="clearBackgroundButton" class="button-secondary overlay-button" type="button">Clear Background</button>
                <input id="backgroundUploadInput" type="file" accept=".png,.jpg,.jpeg,.webp" hidden />
            </div><div id="dropOverlay" class="drop-overlay">Drop texture here</div></div></main>
    <aside class="systems-panel">
        <div class="systems-panel-header">Particle Systems</div>
        <div id="systemsList" class="systems-list"></div>
        <div class="systems-panel-actions">
            <button id="addSystemButton" class="button-primary" type="button">Add New</button>
            <div style="height: 8px;"></div>
            <button id="getConfigsButton" class="button-secondary" type="button">Get Configs</button>
            <div style="height: 8px;"></div>
            <button id="loadConfigsZipButton" class="button-secondary" type="button">Load Configs from ZIP</button>
            <input id="loadConfigsZipInput" type="file" accept=".zip,application/zip" hidden />
        </div>
    </aside>
</div>`;
}

function createNumberModuleSection(title: string, enableId: string, modeId: string, constId: string, minId: string, maxId: string, enabled: boolean, mode: string, constantValue: number, min: number, max: number): string {
    const sectionId = `${enableId}Content`;

    return `
<div class="subsection">
    <div class="section-title-row"><h3 class="section-title">${title}</h3><label class="toggle"><input id="${enableId}" type="checkbox" ${enabled ? "checked" : ""} />enabled</label></div>
    <div id="${sectionId}" class="optional-content">
        <div class="grid">
            <div class="field"><label for="${modeId}">mode</label><select id="${modeId}"><option value="constant" ${mode === "constant" ? "selected" : ""}>constant</option><option value="min-max" ${mode === "min-max" ? "selected" : ""}>min-max</option></select></div>
            <div class="field ${modeId}-constant-only"><label for="${constId}">value</label><input id="${constId}" type="number" step="0.01" value="${constantValue}" /></div>
            <div class="field ${modeId}-range-only"><label for="${minId}">min</label><input id="${minId}" type="number" step="0.01" value="${min}" /></div>
            <div class="field ${modeId}-range-only"><label for="${maxId}">max</label><input id="${maxId}" type="number" step="0.01" value="${max}" /></div>
        </div>
    </div>
</div>`;
}

function createCurveSection(title: string, enableId: string, editorId: string, enabled: boolean, buttonLabel: string): string {
    const suffix = editorId.replace("Editor", "");
    const buttonId = `add${suffix.charAt(0).toUpperCase()}${suffix.slice(1)}Button`;

    return `
<div class="subsection"><div class="section-title-row"><h3 class="section-title">${title}</h3><label class="toggle"><input id="${enableId}" type="checkbox" ${enabled ? "checked" : ""} />enabled</label></div><div id="${enableId}Content" class="optional-content"><div id="${editorId}"></div><button id="${buttonId}" class="button-secondary" type="button">${buttonLabel}</button></div></div>`;
}
