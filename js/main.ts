import { animate, scroll } from "motion";

document.addEventListener("DOMContentLoaded", () => {
  const svgNS = "http://www.w3.org/2000/svg";

  // --- Noise overlay ---
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

  // --- Hero reveal animation (circular mask with turbulent edges) ---
  const heroImage = document.querySelector<HTMLElement>(".hero-image");
  if (heroImage) {
    const svgEl = document.createElementNS(svgNS, "svg");
    svgEl.style.position = "absolute";
    svgEl.setAttribute("width", "0");
    svgEl.setAttribute("height", "0");

    const defsEl = document.createElementNS(svgNS, "defs");

    // Filter to distort mask circle edges into organic blob
    const maskFilter = document.createElementNS(svgNS, "filter");
    maskFilter.setAttribute("id", "mask-warp");
    maskFilter.setAttribute("x", "-30%");
    maskFilter.setAttribute("y", "-30%");
    maskFilter.setAttribute("width", "160%");
    maskFilter.setAttribute("height", "160%");

    const feTurb = document.createElementNS(svgNS, "feTurbulence");
    feTurb.setAttribute("type", "turbulence");
    feTurb.setAttribute("baseFrequency", "5");
    feTurb.setAttribute("numOctaves", "1");
    feTurb.setAttribute("seed", "5");
    feTurb.setAttribute("result", "turb");

    const feDisp = document.createElementNS(svgNS, "feDisplacementMap");
    feDisp.setAttribute("in", "SourceGraphic");
    feDisp.setAttribute("in2", "turb");
    feDisp.setAttribute("scale", "0.08");
    feDisp.setAttribute("xChannelSelector", "R");
    feDisp.setAttribute("yChannelSelector", "G");

    // Soft blur on the distorted edge
    const feBlur = document.createElementNS(svgNS, "feGaussianBlur");
    feBlur.setAttribute("stdDeviation", "0.004");

    maskFilter.append(feTurb, feDisp, feBlur);

    // Mask: white circle on black = visible area
    const mask = document.createElementNS(svgNS, "mask");
    mask.setAttribute("id", "hero-mask");
    mask.setAttribute("maskContentUnits", "objectBoundingBox");

    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("cx", "0.5");
    circle.setAttribute("cy", "0.5");
    circle.setAttribute("r", "0");
    circle.setAttribute("fill", "white");
    circle.setAttribute("filter", "url(#mask-warp)");

    mask.appendChild(circle);
    defsEl.append(maskFilter, mask);
    svgEl.appendChild(defsEl);
    document.body.appendChild(svgEl);

    // Apply mask
    heroImage.style.mask = "url(#hero-mask)";

    // Animate circle radius 0 → 1.0, displacement fades out
    const duration = 1400;
    const startTime = performance.now() + 100;
    const maxDisp = 0.08;

    function easeOutCubic(t: number): number {
      return 1 - Math.pow(1 - t, 3);
    }

    function animateReveal(now: number) {
      const elapsed = now - startTime;
      if (elapsed < 0) {
        requestAnimationFrame(animateReveal);
        return;
      }

      const raw = Math.min(elapsed / duration, 1);
      const t = easeOutCubic(raw);

      // Circle radius: 0 → 1.0
      circle.setAttribute("r", String(t));

      // Displacement decreases as circle grows for cleaner final edge
      const disp = maxDisp * (1 - t * 0.8);
      feDisp.setAttribute("scale", String(disp));

      if (raw < 1) {
        requestAnimationFrame(animateReveal);
      } else {
        // Clean up
        heroImage.style.mask = "";
        svgEl.remove();
      }
    }

    requestAnimationFrame(animateReveal);
  }

  // --- Hero text staggered entry ---
  const homeHead = document.querySelector(".home-head");
  if (homeHead) {
    const children = Array.from(homeHead.children) as HTMLElement[];
    children.forEach((el, i) => {
      el.style.opacity = "0";
      const delay = 0.1 + i * 0.05;
      const spring = { type: "spring" as const, stiffness: 450, damping: 48, mass: 3, delay };
      animate(el, { opacity: [0, 1] }, { duration: 0.3, delay });
      animate(el, { x: [70, 0], y: [50, 0], scale: [0.8, 1], rotate: [5, 0] }, spring);
    });
  }

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
