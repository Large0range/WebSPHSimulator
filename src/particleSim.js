import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';

// Matches the constants from the original CPU particle.js
const H = 20;
const MASS = 1;
const STIFFNESS = 500;
const VISCOSITY = 100;
const DT = 0.008;
const BOUNDS = 50;
const DENSITY_CONSTANT = 4 / (Math.PI * Math.pow(H, 8));

// restDensity should equal whatever density the kernel naturally produces
// for particles sitting at their equilibrium spacing - otherwise pressure
// is never zero at rest, and the fluid either explodes or collapses.
// Sum the same kernel the shader uses, over a local grid at that spacing.
function computeRestDensity(spacing, h, mass) {
    const h2 = h * h;
    const range = Math.ceil(h / spacing);
    let density = 0;
    for (let j = -range; j <= range; j++) {
        for (let i = -range; i <= range; i++) {
            const dx = i * spacing;
            const dy = j * spacing;
            const r2 = dx * dx + dy * dy;
            if (r2 < h2) {
                const value = h2 - r2;
                density += mass * DENSITY_CONSTANT * value * value * value;
            }
        }
    }
    return density;
}


export async function initSimulation(renderer, particlesPerAxis) {
    const WIDTH = particlesPerAxis;
    const HEIGHT = particlesPerAxis;

    const gpuCompute = new GPUComputationRenderer(WIDTH, HEIGHT, renderer); // Renderer for textures

    const posVelTexture = gpuCompute.createTexture(); // create position / velocity texture
    const densityTexture = gpuCompute.createTexture(); // create density texture

    // Initial layout: centered grid, spaced to fit inside ~80% of the domain
    // so it holds together under gravity instead of spilling past the bounds.
    const pvData = posVelTexture.image.data; // get texture location as reference variable
    const spacing = (BOUNDS * 2 * 0.8) / particlesPerAxis; // spacing of the boundary only to 80%
    const half = particlesPerAxis / 2; // get half of the particles per axis for centering
    let i = 0;
    for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
            const s = i * 4;
            pvData[s]     = (x - half + 0.5) * spacing; // position.x
            pvData[s + 1] = (y - half + 0.5) * spacing; // position.y
            pvData[s + 2] = 0;                          // velocity.x
            pvData[s + 3] = 0;                          // velocity.y
            i++;
        }
    }


    // Seed with computed resting density so the very first frame (before density has actually
    // been computed from positions) starts from a sane value, not zero.
    const density = computeRestDensity(spacing, H, MASS);
    const densityData = densityTexture.image.data;
    for (let d = 0; d < WIDTH * HEIGHT; d++) {
        densityData[d * 4] = density;
    }

    let densitySrc = (await import('./density.glsl?raw')).default; // import the density fragment shader
    let posVelSrc = (await import('./posvel.glsl?raw')).default; // import the position velocity fragment shader

    // Bake grid size in as compile-time constants (GLSL loop bounds must be constant)
    densitySrc = densitySrc.replace(/PARTICLES_WIDTH/g, WIDTH).replace(/PARTICLES_HEIGHT/g, HEIGHT);
    posVelSrc = posVelSrc.replace(/PARTICLES_WIDTH/g, WIDTH).replace(/PARTICLES_HEIGHT/g, HEIGHT);

    const densityVar = gpuCompute.addVariable('textureDensity', densitySrc, densityTexture);
    const posVelVar = gpuCompute.addVariable('texturePosVel', posVelSrc, posVelTexture);

    // density depends on last frame's positions; posVel depends on itself + the density just computed
    gpuCompute.setVariableDependencies(densityVar, [posVelVar]);
    gpuCompute.setVariableDependencies(posVelVar, [posVelVar, densityVar]);

    const texSize = new THREE.Vector2(WIDTH, HEIGHT);

    Object.assign(densityVar.material.uniforms, {
        h: { value: H },
        mass: { value: MASS },
        densityConstant: { value: DENSITY_CONSTANT },
        texSize: { value: texSize },
    });

    Object.assign(posVelVar.material.uniforms, {
        h: { value: H },
        mass: { value: MASS },
        stiffness: { value: STIFFNESS },
        restDensity: { value: density },
        viscosity: { value: VISCOSITY },
        dt: { value: DT },
        bounds: { value: BOUNDS },
        texSize: { value: texSize },
    });

    const error = gpuCompute.init();
    if (error !== null) console.error(error);

    return { gpuCompute, posVelVar, densityVar, WIDTH, HEIGHT };
}
