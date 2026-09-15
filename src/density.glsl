#define PI 3.14159265359
#define MASS 500.0
#define RADIUS 40.0

uniform int count;
uniform int texSize;
uniform sampler2D positions;

float smoothing_kernel(float radius, float distance) {
    float volume = PI * pow(radius, 8.0) / 4.0;
    float value = max(0.0, radius * radius - distance * distance);
    return pow(value, 3.0) / volume;
}

void main() {
    float density = 0.0; // density of this particular pixel in the texture
    for (int i = 0; i < count; i++) {   // loop over all particles in the simulation
        float y = float(i / texSize);
        float x = float(i % texSize);
        vec2 uv = (vec2(x,y) + 0.5)/float(texSize);  // particle positions are stored in a texture, retrieve them

        vec2 particlePos = texture(positions, uv).xy; // finally pull the location of the position out of the texture

        float influence = smoothing_kernel(RADIUS, distance(gl_FragCoord.xy, particlePos.xy)); // calculate the influence based on the smoothing kernel
        density += influence * MASS;
    }

    gl_FragColor = vec4(density, 0, 0, 1);
}

/*
function SmoothingKernel(radius, distance) {
    let volume = Math.PI * Math.pow(radius, 8) / 4;
    let value = Math.max(0, radius * radius - distance * distance);
    return value * value * value / volume;
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
}*/
