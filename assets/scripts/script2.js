let hasEntered = false;
const flexContainer = document.getElementById("flexboxcontainer");
const hiddenContainer = document.getElementById("hiddencontainer");
const footerText = document.getElementById('footer-text');
const footerNotice = document.getElementById('footer-notice');

function userHasClicked() {
  if (hasEntered) return;
  hasEntered = true;

  if (flexContainer) flexContainer.style.display = "none";
  if (hiddenContainer) {
    hiddenContainer.style.display = "flex";
    setTimeout(() => hiddenContainer.classList.add("show"), 50);
  }

  changeFooterText();
}

function changeFooterText() {
  if (footerText) {
    footerText.innerHTML = '&copy; 2025 Overdose. All rights reserved.';
    footerText.style.cursor = 'default';
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
});
