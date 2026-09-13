import * as THREE from 'three'
import { calculateBlock, createParticles, constrainParticles, integrate, calculateDensity, smoothingRadius, createBlocks } from './particle';
import { EffectComposer, RenderPass, ShaderPass } from 'three/examples/jsm/Addons.js';



const width = 800;//renderer.domElement.width;
const height = 600;//renderer.domElement.height;
const count = 100;

const grid = false;

const particles = createParticles(width, height, count);
const blocks = createBlocks(width, height, particles);
const aspect = 1;// window.innerWidth / window.innerHeight;

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-100 * aspect, 100 * aspect, 100, -100, -100, 100);
const renderer = new THREE.WebGLRenderer();

camera.position.z = 10;
camera.lookAt(0,0,0);

renderer.setSize(window.innerWidth, window.innerHeight);

document.body.appendChild(renderer.domElement);

const geometry = new THREE.CircleGeometry(1, 16);
const material = new THREE.MeshBasicMaterial( { color: 0x0000ff } );
const circle = new THREE.InstancedMesh( geometry, material, particles.length);

const dummy = new THREE.Object3D();

/*for (let i = 0 ; i < particles.length; i++) {
    dummy.position.set(
        particles[i].position.x,
        particles[i].position.y,
        0
    );

    dummy.updateMatrix();

    circle.setMatrixAt(i, dummy.matrix);
}*/

scene.add(circle);

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// 4. Define your Custom Fragment Shader Effect
const MyCustomShader = {
  uniforms: {
    // tDiffuse is automatically populated with the rendered scene texture
    tDiffuse: { value: null },
    tDense: {value: null},
    particleCount: { value: particles.length }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler2D tDense;
    uniform int particleCount;
    varying vec2 vUv;



    void main() {
      // Sample the original rendered scene pixel color
      vec4 texColor = texture2D(tDiffuse, vUv);
      vec4 density = texture2D(tDense, vUv);
      vec4 finalColor = vec4(1,0,0,1);//mix(texColor, vec4(1.0, 0.0, 0.0, 1.0), effect * 0.3);

      gl_FragColor = density;//vec4(texColor.x, 0, 0, 1);
    }
  `
};

// 5. Create and add the ShaderPass
const myEffectPass = new ShaderPass(MyCustomShader);
composer.addPass(myEffectPass);

const temp = [];
const data = new Uint8Array(4 * width * height);

console.log(width, height);
console.log(calculateBlock(100,0));

for (let i = 0; i < width * height; i++) {
  let block = calculateBlock(i % width, Math.floor(i / width));
  data[i * 4 + 2] = Math.round(calculateDensity(i % width, Math.floor(i / width), particles, blocks) * 255);
  data[i * 4 + 0] = 0;
  if ((Math.floor(i/width) % smoothingRadius == 0 || i % smoothingRadius == 0) && grid)
    data[i * 4 + 0] = 255;

  data[i * 4 + 1] = 0;
  data[i * 4 + 3] = 255;
}


const denseTex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
denseTex.needsUpdate = true;
myEffectPass.uniforms.tDense.value = denseTex;

composer.render();

const deltaTime = 0.008//now - then;
function animate( now ) {

    //integrate(deltaTime, particles);
    constrainParticles(particles);


    for (let i = 0 ; i < particles.length; i++) {
        dummy.position.set(
            particles[i].position.x,
            particles[i].position.y,
            0
        );

        dummy.updateMatrix();

        circle.setMatrixAt(i, dummy.matrix);
    }

    circle.instanceMatrix.needsUpdate = true;
    //renderer.render( scene, camera );
    composer.render();
}
renderer.setAnimationLoop( animate );
