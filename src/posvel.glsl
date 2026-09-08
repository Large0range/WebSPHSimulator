#define PI 3.14159265359

uniform float h;
uniform float mass;
uniform float stiffness;
uniform float restDensity;
uniform float viscosity;
uniform float dt;
uniform float maxSpeed;
uniform float bounds;
uniform vec2 texSize;

void main() {
    vec2 uv = gl_FragCoord.xy / texSize;

    vec4 selfPV = texture2D(texturePosVel, uv);
    vec2 pos = selfPV.xy;
    vec2 vel = selfPV.zw;
    vec2 selfBlock = texture2D(textureBlock, uv).xy;

    float density = max(texture2D(textureDensity, uv).x, 0.0001);
    // Clamped to zero: negative pressure (density below rest) would otherwise make
    // the pressure force attractive instead of repulsive - the classic SPH "tensile
    // instability" that clumps particles together in low-density regions instead of
    // letting them disperse.
    float pressure = max(stiffness * (density - restDensity), 0.0);

    vec2 force = vec2(0.0, -9.8 * density);

    for (int y = 0; y < PARTICLES_HEIGHT; y++) {
        for (int x = 0; x < PARTICLES_WIDTH; x++) {
            vec2 uv2 = (vec2(float(x), float(y)) + 0.5) / texSize;

            // Cheap reject before touching position/velocity/density textures or doing any kernel math.
            vec2 otherBlock = texture2D(textureBlock, uv2).xy;
            vec2 blockDist = abs(otherBlock - selfBlock);
            if (blockDist.x > 1.0 || blockDist.y > 1.0) continue;

            vec4 otherPV = texture2D(texturePosVel, uv2);
            vec2 pos2 = otherPV.xy;
            vec2 vel2 = otherPV.zw;
            float density2 = max(texture2D(textureDensity, uv2).x, 0.0001);
            float pressure2 = max(stiffness * (density2 - restDensity), 0.0);

            vec2 d = pos - pos2;
            float r = length(d);

            // r <= 0.0 skips self (matches CPU's p === q check)
            if (r >= h || r <= 0.0) continue;

            vec2 n = d / r;

            float gradient = -30.0 / (PI * pow(h, 5.0)) * pow(h - r, 2.0);
            float pressureForce = -mass * (pressure + pressure2) / (2.0 * density2) * gradient;
            force += pressureForce * n;

            float lap = 45.0 / (PI * pow(h, 6.0)) * (h - r);
            float visc = viscosity * mass * lap / density2;
            force += visc * (vel2 - vel);
        }
    }

    vec2 accel = force / density;
    vel += accel * dt;

    // Safety net: if a frame's force spikes (particles briefly too close, etc.),
    // this stops that single frame from producing a huge position jump that would
    // otherwise feed straight into next frame's density calc and compound.
    float speed = length(vel);
    if (speed > maxSpeed) {
        vel *= maxSpeed / speed;
    }

    pos += vel * dt;

    if (pos.x < -bounds) { pos.x = -bounds; vel.x *= -0.5; vel.y *= 0.9; }
    if (pos.x >  bounds) { pos.x =  bounds; vel.x *= -0.5; vel.y *= 0.9; }
    if (pos.y < -bounds) { pos.y = -bounds; vel.y *= -0.5; }
    if (pos.y >  bounds) { pos.y =  bounds; vel.y *= -0.5; }

    gl_FragColor = vec4(pos, vel);
}
