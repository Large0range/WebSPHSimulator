// Bitonic sort step, keyed on grid-cell id.
// Run from JS for k = 2,4,..,n and j = k/2,..,1 (n must be a power of two).
// `positionTexture` is auto-declared by GPUComputationRenderer (self-dependency).

uniform float RADIUS;
uniform int numBlocksX;
uniform int texWidth;
uniform int K; // current bitonic block size
uniform int J; // current compare distance (power of two, < K)

float cellId(vec2 p) {
    vec2 b = floor(p / RADIUS);
    return b.x + b.y * float(numBlocksX);
}

void main() {
    ivec2 texel = ivec2(gl_FragCoord.xy);
    int idx = texel.x + texel.y * texWidth;
    int partnerIdx = idx ^ J;
    ivec2 partnerTexel = ivec2(partnerIdx % texWidth, partnerIdx / texWidth);

    vec4 self = texelFetch(positionTexture, texel, 0);
    vec4 other = texelFetch(positionTexture, partnerTexel, 0);

    float a = cellId(self.xy);
    float b = cellId(other.xy);

    bool ascending = (idx & K) == 0;
    bool lower = idx < partnerIdx;

    // lower element of an ascending pair keeps the min, upper keeps the max (reversed when descending)
    bool takePartner = (lower == ascending) ? (a > b) : (a < b);

    gl_FragColor = takePartner ? other : self;
}
