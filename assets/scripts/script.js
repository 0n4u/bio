const songs = [
  "./assets/music/music.mp3",
  "./assets/music/music2.mp3",
  "./assets/music/music3.mp3",
  "./assets/music/music4.mp3",
];

let currentSongIndex = Math.floor(Math.random() * songs.length);
let currentAudio = null;

function playNextSong() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }

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
  document.getElementById("hiddencontainer").style.display = "flex";
  playNextSong();
  setTimeout(() => {
    document.getElementById("hiddencontainer").style.opacity = 1;
  }, 50);
}

function showFooterNotice(e) {
  window.open('./tos.html', '_blank');
  document.getElementById('footer-notice').style.display = 'block';
  document.getElementById('tos-link').style.display = 'none';
  e.preventDefault();
}

function changeFooterText() {
  document.getElementById('tos-link').innerHTML = '&copy; 2025 Overdose. All rights reserved.';
  document.getElementById('tos-link').style.cursor = 'default';
}

function updateFlicker() {
  const randomOpacity = Math.random() * 0.75 + 0.75;
  document.querySelectorAll(".flickertext").forEach((element) => {
    element.style.setProperty("--rand", randomOpacity);
  });
}

setInterval(updateFlicker, 500);

document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("flexboxcontainer")
    .addEventListener("click", userHasClicked);

  document
    .getElementById("overdoseText")
    .addEventListener("click", changeFooterText);

  document
    .getElementById("doseText")
    .addEventListener("click", changeFooterText);

  document
    .getElementById("tos-link")
    .addEventListener("click", showFooterNotice);
});
