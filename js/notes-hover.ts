export function startNotesHover(root: HTMLElement, signal: AbortSignal) {
  const stage = root.querySelector<HTMLElement>(".notes-stage");
  const list = stage?.querySelector(".notes-list");
  if (!stage || !list) return;

  const pointer = matchMedia("(hover: hover) and (pointer: fine) and (min-width: 781px)");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const preview = document.createElement("div");
  preview.className = "note-hover-preview";
  preview.setAttribute("aria-hidden", "true");
  const mask = document.createElement("div");
  mask.className = "note-hover-mask";
  preview.append(mask);
  list.before(preview);
  const images = new Map<HTMLAnchorElement, HTMLImageElement>();
  list.querySelectorAll<HTMLAnchorElement>("a").forEach(link => {
    const source = link.querySelector<HTMLImageElement>(".note-list-image");
    if (!source) return;
    const image = document.createElement("img");
    image.src = source.currentSrc || source.src;
    image.alt = "";
    mask.append(image);
    images.set(link, image);
  });

  let active: HTMLAnchorElement | undefined;
  let frame = 0;
  let x = 0;
  let y = 0;
  let targetX = 0;
  let targetY = 0;
  const restingTilt = -2;
  let tilt = restingTilt;
  let lastTime = 0;

  const paint = () => {
    const bounds = stage.getBoundingClientRect();
    preview.style.transform = `translate3d(${x - bounds.left}px, ${y - bounds.top}px, 0) rotate(${tilt}deg)`;
  };

  function render(time: number) {
    const blend = 1 - Math.exp(-Math.min(time - lastTime, 64) / 70);
    lastTime = time;
    const drift = targetX - x;
    x += drift * blend;
    y += (targetY - y) * blend;
    tilt += (restingTilt + Math.max(-12, Math.min(12, drift * 0.12)) - tilt) * blend;
    paint();
    frame = requestAnimationFrame(render);
  }

  function position(link: HTMLAnchorElement, clientX: number, clientY: number) {
    const date = link.querySelector(".note-list-date");
    if (!date) return;
    const dateBounds = date.getBoundingClientRect();
    const row = link.getBoundingClientRect();
    const width = preview.offsetWidth;
    const height = preview.offsetHeight;
    const drift = Math.max(-40, Math.min(40, (clientX - (row.left + row.width / 2)) * 0.2));
    const center = dateBounds.left - 24 - width / 2 + drift;
    targetX = Math.max(20, Math.min(innerWidth - width - 20, center - width / 2));
    targetY = Math.max(20, Math.min(innerHeight - height - 20, clientY - height / 2));
  }

  function hide() {
    active = undefined;
    cancelAnimationFrame(frame);
    frame = 0;
    preview.classList.remove("is-visible");
  }

  function show(link: HTMLAnchorElement, clientX: number, clientY: number) {
    const image = images.get(link);
    if (!image || !pointer.matches) {
      hide();
      return;
    }
    const wasVisible = Boolean(active);
    active = link;
    position(link, clientX, clientY);
    if (!wasVisible || reducedMotion.matches) {
      x = targetX;
      y = targetY;
      tilt = restingTilt;
      paint();
    }

    images.forEach(candidate => candidate.classList.toggle("is-active", candidate === image));
    preview.classList.add("is-visible");

    if (!reducedMotion.matches) {
      if (!frame) {
        lastTime = performance.now();
        frame = requestAnimationFrame(render);
      }
    }
  }

  list.querySelectorAll<HTMLAnchorElement>("a").forEach(link => {
    link.addEventListener("pointerenter", event => {
      if (event.pointerType !== "touch") show(link, event.clientX, event.clientY);
    }, { signal });
    link.addEventListener("pointermove", event => {
      if (active !== link) return;
      position(link, event.clientX, event.clientY);
      if (reducedMotion.matches) {
        x = targetX;
        y = targetY;
        paint();
      }
    }, { signal });
    link.addEventListener("focus", () => {
      if (!link.matches(":focus-visible")) return;
      const rect = link.getBoundingClientRect();
      show(link, rect.right - 60, rect.top + rect.height / 2);
    }, { signal });
    link.addEventListener("blur", event => {
      if (!(event.relatedTarget instanceof Node) || !list.contains(event.relatedTarget)) hide();
    }, { signal });
  });

  list.addEventListener("pointerleave", hide, { signal });
  window.addEventListener("scroll", hide, { signal, passive: true });
  window.addEventListener("resize", hide, { signal });
  pointer.addEventListener("change", hide, { signal });
  reducedMotion.addEventListener("change", hide, { signal });
  signal.addEventListener("abort", () => {
    hide();
    preview.remove();
  }, { once: true });
}
