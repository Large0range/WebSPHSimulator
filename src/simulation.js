import * as THREE from 'three';
import { calculateBlock, createParticles } from './particle';
import { EffectComposer, GPUComputationRenderer, RenderPass, ShaderPass } from 'three/examples/jsm/Addons.js';

import densityShaderSrc from './density.glsl?raw';
import vertexShaderSrc from './vertex.glsl?raw';
import displayShaderSrc from './display.glsl?raw';
import shellsortShaderSrc from './shellsort.glsl?raw';
import moveShaderSrc from './move.glsl?raw';
import { NodeBuilder } from 'three/webgpu';
import { instancedArray, instanceIndex } from 'three/src/nodes/TSL.js';
import { Fn } from 'three/tsl';

function roundToEven(x) {
  const c = Math.ceil(x);
  if (c % 2 != 0) return Math.floor(x);
  return c;
}

export function runSimulation(width, height, count, smoothingRadius, mass, stiffSlider, viscSlider, targetSlider, gravSlider) {
  //count = 4;


  const deltaTime = 0.004;// best
  const refDensity = mass * count / (width * height);


  const stiffness_constant = Number(stiffSlider.value);
  const viscosity_constant = Number(viscSlider.value);
  const target_density = Number(targetSlider.value / 100);



  //const smoothingRadius = Number(document.querySelector("#smooth").value);


  // Generate intial particle data and the particle position texture that is used
  //
  // DEBUG ------------------------------------------------------------------
  const data = new Float32Array(4 * count);
  const texWidth = roundToEven(Math.sqrt(count));
  const texHeight = count / texWidth;

  const numBlocksX = Math.ceil(width / smoothingRadius) + 1;


  const particles = createParticles(width, height, count);

  let mouseDown = false;
  let mousePos = [0,0];

  //width = texWidth;
  //height = texHeight;



  //const blocks = createBlocks(width, height, particles);

  // Replace the canvas with a fresh clone to avoid reusing a lost WebGL context
  const oldCanvas = document.querySelector("#simulation");
  const canvas = oldCanvas.cloneNode(false); // shallow clone, no children/context
  oldCanvas.replaceWith(canvas);

  canvas.addEventListener("pointerdown", (event) => {
    mouseDown = true;

    //console.log(rect.x, canvas.width - (event.clientX - rect.x), canvas.height - (event.clientY - rect.y));
  })

  canvas.addEventListener("pointerup", (event) => {
    mouseDown = false;
  })

  canvas.addEventListener("pointermove", (event) => {
    const rect = canvas.getBoundingClientRect();
    mousePos = [event.clientX - rect.x, canvas.height - (event.clientY - rect.y)];
  })

  const renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setSize(width, height);




  console.log(texWidth, texHeight, particles.length);

  for (let i = 0; i < particles.length; i++) {
    let x = particles[i].position.x;
    let y = particles[i].position.y;

    data[i * 4 + 0] = x;
    data[i * 4 + 1] = y;
    data[i * 4 + 2] = 0;
    data[i * 4 + 3] = 0;
  }

  console.log(data);

  const positionTexture = new THREE.DataTexture(data, texWidth, texHeight, THREE.RGBAFormat, THREE.FloatType);
  positionTexture.needsUpdate = true;



  //SETUP SIMULATION LOGIC
  /*const positionArray = instancedArray(particles.length, 'vec4');

  const computeShader = Fn(() => {
    const position = positionArray.element(instanceIndex);

    position.x.addAssign(0);
  })().compute(particles.length); -- Maybe?*/





  // Setup sorter for the position texture, must be power of 2
  const sortRenderer = new GPUComputationRenderer(texWidth, texHeight, renderer);
  const sortPosVar = sortRenderer.addVariable("positionTexture", shellsortShaderSrc, positionTexture);
  sortRenderer.setVariableDependencies(sortPosVar, [sortPosVar]);

  sortPosVar.material.uniforms.DISTANCE = { value: 1 };
  sortPosVar.material.uniforms.texWidth = { value: texWidth };
  sortPosVar.material.uniforms.numBlocksX = { value: numBlocksX };
  sortPosVar.material.uniforms.RADIUS = { value: smoothingRadius };

  sortRenderer.init();

  // Inital sorting of the positions data -- look into CountingSort method from threejs
  for (let i = count-1; i > 0; i--) {
    sortPosVar.material.uniforms.DISTANCE = { value: i };
    sortRenderer.compute();

  }
  const sortedPositionTexture = sortRenderer.getCurrentRenderTarget(sortPosVar).texture;




  const densityRenderer = new GPUComputationRenderer(texWidth, texHeight, renderer);
  const densityVar = densityRenderer.addVariable("densityTexture", densityShaderSrc, sortedPositionTexture);

  densityVar.material.uniforms.RADIUS = { value: smoothingRadius };
  densityVar.material.uniforms.MASS = { value: mass };
  densityVar.material.uniforms.numBlocksX = { value: numBlocksX };
  densityVar.material.uniforms.count = { value: particles.length };
  densityVar.material.uniforms.texWidth = { value: texWidth };
  densityVar.material.uniforms.texHeight = { value: texHeight };

  densityRenderer.init();


  const physicsRenderer = new GPUComputationRenderer(texWidth, texHeight, renderer);
  const physicsPosVar = physicsRenderer.addVariable("positionTexture", moveShaderSrc, sortedPositionTexture);

  physicsPosVar.material.uniforms.texWidth = { value: texWidth };
  physicsPosVar.material.uniforms.texHeight = { value: texHeight };
  physicsPosVar.material.uniforms.screenWidth = { value: width };
  physicsPosVar.material.uniforms.screenHeight = { value: height };
  physicsPosVar.material.uniforms.count = { value: particles.length };
  physicsPosVar.material.uniforms.STIFF = { value: stiffness_constant };
  physicsPosVar.material.uniforms.VISC_CONSTANT = { value: viscosity_constant };
  physicsPosVar.material.uniforms.TARGET_DENSITY = { value: target_density * refDensity };
  physicsPosVar.material.uniforms.MASS = { value: mass };
  physicsPosVar.material.uniforms.RADIUS = { value: smoothingRadius };
  physicsPosVar.material.uniforms.DELTA_TIME = { value: deltaTime };
  physicsPosVar.material.uniforms.numBlocksX = { value: numBlocksX };

  physicsPosVar.material.uniforms.mouseDown = { value: mouseDown };
  physicsPosVar.material.uniforms.mousePos = { value: mousePos };

  physicsRenderer.init();



  //create the post effect composer
  const composer = new EffectComposer(renderer);
  const DisplayShader = {
    uniforms: {
      // tDiffuse is automatically populated with the rendered scene texture
      tDiffuse: { value: null },

      RADIUS: { value: smoothingRadius },
      MASS: { value: mass },
      refDense: { value: refDensity },
      count: { value: count },
      texWidth: { value: texWidth },
      texHeight: { value: texHeight },
      numBlocksX: { value: numBlocksX },

      positionTexture: { value: null },
    },
    vertexShader: vertexShaderSrc,
    fragmentShader: displayShaderSrc
  };

  // Create the shader pass
  const densityPass = new ShaderPass(DisplayShader);
  composer.addPass(densityPass);





  const buffer = new Float32Array(texWidth * texHeight * 4); // RGBA per texel
  renderer.setAnimationLoop((now) => {
    sortRenderer.renderTexture(physicsRenderer.getCurrentRenderTarget(physicsPosVar).texture, sortPosVar.renderTargets[0]);
    sortRenderer.renderTexture(physicsRenderer.getCurrentRenderTarget(physicsPosVar).texture, sortPosVar.renderTargets[1]);

    for (let i = count - 1; i > 0; i--) {
      sortPosVar.material.uniforms.DISTANCE.value = i;
      sortRenderer.compute();
    }

    densityVar.material.uniforms.positionTexture = { value: sortRenderer.getCurrentRenderTarget(sortPosVar).texture };
    densityRenderer.compute();

    physicsPosVar.material.uniforms.positionTexture = { value: sortRenderer.getCurrentRenderTarget(sortPosVar).texture };
    physicsPosVar.material.uniforms.densityTexture = { value: densityRenderer.getCurrentRenderTarget(densityVar).texture };
    physicsPosVar.material.uniforms.mouseDown.value = mouseDown;
    physicsPosVar.material.uniforms.mousePos = { value: mousePos };


    physicsPosVar.material.uniforms.STIFF = { value: Number(stiffSlider.value) };
    physicsPosVar.material.uniforms.VISC_CONSTANT = { value: Number(viscSlider.value) };
    physicsPosVar.material.uniforms.TARGET_DENSITY = { value: Number(targetSlider.value / 100) * refDensity };
    physicsPosVar.material.uniforms.GRAVITY = { value: Number(gravSlider.value) };


    physicsRenderer.compute();

    //calculate the density field, take the output, and then render


    //console.log("pass");
    //renderer.readRenderTargetPixels(physicsRenderer.getCurrentRenderTarget(physicsPosVar), 0, 0, texWidth, texHeight, buffer);
    //console.log(buffer);

    densityPass.uniforms.positionTexture.value = sortRenderer.getCurrentRenderTarget(sortPosVar).texture;
    composer.render();

  })

  const cleanup = () => {
    renderer.setAnimationLoop(null);
    composer.dispose();
    densityPass.material.dispose();
    densityPass.uniforms.positionTexture.value.dispose();
    renderer.dispose();
    physicsRenderer.dispose();
    sortRenderer.dispose();
    renderer.forceContextLoss();

    document.querySelector("#run-button").removeAttribute("disabled");
    canvas.style.display = "none";
    document.querySelector("#preview").style.display = "";

    document.querySelector("#stop-button").onclick = null;

  };

  document.querySelector("#stop-button").onclick = cleanup;
}
