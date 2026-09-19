#define PI 3.14159265359

//auto injects positionTexture, densityTexture

//vector 1,1 is up and right
uniform float RADIUS;
uniform float STIFF;
uniform float MASS;
uniform float TARGET_DENSITY;

uniform int width;
uniform int height;
uniform int count;
uniform int numBlocksX;


float calculate_block(vec2 p) {
    float bx = floor(p.x / RADIUS);
    float by = floor(p.y / RADIUS);
    return bx + by * float(numBlocksX);
}


// get block from texture
float readBlock(int i) {
    float y = float(i / width);
    float x = float(i % width);
    vec2 uv = (vec2(x, y) + 0.5) / vec2(width, height);
    return texture(positionTexture, uv).z;
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



vec2 spiky_kernel_gradient(float radius, vec2 r_vector) {
    float distance = length(r_vector);

    if (distance > radius || distance < 0.0) return vec2(0.0);
    float value = radius - distance;
    vec2 unit_vector = r_vector / distance;
    float scale = -10.0 / (PI * pow(radius, 5.0));
    return scale * (value * value * unit_vector);
}

float density_to_pressure(float density) {
    return STIFF * (density - TARGET_DENSITY);
}

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    float density = texture(densityTexture, uv).z;
    vec3 position = texture(positionTexture, uv).xyz;




    vec2 pressure_force = vec2(0.0);

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
            float y = float(i / width);
            float x = float(i % width);
            vec2 uv = (vec2(x, y) + 0.5) / vec2(width, height);
            vec3 data = texture(positionTexture, uv).xyz;

            float densityI = texture(densityTexture, uv).z;

            vec2 particlePos = data.xy;

            float pressure_density = (density_to_pressure(densityI) / pow(densityI, 2.0)) + (density_to_pressure(density) / pow(density, 2.0));
            vec2 gradient = spiky_kernel_gradient(RADIUS, gl_FragCoord.xy - particlePos.xy);
            pressure_force += MASS * pressure_density * gradient;
        }
    }

    // convert density to pressure
    // pressure = stiffness(density - target_density)





    //clamp positionings and recalculate the block
    position.y = min(position.y, resolution.y);
    position.y = max(position.y, 0.0);

    position.x = min(position.x, resolution.x);
    position.x = max(position.x, 0.0);

    position.z = calculate_block(position.xy);

    gl_FragColor = vec4(position, 0);
}
