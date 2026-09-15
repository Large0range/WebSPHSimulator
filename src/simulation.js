import * as THREE from 'three';
import { calculateBlock, createParticles, constrainParticles, integrate, calculateDensity, smoothingRadius, createBlocks, mass } from './particle';
import { EffectComposer, GPUComputationRenderer, RenderPass, ShaderPass } from 'three/examples/jsm/Addons.js';

import densityShaderSrc from './density.glsl?raw';
import vertexShaderSrc from './vertex.glsl?raw';
import displayShaderSrc from './display.glsl?raw';
import shellsortShaderSrc from './shellsort.glsl?raw';

function roundToEven(x) {
  const c = Math.ceil(x);
  if (c % 2 != 0) return Math.floor(x);
  return c;
}

export function runSimulation(width, height, count) {
  //count = 4;

  const numBlocksX = width / smoothingRadius;

  const particles = createParticles(width, height, count);
  //const blocks = createBlocks(width, height, particles);

  // Replace the canvas with a fresh clone to avoid reusing a lost WebGL context
  const oldCanvas = document.querySelector("#simulation");
  const canvas = oldCanvas.cloneNode(false); // shallow clone, no children/context
  oldCanvas.replaceWith(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setSize(width, height);


  //setup the particle position texture that is used
  const data = new Float32Array(4 * particles.length);
  const texWidth = roundToEven(Math.sqrt(particles.length));
  const texHeight = particles.length / texWidth;

  console.log(texWidth, texHeight, particles.length);

  for (let i = 0; i < particles.length; i++) {
    let x = particles[i].position.x;
    let y = particles[i].position.y;

    data[i * 4 + 0] = x;
    data[i * 4 + 1] = y;
    let [a, b] = calculateBlock(x, y);

    data[i * 4 + 2] = a + b * numBlocksX; // flatten blocks into singular value
    data[i * 4 + 3] = 0;
  }

  const positionTexture = new THREE.DataTexture(data, texWidth, texHeight, THREE.RGBAFormat, THREE.FloatType);
  positionTexture.needsUpdate = true;
  //BLOCK AND SORT THIS DATA HERE WITH SHELLSORT.GLSL
  console.log(data);

  const total = Math.log2(count);
  const sortWPower = Math.ceil(total / 2);
  const sortHPower = total - sortWPower;
  const sortWidth = Math.pow(2, sortWPower);
  const sortHeight = Math.pow(2, sortHPower);

  //sort the position texture
  const sortRenderer = new GPUComputationRenderer(sortWidth, sortHeight, renderer);
  const sortPosVar = sortRenderer.addVariable("positionTexture", shellsortShaderSrc, positionTexture);
  sortRenderer.setVariableDependencies(sortPosVar, [sortPosVar]);
  sortPosVar.material.uniforms.DISTANCE = { value: 1 };
  sortPosVar.material.uniforms.texWidth = { value: sortWidth };
  sortRenderer.init();

  // REMOVE THIS
  const buffer = new Float32Array(sortWidth * sortHeight * 4); // RGBA per texel

  for (let i = count-1; i > 0; i--) {
    sortPosVar.material.uniforms.DISTANCE = { value: i };
    sortRenderer.compute();

  }


  console.log("sorted");
  renderer.readRenderTargetPixels(sortRenderer.getCurrentRenderTarget(sortPosVar), 0, 0, sortWidth, sortHeight, buffer);
  console.log(buffer);
  // REMOVE THIS
  //

  const sortedPositionTexture = sortRenderer.getCurrentRenderTarget(sortPosVar).texture;



  //create the fragment shader passthrough
  const computationRenderer = new GPUComputationRenderer(width, height, renderer);
  const posVar = computationRenderer.addVariable("positions", densityShaderSrc, sortedPositionTexture);
  posVar.material.uniforms.RADIUS = { value: smoothingRadius };
  posVar.material.uniforms.MASS = { value: mass };
  posVar.material.uniforms.numBlocksX = { value: numBlocksX };
  posVar.material.uniforms.count = { value: particles.length };
  posVar.material.uniforms.texWidth = { value: texWidth };
  posVar.material.uniforms.texHeight = { value: texHeight };
  computationRenderer.init();


  //create the post effect composer
  const composer = new EffectComposer(renderer);
  const DisplayShader = {
    uniforms: {
      // tDiffuse is automatically populated with the rendered scene texture
      tDiffuse: { value: null },
      tDense: { value: null },
      particleCount: { value: particles.length }
    },
    vertexShader: vertexShaderSrc,
    fragmentShader: displayShaderSrc
  };

  // Create the shader pass
  const densityPass = new ShaderPass(DisplayShader);
  composer.addPass(densityPass);


  //calculate the density field, take the output, and then render
  computationRenderer.compute();
  densityPass.uniforms.tDense.value = computationRenderer.getCurrentRenderTarget(posVar).texture;
  composer.render();





  const deltaTime = 0.008//now - then;

  renderer.setAnimationLoop((now) => {
    constrainParticles(particles);
    composer.render();
  })

  const cleanup = () => {
    renderer.setAnimationLoop(null);
    composer.dispose();
    densityPass.material.dispose();
    densityPass.uniforms.tDense.value.dispose();
    renderer.dispose();
    computationRenderer.dispose();
    sortRenderer.dispose();
    renderer.forceContextLoss();

    document.querySelector("#run-button").removeAttribute("disabled");
    canvas.style.display = "none";
    document.querySelector("#preview").style.display = "";

    document.querySelector("#stop-button").onclick = null;
  };

  document.querySelector("#stop-button").onclick = cleanup;
}
