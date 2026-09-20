#define PI 3.14159265359

uniform float RADIUS;
uniform float MASS;
uniform float refDense;

varying vec2 vOffset;

void main() {
    float h2 = RADIUS * RADIUS;
    float d = h2 - dot(vOffset, vOffset);
    if (d <= 0.0) discard;

    float density = MASS * 4.0 / (PI * h2 * h2 * h2 * h2) * d * d * d;
    // additively blended into a half-float target; stored relative to reference density
    gl_FragColor = vec4(density / refDense, 0.0, 0.0, 1.0);
}
