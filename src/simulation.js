import * as THREE from 'three';
import { calculateBlock, createParticles, constrainParticles, integrate, calculateDensity, smoothingRadius, createBlocks } from './particle';
import { EffectComposer, GPUComputationRenderer, RenderPass, ShaderPass } from 'three/examples/jsm/Addons.js';


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

  const composer = new EffectComposer(renderer);
  const DisplayShader = {
    uniforms: {
      // tDiffuse is automatically populated with the rendered scene texture
      tDiffuse: { value: null },
      tDense: { value: null },
      particleCount: { value: particles.length }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform sampler2D tDense;
      uniform int particleCount;
      varying vec2 vUv;



      void main() {
        // Sample the original rendered scene pixel color
        vec4 texColor = texture2D(tDiffuse, vUv);
        vec4 density = texture2D(tDense, vUv);
        vec4 finalColor = vec4(1,0,0,1);//mix(texColor, vec4(1.0, 0.0, 0.0, 1.0), effect * 0.3);

        gl_FragColor = density;//vec4(texColor.x, 0, 0, 1);
      }
    `
  };

  // 5. Create and add the ShaderPass
  const densityPass = new ShaderPass(DisplayShader);
  composer.addPass(densityPass);

  const temp = [];
  const data = new Uint8Array(4 * width * height);

  console.log(width, height);
  console.log(calculateBlock(100, 0));

  for (let i = 0; i < width * height; i++) {
    let block = calculateBlock(i % width, Math.floor(i / width));
    data[i * 4 + 2] = Math.round(calculateDensity(i % width, Math.floor(i / width), particles, blocks) * 255);
    data[i * 4 + 0] = 0;
    if ((Math.floor(i / width) % smoothingRadius == 0 || i % smoothingRadius == 0) && grid)
      data[i * 4 + 0] = 255;

    data[i * 4 + 1] = 0;
    data[i * 4 + 3] = 255;
  }


  const denseTex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  denseTex.needsUpdate = true;
  densityPass.uniforms.tDense.value = denseTex;

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
    renderer.forceContextLoss();

    document.querySelector("#run-button").removeAttribute("disabled");
    canvas.style.display = "none";
    document.querySelector("#preview").style.display = "";

    document.querySelector("#stop-button").onclick = null;
  };

  document.querySelector("#stop-button").onclick = cleanup;
}
