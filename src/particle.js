import * as THREE from 'three';

const restDensity = 0.0109;
const stiffness = 100;
const h = 20;
const mass = 1;
const viscosity = 60; // tune this


const densityConstant = 4 / (Math.PI * Math.pow(h, 8));

export class Particle {
    constructor(x, y) {
        this.position = new THREE.Vector2(x, y);
        this.velocity = new THREE.Vector2(0, 0);
        this.force = new THREE.Vector2(0, 0);

        this.density = 0;
        this.pressure = 0;
    }
}

export function createParticles() {
    const particles = [];
    const spacing = 10;

    for (let y = -10; y < 10; y++) {
        for (let x = -10; x < 10; x++) {
            particles.push(
                new Particle(
                    x * spacing,
                    y * spacing
                )
            );
        }
    }

    return particles;
}


export function calculatePressure(particles) {
    for (const p of particles) {
        p.pressure = stiffness * (p.density - restDensity);
    }
}

export function calculateDensity(particles) {
    for (const p of particles) {
        p.density = 0;

        for (const q of particles) {
            const dx = p.position.x - q.position.x;
            const dy = p.position.y - q.position.y;

            const r2 = dx * dx + dy * dy;

            if (r2 < h * h) {
                const value = h * h - r2;

                p.density +=
                    mass *
                    densityConstant *
                    value * value * value;
            }
        }
    }
}



function viscosityLaplacian(r) {
    if (r >= h || r <= 0) return 0;
    return 45 / (Math.PI * Math.pow(h, 6)) * (h - r);
}


function pressureGradient(r) {
    if (r >= h || r <= 0) return 0;

    return -30 / (Math.PI * Math.pow(h, 5))
        * Math.pow(h - r, 2);
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


export function calculateForces(particles) {
    for (const p of particles) {
        // gravity
        p.force.set(0, -9.8 * p.density);

        for (const q of particles) {
            if (p === q) continue;

            const dx = p.position.x - q.position.x;
            const dy = p.position.y - q.position.y;

            const r = Math.sqrt(dx * dx + dy * dy);

            if (r >= h || r <= 0) continue;

            const nx = dx / r;
            const ny = dy / r;

            const gradient = pressureGradient(r);

            const pressureForce =
                -mass *
                (p.pressure + q.pressure) /
                (2 * q.density) *
                gradient;

            p.force.x += pressureForce * nx;
            p.force.y += pressureForce * ny;

            const lap = viscosityLaplacian(r);
            const visc = viscosity * mass * lap / q.density;

            p.force.x += visc * (q.velocity.x - p.velocity.x);
            p.force.y += visc * (q.velocity.y - p.velocity.y);
        }
    }
}