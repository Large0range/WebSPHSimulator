import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';

const MASS = 1;
const STIFFNESS_RELATIVE = 100; // dimensionless now - see note below
const VISCOSITY = 100;
const DT = 0.008; // smaller h = stiffer local dynamics = needs a smaller step to stay stable
const MAX_SPEED_CELLS_PER_STEP = 4; // safety net: a particle can't cross more than this many cells in one step
const BOUNDS = 50;
const H_MULTIPLIER = 2.5; // kernel radius = this many times the particle spacing

// restDensity should equal whatever density the kernel naturally produces
// for particles sitting at their equilibrium spacing - otherwise pressure
// is never zero at rest, and the fluid either explodes or collapses.
// Sum the same kernel the shader uses, over a local grid at that spacing.
function computeRestDensity(spacing, h, mass, densityConstant) {
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
                density += mass * densityConstant * value * value * value;
            }
        }
    }
    return density;
}


export async function initSimulation(renderer, particlesPerAxis) {
    const WIDTH = particlesPerAxis;
    const HEIGHT = particlesPerAxis;

    const gpuCompute = new GPUComputationRenderer(WIDTH, HEIGHT, renderer); // Renderer for textures

    const spatialTexture = gpuCompute.createTexture(); // initial (blank) texture for the block-id pass

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

    // h scales with spacing so the average neighbor count - and how many particles
    // land in the same handful of blocks - stays roughly constant no matter how
    // many particles you run. Without this, more particles just means a bigger,
    // stiffer kernel relative to spacing, and the block early-out stops helping
    // because everything crowds into the same few cells.
    const h = spacing * H_MULTIPLIER;
    const densityConstant = 4 / (Math.PI * Math.pow(h, 8));

    // Seed with computed resting density so the very first frame (before density has actually
    // been computed from positions) starts from a sane value, not zero.
    const restDensity = computeRestDensity(spacing, h, MASS, densityConstant);
    const densityData = densityTexture.image.data;
    for (let d = 0; d < WIDTH * HEIGHT; d++) {
        densityData[d * 4] = restDensity;
    }

    // pressure = stiffness * (density - restDensity). If stiffness were a fixed
    // absolute number, its effective strength would swing with h (since h changes
    // density's absolute units) - dividing by restDensity turns it into "how much
    // pressure per unit of *relative* density deviation", which stays consistent
    // no matter what h works out to.
    const stiffness = STIFFNESS_RELATIVE / restDensity;
    const maxSpeed = (MAX_SPEED_CELLS_PER_STEP * h) / DT;

    let densitySrc = (await import('./density.glsl?raw')).default; // import the density fragment shader
    let posVelSrc = (await import('./posvel.glsl?raw')).default; // import the position velocity fragment shader
    let blockingSrc = (await import('./blocking.glsl?raw')).default; // import the blocking fragment shader code

    // Bake grid size in as compile-time constants (GLSL loop bounds must be constant)
    densitySrc = densitySrc.replace(/PARTICLES_WIDTH/g, WIDTH).replace(/PARTICLES_HEIGHT/g, HEIGHT);
    posVelSrc = posVelSrc.replace(/PARTICLES_WIDTH/g, WIDTH).replace(/PARTICLES_HEIGHT/g, HEIGHT);
    blockingSrc = blockingSrc.replace(/PARTICLES_WIDTH/g, WIDTH).replace(/PARTICLES_HEIGHT/g, HEIGHT);

    // Added in dependency order for clarity - blocking has to exist before density/posVel can use it.
    // (GPUComputationRenderer's internal buffer swap happens once per compute() call regardless of
    // add-order, so every dependency this frame reads last frame's data either way - but this order
    // reads top-to-bottom the way the pipeline actually flows.)
    const blockingVar = gpuCompute.addVariable('textureBlock', blockingSrc, spatialTexture);
    const densityVar = gpuCompute.addVariable('textureDensity', densitySrc, densityTexture);
    const posVelVar = gpuCompute.addVariable('texturePosVel', posVelSrc, posVelTexture);

    // block ids depend on last frame's positions; density needs both positions and block ids
    // (block ids to cheaply skip far-away particles, positions for the actual kernel math);
    // posVel depends on itself + the block ids + the density just computed
    gpuCompute.setVariableDependencies(blockingVar, [posVelVar]);
    gpuCompute.setVariableDependencies(densityVar, [posVelVar, blockingVar]);
    gpuCompute.setVariableDependencies(posVelVar, [posVelVar, blockingVar, densityVar]);

    const texSize = new THREE.Vector2(WIDTH, HEIGHT);

    Object.assign(blockingVar.material.uniforms, {
        boundsMin: { value: -BOUNDS },
        h: { value: h },
        texSize: { value: texSize },
    });

    Object.assign(densityVar.material.uniforms, {
        h: { value: h },
        mass: { value: MASS },
        densityConstant: { value: densityConstant },
        texSize: { value: texSize },
    });

    Object.assign(posVelVar.material.uniforms, {
        h: { value: h },
        mass: { value: MASS },
        stiffness: { value: stiffness },
        restDensity: { value: restDensity },
        viscosity: { value: VISCOSITY },
        dt: { value: DT },
        maxSpeed: { value: maxSpeed },
        bounds: { value: BOUNDS },
        texSize: { value: texSize },
    });

    const error = gpuCompute.init();
    if (error !== null) console.error(error);

    return { gpuCompute, posVelVar, densityVar, blockingVar, WIDTH, HEIGHT };
}
