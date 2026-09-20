#define PI 3.14159265359

uniform sampler2D positionTexture;   // sorted particles (xy = pos, zw = vel)
uniform sampler2D densityTexture;
uniform sampler2D cellStartTexture;

uniform float RADIUS;
uniform float STIFF;
uniform float VISC_CONSTANT;
uniform float MASS;
uniform float TARGET_DENSITY;
uniform float DELTA_TIME;
uniform float GRAVITY;          // px / s^2, downward

uniform float MOUSE_RADIUS;
uniform float MOUSE_STRENGTH;   // px / s^2 at the centre
uniform float WALL_RESTITUTION;

uniform int texWidth;
uniform int numBlocksX;
uniform int numBlocksY;
uniform float screenWidth;
uniform float screenHeight;

uniform vec2 mousePos;
uniform bool mouseDown;

float pressureOf(float density) {
    // clamped: no negative pressure, avoids tensile clumping
    return STIFF * max(density - TARGET_DENSITY, 0.0);
}

void main() {
    ivec2 texel = ivec2(gl_FragCoord.xy);
    int myIndex = texel.x + texel.y * texWidth;

    vec4 self = texelFetch(positionTexture, texel, 0);
    vec2 position = self.xy;
    vec2 velocity = self.zw;

    float rho = texelFetch(densityTexture, texel, 0).x;
    float pOverRho2 = pressureOf(rho) / (rho * rho);

    float spikyGrad = 30.0 / (PI * pow(RADIUS, 5.0)); // |grad| of 2D spiky kernel = spikyGrad * (h-r)^2
    float viscLap   = 40.0 / (PI * pow(RADIUS, 5.0)); // laplacian of 2D viscosity kernel = viscLap * (h-r)

    vec2 pressureAccel = vec2(0.0);
    vec2 viscAccel = vec2(0.0);

    ivec2 cell = clamp(ivec2(floor(position / RADIUS)), ivec2(0), ivec2(numBlocksX - 1, numBlocksY - 1));

    for (int dy = -1; dy <= 1; dy++) {
        int cy = cell.y + dy;
        if (cy < 0 || cy >= numBlocksY) continue;

        int xLo = max(cell.x - 1, 0);
        int xHi = min(cell.x + 1, numBlocksX - 1);

        int start = int(texelFetch(cellStartTexture, ivec2(xLo, cy), 0).x);
        int end   = int(texelFetch(cellStartTexture, ivec2(xHi + 1, cy), 0).x);

        for (int i = start; i < end; i++) {
            if (i == myIndex) continue;

            ivec2 t = ivec2(i % texWidth, i / texWidth);
            vec4 other = texelFetch(positionTexture, t, 0);
            float rhoJ = texelFetch(densityTexture, t, 0).x;

            vec2 rij = position - other.xy;
            float r = length(rij);
            if (r >= RADIUS || r < 1e-5) continue;

            vec2 dir = rij / r;
            float w = RADIUS - r;

            // symmetric pressure term; pushes i away from j when P > 0
            float shared = pOverRho2 + pressureOf(rhoJ) / (rhoJ * rhoJ);
            pressureAccel += MASS * shared * spikyGrad * w * w * dir;

            // viscosity: smooth velocity toward neighbours' velocity
            viscAccel += MASS * (other.zw - velocity) / rhoJ * viscLap * w;
        }
    }

    vec2 acceleration = pressureAccel + viscAccel * (VISC_CONSTANT / rho);
    acceleration += vec2(0.0, -GRAVITY);

    if (mouseDown) {
        vec2 delta = position - mousePos;
        float d = length(delta);
        if (d < MOUSE_RADIUS && d > 1e-4) {
            float falloff = 1.0 - d / MOUSE_RADIUS;
            acceleration += (delta / d) * MOUSE_STRENGTH * falloff * falloff;
        }
    }

    // semi-implicit Euler
    velocity += acceleration * DELTA_TIME;

    // CFL-style safety: never move more than half a kernel radius per step
    float vMax = 0.5 * RADIUS / DELTA_TIME;
    float speed = length(velocity);
    if (speed > vMax) velocity *= vMax / speed;

    position += velocity * DELTA_TIME;

    // walls: clamp and reflect (with damping) the normal velocity component
    if (position.x < 0.0)               { position.x = 0.0;          velocity.x =  abs(velocity.x) * WALL_RESTITUTION; }
    else if (position.x > screenWidth)  { position.x = screenWidth;  velocity.x = -abs(velocity.x) * WALL_RESTITUTION; }
    if (position.y < 0.0)               { position.y = 0.0;          velocity.y =  abs(velocity.y) * WALL_RESTITUTION; }
    else if (position.y > screenHeight) { position.y = screenHeight; velocity.y = -abs(velocity.y) * WALL_RESTITUTION; }

    // a NaN would poison the sort, so respawn it
    if (any(isnan(position)) || any(isnan(velocity))) {
        position = vec2(screenWidth, screenHeight) * 0.5;
        velocity = vec2(0.0);
    }

    gl_FragColor = vec4(position, velocity);
}
