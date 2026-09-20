import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';

import sortSrc from './sort.glsl?raw';
import cellStartSrc from './cellstart.glsl?raw';
import densitySrc from './density.glsl?raw';
import moveSrc from './move.glsl?raw';
import splatVertSrc from './splat.vert.glsl?raw';
import splatFragSrc from './splat.frag.glsl?raw';
import resolveFragSrc from './resolve.frag.glsl?raw';

// ---- tunables -------------------------------------------------------------
const DT = 0.006;             // simulated seconds per substep
const SUBSTEPS = 2;           // full sort+density+force passes per frame
const STIFF_SCALE = 1000;     // slider -> pressure stiffness
const VISC_SCALE = 10;        // slider -> viscosity
const GRAVITY_SCALE = 10;     // slider -> px / s^2
const MOUSE_RADIUS = 60;      // px
const MOUSE_STRENGTH = 20000; // px / s^2
const WALL_RESTITUTION = 0.3;
// Stability rule of thumb: sqrt(stiffness) * DT / smoothingRadius should stay
// below ~0.3. If it explodes at small radii or high stiffness, lower DT or
// raise SUBSTEPS.
// ---------------------------------------------------------------------------

export function runSimulation(width, height, count, smoothingRadius, mass, stiffSlider, viscSlider, targetSlider, gravSlider) {
  const R = smoothingRadius;

  // bitonic sort needs a power-of-two count; keep the texture power-of-two too
  const log2n = Math.round(Math.log2(count));
  count = 2 ** log2n;
  const texWidth = 2 ** Math.ceil(log2n / 2);
  const texHeight = count / texWidth;

  const numBlocksX = Math.ceil(width / R) + 1;
  const numBlocksY = Math.ceil(height / R) + 1;
  const refDensity = (mass * count) / (width * height);

  // ---- canvas / renderer --------------------------------------------------
  // fresh canvas each run to avoid reusing a lost WebGL context
  const oldCanvas = document.querySelector("#simulation");
  const canvas = oldCanvas.cloneNode(false);
  oldCanvas.replaceWith(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(1); // everything is in raw pixels
  renderer.setSize(width, height);

  // ---- mouse --------------------------------------------------------------
  let mouseDown = false;
  const mousePos = new THREE.Vector2();
  const updateMouse = (e) => {
    const r = canvas.getBoundingClientRect();
    mousePos.set((e.clientX - r.left) * (width / r.width), (r.bottom - e.clientY) * (height / r.height));
  };
  const onDown = (e) => { mouseDown = true; updateMouse(e); canvas.setPointerCapture(e.pointerId); };
  const onMove = (e) => updateMouse(e);
  const onUp = () => { mouseDown = false; };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);

  // ---- initial particle state (xy = position, zw = velocity) ---------------
  const initial = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    initial[i * 4 + 0] = Math.random() * width;
    initial[i * 4 + 1] = Math.random() * height;
  }

  const check = (err, name) => { if (err !== null) console.error(`${name} init failed:`, err); };

  // ---- sort: positionTexture ping-pongs with itself -------------------------
  const sortGpu = new GPUComputationRenderer(texWidth, texHeight, renderer);
  const sortVar = sortGpu.addVariable("positionTexture", sortSrc, sortGpu.createTexture());
  sortGpu.setVariableDependencies(sortVar, [sortVar]);
  Object.assign(sortVar.material.uniforms, {
    K: { value: 2 },
    J: { value: 1 },
    texWidth: { value: texWidth },
    numBlocksX: { value: numBlocksX },
    RADIUS: { value: R },
  });
  check(sortGpu.init(), "sort");

  // ---- cell start table -----------------------------------------------------
  const cellGpu = new GPUComputationRenderer(numBlocksX + 1, numBlocksY, renderer);
  const cellVar = cellGpu.addVariable("cellStartTexture", cellStartSrc, cellGpu.createTexture());
  Object.assign(cellVar.material.uniforms, {
    positionTexture: { value: null },
    RADIUS: { value: R },
    numBlocksX: { value: numBlocksX },
    texWidth: { value: texWidth },
    count: { value: count },
  });
  check(cellGpu.init(), "cellStart");

  // ---- density --------------------------------------------------------------
  const densityGpu = new GPUComputationRenderer(texWidth, texHeight, renderer);
  const densityVar = densityGpu.addVariable("densityTexture", densitySrc, densityGpu.createTexture());
  Object.assign(densityVar.material.uniforms, {
    positionTexture: { value: null },
    cellStartTexture: { value: null },
    RADIUS: { value: R },
    MASS: { value: mass },
    numBlocksX: { value: numBlocksX },
    numBlocksY: { value: numBlocksY },
    texWidth: { value: texWidth },
  });
  check(densityGpu.init(), "density");

  // ---- forces + integration --------------------------------------------------
  const physicsGpu = new GPUComputationRenderer(texWidth, texHeight, renderer);
  const stateTex = physicsGpu.createTexture();
  stateTex.image.data.set(initial);
  const physicsVar = physicsGpu.addVariable("stateTexture", moveSrc, stateTex);
  const physU = physicsVar.material.uniforms;
  Object.assign(physU, {
    positionTexture: { value: null },
    densityTexture: { value: null },
    cellStartTexture: { value: null },
    RADIUS: { value: R },
    MASS: { value: mass },
    STIFF: { value: 0 },
    VISC_CONSTANT: { value: 0 },
    TARGET_DENSITY: { value: 0 },
    GRAVITY: { value: 0 },
    DELTA_TIME: { value: DT },
    MOUSE_RADIUS: { value: MOUSE_RADIUS },
    MOUSE_STRENGTH: { value: MOUSE_STRENGTH },
    WALL_RESTITUTION: { value: WALL_RESTITUTION },
    texWidth: { value: texWidth },
    numBlocksX: { value: numBlocksX },
    numBlocksY: { value: numBlocksY },
    screenWidth: { value: width },
    screenHeight: { value: height },
    mousePos: { value: mousePos },
    mouseDown: { value: false },
  });
  check(physicsGpu.init(), "physics");

  // ---- rendering: additive kernel splats -> resolve pass ----------------------
  const densityTarget = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.HalfFloatType,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: false,
  });

  const quad = new THREE.PlaneGeometry(2, 2);
  const splatGeo = new THREE.InstancedBufferGeometry();
  splatGeo.index = quad.index;
  splatGeo.setAttribute("position", quad.attributes.position);
  splatGeo.instanceCount = count;

  const splatMat = new THREE.ShaderMaterial({
    vertexShader: splatVertSrc,
    fragmentShader: splatFragSrc,
    uniforms: {
      positionTexture: { value: null },
      screenSize: { value: new THREE.Vector2(width, height) },
      RADIUS: { value: R },
      MASS: { value: mass },
      refDense: { value: refDensity },
      texWidth: { value: texWidth },
    },
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const splatMesh = new THREE.Mesh(splatGeo, splatMat);
  splatMesh.frustumCulled = false;
  const splatScene = new THREE.Scene();
  splatScene.add(splatMesh);

  const resolveMat = new THREE.ShaderMaterial({
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: resolveFragSrc,
    uniforms: { tDensity: { value: densityTarget.texture } },
    depthTest: false,
    depthWrite: false,
  });
  const resolveScene = new THREE.Scene();
  resolveScene.add(new THREE.Mesh(quad, resolveMat));
  const camera = new THREE.Camera();

  // ---- one simulation substep -------------------------------------------------
  function step() {
    const state = physicsGpu.getCurrentRenderTarget(physicsVar).texture;

    // copy latest state into both ping-pong targets of the sorter
    sortGpu.renderTexture(state, sortVar.renderTargets[0]);
    sortGpu.renderTexture(state, sortVar.renderTargets[1]);

    // bitonic sort: log2(n) * (log2(n) + 1) / 2 passes
    const sortU = sortVar.material.uniforms;
    for (let k = 2; k <= count; k <<= 1) {
      for (let j = k >> 1; j > 0; j >>= 1) {
        sortU.K.value = k;
        sortU.J.value = j;
        sortGpu.compute();
      }
    }
    const sorted = sortGpu.getCurrentRenderTarget(sortVar).texture;

    cellVar.material.uniforms.positionTexture.value = sorted;
    cellGpu.compute();
    const cellTex = cellGpu.getCurrentRenderTarget(cellVar).texture;

    densityVar.material.uniforms.positionTexture.value = sorted;
    densityVar.material.uniforms.cellStartTexture.value = cellTex;
    densityGpu.compute();
    const densTex = densityGpu.getCurrentRenderTarget(densityVar).texture;

    physU.positionTexture.value = sorted;
    physU.densityTexture.value = densTex;
    physU.cellStartTexture.value = cellTex;
    physicsGpu.compute();
  }

  renderer.setAnimationLoop(() => {
    // live sliders
    physU.STIFF.value = Number(stiffSlider.value) * STIFF_SCALE;
    physU.VISC_CONSTANT.value = Number(viscSlider.value) * VISC_SCALE;
    physU.TARGET_DENSITY.value = (Number(targetSlider.value) / 100) * refDensity;
    physU.GRAVITY.value = Number(gravSlider.value) * GRAVITY_SCALE;
    physU.mouseDown.value = mouseDown;

    for (let s = 0; s < SUBSTEPS; s++) step();

    // draw
    splatMat.uniforms.positionTexture.value = physicsGpu.getCurrentRenderTarget(physicsVar).texture;
    renderer.setRenderTarget(densityTarget);
    renderer.render(splatScene, camera);
    renderer.setRenderTarget(null);
    renderer.render(resolveScene, camera);
  });

  // ---- teardown ---------------------------------------------------------------
  const cleanup = () => {
    renderer.setAnimationLoop(null);

    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", onUp);

    for (const g of [sortGpu, cellGpu, densityGpu, physicsGpu]) g.dispose?.();
    densityTarget.dispose();
    splatGeo.dispose();
    quad.dispose();
    splatMat.dispose();
    resolveMat.dispose();
    renderer.dispose();
    renderer.forceContextLoss();

    document.querySelector("#run-button").removeAttribute("disabled");
    canvas.style.display = "none";
    document.querySelector("#preview").style.display = "";
    document.querySelector("#stop-button").onclick = null;
  };

  document.querySelector("#stop-button").onclick = cleanup;
}
