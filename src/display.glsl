uniform sampler2D tDiffuse;
uniform sampler2D tDense;
uniform int particleCount;
varying vec2 vUv;



void main() {
// Sample the original rendered scene pixel color
    vec4 texColor = texture2D(tDiffuse, vUv);
    vec4 density = texture2D(tDense, vUv);

    gl_FragColor = density;//vec4(texColor.x, 0, 0, 1);
}
