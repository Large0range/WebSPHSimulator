#define PI 3.14159265359
//#define MASS 500.0
//#define RADIUS 40.0

uniform float RADIUS;
uniform float MASS;

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

float spiky_kernel(float radius, float distance) {
    if (distance >= radius) return 0.0;
    float volume = PI * pow(radius, 5.0) / 10.0;
    float value = radius - distance;
    return pow(value, 3.0) / volume;
}

//r vector is current particle - particle looking at
vec2 spiky_kernel_gradient(vec2 r_vector, float radius) {
    float distance = length(r_vector);

    if (distance > radius || distance < 0.0) return vec2(0.0);
    float value = radius - distance;
    vec2 unit_vector = r_vector / distance;
    float scale = -10.0 / (PI * pow(radius, 5.0));
    return scale * (value * value * unit_vector);
}



void main() {
    float density = 0.0;

    vec2 position = texture(positionTexture, gl_FragCoord.xy / resolution.xy).xy;

    float bx = floor(position.x / RADIUS); // get x block
    float by = floor(position.y / RADIUS); // get y block

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
            float influence = smoothing_kernel(RADIUS, distance(position, particlePos.xy));
            density += influence * MASS;
        }
    }

    // convert density to pressure
    // pressure = stiffness(density - target_density)

    gl_FragColor = vec4(0,0,density, 1);
}
