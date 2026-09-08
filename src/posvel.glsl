#define PI 3.14159265359

uniform float h;
uniform float mass;
uniform float stiffness;
uniform float restDensity;
uniform float viscosity;
uniform float dt;
uniform float bounds;
uniform vec2 texSize;

void main() {
    vec2 uv = gl_FragCoord.xy / texSize;

    vec4 selfPV = texture2D(texturePosVel, uv);
    vec2 pos = selfPV.xy;
    vec2 vel = selfPV.zw;

    float density = max(texture2D(textureDensity, uv).x, 0.0001);
    float pressure = stiffness * (density - restDensity);

    vec2 force = vec2(0.0, -9.8 * density);

    for (int y = 0; y < PARTICLES_HEIGHT; y++) {
        for (int x = 0; x < PARTICLES_WIDTH; x++) {
            vec2 uv2 = (vec2(float(x), float(y)) + 0.5) / texSize;

            vec4 otherPV = texture2D(texturePosVel, uv2);
            vec2 pos2 = otherPV.xy;
            vec2 vel2 = otherPV.zw;
            float density2 = max(texture2D(textureDensity, uv2).x, 0.0001);
            float pressure2 = stiffness * (density2 - restDensity);

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
    pos += vel * dt;

    if (pos.x < -bounds) { pos.x = -bounds; vel.x *= -0.5; vel.y *= 0.9; }
    if (pos.x >  bounds) { pos.x =  bounds; vel.x *= -0.5; vel.y *= 0.9; }
    if (pos.y < -bounds) { pos.y = -bounds; vel.y *= -0.5; }
    if (pos.y >  bounds) { pos.y =  bounds; vel.y *= -0.5; }

    gl_FragColor = vec4(pos, vel);
}
