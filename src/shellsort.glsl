//#define DISTANCE 1

uniform int DISTANCE;
uniform int texWidth; // width of the 2D texture layout (elements are stored row-major)

void main() {
    ivec2 texel = ivec2(gl_FragCoord.xy); // this texel's 2D coords
    int idx = texel.x + texel.y * texWidth; // flatten to a linear index into the array
    int partnerIDX = idx ^ DISTANCE; // calculate partner with xor, flipping the distance bit as array is power of 2

    ivec2 partnerTexel = ivec2(partnerIDX % texWidth, partnerIDX / texWidth); // unflatten back to 2D coords

    vec2 uv = gl_FragCoord.xy / resolution.xy; // calculate the uv for this location
    vec2 partnerUV = (vec2(partnerTexel) + 0.5) / resolution.xy; // calculate the partner uv

    vec2 thisPosition = texture(positionTexture, uv).xy; // grab our positions to pass through
    float thisValue = texture(positionTexture, uv).z; // grab our value

    vec2 partnerPosition = texture(positionTexture, partnerUV).xy; // grab our positions to pass through
    float partnerValue = texture(positionTexture, partnerUV).z; // grab our partner value

    if (idx > partnerIDX) {    // if we are higher in the list we want greater values
        if (thisValue < partnerValue)
            gl_FragColor = vec4(partnerPosition.xy, partnerValue, 0);
        else
            gl_FragColor = vec4(thisPosition.xy, thisValue, 0);
    } else {   // lower in the list we want smaller values
        if (thisValue > partnerValue)
            gl_FragColor = vec4(partnerPosition.xy, partnerValue, 0);
        else
            gl_FragColor = vec4(thisPosition.xy, thisValue, 0);
    }
}
