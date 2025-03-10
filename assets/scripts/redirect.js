window.onload = function () {
  var currentURL = window.location.href;

  if (currentURL.endsWith(".html")) {
    var newURL = currentURL.substring(0, currentURL.length - 5);
    window.location.replace(newURL);
  }
};
