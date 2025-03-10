const songs = [
  "./assets/music/music.mp3",
  "./assets/music/music2.mp3",
  "./assets/music/music3.mp3",
  "./assets/music/music4.mp3",
  "./assets/music/music5.mp3",
];

let currentSongIndex = Math.floor(Math.random() * songs.length);
let currentAudio = null; // Store the current audio element

function playNextSong() {
  // Stop the current song if it's playing
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0; // Reset the time to the beginning
  }

  // Make sure the next song is different from the current one
  let nextSongIndex;
  do {
    nextSongIndex = Math.floor(Math.random() * songs.length);
  } while (nextSongIndex === currentSongIndex);

  currentSongIndex = nextSongIndex;
  currentAudio = new Audio(songs[currentSongIndex]);

  currentAudio.loop = false;
  currentAudio.volume = 0.4;

  currentAudio.addEventListener("ended", () => {
    playNextSong();
  });

  currentAudio.play();
}

function userHasClicked() {
  document.getElementById("flexboxcontainer").style.display = "none";
  document.getElementById("flexboxcontainer").style.width = 0;
  document.getElementById("flexboxcontainer").style.height = 0;

  const hiddenContainer = document.getElementById("hiddencontainer");
  hiddenContainer.style.display = "flex";
  playNextSong();
  setTimeout(() => {
    hiddenContainer.style.opacity = 1;
  }, 50);
}

function updateFlicker() {
  const randomOpacity = Math.random() * 0.75 + 0.75;

  const flickerTexts = document
    .querySelectorAll(".flickertext")
    .forEach((element) => {
      element.style.setProperty("--rand", randomOpacity);
    });
}

setInterval(updateFlicker, 500);

document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("flexboxcontainer")
    .addEventListener("click", userHasClicked);
});
