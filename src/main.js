import './style.css';
import { runSimulation } from './simulation';


//canvas and ctx for pre-sim drawing
const canvas = document.querySelector("#preview");
const ctx = canvas.getContext('2d');


//gets the width slider and display
const widthDisplay = document.body.querySelector("#widthDisp");
const widthSlider = document.body.querySelector("#width")

//gets the height slider and display
const heightDisplay = document.body.querySelector("#heightDisp");
const heightSlider = document.body.querySelector("#height")

const countDisplay = document.body.querySelector("#countDisp");
const countSlider = document.body.querySelector("#count");

const smoothDisplay = document.body.querySelector("#smoothDisp");
const smoothSlider = document.body.querySelector("#smooth");

const massDisplay = document.body.querySelector("#massDisp");
const massSlider = document.body.querySelector("#mass");

const stiffDisplay = document.body.querySelector("#stiffDisp");
const stiffSlider = document.body.querySelector("#stiff");

const targetDisplay = document.body.querySelector("#targetDisp");
const targetSlider = document.body.querySelector("#target");

const viscDisplay = document.body.querySelector("#viscDisp");
const viscSlider = document.body.querySelector("#visc");


//default setup for startup
function setup(event) {
  widthSlider.addEventListener("input", (event) => {
    widthDisplay.innerHTML = "Width: " + event.target.value;
    canvas.setAttribute("width", event.target.value);

    ctx.fillRect(0, 0, canvas.width, canvas.height);
  });

  heightSlider.addEventListener("input", (event) => {
    heightDisplay.innerHTML = "Height: " + event.target.value;
    canvas.setAttribute("height", event.target.value);

    ctx.fillRect(0, 0, canvas.width, canvas.height);
  });

  countSlider.addEventListener("input", (event) => {
    countDisplay.innerHTML = "Particle Count: " + Math.pow(2, event.target.value);
  });

  smoothSlider.addEventListener("input", (event) => {
    smoothDisplay.innerHTML = "Smooth: " + event.target.value;
  });

  massSlider.addEventListener("input", (event) => {
    massDisplay.innerHTML = "Mass: " + event.target.value;
  });

  stiffSlider.addEventListener("input", (event) => {
    stiffDisplay.innerHTML = "Stiff: " + event.target.value;
  })

  viscSlider.addEventListener("input", (event) => {
    viscDisplay.innerHTML = "Visc: " + event.target.value;
  })

  targetSlider.addEventListener("input", (event) => {
    targetDisplay.innerHTML = "Target: " + event.target.value / 1000;
  })


  widthDisplay.innerHTML = "Width: " + widthSlider.value;
  heightDisplay.innerHTML = "Height: " + heightSlider.value;
  countDisplay.innerHTML = "Particle Count: " + Math.pow(2, countSlider.value);
  smoothDisplay.innerHTML = "Smooth: " + smoothSlider.value;
  massDisplay.innerHTML = "Mass: " + massSlider.value;
  stiffDisplay.innerHTML = "Stiff: " + stiffSlider.value;
  viscDisplay.innerHTML = "Visc: " + viscSlider.value;
  targetDisplay.innerHTML = "Target: " + targetSlider.value / 1000;

  canvas.setAttribute("width", widthSlider.value);
  canvas.setAttribute("height", heightSlider.value);

  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);


  document.querySelector("#run-button").addEventListener("click", (event) => {
    event.target.setAttribute("disabled", "");

    //swap preview simulation canvas so that we can have multiple contexts
    document.querySelector("#simulation").style.display = "";
    canvas.style.display = "none";

    runSimulation(Number(widthSlider.value), Number(heightSlider.value), Math.pow(2, Number(countSlider.value)), Number(smoothSlider.value), Number(massSlider.value), Number(stiffSlider.value), Number(viscSlider.value), Number(targetSlider.value / 1000));
  })
}

document.body.onload = setup;
//runSimulation(800, 600, 10);
