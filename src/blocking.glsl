#define PI 3.14159265359

uniform vec2 texSize;
uniform float boundsMin;
uniform float h;

void main() {
    vec2 uv = gl_FragCoord.xy / texSize;
    vec2 pos = texture2D(texturePosVel, uv).xy;


    vec2 block = floor((pos - boundsMin) / h);

    gl_FragColor = vec4(block, 0.0, 0.0, 1.0);
}
