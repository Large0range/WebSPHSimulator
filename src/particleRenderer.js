import * as THREE from 'three';

export function createParticleRenderer(WIDTH, HEIGHT) {
    const count = WIDTH * HEIGHT;

    const geometry = new THREE.BufferGeometry();

    // dummy position attribute (required by three.js) - actual position comes from the texture
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));

    const particleUv = new Float32Array(count * 2);
    let p = 0;
    for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
            particleUv[p++] = (x + 0.5) / WIDTH;
            particleUv[p++] = (y + 0.5) / HEIGHT;
        }
    }
    geometry.setAttribute('particleUv', new THREE.BufferAttribute(particleUv, 2));

    const material = new THREE.ShaderMaterial({
        uniforms: {
            texturePosVel: { value: null },
        },
        vertexShader: `
            attribute vec2 particleUv;
            uniform sampler2D texturePosVel;
            void main() {
                vec4 posVel = texture2D(texturePosVel, particleUv);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(posVel.xy, 0.0, 1.0);
                gl_PointSize = 4.0;
            }
        `,
        fragmentShader: `
            void main() {
                vec2 c = gl_PointCoord - 0.5;
                if (length(c) > 0.5) discard;
                gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0);
            }
        `,
    });

    return new THREE.Points(geometry, material);
}
