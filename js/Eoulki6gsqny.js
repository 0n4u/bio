class _app {
  id = 0;
  videoElement = null;
  audioElement = null;
  musicVolume = 0.12;
  musicFadeIn = 4000;
  skippedIntro = false;
  backgroundToggler = false;
  shouldIgnoreVideo = false;
  effects = [
      "bounce",
      "flash",
      "pulse",
      "rubberBand",
      "shake",
      "swing",
      "tada",
      "wobble",
      "jello"
  ];
  brandDescription = [
      "𓆝 𓆟 𓆞 𓆝 𓆟",
      "So uh No head?",
      "١٥٧٤   ♡"
  ];

  titleChanger = (text, delay) => {
      if (!text) return;

      delay = delay || 2000;

      let counter = 0;

      setInterval(() => {
          if (counter < text.length) document.title = text[counter++];
          else document.title = text[(counter = 0)];
      }, delay);
  };
}

const app = new _app();