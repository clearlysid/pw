document.addEventListener("DOMContentLoaded", () => {
  const home = document.querySelector(".home");
  if (home) {
    home.classList.add("is-loading");
    window.addEventListener("load", () => {
      home.classList.remove("is-loading");
    });
  }
});
