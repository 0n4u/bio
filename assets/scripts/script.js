const songs = [
  "./assets/music/music.mp3",
  "./assets/music/music2.mp3",
  "./assets/music/music3.mp3",
  "./assets/music/music4.mp3",
];
let currentSongIndex = Math.floor(Math.random() * songs.length);
let currentAudio = new Audio(songs[currentSongIndex]);
currentAudio.loop = false;
currentAudio.volume = 0.4;
let hasEntered = false;
const flexContainer = document.getElementById("flexboxcontainer");
const hiddenContainer = document.getElementById("hiddencontainer");
const footerText = document.getElementById("footer-text");
const footerNotice = document.getElementById("footer-notice");

function playNextSong() {
  const nextSongIndex = (currentSongIndex + 1) % songs.length;
  currentAudio.pause();
  currentAudio.currentTime = 0;
  currentSongIndex = nextSongIndex;
  currentAudio.src = songs[currentSongIndex];
  currentAudio.play();
}

function userHasClicked() {
  if (hasEntered) return;
  hasEntered = true;
  if (flexContainer) flexContainer.style.display = "none";
  if (hiddenContainer) {
    hiddenContainer.style.display = "flex";
    setTimeout(() => hiddenContainer.classList.add("show"), 50);
  }
  playNextSong();
  changeFooterText();
}

function changeFooterText() {
  if (footerText) {
    footerText.innerHTML = "&copy; 2025 Overdose. All rights reserved.";
    footerText.style.cursor = "default";
  }
}

function updateFlicker() {
  const randomOpacity = Math.random() * 0.75 + 0.75;
  document.querySelectorAll(".flickertext").forEach((element) => {
    element.style.setProperty("--rand", randomOpacity);
  });
}
setInterval(updateFlicker, 500);
document.addEventListener("DOMContentLoaded", () => {
  if (flexContainer) {
    flexContainer.addEventListener("click", userHasClicked);
  }
  currentAudio.addEventListener("ended", playNextSong);
});
