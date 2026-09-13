import * as THREE from 'three';

const restDensity = 0.0;
const stiffness = 10;
export const smoothingRadius = 40;
const mass = 100;
const viscosity = 0; // tune this


//const densityConstant = 4 / (Math.PI * Math.pow(h, 8));

function SmoothingKernel(radius, distance) {
    let volume = Math.PI * Math.pow(radius, 8) / 4;
    let value = Math.max(0, radius * radius - distance * distance);
    return value * value * value / volume;
}

export class Particle {
    constructor(x, y) {
        this.position = new THREE.Vector2(x, y);
        this.velocity = new THREE.Vector2(0, 0);
        this.force = new THREE.Vector2(0, 0);

        this.density = 0;
        this.pressure = 0;
    }
}

export function calculateBlock(x, y) {
    return [Math.floor(x / smoothingRadius), Math.floor(y / smoothingRadius)]
}

export function createBlocks(width, height, particles) {
    const blocks = [];
    for (let i = 0; i < width / smoothingRadius; i++) {
        blocks.push([]);
        for (let j = 0; j < height / smoothingRadius; j++) {
            blocks[i].push([]);
        }
    }

    for (const p of particles) {
        let x = p.position.x;
        let y = p.position.y;
        blocks[Math.floor(x / smoothingRadius)][Math.floor(y / smoothingRadius)].push(p);
    }

    return blocks;
}

export function createParticles(width, height, count) {
    const particles = [];
    const spacing = 10;

    for (let i = 0; i < count; i++) {
        let x = Math.random() * width;
        let y = Math.random() * height;
        let p = new Particle(x, y);
        particles.push(p);
    }

    return particles;
}

export function calculateDensity(x, y, particles, blocks) {
    let density = 0;
    let checkingBlocks = [];

    //append all blocks immedately next to the innerblock
    const [blockX, blockY] = calculateBlock(x, y);
    const maxX = blocks.length - 1; // get total block length
    const maxY = blocks[0].length - 1;  // get total block height

    for (let dx = -1; dx <= 1; dx++) {      // 1x1 check grid
        for (let dy = -1; dy <= 1; dy++) {
            const nx = blockX + dx;
            const ny = blockY + dy;
            if (nx < 0 || nx > maxX || ny < 0 || ny > maxY) continue;
            checkingBlocks.push(blocks[nx][ny]);
        }
    }
    checkingBlocks = checkingBlocks.flat();

    if (checkingBlocks.length == 0) return 0;

    for (const p of checkingBlocks) {
        let distance = (new THREE.Vector2(x,y).distanceTo(p.position));
        let influence = SmoothingKernel(smoothingRadius, distance);
        density += mass * influence;
    }

    return density;
}


export function integrate(dt, particles) {
    for (const p of particles) {
        const acceleration = p.force.clone()
            .divideScalar(p.density);

        p.velocity.addScaledVector(acceleration, dt);

        p.position.addScaledVector(p.velocity, dt);
    }
}

export function constrainParticles(particles) {
    for (const p of particles) {
        if (p.position.x < -100) {
            p.position.x = -100;
            p.velocity.x *= -0.5;
            p.velocity.y *= 0.9; // friction along the wall
        }

        if (p.position.x > 100) {
            p.position.x = 100;
            p.velocity.x *= -0.5;
            p.velocity.y *= 0.9; // friction along the wall
        }

        if (p.position.y < -100) {
            p.position.y = -100;
            p.velocity.y *= -0.5;
        }

        if (p.position.y > 100) {
            p.position.y = 100;
            p.velocity.y *= -0.5;
        }
    }
}
