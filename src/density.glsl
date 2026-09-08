#define PI 3.14159265359

uniform float h;
uniform float mass;
uniform float densityConstant;
uniform vec2 texSize;

void main() {
    vec2 uv = gl_FragCoord.xy / texSize;
    vec2 pos = texture2D(texturePosVel, uv).xy;
    vec2 selfBlock = texture2D(textureBlock, uv).xy;

    float h2 = h * h;
    float density = 0.0;

    for (int y = 0; y < PARTICLES_HEIGHT; y++) {
        for (int x = 0; x < PARTICLES_WIDTH; x++) {
            vec2 uv2 = (vec2(float(x), float(y)) + 0.5) / texSize;

            // Cheap reject: cell size == h, so anything outside the 3x3 block
            // neighborhood can't possibly be within radius h. Skip the more
            // expensive position fetch + kernel math for those.
            vec2 otherBlock = texture2D(textureBlock, uv2).xy;
            vec2 blockDist = abs(otherBlock - selfBlock);
            if (blockDist.x > 1.0 || blockDist.y > 1.0) continue;

            vec2 pos2 = texture2D(texturePosVel, uv2).xy;

            vec2 d = pos - pos2;
            float r2 = dot(d, d);

            if (r2 < h2) {
                float value = h2 - r2;
                density += mass * densityConstant * value * value * value;
            }
        }
    }

    gl_FragColor = vec4(density, 0.0, 0.0, 1.0);
}
