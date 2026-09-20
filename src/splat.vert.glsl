// One instanced quad per particle; position is fetched from the state texture.
uniform sampler2D positionTexture;
uniform vec2 screenSize;
uniform float RADIUS;
uniform int texWidth;

varying vec2 vOffset; // pixel offset from particle centre

void main() {
    ivec2 t = ivec2(gl_InstanceID % texWidth, gl_InstanceID / texWidth);
    vec2 p = texelFetch(positionTexture, t, 0).xy;

    vOffset = position.xy * RADIUS; // quad corners are (-1..1)
    vec2 pix = p + vOffset;
    gl_Position = vec4(pix / screenSize * 2.0 - 1.0, 0.0, 1.0);
}
