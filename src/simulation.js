import * as THREE from 'three';
import { calculateBlock, createParticles, constrainParticles, integrate, calculateDensity, smoothingRadius, createBlocks } from './particle';
import { EffectComposer, GPUComputationRenderer, RenderPass, ShaderPass } from 'three/examples/jsm/Addons.js';

import densityShaderSrc from './density.glsl?raw';
import vertexShaderSrc from './vertex.glsl?raw';
import displayShaderSrc from './display.glsl?raw';

export function runSimulation(width, height, count) {
  const grid = false;

  const particles = createParticles(width, height, count);
  const blocks = createBlocks(width, height, particles);

  // Replace the canvas with a fresh clone to avoid reusing a lost WebGL context
  const oldCanvas = document.querySelector("#simulation");
  const canvas = oldCanvas.cloneNode(false); // shallow clone, no children/context
  oldCanvas.replaceWith(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setSize(width, height);



  //setup the particle position texture that is used
  const data = new Float32Array(4 * particles.length);
  const s = Math.ceil(Math.sqrt(particles.length));
  console.log(s, particles.length);

  for (let i = 0; i < particles.length; i++) {
    data[i * 4 + 0] = particles[i].position.x;
    data[i * 4 + 1] = particles[i].position.y;
    data[i * 4 + 2] = 0;
    data[i * 4 + 3] = 0;
  }

  const positionTexture = new THREE.DataTexture(data, s, s, THREE.RGBAFormat, THREE.FloatType);
  positionTexture.needsUpdate = true;
  //BLOCK AND SORT THIS DATA HERE WITH SHELLSORT.GLSL
  console.log(data);


  //create the fragment shader passthrough
  const computationRenderer = new GPUComputationRenderer(width, height, renderer);
  const densityTexture = computationRenderer.createTexture();
  const posVar = computationRenderer.addVariable("positions", densityShaderSrc, positionTexture);
  posVar.material.uniforms.count = { value: particles.length };
  posVar.material.uniforms.texSize = { value: s };
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
    renderer.forceContextLoss();

    document.querySelector("#run-button").removeAttribute("disabled");
    canvas.style.display = "none";
    document.querySelector("#preview").style.display = "";

    document.querySelector("#stop-button").onclick = null;
  };

  document.querySelector("#stop-button").onclick = cleanup;
}
