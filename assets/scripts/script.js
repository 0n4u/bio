const songs = [
  "./assets/music/music.mp3",
  "./assets/music/music2.mp3",
  "./assets/music/music3.mp3",
  "./assets/music/music4.mp3",
];

let currentSongIndex = Math.floor(Math.random() * songs.length);
let currentAudio = null;
let hasEntered = false;

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

  currentAudio.addEventListener("ended", playNextSong);
  currentAudio.play();
}

function userHasClicked() {
  if (hasEntered) return;
  hasEntered = true;

  const flexContainer = document.getElementById("flexboxcontainer");
  const hiddenContainer = document.getElementById("hiddencontainer");

  flexContainer.style.display = "none";
  hiddenContainer.style.display = "flex";

  setTimeout(() => {
    hiddenContainer.classList.add("show");
  }, 50);

  playNextSong();
  changeFooterText();
}

function showFooterNotice(e) {
  window.open('./tos.html', '_blank');
  const footerNotice = document.getElementById('footer-notice');
  if (footerNotice) footerNotice.style.display = 'block';
  document.getElementById('tos-link').style.display = 'none';
  e.preventDefault();
}

function changeFooterText() {
  const tos = document.getElementById('tos-link');
  tos.innerHTML = '&copy; 2025 Overdose. All rights reserved.';
  tos.style.cursor = 'default';
}

function updateFlicker() {
  const randomOpacity = Math.random() * 0.75 + 0.75;
  document.querySelectorAll(".flickertext").forEach((element) => {
    element.style.setProperty("--rand", randomOpacity);
  });
}

setInterval(updateFlicker, 500);

document.addEventListener("DOMContentLoaded", () => {
  const flexContainer = document.getElementById("flexboxcontainer");
  if (flexContainer) {
    flexContainer.addEventListener("click", userHasClicked);
  }

  const tosLink = document.getElementById("tos-link");
  if (tosLink) {
    tosLink.addEventListener("click", showFooterNotice);
  }
});
