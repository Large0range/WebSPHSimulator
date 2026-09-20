// Builds a (numBlocksX+1) x numBlocksY table: texel (x,y) = index of the first
// sorted particle whose cell id >= y*numBlocksX + x.
// The extra column means texel (numBlocksX, y) is the end of row y.
// One binary search per cell per step, instead of six per particle/pixel.

uniform sampler2D positionTexture; // sorted
uniform float RADIUS;
uniform int numBlocksX;
uniform int texWidth;
uniform int count;

float cellIdAt(int i) {
    vec2 p = texelFetch(positionTexture, ivec2(i % texWidth, i / texWidth), 0).xy;
    vec2 b = floor(p / RADIUS);
    return b.x + b.y * float(numBlocksX);
}

void main() {
    ivec2 c = ivec2(gl_FragCoord.xy);
    float target = float(c.y * numBlocksX + c.x);

    int lo = 0;
    int hi = count;
    while (lo < hi) {
        int mid = (lo + hi) / 2;
        if (cellIdAt(mid) < target) lo = mid + 1;
        else hi = mid;
    }

    gl_FragColor = vec4(float(lo), 0.0, 0.0, 1.0);
}
