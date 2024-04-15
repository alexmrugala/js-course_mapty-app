'use strict';

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

class Workout {
  //modern specification of JS
  date = new Date();
  id = (Date.now() + '').slice(-10);

  constructor(coords, distance, duration) {
    //this.date = ... need to define to make work with older browsers
    //this.id = ...
    this.coords = coords; //[lat,lng]
    this.distance = distance; //in km
    this.duration = duration; //in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
}

class Running extends Workout {
  type = 'running'; //now available on all instances
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration); //initialized this keyword
    this.cadence = cadence;
    this.calcPace(); //used to automaticlly call the calc at the call of the object
    this._setDescription(); //call this mehtod in the child because the child class is what actually has the type. workout does not have the type defined
  }

  calcPace() {
    //min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling'; //will now be available on all instances
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration); //initialized this keyword
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }
  calcSpeed() {
    //km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

//global variables
//let map, mapEvent; //define these as properties of the class field so we can keep everything in the map class

/////////////////////////////
//Application architecture
class App {
  #map;
  #mapEvent;
  #workouts = [];
  #mapZoomLevel = 13;
  constructor() {
    //get user's position
    this._getPosition();

    //get data from local storage
    this._getLocalStorage();

    //attach event handlers
    //need to bind newWorkout because this keyword originally points to form
    form.addEventListener('submit', this._newWorkout.bind(this));

    //don't technically need to rebind the this keyword since toggle elevation field does not use this in the function
    inputType.addEventListener('change', this._toggleElevationField.bind(this));

    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
  }

  _getPosition() {
    if (navigator.geolocation)
      //check in case older browsers don't support this api
      //need to bind the this keyword because getCUrrentPOsition treats the this as a normal function call --> bind the this keyword to this which points back to the app object
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel); //html must have div with id of string passed into .map()
    L.tileLayer('https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(this.#map);

    const marker = L.marker(coords).addTo(this.#map);
    L.marker;

    //handling clicks on map
    //have to bind showFrom --> this keyword points to what is calling it --> points to #map itself
    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
      this._renderWorkoutMarker(work); //does not work because get local storage happens as soon as the app gets loaded --> map has not loaded yet so throws an error --> add logic to _loadMap
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus(); //comes from leaflet library
  }

  _hideForm() {
    //empty inputs
    inputDuration.value =
      inputElevation.value =
      inputCadence.value =
      inputDistance.value =
        '';
    form.style.display = 'none'; //helps with animation
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
    //readd hidden
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    //helper functions
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));

    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();
    //get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    //check if data is valid

    //if running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      //check if data is valid
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return alert('Inputs have to be positive numbers'); //guard clause

      workout = new Running([lat, lng], distance, duration, cadence);
    }
    //if cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return alert('Inputs have to be positive numbers'); //guard clause
      workout = new Cycling([lat, lng], distance, duration, elevation);
    }
    //add new object to workout array
    this.#workouts.push(workout);

    // render workout on map as marker
    this._renderWorkoutMarker(workout);

    //render workout on list
    this._renderWorkout(workout);

    //hide from + clear input fields
    this._hideForm();

    //set local storage to all workouts
    this._setLocalStorage();
  }

  _renderWorkout(workout) {
    let html = `
    <li class="workout workout--${workout.type}" data-id="${workout.id}">
     <h2 class="workout__title">${workout.description}</h2>
    <div class="workout__details">
      <span class="workout__icon">${
        workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
      }</span>
      <span class="workout__value">${workout.distance}</span>
      <span class="workout__unit">km</span>
    </div>
    <div class="workout__details">
      <span class="workout__icon">⏱</span>
      <span class="workout__value">${workout.duration}</span>
      <span class="workout__unit">min</span>
    </div>`;

    if (workout.type === 'running')
      html += `
    <div class="workout__details">
      <span class="workout__icon">⚡️</span>
      <span class="workout__value">${workout.cadence}</span>
      <span class="workout__unit">min/km</span>
    </div>
    <div class="workout__details">
      <span class="workout__icon">🦶🏼</span>
      <span class="workout__value">178</span>
      <span class="workout__unit">spm</span>
    </div>
  </li>`;

    if (workout.type === 'cycling')
      html += `
  <div class="workout__details">
  <span class="workout__icon">⚡️</span>
  <span class="workout__value">${workout.speed.toFixed(1)}</span>
  <span class="workout__unit">km/h</span>
</div>
<div class="workout__details">
  <span class="workout__icon">⛰</span>
  <span class="workout__value">${workout.elevationGain}</span>
  <span class="workout__unit">m</span>
</div>
</li>`;

    form.insertAdjacentHTML('afterend', html); //afterend adds new element as sibling elememt at the end of the form
  }

  _renderWorkoutMarker(workout) {
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 150,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();
  }

  _moveToPopup(e) {
    //attach event listener of click on running or cycling object to parent since the objects may not be created at startup of the application
    const workoutEl = e.target.closest('.workout');

    //use the id to find the workout in the workouts array --> build bridge from data stored to user interface

    if (!workoutEl) return; //guard clause --> if workout element null, return the function
    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    //in leaflet, go to the object that is selected --> see documentation
    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  _setLocalStorage() {
    //api that the browser provides
    localStorage.setItem('workouts', JSON.stringify(this.#workouts)); //convert object to string
    //only use localStorage api for small amounts of data --> is blocking
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    //check if data is actually there
    if (!data) return;

    //repopulate the workouts array with the data that was stored in local storage
    this.#workouts = data;

    // this.#workouts.forEach(work => {
    //   this._renderWorkout(work);
    //   this._renderWorkoutMarker(work); //does not work because get local storage happens as soon as the app gets loaded --> map has not loaded yet so throws an error --> add logic to _loadMap
    // });
  }

  reset() {
    //remove items from local storage
    localStorage.removeItem('workouts');
    location.reload(); //big object that has lot of methods within the browser
  }
}

const app = new App();
//app._getPosition(); //this code will get executed right at the point when the application is loaded
//also have a method in App that gets called during loading --> constructor function gets called once the new 'app' object is created --> call get Position in the constructor function
