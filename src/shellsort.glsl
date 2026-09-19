//#define DISTANCE 1

uniform float RADIUS;
uniform int numBlocksX;

uniform int DISTANCE;
uniform int texWidth; // width of the 2D texture layout (elements are stored row-major)

float calculate_block(vec2 p) {
    float bx = floor(p.x / RADIUS);
    float by = floor(p.y / RADIUS);
    return bx + by * float(numBlocksX);
}

void main() {
    ivec2 texel = ivec2(gl_FragCoord.xy); // this texel's 2D coords
    int idx = texel.x + texel.y * texWidth; // flatten to a linear index into the array
    int partnerIDX = idx ^ DISTANCE; // calculate partner with xor, flipping the distance bit as array is power of 2

    ivec2 partnerTexel = ivec2(partnerIDX % texWidth, partnerIDX / texWidth); // unflatten back to 2D coords

    vec2 uv = gl_FragCoord.xy / resolution.xy; // calculate the uv for this location
    vec2 partnerUV = (vec2(partnerTexel) + 0.5) / resolution.xy; // calculate the partner uv

    vec2 thisPosition = texture(positionTexture, uv).xy; // grab our positions to pass through
    vec2 thisVelocity = texture(positionTexture, uv).zw; // grab our velocity to pass through
    float thisValue = calculate_block(thisPosition); //texture(positionTexture, uv).z; // calculate our block value

    vec2 partnerPosition = texture(positionTexture, partnerUV).xy; // grab our partner positions to pass through
    vec2 partnerVelocity = texture(positionTexture, partnerUV).zw; // grab our partner velocity to pass through
    float partnerValue = calculate_block(partnerPosition); //texture(positionTexture, partnerUV).z; // calculate our partner block value

    if (idx > partnerIDX) {    // if we are higher in the list we want greater values
        if (thisValue < partnerValue)
            gl_FragColor = vec4(partnerPosition.xy, partnerVelocity);
        else
            gl_FragColor = vec4(thisPosition.xy, thisVelocity);
    } else {   // lower in the list we want smaller values
        if (thisValue > partnerValue)
            gl_FragColor = vec4(partnerPosition.xy, partnerVelocity);
        else
            gl_FragColor = vec4(thisPosition.xy, thisVelocity);
    }
}
