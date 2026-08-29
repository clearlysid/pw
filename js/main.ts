import { animate, scroll } from "motion";
import { galleryPhotos } from "./gallery-data";

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

  // --- Hero reveal + text entry (wait for fonts & image) ---
  const heroImage = document.querySelector<HTMLElement>(".hero-image");
  const heroImg = heroImage?.querySelector("img") as HTMLImageElement | null;
  const homeHead = document.querySelector(".home-head");

  // Hide hero content immediately to prevent flash before reveal
  if (heroImg) heroImg.style.opacity = "0";
  if (homeHead) {
    (Array.from(homeHead.children) as HTMLElement[]).forEach((el) => {
      el.style.opacity = "0";
    });
  }

  if (heroImage && heroImg) {
    Promise.all([
      document.fonts.ready,
      heroImg.decode().catch(() => {}),
    ]).then(() => {
    const vertSrc = `
      attribute vec2 aPosition;
      varying vec2 vTextureCoord;
      void main() {
        vTextureCoord = aPosition * 0.5 + 0.5;
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    const fragSrc = `
      precision mediump float;
      uniform sampler2D uTexture;
      uniform float uBurn;
      uniform float uProgress;
      uniform float uDensity;

      varying vec2 vTextureCoord;

      vec2 hash(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
      }

      float noise(vec2 p) {
        const float K1 = 0.366025404;
        const float K2 = 0.211324865;
        vec2 i = floor(p + (p.x + p.y) * K1);
        vec2 a = p - i + (i.x + i.y) * K2;
        vec2 o = (a.x > a.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec2 b = a - o + K2;
        vec2 c = a - 1.0 + 2.0 * K2;
        vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
        vec3 n = h * h * h * h * vec3(dot(a, hash(i)), dot(b, hash(i + o)), dot(c, hash(i + 1.0)));
        return dot(n, vec3(70.0));
      }

      void main() {
        vec4 texColor = texture2D(uTexture, vTextureCoord);
        float dist = distance(vTextureCoord, vec2(0.5));

        float noiseFactor = noise(vTextureCoord * 10.0 * uDensity) * 0.2;
        float adjustedBurn = uBurn * (1.0 - uProgress + (1.0 - uProgress) * 0.1);
        float burnThreshold = clamp(adjustedBurn + adjustedBurn * 0.1 + noiseFactor, 0.0, 1.0);

        float edgeWidth = 0.1;
        float burnEdge = smoothstep(burnThreshold, burnThreshold + edgeWidth, 1.0 - dist);

        float alpha = texColor.a * burnEdge;
        if (burnEdge < 0.01) alpha = 0.0;

        gl_FragColor = vec4(texColor.rgb * burnEdge, alpha);
      }
    `;

    const W = heroImage.offsetWidth;
    const H = heroImage.offsetHeight;
    const dpr = window.devicePixelRatio || 1;

    const canvas = document.createElement("canvas");
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;";
    heroImage.appendChild(canvas);
    heroImg.style.opacity = "0";

    const gl = canvas.getContext("webgl", { premultipliedAlpha: false, alpha: true });
    if (!gl) {
      // WebGL unavailable — show image immediately and skip shader reveal
      heroImg.style.opacity = "";
      canvas.remove();
      if (homeHead) {
        const children = Array.from(homeHead.children) as HTMLElement[];
        children.forEach((el, i) => {
          const delay = 0.1 + i * 0.05;
          const spring = { type: "spring" as const, stiffness: 450, damping: 48, mass: 3, delay };
          animate(el, { opacity: [0, 1] }, { duration: 0.3, delay });
          animate(el, { x: [70, 0], y: [50, 0], scale: [0.8, 1], rotate: [5, 0] }, spring);
        });
      }
      return;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    function compileShader(src: string, type: number) {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    }

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compileShader(vertSrc, gl.VERTEX_SHADER));
    gl.attachShader(prog, compileShader(fragSrc, gl.FRAGMENT_SHADER));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    // Fullscreen quad
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "aPosition");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    // Uniforms
    const uProgress = gl.getUniformLocation(prog, "uProgress");
    const uBurn = gl.getUniformLocation(prog, "uBurn");
    const uDensity = gl.getUniformLocation(prog, "uDensity");
    gl.uniform1f(uBurn, 0.7);
    gl.uniform1f(uDensity, 0.8);
    gl.uniform1f(uProgress, 0.0);

    // Texture from hero image
    const tex = gl.createTexture();
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, heroImg);

    const duration = 1800;
    const startTime = performance.now() + 100;

    // Cubic bezier easing (0.47, 0, 0.22, 0.98)
    function cubicBezier(t: number): number {
      const p1x = 0.47, p1y = 0, p2x = 0.22, p2y = 0.98;
      let lo = 0, hi = 1;
      for (let i = 0; i < 20; i++) {
        const mid = (lo + hi) / 2;
        const x = 3 * p1x * mid * (1 - mid) ** 2 + 3 * p2x * mid ** 2 * (1 - mid) + mid ** 3;
        if (x < t) lo = mid; else hi = mid;
      }
      const s = (lo + hi) / 2;
      return 3 * p1y * s * (1 - s) ** 2 + 3 * p2y * s ** 2 * (1 - s) + s ** 3;
    }

    function tick(now: number) {
      const elapsed = now - startTime;
      if (elapsed < 0) {
        requestAnimationFrame(tick);
        return;
      }
      const raw = Math.min(elapsed / duration, 1);
      const t = cubicBezier(raw);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uProgress, t);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      if (raw < 1) {
        requestAnimationFrame(tick);
      } else {
        heroImg.style.opacity = "";
        canvas.remove();
      }
    }

    requestAnimationFrame(tick);

    // --- Hero text staggered entry ---
    if (homeHead) {
      const children = Array.from(homeHead.children) as HTMLElement[];
      children.forEach((el, i) => {
        const delay = 0.1 + i * 0.05;
        const spring = { type: "spring" as const, stiffness: 450, damping: 48, mass: 3, delay };
        animate(el, { opacity: [0, 1] }, { duration: 0.3, delay });
        animate(el, { x: [70, 0], y: [50, 0], scale: [0.8, 1], rotate: [5, 0] }, spring);
      });
    }
    }); // end Promise.all .then()
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
  const heroParallax = document.querySelector<HTMLElement>(".hero-image");
  if (heroParallax) {
    scroll(animate(heroParallax, { transform: ["perspective(1200px) rotate(6deg) translateY(0px)", "perspective(1200px) rotate(6deg) translateY(-80px)"] }), {
      target: heroParallax,
      offset: ["start end", "end start"],
    });
  }

  // Scroll-driven animations for work assets
  const workAssets = document.querySelectorAll<HTMLElement>(
    ".work-row video, .work-secondary"
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

  const gallery = document.querySelector<HTMLElement>("[data-photo-gallery]");
  const galleryRail = document.querySelector<HTMLElement>("[data-gallery-rail]");
  const galleryFocusList = document.querySelector<HTMLElement>("[data-gallery-focus-list]");

  if (galleryRail && galleryFocusList) {
    const randomizedPhotos = [...galleryPhotos];
    for (let index = randomizedPhotos.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      const current = randomizedPhotos[index];
      const swap = randomizedPhotos[swapIndex];
      if (!current || !swap) continue;
      randomizedPhotos[index] = swap;
      randomizedPhotos[swapIndex] = current;
    }

    randomizedPhotos.forEach((photo, index) => {
      const thumbnail = document.createElement("button");
      thumbnail.className = `gallery-thumb ${photo.orientation}`;
      thumbnail.dataset.galleryThumb = String(index);
      thumbnail.type = "button";
      thumbnail.setAttribute("aria-label", `View photo ${index + 1}`);

      const thumbnailImage = document.createElement("img");
      thumbnailImage.alt = "";
      thumbnailImage.decoding = "async";
      thumbnailImage.height = photo.orientation === "portrait" ? 240 : 180;
      thumbnailImage.loading = index < 4 ? "eager" : "lazy";
      thumbnailImage.src = `https://images.unsplash.com/photo-${photo.id}?auto=format&fit=crop&w=240&q=70`;
      thumbnailImage.width = photo.orientation === "portrait" ? 180 : 240;
      thumbnail.appendChild(thumbnailImage);
      galleryRail.appendChild(thumbnail);

      const focusItem = document.createElement("figure");
      focusItem.className = "gallery-focus-item";
      focusItem.dataset.caption = photo.caption;
      focusItem.dataset.galleryFocus = String(index);

      const focusImage = document.createElement("img");
      focusImage.alt = photo.alt;
      focusImage.decoding = "async";
      focusImage.loading = index === 0 ? "eager" : "lazy";
      focusImage.src = `https://images.unsplash.com/photo-${photo.id}?auto=format&fit=crop&w=1600&q=86`;
      focusItem.appendChild(focusImage);
      galleryFocusList.appendChild(focusItem);
    });
  }

  const galleryThumbs = Array.from(
    document.querySelectorAll<HTMLButtonElement>("[data-gallery-thumb]"),
  );
  const galleryFocusItems = Array.from(
    document.querySelectorAll<HTMLElement>("[data-gallery-focus]"),
  );

  if (gallery && galleryRail && galleryThumbs.length > 0) {
    const dockPositions = new Map<HTMLButtonElement, number>();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let displayedScroll = window.scrollY;
    let activeIndex = -1;

    const isMobile = () => window.innerWidth <= 768;

    const setActive = (index: number) => {
      if (index === activeIndex) return;
      activeIndex = index;
      galleryThumbs.forEach((thumb, thumbIndex) => {
        thumb.classList.toggle("is-active", thumbIndex === index);
      });
      galleryFocusItems.forEach((item, itemIndex) => {
        item.classList.toggle("is-active", itemIndex === index);
      });
    };

    const sizeGallery = () => {
      galleryRail.style.transform = "none";
      const firstThumb = galleryThumbs[0];
      const lastThumb = galleryThumbs[galleryThumbs.length - 1];
      if (!firstThumb || !lastThumb) return;
      if (isMobile()) {
        galleryRail.style.paddingTop = "0";
        galleryRail.style.paddingBottom = "0";
        galleryRail.style.paddingLeft = `${window.innerWidth / 2 - firstThumb.offsetWidth / 2}px`;
        galleryRail.style.paddingRight = `${window.innerWidth / 2 - lastThumb.offsetWidth / 2}px`;
      } else {
        galleryRail.style.paddingLeft = "0";
        galleryRail.style.paddingRight = "0";
        galleryRail.style.paddingTop = `${window.innerHeight / 2 - firstThumb.offsetHeight / 2}px`;
        galleryRail.style.paddingBottom = `${window.innerHeight / 2 - lastThumb.offsetHeight / 2}px`;
      }
      const scrollDistance = isMobile()
        ? Math.max(0, galleryRail.scrollWidth - window.innerWidth)
        : Math.max(0, galleryRail.scrollHeight - window.innerHeight);
      gallery.style.height = `${window.innerHeight + scrollDistance}px`;
    };

    const scrollToThumb = (thumb: HTMLButtonElement) => {
      const target = isMobile()
        ? thumb.offsetLeft + thumb.offsetWidth / 2 - window.innerWidth / 2
        : thumb.offsetTop + thumb.offsetHeight / 2 - window.innerHeight / 2;
      window.scrollTo({ top: target, behavior: reducedMotion.matches ? "auto" : "smooth" });
    };

    galleryThumbs.forEach((thumb) => {
      thumb.addEventListener("click", () => scrollToThumb(thumb));
    });

    window.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const nextIndex = Math.min(
        galleryThumbs.length - 1,
        Math.max(0, activeIndex + (event.key === "ArrowDown" ? 1 : -1)),
      );
      const nextThumb = galleryThumbs[nextIndex];
      if (nextThumb) {
        event.preventDefault();
        scrollToThumb(nextThumb);
      }
    });

    const renderGallery = () => {
      const targetScroll = window.scrollY;
      displayedScroll = reducedMotion.matches
        ? targetScroll
        : displayedScroll + (targetScroll - displayedScroll) * 0.1;
      galleryRail.style.transform = isMobile()
        ? `translate3d(${-displayedScroll}px, 0, 0)`
        : `translate3d(0, ${-displayedScroll}px, 0)`;

      const viewportCenter = isMobile() ? window.innerWidth / 2 : window.innerHeight / 2;
      const influence = isMobile() ? 220 : 280;
      const maxShift = isMobile() ? 22 : 48;
      let closestIndex = 0;
      let closestDistance = Number.POSITIVE_INFINITY;

      galleryThumbs.forEach((thumb, index) => {
        const rect = thumb.getBoundingClientRect();
        const center = isMobile() ? rect.left + rect.width / 2 : rect.top + rect.height / 2;
        const distance = Math.abs(center - viewportCenter);
        const strength = Math.max(0, 1 - distance / influence);
        const wantedShift = reducedMotion.matches ? 0 : strength * strength * maxShift;
        const currentShift = dockPositions.get(thumb) ?? 0;
        const shift = currentShift + (wantedShift - currentShift) * 0.12;
        dockPositions.set(thumb, shift);
        thumb.style.setProperty("--dock-shift", `${shift}px`);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      setActive(closestIndex);
      requestAnimationFrame(renderGallery);
    };

    sizeGallery();
    const railResizeObserver = new ResizeObserver(sizeGallery);
    railResizeObserver.observe(galleryRail);
    window.addEventListener("resize", sizeGallery);
    requestAnimationFrame(renderGallery);
  }
});
