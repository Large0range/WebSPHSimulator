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

export function runSimulation(width, height, count, smoothingRadius, mass) {
  //count = 4;


  const stiffness_constant = 1;
  const target_density = 0.5;



  //const smoothingRadius = Number(document.querySelector("#smooth").value);


  // Generate intial particle data and the particle position texture that is used
  //
  // DEBUG ------------------------------------------------------------------
  const data = new Float32Array(4 * count);
  const texWidth = roundToEven(Math.sqrt(count));
  const texHeight = count / texWidth;

  const numBlocksX = width / smoothingRadius;


  const particles = createParticles(texWidth, texHeight, count);

  width = texWidth;
  height = texHeight;



  //const blocks = createBlocks(width, height, particles);

  // Replace the canvas with a fresh clone to avoid reusing a lost WebGL context
  const oldCanvas = document.querySelector("#simulation");
  const canvas = oldCanvas.cloneNode(false); // shallow clone, no children/context
  oldCanvas.replaceWith(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setSize(width, height);




  console.log(texWidth, texHeight, particles.length);

  for (let i = 0; i < particles.length; i++) {
    let x = particles[i].position.x;
    let y = particles[i].position.y;

    data[i * 4 + 0] = x;
    data[i * 4 + 1] = y;
    let [a, b] = calculateBlock(x, y, smoothingRadius);

    data[i * 4 + 2] = a + b * numBlocksX; // flatten blocks into singular value
    data[i * 4 + 3] = 0;
  }

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
  sortRenderer.init();

  // Inital sorting of the positions data -- look into CountingSort method from threejs
  for (let i = count-1; i > 0; i--) {
    sortPosVar.material.uniforms.DISTANCE = { value: i };
    sortRenderer.compute();

  }
  const sortedPositionTexture = sortRenderer.getCurrentRenderTarget(sortPosVar).texture;




  const physicsRenderer = new GPUComputationRenderer(texWidth, texHeight, renderer);

  const densityVar = physicsRenderer.addVariable("densityTexture", densityShaderSrc, sortedPositionTexture);

  densityVar.material.uniforms.RADIUS = { value: smoothingRadius };
  densityVar.material.uniforms.MASS = { value: mass };
  densityVar.material.uniforms.numBlocksX = { value: numBlocksX };
  densityVar.material.uniforms.count = { value: particles.length };
  densityVar.material.uniforms.texWidth = { value: texWidth };
  densityVar.material.uniforms.texHeight = { value: texHeight };



  const physicsPosVar = physicsRenderer.addVariable("positionTexture", moveShaderSrc, sortedPositionTexture);
  physicsRenderer.setVariableDependencies(physicsPosVar, [densityVar, physicsPosVar]);

  physicsPosVar.material.uniforms.width = { value: width };
  physicsPosVar.material.uniforms.height = { value: height };
  physicsPosVar.material.uniforms.count = { value: particles.length };
  physicsPosVar.material.uniforms.STIFF = { value: stiffness_constant };
  physicsPosVar.material.uniforms.TARGET_DENSITY = { value: target_density };
  physicsPosVar.material.uniforms.MASS = { value: mass };
  physicsPosVar.material.uniforms.numBlocksX = { value: numBlocksX };

  physicsRenderer.init();


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




  const deltaTime = 0.008//now - then;

  renderer.setAnimationLoop((now) => {
    //constrainParticles(particles);
    // reset sorting to new positions

    //sortRenderer.renderTexture(computationRenderer.getCurrentRenderTarget(physicsPosVar).texture, sortPosVar.renderTargets[0]);
    //sortRenderer.renderTexture(computationRenderer.getCurrentRenderTarget(physicsPosVar).texture, sortPosVar.renderTargets[1]);

    for (let i = count - 1; i > 0; i--) {
      sortPosVar.material.uniforms.DISTANCE.value = i;
      sortRenderer.compute();
    }

    densityVar.material.uniforms.positions = { value: sortRenderer.getCurrentRenderTarget(sortPosVar).texture };
    physicsRenderer.compute();

    //calculate the density field, take the output, and then render

    densityPass.uniforms.tDense.value = physicsRenderer.getCurrentRenderTarget(densityVar).texture;
    composer.render();

  })

  const cleanup = () => {
    renderer.setAnimationLoop(null);
    composer.dispose();
    densityPass.material.dispose();
    densityPass.uniforms.tDense.value.dispose();
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
