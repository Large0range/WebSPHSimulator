import * as THREE from 'three';
import {create_integer_texture_from_array} from './GPU';

const fragmentShader = (await import('./fragment.glsl?raw')).default;

const uniforms = {
  iTime: { value: 0 },
  iResolution:  { value: new THREE.Vector3() },
  iPositionTexture: { value: 1},
  iVelocityTexture: { value: 1},
  iForceTexture: { value: 1},
}; 



const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
const renderer = new THREE.WebGLRenderer();
renderer.autoClearColor = false;


renderer.setSize(window.innerWidth, window.innerHeight);

document.body.appendChild(renderer.domElement);

const geometry = new THREE.PlaneGeometry(2, 2);
const material = new THREE.ShaderMaterial({fragmentShader, uniforms});
const plane = new THREE.Mesh( geometry, material);
scene.add(plane);

const g2 = new THREE.CircleGeometry(1, 16);
const m2 = new THREE.MeshBasicMaterial({color: 'red'});
const c2 = new THREE.Mesh(g2, m2);

const buffer = new THREE.RenderTarget(renderer.domElement.width, renderer.domElement.height, 1);


const size = renderer.domElement.width * renderer.domElement.height;
const data = new Uint8Array(2 * size); // 2 channels: RG

// Fill the array with raw pixel data (e.g., a procedural pattern)
for (let i = 0; i < size; i++) {
    const stride = i * 2;
    
    data[stride]     = 255;  // Red
    data[stride + 1] = 0;  // Green
}

let testData = [];
for (let i = 0; i < size; i++) {
    testData.push([255, 0]);
}


let testData2 = [];
for (let i = 0; i < size; i++) {
    testData2.push([0, 255]);
}

let testData3 = [];
for (let i = 0; i < size; i++) {
    testData3.push([255, 255]);
}



const positionTexture = create_integer_texture_from_array(renderer.domElement.width, renderer.domElement.height, testData);
const velocityTexture = create_integer_texture_from_array(renderer.domElement.width, renderer.domElement.height, testData2);
const forceTexture = create_integer_texture_from_array(renderer.domElement.width, renderer.domElement.height, testData3);



let then = 0;
function animate( now ) {
    now *= 0.001;  // convert to seconds
    const deltaTime = 0.008//now - then;
    then = now;

    const canvas = renderer.domElement;
    uniforms.iResolution.value.set(canvas.width, canvas.height, 1);
    uniforms.iTime.value = now;
    uniforms.iPositionTexture.value = positionTexture;
    uniforms.iVelocityTexture.value = velocityTexture;
    uniforms.iForceTexture.value = forceTexture;

    renderer.render( scene, camera );
    
}
renderer.setAnimationLoop( animate );

