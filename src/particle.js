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
    
    let block = calculateBlock(x, y);
    let blockX = block[0];
    let blockY = block[1];

    console.log(blockX, blockY);
    //console.log(block, x, y, blocks[block[0]][block[1]]);

    //append all blocks immedately next to the innerblock
    if (blockX != 0 && blockY != 0 && blockX != blocks.length-1) {
        checkingBlocks.push(blocks[blockX-1][blockY-1]);
        checkingBlocks.push(blocks[blockX+0][blockY-1]);
        checkingBlocks.push(blocks[blockX+1][blockY-1]);

        checkingBlocks.push(blocks[blockX-1][blockY+0]);
        checkingBlocks.push(blocks[blockX+0][blockY+0]);
        checkingBlocks.push(blocks[blockX+1][blockY+0]);

        checkingBlocks.push(blocks[blockX-1][blockY+1]);
        checkingBlocks.push(blocks[blockX+0][blockY+1]);
        checkingBlocks.push(blocks[blockX+1][blockY+1]);
    } else {
        checkingBlocks.push(blocks[blockX][blockY]);
    }
    checkingBlocks = checkingBlocks.flat();
    console.log(checkingBlocks);

    if (checkingBlocks.length == 1) return 0;

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
