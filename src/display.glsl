#define PI 3.14159265359

uniform sampler2D tDiffuse;
varying vec2 vUv;


uniform float RADIUS;
uniform float MASS;

uniform float refDense;

uniform int count;
uniform int texWidth;
uniform int texHeight;
uniform int numBlocksX; // how many blocks span the domain in x — needed to flatten (bx,by) consistently
uniform sampler2D positionTexture;



// bx/by are the 2D block coords, flattened row-major
float calculate_block(vec2 p) {
    float bx = floor(p.x / RADIUS);
    float by = floor(p.y / RADIUS);
    return bx + by * float(numBlocksX);
}

// get block from texture
float readBlock(int i) {
    float y = float(i / texWidth);
    float x = float(i % texWidth);
    vec2 uv = (vec2(x, y) + 0.5) / vec2(texWidth, texHeight);
    return calculate_block(texture(positionTexture, uv).xy);
}

// first index whose block id is >= target (standard binary search lower_bound)
int lowerBound(float target) {
    int lo = 0;
    int hi = count;
    while (lo < hi) {
        int mid = (lo + hi) / 2;
        if (readBlock(mid) < target) {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    return lo;
}

float smoothing_kernel(float radius, float distance) {
    float volume = PI * pow(radius, 8.0) / 4.0;
    float value = max(0.0, radius * radius - distance * distance);
    return pow(value, 3.0) / volume;
}


void main() {
    float density = 0.0;

    float bx = floor(gl_FragCoord.x / RADIUS); // get x block
    float by = floor(gl_FragCoord.y / RADIUS); // get y block

    // walk the 3 rows above/current/below this block
    for (int dy = -1; dy <= 1; dy++) {
        float rowY = by + float(dy);
        if (rowY < 0.0) continue; // clamps edges

        float rowBase = rowY * float(numBlocksX);

        float xLo = max(bx - 1.0, 0.0);
        float xHi = min(bx + 1.0, float(numBlocksX - 1));
        if (xLo > xHi) continue; // clamps edges

        float startBlock = rowBase + xLo;
        float endBlockExclusive = rowBase + xHi + 1.0; // one past the last block we want

        int start = lowerBound(startBlock);
        int end = lowerBound(endBlockExclusive);

        for (int i = start; i < end; i++) {
            float y = float(i / texWidth);
            float x = float(i % texWidth);
            vec2 uv = (vec2(x, y) + 0.5) / vec2(texWidth, texHeight);

            vec2 particlePos = texture(positionTexture, uv).xy;
            float influence = smoothing_kernel(RADIUS, distance(gl_FragCoord.xy, particlePos.xy));
            density += influence * MASS;
        }
    }

    // convert density to pressure
    // pressure = stiffness(density - target_density)

    gl_FragColor = vec4(0,0,smoothstep(0.0, 2.0, density/refDense), 1);
}
