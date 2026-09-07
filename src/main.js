import * as THREE from 'three';
import { initSimulation } from './particleSim.js';
import { createParticleRenderer } from './particleRenderer.js';

const PARTICLES_PER_AXIS = 100; // 20x20 = 400 particles, matches original CPU grid

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-120, 120, 120, -120, -1, 1);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const { gpuCompute, posVelVar, WIDTH, HEIGHT } = await initSimulation(renderer, PARTICLES_PER_AXIS);

const particles = createParticleRenderer(WIDTH, HEIGHT);
particles.frustumCulled = false;
scene.add(particles);

function animate() {
    gpuCompute.compute();

    particles.material.uniforms.texturePosVel.value =
        gpuCompute.getCurrentRenderTarget(posVelVar).texture;

    renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);
