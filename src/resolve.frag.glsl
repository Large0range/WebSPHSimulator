uniform sampler2D tDensity;
varying vec2 vUv;

void main() {
    float d = texture(tDensity, vUv).r;
    float s = smoothstep(0.0, 2.0, d);

    vec3 col = mix(vec3(0.0, 0.0, 0.03), vec3(0.1, 0.45, 1.0), s);
    col = mix(col, vec3(0.9, 0.97, 1.0), smoothstep(0.8, 1.0, s));

    gl_FragColor = vec4(col, 1.0);
}
