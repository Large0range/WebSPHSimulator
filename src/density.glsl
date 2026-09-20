#define PI 3.14159265359

uniform sampler2D positionTexture;  // sorted particles (xy = pos, zw = vel)
uniform sampler2D cellStartTexture;

uniform float RADIUS;
uniform float MASS;
uniform int numBlocksX;
uniform int numBlocksY;
uniform int texWidth;

void main() {
    ivec2 texel = ivec2(gl_FragCoord.xy);
    vec2 position = texelFetch(positionTexture, texel, 0).xy;

    float h2 = RADIUS * RADIUS;
    float poly6 = 4.0 / (PI * h2 * h2 * h2 * h2); // 2D poly6 normalisation

    ivec2 cell = clamp(ivec2(floor(position / RADIUS)), ivec2(0), ivec2(numBlocksX - 1, numBlocksY - 1));

    float density = 0.0;

    for (int dy = -1; dy <= 1; dy++) {
        int cy = cell.y + dy;
        if (cy < 0 || cy >= numBlocksY) continue;

        int xLo = max(cell.x - 1, 0);
        int xHi = min(cell.x + 1, numBlocksX - 1);

        // cells in a row are contiguous in the sorted list
        int start = int(texelFetch(cellStartTexture, ivec2(xLo, cy), 0).x);
        int end   = int(texelFetch(cellStartTexture, ivec2(xHi + 1, cy), 0).x);

        for (int i = start; i < end; i++) {
            vec2 other = texelFetch(positionTexture, ivec2(i % texWidth, i / texWidth), 0).xy;
            vec2 d = position - other;
            float w = max(0.0, h2 - dot(d, d));
            density += MASS * poly6 * w * w * w;
        }
    }

    gl_FragColor = vec4(density, 0.0, 0.0, 1.0);
}
