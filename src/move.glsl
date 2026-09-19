#define PI 3.14159265359

//auto injects positionTexture, densityTexture
uniform sampler2D positionTexture;
uniform sampler2D densityTexture;

//vector 1,1 is up and right
uniform float RADIUS;
uniform float STIFF;
uniform float VISC_CONSTANT;
uniform float MASS;
uniform float TARGET_DENSITY;
uniform float DELTA_TIME;

uniform int texWidth;
uniform int texHeight;
uniform int count;
uniform int numBlocksX;

uniform int screenWidth;
uniform int screenHeight;

uniform vec2 mousePos;
uniform bool mouseDown;


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


// Used for pressure force calculation
vec2 spiky_kernel_gradient(float radius, vec2 r_vector) {
    float distance = length(r_vector);

    if (distance > radius || distance == 0.0) return vec2(0.0);
    float value = radius - distance;
    vec2 unit_vector = r_vector / distance;
    float scale = -10.0 / (PI * pow(radius, 5.0));
    return scale * (value * value * unit_vector);
}

float density_to_pressure(float density) {
    return STIFF * (density - TARGET_DENSITY);
}

// Used for viscosity force calculation
float viscosity_kernel_laplacian(float radius, float r_mag) {
    if (r_mag > radius || r_mag <= 0.0) return 0.0;

    float coeff = 40.0 / (PI * pow(radius, 5.0));
    return coeff * (radius - r_mag);
}

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    float density = texture(densityTexture, uv).z;
    vec2 position = texture(positionTexture, uv).xy;
    vec2 velocity = texture(positionTexture, uv).zw;
    vec2 acceleration = vec2(0.0);

    vec2 pressure_force = vec2(0.0);
    vec2 viscosity_force = vec2(0.0);

    float bx = floor(position.x / RADIUS); // get x block
    float by = floor(position.y / RADIUS); // get y block


    if (density == 0.0) {
        gl_FragColor = vec4(position, velocity);
        return;
    }

    // Calculate the pressure force

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


            vec2 particleVelocity = texture(positionTexture, uv).zw;
            float particleDensity = texture(densityTexture, uv).z;

            vec2 visc_coeff = (particleVelocity - velocity) / particleDensity;
            float visc = viscosity_kernel_laplacian(RADIUS, distance(position, particlePos));

            viscosity_force += MASS * visc_coeff * visc;

            if (particleDensity == 0.0) continue;



            float pressure_density = (density_to_pressure(particleDensity) / pow(particleDensity, 2.0)) + (density_to_pressure(density) / pow(density, 2.0));
            vec2 gradient = spiky_kernel_gradient(RADIUS, position - particlePos);
            pressure_force += MASS * pressure_density * gradient;
        }
    }


    //position.xy += -pressure_force * DELTA_TIME;
    //position.y -= 1.0;
    if (mouseDown) {
        float mouseRadius = 50.0;
        float mouseStrength = 100.0;

        vec2 delta = position - mousePos;
        float d = length(delta);

        if (d < mouseRadius && d > 0.0001) {
            float falloff = 1.0 - d / mouseRadius;
            acceleration += (delta / d) * mouseStrength * falloff * falloff;
        }
    }

    acceleration += -pressure_force;
    acceleration += viscosity_force * VISC_CONSTANT;
    //acceleration += vec2(0,-1) * density;
    velocity += acceleration * DELTA_TIME;
    position += velocity;


    //clamp positionings and recalculate the block
    position.y = min(position.y, float(screenHeight));
    position.y = max(position.y, 0.0);

    position.x = min(position.x, float(screenWidth));
    position.x = max(position.x, 0.0);

    //position.z = calculate_block(position.xy);

    gl_FragColor = vec4(position, velocity);
}
