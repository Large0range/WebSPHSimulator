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
    countDisplay.innerHTML = "Particle Count: " + event.target.value;
  });


  widthDisplay.innerHTML = "Width: " + widthSlider.value;
  heightDisplay.innerHTML = "Height: " + heightSlider.value;
  countDisplay.innerHTML = "Particle Count: " + countSlider.value;

  canvas.setAttribute("width", widthSlider.value);
  canvas.setAttribute("height", heightSlider.value);

  console.log(heightSlider.value);

  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);


  document.querySelector("#run-button").addEventListener("click", (event) => {
    event.target.setAttribute("disabled", "");

    //swap preview simulation canvas so that we can have multiple contexts
    document.querySelector("#simulation").style.display = "";
    canvas.style.display = "none";

    runSimulation(Number(widthSlider.value), Number(heightSlider.value), Number(countSlider.value));
  })
}

document.body.onload = setup;
//runSimulation(800, 600, 10);
