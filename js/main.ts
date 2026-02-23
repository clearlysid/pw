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
});
