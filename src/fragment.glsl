#include <common>
uniform vec3 iResolution;
uniform float iTime;
uniform usampler2D iPositionTexture;
uniform usampler2D iVelocityTexture;
uniform usampler2D iForceTexture;
// By iq: https://www.shadertoy.com/user/iq
// license: Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = fragCoord/iResolution.xy;
    //vec4 color = texture(iTexture, uv);
    fragColor = vec4(texture2D(iForceTexture, uv).xy,0,1);
}
void main() {
mainImage(gl_FragColor, gl_FragCoord.xy);
}