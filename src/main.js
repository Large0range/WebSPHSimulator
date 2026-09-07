import * as THREE from 'three'
import { constrainParticles, calculateDensity, calculatePressure, createParticles, calculateForces, integrate } from './particle';


const particles = createParticles();
const aspect = window.innerWidth / window.innerHeight;

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

for (let i = 0 ; i < particles.length; i++) {
    dummy.position.set(
        particles[i].position.x,
        particles[i].position.y,
        0
    );

    dummy.updateMatrix();

    circle.setMatrixAt(i, dummy.matrix);
}

scene.add(circle);


calculateDensity(particles);

const h = 20;
const r = 10;
const densityConstant = 4 / (Math.PI * Math.pow(h, 8));

const value = h * h - r * r;




let then = 0;
function animate( now ) {
    now *= 0.001;  // convert to seconds
    const deltaTime = 0.008//now - then;
    then = now;

    calculateDensity(particles);
    calculatePressure(particles);
    calculateForces(particles);
    integrate(deltaTime, particles);
    constrainParticles(particles);


    for (let i = 0 ; i < particles.length; i++) {
        dummy.position.set(
            particles[i].position.x,
            particles[i].position.y,
            0
        );

        dummy.updateMatrix();

        circle.setMatrixAt(i, dummy.matrix);
        circle.instanceMatrix.needsUpdate = true;
    }

    renderer.render( scene, camera );
}
renderer.setAnimationLoop( animate );



window.addEventListener('keydown', (event) => {
    if (event.key == 'z') {
        camera.position.z -= 1;
    } else if (event.key == 'x') {
        camera.position.z += 1;
    }
}, false);