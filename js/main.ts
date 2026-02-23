import { animate, scroll } from "motion";

document.addEventListener("DOMContentLoaded", () => {
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("id", "noise-overlay");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("xmlns", svgNS);

  const filter = document.createElementNS(svgNS, "filter");
  filter.setAttribute("id", "noise");
  filter.setAttribute("x", "0%");
  filter.setAttribute("y", "0%");
  filter.setAttribute("width", "100%");
  filter.setAttribute("height", "100%");

  const turbulence = document.createElementNS(svgNS, "feTurbulence");
  turbulence.setAttribute("type", "fractalNoise");
  turbulence.setAttribute("baseFrequency", "0.5");
  turbulence.setAttribute("numOctaves", "4");
  turbulence.setAttribute("stitchTiles", "stitch");

  filter.appendChild(turbulence);
  svg.appendChild(filter);

  const rect = document.createElementNS(svgNS, "rect");
  rect.setAttribute("width", "100%");
  rect.setAttribute("height", "100%");
  rect.setAttribute("filter", "url(#noise)");
  svg.appendChild(rect);

  document.body.appendChild(svg);

  // Smooth scroll
  if (typeof Lenis !== "undefined") {
    const lenis = new Lenis();
    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
  }

  // Hero image parallax
  const heroImg = document.querySelector<HTMLElement>(".hero-image");
  if (heroImg) {
    scroll(animate(heroImg, { transform: ["perspective(1200px) rotate(6deg) translateY(0px)", "perspective(1200px) rotate(6deg) translateY(-80px)"] }), {
      target: heroImg,
      speed: 1.1,
    });
  }

  // Scroll-driven animations for work assets
  const workAssets = document.querySelectorAll<HTMLElement>(
    ".work-images video, .work-secondary"
  );

  workAssets.forEach((el) => {
    const from = el.dataset.from;
    if (!from) return;
    const to = el.style.transform || "none";

    scroll(
      animate(el, { opacity: [0, 1], transform: [from, to] }, { ease: "easeOut" }),
      { target: el, offset: ["start end", "start 0.6"] }
    );
  });
});
