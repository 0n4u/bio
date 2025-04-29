window.onload = function () {
  const currentURL = window.location.href;
  const newURL = currentURL.replace(/\.html$/, "");

  if (newURL !== currentURL) {
    window.location.replace(newURL);
  }
};
