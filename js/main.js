import { DEFAULT_STATE, PRESETS, SHAPES } from './presets.js';
import { CRYSTAL_VERT, CRYSTAL_FRAG, PARTICLE_VERT, PARTICLE_FRAG } from './shaders.js';
import { hexToRgb01, buildViewProj } from './math.js';
import { createTextSdfManager } from './sdf.js';

function compileShader(gl, type, source) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, source);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error('Shader compile error: ' + log);
  }
  return sh;
}

function createProgram(gl, vsSrc, fsSrc) {
  const prog = gl.createProgram();
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = (gl.getProgramInfoLog(prog) || '').trim();
    const lost = gl.isContextLost();
    const errCode = gl.getError();
    throw new Error(
      `Program link error: ${log || (lost ? 'WebGL context lost during GPU shader compilation' : `driver failed (glError=${errCode})`)}`
    );
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return prog;
}

function init() {
  const state = JSON.parse(JSON.stringify(DEFAULT_STATE));

  // Smoothly animated runtime variables
  const anim = {
    time: 0,
    reveal: 1.0,
    revealActive: false,
    explode: 0.0,
    xray: 0.0,
    lightExp: 0.0,
    freeze: 0.0,
    camYaw: state.camYaw,
    camPitch: state.camPitch,
    camZoom: state.camZoom,
    targetYaw: state.camYaw,
    targetPitch: state.camPitch,
    targetZoom: state.camZoom,
    lightAngleOffset: 0
  };

  /* ============================================================================
   * WEBGL2 INITIALIZATION & CAPABILITY DETECTION
   * ============================================================================ */
  const canvas = document.getElementById('gl-canvas');
  const gl = canvas.getContext('webgl2', {
    antialias: false,
    alpha: false,
    depth: false,
    stencil: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true
  });

  if (!gl) {
    document.getElementById('webgl-error').style.display = 'flex';
    return;
  }

  // Detect floating-point texture linear filtering support with graceful fallback
  const hasFloatLinear = !!gl.getExtension('OES_texture_float_linear');
  const hasHalfFloatLinear = !!gl.getExtension('OES_texture_half_float_linear');
  const sdfMode = hasFloatLinear ? 'R32F' : (hasHalfFloatLinear ? 'R16F' : 'R8');

  const gpuBadge = document.getElementById('gpu-badge');
  gpuBadge.textContent = `WebGL2 • ${sdfMode} SDF`;

  const textSdf = createTextSdfManager(gl, sdfMode);

  /* ============================================================================
   * SHADER PROGRAMS & BUFFERS
   * ============================================================================ */
  let crystalProg, particleProg;
  try {
    crystalProg = createProgram(gl, CRYSTAL_VERT, CRYSTAL_FRAG);
    particleProg = createProgram(gl, PARTICLE_VERT, PARTICLE_FRAG);
  } catch (err) {
    document.getElementById('webgl-error').style.display = 'flex';
    document.getElementById('webgl-error-msg').textContent = err.message;
    console.error(err);
    return;
  }

  const uC = {};
  [
    'uResolution', 'uTime', 'uTextSDF', 'uSdfIsR8',
    'uCamPos', 'uCamTarget',
    'uTextSize', 'uTextDepth', 'uTextThickness', 'uTextRot', 'uTextPos',
    'uRefraction', 'uIOR', 'uReflection', 'uFresnel', 'uDispersion', 'uTransparency',
    'uFrost', 'uRoughness', 'uSmoothness', 'uWaterDistortion', 'uSurfaceDetail',
    'uLightIntensity', 'uLightColor', 'uLightDir', 'uRimLight', 'uBgIllum',
    'uSphereSize', 'uShapeType', 'uInternalGlow', 'uBaseTint', 'uAbsorption', 'uEngravingColor',
    'uRimColor', 'uMetalness', 'uIridescence', 'uIcePreset',
    'uReveal', 'uExplode', 'uXray', 'uLightExp', 'uFreeze'
  ].forEach(name => { uC[name] = gl.getUniformLocation(crystalProg, name); });

  const uP = {};
  ['uViewProj', 'uTime', 'uSphereSize', 'uReveal', 'uFreeze', 'uPixelRatio', 'uRimColor', 'uLightColor']
    .forEach(name => { uP[name] = gl.getUniformLocation(particleProg, name); });

  const quadVao = gl.createVertexArray();
  const quadVbo = gl.createBuffer();
  gl.bindVertexArray(quadVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadVbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const locPos = gl.getAttribLocation(crystalProg, 'aPos');
  gl.enableVertexAttribArray(locPos);
  gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  const MAX_PARTICLES = 900;
  const particleSeeds = new Float32Array(MAX_PARTICLES * 4);
  for (let i = 0; i < MAX_PARTICLES; i++) {
    particleSeeds[i * 4 + 0] = Math.random();
    particleSeeds[i * 4 + 1] = Math.random();
    particleSeeds[i * 4 + 2] = Math.random();
    particleSeeds[i * 4 + 3] = Math.random();
  }
  const particleVao = gl.createVertexArray();
  const particleVbo = gl.createBuffer();
  gl.bindVertexArray(particleVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, particleVbo);
  gl.bufferData(gl.ARRAY_BUFFER, particleSeeds, gl.STATIC_DRAW);
  const locSeed = gl.getAttribLocation(particleProg, 'aSeed');
  gl.enableVertexAttribArray(locSeed);
  gl.vertexAttribPointer(locSeed, 4, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  /* ============================================================================
   * UI WIRING, PRESETS, SLIDERS, CAMERA ORBIT & WOW MODES
   * ============================================================================ */
  let toastTimer = null;
  function showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
  }

  const shapeGrid = document.getElementById('shape-grid');
  SHAPES.forEach(s => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'shape-card' + (s.id === state.shapeType ? ' active' : '');
    btn.dataset.shape = String(s.id);
    btn.innerHTML = `<svg viewBox="0 0 24 24">${s.svg}</svg><span class="shape-name">${s.name}</span>`;
    btn.addEventListener('click', () => {
      state.shapeType = s.id;
      document.querySelectorAll('.shape-card').forEach(c => {
        c.classList.toggle('active', c.dataset.shape === String(s.id));
      });
      showToast(`Shape: ${s.name}`);
    });
    shapeGrid.appendChild(btn);
  });

  const presetGrid = document.getElementById('preset-grid');
  PRESETS.forEach(p => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset-card' + (p.id === state.activePreset ? ' active' : '');
    btn.dataset.preset = p.id;
    btn.innerHTML = `<span class="preset-swatch" style="background:${p.swatch}"></span><span class="preset-name">${p.name}</span>`;
    btn.addEventListener('click', () => applyPreset(p.id));
    presetGrid.appendChild(btn);
  });

  function applyPreset(id) {
    const preset = PRESETS.find(p => p.id === id);
    if (!preset) return;
    state.activePreset = id;
    Object.assign(state, JSON.parse(JSON.stringify(preset.values)));
    if (id === 'ice') {
      state.freezeMode = true;
      document.getElementById('wow-freeze').classList.add('active');
    } else if (state.freezeMode && id !== 'ice') {
      state.freezeMode = false;
      document.getElementById('wow-freeze').classList.remove('active');
    }
    syncAllControlsFromState();
    document.querySelectorAll('.preset-card').forEach(c => {
      c.classList.toggle('active', c.dataset.preset === id);
    });
    showToast(`Material: ${preset.name}`);
  }

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => {
        const active = b.dataset.tab === target;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === 'tab-' + target);
      });
    });
  });

  const nameInput = document.getElementById('student-name-input');
  const charCount = document.getElementById('name-char-count');
  nameInput.addEventListener('input', () => {
    state.studentName = nameInput.value;
    charCount.textContent = `${state.studentName.length} chars`;
    textSdf.update(state.studentName, state.font);
  });

  const fontSelect = document.getElementById('ctrl-font');
  fontSelect.addEventListener('change', () => {
    state.font = fontSelect.value;
    textSdf.update(state.studentName, state.font);
  });

  const SLIDER_BINDINGS = [
    { id: 'textSize',        fmt: v => v.toFixed(2) },
    { id: 'textDepth',       fmt: v => v.toFixed(3) },
    { id: 'textThickness',   fmt: v => v.toFixed(3) },
    { id: 'textRotY',        fmt: v => `${Math.round(v)}°` },
    { id: 'textRotX',        fmt: v => `${Math.round(v)}°` },
    { id: 'textPosX',        fmt: v => v.toFixed(2) },
    { id: 'textPosY',        fmt: v => v.toFixed(2) },
    { id: 'refraction',      fmt: v => v.toFixed(2) },
    { id: 'ior',             fmt: v => v.toFixed(2) },
    { id: 'reflection',      fmt: v => v.toFixed(2) },
    { id: 'fresnel',         fmt: v => v.toFixed(2) },
    { id: 'dispersion',      fmt: v => v.toFixed(3) },
    { id: 'transparency',    fmt: v => v.toFixed(2) },
    { id: 'frost',           fmt: v => v.toFixed(2) },
    { id: 'roughness',       fmt: v => v.toFixed(2), onChange: v => {
      state.smoothness = Math.max(0, Math.min(1, +(1 - v).toFixed(2)));
      syncSingleSlider('smoothness');
    }},
    { id: 'smoothness',      fmt: v => v.toFixed(2), onChange: v => {
      state.roughness = Math.max(0, Math.min(1, +(1 - v).toFixed(2)));
      syncSingleSlider('roughness');
    }},
    { id: 'waterDistortion', fmt: v => v.toFixed(2) },
    { id: 'surfaceDetail',   fmt: v => v.toFixed(2) },
    { id: 'lightIntensity',  fmt: v => v.toFixed(2) },
    { id: 'lightAzimuth',    fmt: v => `${Math.round(v)}°` },
    { id: 'lightElevation',  fmt: v => `${Math.round(v)}°` },
    { id: 'rimLight',        fmt: v => v.toFixed(2) },
    { id: 'bgIllum',         fmt: v => v.toFixed(2) },
    { id: 'sphereSize',      fmt: v => v.toFixed(2) },
    { id: 'internalGlow',    fmt: v => v.toFixed(2) },
    { id: 'particles',       fmt: v => `${Math.round(v)}%` },
    { id: 'animSpeed',       fmt: v => `${v.toFixed(2)}x` },
    { id: 'camYaw',          fmt: v => `${Math.round(v)}°`, onChange: v => { anim.targetYaw = v; } },
    { id: 'camPitch',        fmt: v => `${Math.round(v)}°`, onChange: v => { anim.targetPitch = v; } },
    { id: 'camZoom',         fmt: v => v.toFixed(2), onChange: v => { anim.targetZoom = v; } }
  ];

  function syncSingleSlider(key) {
    const b = SLIDER_BINDINGS.find(item => item.id === key);
    if (!b) return;
    const input = document.getElementById('ctrl-' + b.id);
    const valEl = document.getElementById('val-' + b.id);
    if (input) input.value = state[b.id];
    if (valEl) valEl.textContent = b.fmt(state[b.id]);
  }

  SLIDER_BINDINGS.forEach(b => {
    const input = document.getElementById('ctrl-' + b.id);
    const valEl = document.getElementById('val-' + b.id);
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      state[b.id] = v;
      valEl.textContent = b.fmt(v);
      if (b.onChange) b.onChange(v);
    });
  });

  const lightColorInput = document.getElementById('ctrl-lightColor');
  lightColorInput.addEventListener('input', () => {
    state.lightColor = lightColorInput.value;
  });
  document.querySelectorAll('.color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      state.lightColor = dot.dataset.color;
      lightColorInput.value = state.lightColor;
    });
  });

  function syncAllControlsFromState() {
    nameInput.value = state.studentName;
    charCount.textContent = `${state.studentName.length} chars`;
    fontSelect.value = state.font;
    lightColorInput.value = state.lightColor;
    SLIDER_BINDINGS.forEach(b => syncSingleSlider(b.id));
    anim.targetYaw = state.camYaw;
    anim.targetPitch = state.camPitch;
    anim.targetZoom = state.camZoom;
  }

  const btnPlayPause = document.getElementById('btn-play-pause');
  const iconPause = document.getElementById('icon-pause');
  const iconPlay = document.getElementById('icon-play');
  const labelPlayPause = document.getElementById('label-play-pause');

  function togglePause() {
    state.paused = !state.paused;
    iconPause.style.display = state.paused ? 'none' : 'block';
    iconPlay.style.display = state.paused ? 'block' : 'none';
    labelPlayPause.textContent = state.paused ? 'Play' : 'Pause';
    btnPlayPause.classList.toggle('active', state.paused);
    showToast(state.paused ? 'Animation Paused' : 'Animation Resumed');
  }
  btnPlayPause.addEventListener('click', togglePause);

  document.getElementById('btn-reset').addEventListener('click', () => {
    const keepName = state.studentName;
    Object.assign(state, JSON.parse(JSON.stringify(DEFAULT_STATE)));
    state.studentName = keepName || 'STUDENT NAME';
    anim.reveal = 1.0;
    anim.revealActive = false;
    anim.lightAngleOffset = 0;
    document.getElementById('wow-explode').classList.remove('active');
    document.getElementById('wow-xray').classList.remove('active');
    document.getElementById('wow-light').classList.remove('active');
    document.getElementById('wow-freeze').classList.remove('active');
    document.getElementById('science-telemetry').classList.remove('visible');
    document.querySelectorAll('.preset-card').forEach(c => {
      c.classList.toggle('active', c.dataset.preset === 'crystal');
    });
    document.querySelectorAll('.shape-card').forEach(c => {
      c.classList.toggle('active', c.dataset.shape === '0');
    });
    if (state.paused) togglePause();
    syncAllControlsFromState();
    textSdf.update(state.studentName, state.font);
    showToast('Crystal Lab Reset');
  });

  document.getElementById('btn-fullscreen').addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {
        showToast('Fullscreen is restricted in this frame');
      });
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  });

  const btnTogglePanel = document.getElementById('btn-toggle-panel');
  btnTogglePanel.addEventListener('click', () => {
    const collapsed = document.body.classList.toggle('panel-collapsed');
    btnTogglePanel.classList.toggle('active', !collapsed);
  });

  document.getElementById('wow-reveal').addEventListener('click', () => {
    anim.reveal = 0.0;
    anim.revealActive = true;
    if (state.paused) togglePause();
    showToast(`Revealing "${state.studentName || 'Crystal'}"...`);
  });

  document.getElementById('wow-explode').addEventListener('click', e => {
    state.explodeMode = !state.explodeMode;
    e.currentTarget.classList.toggle('active', state.explodeMode);
    showToast(state.explodeMode ? 'Exploded View: Outer Glass • Core • Engraving' : 'Assembled Crystal');
  });

  document.getElementById('wow-xray').addEventListener('click', e => {
    state.xrayMode = !state.xrayMode;
    e.currentTarget.classList.toggle('active', state.xrayMode);
    showToast(state.xrayMode ? 'X-Ray Optical Scan Active' : 'Standard Optical View');
  });

  document.getElementById('wow-light').addEventListener('click', e => {
    state.lightExperiment = !state.lightExperiment;
    e.currentTarget.classList.toggle('active', state.lightExperiment);
    document.getElementById('science-telemetry').classList.toggle('visible', state.lightExperiment);
    showToast(state.lightExperiment ? 'Light Experiment: Observing Refraction & Caustics' : 'Light Experiment Ended');
  });

  document.getElementById('wow-freeze').addEventListener('click', e => {
    state.freezeMode = !state.freezeMode;
    e.currentTarget.classList.toggle('active', state.freezeMode);
    showToast(state.freezeMode ? 'Freeze Mode: Crystalline Solid State' : 'Fluid Motion Restored');
  });

  function setPresentationMode(enabled) {
    state.presentationMode = enabled;
    document.body.classList.toggle('presentation-mode', enabled);
    if (enabled) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      showToast('Presentation Mode — Press Esc to return');
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  }

  document.getElementById('wow-present').addEventListener('click', () => setPresentationMode(true));
  document.getElementById('btn-exit-presentation').addEventListener('click', () => setPresentationMode(false));

  const shotModal = document.getElementById('screenshot-modal');
  const shotImg = document.getElementById('screenshot-img');
  const shotDownload = document.getElementById('btn-download-shot');

  document.getElementById('wow-screenshot').addEventListener('click', () => {
    renderFrame(0);
    const dataUrl = canvas.toDataURL('image/png');
    const safeName = (state.studentName || 'crystal').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'crystal';
    shotImg.src = dataUrl;
    shotDownload.href = dataUrl;
    shotDownload.download = `crystal-identity-${safeName}.png`;
    shotModal.classList.add('open');
    showToast('High-resolution crystal captured');
  });

  document.getElementById('btn-close-modal').addEventListener('click', () => shotModal.classList.remove('open'));
  shotModal.addEventListener('click', e => { if (e.target === shotModal) shotModal.classList.remove('open'); });

  window.addEventListener('keydown', e => {
    if (document.activeElement === nameInput) return;
    if (e.key === 'Escape') {
      if (shotModal.classList.contains('open')) shotModal.classList.remove('open');
      else if (state.presentationMode) setPresentationMode(false);
    } else if (e.code === 'Space') {
      e.preventDefault();
      togglePause();
    }
  });

  /* ============================================================================
   * SMOOTH ORBIT CAMERA (MOUSE, TOUCH & WHEEL)
   * ============================================================================ */
  const orbitHint = document.getElementById('orbit-hint');
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;
  let pinchStartDist = 0;
  let pinchStartZoom = 3.45;

  canvas.addEventListener('pointerdown', e => {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    orbitHint.classList.add('hidden');
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', e => {
    if (!isDragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    anim.targetYaw = ((anim.targetYaw - dx * 0.38 + 180) % 360 + 360) % 360 - 180;
    anim.targetPitch = Math.max(-55, Math.min(55, anim.targetPitch + dy * 0.30));
    state.camYaw = anim.targetYaw;
    state.camPitch = anim.targetPitch;
    syncSingleSlider('camYaw');
    syncSingleSlider('camPitch');
  });

  canvas.addEventListener('pointerup', e => {
    isDragging = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
  });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    orbitHint.classList.add('hidden');
    anim.targetZoom = Math.max(2.40, Math.min(6.20, anim.targetZoom + e.deltaY * 0.0022));
    state.camZoom = anim.targetZoom;
    syncSingleSlider('camZoom');
  }, { passive: false });

  canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      isDragging = false;
      pinchStartDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchStartZoom = anim.targetZoom;
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', e => {
    if (e.touches.length === 2 && pinchStartDist > 0) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = pinchStartDist / Math.max(10, dist);
      anim.targetZoom = Math.max(2.40, Math.min(6.20, pinchStartZoom * scale));
      state.camZoom = anim.targetZoom;
      syncSingleSlider('camZoom');
    }
  }, { passive: true });

  /* ============================================================================
   * ADAPTIVE RESOLUTION SCALING FOR CLASSROOM LAPTOPS
   * ============================================================================ */
  let pixelRatio = 1.0;
  let adaptiveScale = 1.0;

  function resizeCanvas() {
    const baseDpr = Math.min(window.devicePixelRatio || 1, 1.5);
    pixelRatio = Math.max(0.65, baseDpr * adaptiveScale);
    const w = Math.max(1, Math.floor(window.innerWidth * pixelRatio));
    const h = Math.max(1, Math.floor(window.innerHeight * pixelRatio));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }
  window.addEventListener('resize', resizeCanvas);

  /* ============================================================================
   * MAIN RENDER LOOP
   * ============================================================================ */
  const fpsBadge = document.getElementById('fps-badge');
  const telIor = document.getElementById('tel-ior');
  const telCrit = document.getElementById('tel-crit');
  const telAz = document.getElementById('tel-az');
  const telDisp = document.getElementById('tel-disp');

  let lastFrameMs = performance.now();
  let fpsFrames = 0;
  let fpsLastUpdate = performance.now();

  function renderFrame(dt) {
    resizeCanvas();

    if (!state.paused) {
      anim.time += dt * state.animSpeed;
      if (anim.revealActive) {
        anim.reveal = Math.min(1.0, anim.reveal + dt * 0.34);
        if (anim.reveal >= 1.0) anim.revealActive = false;
      }
      if (state.lightExperiment) {
        anim.lightAngleOffset = (anim.lightAngleOffset + dt * 52.0 * Math.max(0.4, state.animSpeed)) % 360;
      }
    }

    const lerpRate = Math.min(1.0, dt * 5.5);
    anim.explode += ((state.explodeMode ? 1.0 : 0.0) - anim.explode) * lerpRate;
    anim.xray += ((state.xrayMode ? 1.0 : 0.0) - anim.xray) * lerpRate;
    anim.lightExp += ((state.lightExperiment ? 1.0 : 0.0) - anim.lightExp) * lerpRate;
    anim.freeze += ((state.freezeMode ? 1.0 : 0.0) - anim.freeze) * lerpRate;

    anim.camYaw += (anim.targetYaw - anim.camYaw) * Math.min(1.0, dt * 8.0);
    anim.camPitch += (anim.targetPitch - anim.camPitch) * Math.min(1.0, dt * 8.0);
    anim.camZoom += (anim.targetZoom - anim.camZoom) * Math.min(1.0, dt * 8.0);

    const idleYaw = isDragging ? 0 : Math.sin(anim.time * 0.28) * 3.0;
    const yawRad = (anim.camYaw + idleYaw) * Math.PI / 180;
    const pitchRad = anim.camPitch * Math.PI / 180;

    const panelOpen = !document.body.classList.contains('panel-collapsed') && !state.presentationMode && window.innerWidth > 900;
    const targetX = panelOpen ? 0.24 : 0.0;
    const camTarget = [targetX, 0.0, 0.0];
    const camPos = [
      camTarget[0] + Math.sin(yawRad) * Math.cos(pitchRad) * anim.camZoom,
      camTarget[1] + Math.sin(pitchRad) * anim.camZoom,
      camTarget[2] + Math.cos(yawRad) * Math.cos(pitchRad) * anim.camZoom
    ];

    const totalAzDeg = state.lightAzimuth + (state.lightExperiment ? anim.lightAngleOffset : 0);
    const lAz = totalAzDeg * Math.PI / 180;
    const lEl = state.lightElevation * Math.PI / 180;
    const lightDir = [
      Math.sin(lAz) * Math.cos(lEl),
      Math.sin(lEl),
      Math.cos(lAz) * Math.cos(lEl)
    ];

    if (state.lightExperiment) {
      const ior = Math.max(1.01, state.ior);
      const critDeg = Math.asin(1.0 / ior) * 180 / Math.PI;
      telIor.textContent = ior.toFixed(2);
      telCrit.textContent = `${critDeg.toFixed(1)}°`;
      telAz.textContent = `${Math.round(((totalAzDeg % 360) + 360) % 360)}°`;
      telDisp.textContent = `Δn ${state.dispersion.toFixed(3)}`;
    }

    const lightRgb = hexToRgb01(state.lightColor);

    gl.viewport(0, 0, canvas.width, canvas.height);

    // PASS A: Raymarched Crystal Sphere & 3D Engraved Name
    gl.disable(gl.BLEND);
    gl.useProgram(crystalProg);
    gl.bindVertexArray(quadVao);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textSdf.texture);
    gl.uniform1i(uC.uTextSDF, 0);
    gl.uniform1f(uC.uSdfIsR8, sdfMode === 'R8' ? 1.0 : 0.0);

    gl.uniform2f(uC.uResolution, canvas.width, canvas.height);
    gl.uniform1f(uC.uTime, anim.time);
    gl.uniform3fv(uC.uCamPos, camPos);
    gl.uniform3fv(uC.uCamTarget, camTarget);

    gl.uniform1f(uC.uTextSize, state.textSize);
    gl.uniform1f(uC.uTextDepth, state.textDepth);
    gl.uniform1f(uC.uTextThickness, state.textThickness);
    gl.uniform2f(uC.uTextRot, state.textRotY * Math.PI / 180, state.textRotX * Math.PI / 180);
    gl.uniform2f(uC.uTextPos, state.textPosX, state.textPosY);

    gl.uniform1f(uC.uRefraction, state.refraction);
    gl.uniform1f(uC.uIOR, state.ior);
    gl.uniform1f(uC.uReflection, state.reflection);
    gl.uniform1f(uC.uFresnel, state.fresnel);
    gl.uniform1f(uC.uDispersion, state.dispersion);
    gl.uniform1f(uC.uTransparency, state.transparency);

    gl.uniform1f(uC.uFrost, state.frost);
    gl.uniform1f(uC.uRoughness, state.roughness);
    gl.uniform1f(uC.uSmoothness, state.smoothness);
    gl.uniform1f(uC.uWaterDistortion, state.waterDistortion);
    gl.uniform1f(uC.uSurfaceDetail, state.surfaceDetail);

    gl.uniform1f(uC.uLightIntensity, state.lightIntensity);
    gl.uniform3fv(uC.uLightColor, lightRgb);
    gl.uniform3fv(uC.uLightDir, lightDir);
    gl.uniform1f(uC.uRimLight, state.rimLight);
    gl.uniform1f(uC.uBgIllum, state.bgIllum);

    gl.uniform1f(uC.uSphereSize, state.sphereSize);
    gl.uniform1i(uC.uShapeType, state.shapeType);
    gl.uniform1f(uC.uInternalGlow, state.internalGlow);
    gl.uniform3fv(uC.uBaseTint, state.baseTint);
    gl.uniform3fv(uC.uAbsorption, state.absorption);
    gl.uniform3fv(uC.uEngravingColor, state.engravingColor);
    gl.uniform3fv(uC.uRimColor, state.rimColor);
    gl.uniform1f(uC.uMetalness, state.metalness);
    gl.uniform1f(uC.uIridescence, state.iridescence);
    gl.uniform1f(uC.uIcePreset, state.icePreset);

    gl.uniform1f(uC.uReveal, anim.reveal);
    gl.uniform1f(uC.uExplode, anim.explode);
    gl.uniform1f(uC.uXray, anim.xray);
    gl.uniform1f(uC.uLightExp, anim.lightExp);
    gl.uniform1f(uC.uFreeze, anim.freeze);

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // PASS B: Floating 3D Bokeh Particles
    const activeParticles = Math.floor((state.particles / 100) * MAX_PARTICLES);
    if (activeParticles > 0) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.useProgram(particleProg);
      gl.bindVertexArray(particleVao);

      const viewProj = buildViewProj(camPos, camTarget, canvas.width / Math.max(1, canvas.height));
      gl.uniformMatrix4fv(uP.uViewProj, false, viewProj);
      gl.uniform1f(uP.uTime, anim.time);
      gl.uniform1f(uP.uSphereSize, state.sphereSize);
      gl.uniform1f(uP.uReveal, anim.reveal);
      gl.uniform1f(uP.uFreeze, anim.freeze);
      gl.uniform1f(uP.uPixelRatio, pixelRatio);
      gl.uniform3fv(uP.uRimColor, state.rimColor);
      gl.uniform3fv(uP.uLightColor, lightRgb);

      gl.drawArrays(gl.POINTS, 0, activeParticles);
      gl.disable(gl.BLEND);
    }
  }

  function loop(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameMs) / 1000));
    lastFrameMs = now;
    renderFrame(dt);

    fpsFrames++;
    if (now - fpsLastUpdate >= 600) {
      const fps = Math.round((fpsFrames * 1000) / (now - fpsLastUpdate));
      fpsBadge.textContent = `${fps} FPS`;
      // Gentle adaptive scaling for classroom laptops
      if (fps < 24 && adaptiveScale > 0.72) {
        adaptiveScale = Math.max(0.70, adaptiveScale - 0.08);
      } else if (fps > 52 && adaptiveScale < 1.0) {
        adaptiveScale = Math.min(1.0, adaptiveScale + 0.05);
      }
      fpsFrames = 0;
      fpsLastUpdate = now;
    }
    requestAnimationFrame(loop);
  }

  syncAllControlsFromState();
  textSdf.update(state.studentName, state.font);
  resizeCanvas();
  requestAnimationFrame(loop);
}

init();
