import * as THREE from 'three';

export function create_integer_texture_from_array(width, height, data) {
    const size = width * height;
    const textureData = new Uint8Array(data[0].length * size); // 2 channels: RG
    let format = null;


    switch (data[0].length) {
        case 1:
            format = THREE.RedIntegerFormat;
            break;
        case 2:
            format = THREE.RGIntegerFormat;
            break;
        case 3:
            format = THREE.RGBIntegerFormat;
            break;
        case 4:
            format = THREE.RGBAIntegerFormat;
            break;
        default:
            console.log(data[0].length + "??????");
            break;
    }

    // Fill the array with raw pixel data (e.g., a procedural pattern)
    for (let i = 0; i < size; i++) {
        const stride = i * 2;
        
        textureData[stride]     = data[i][0];  // Red
        textureData[stride + 1] = data[i][1];  // Green
    }
    
    
    
    
    
    const newTexture = new THREE.DataTexture(textureData, width, height, format);
    newTexture.needsUpdate = true;

    return newTexture;
}