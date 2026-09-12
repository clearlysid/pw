export function createCoverTransition(trigger: Element | undefined) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const link = trigger?.closest(".notes-list a");
  const source = link?.querySelector<HTMLImageElement>(".note-list-image");
  const preview = document.querySelector<HTMLElement>(".note-hover-preview.is-visible");
  const image = preview?.querySelector<HTMLImageElement>("img.is-active");
  if (!source || !preview || !image || source.src !== image.src || !image.complete || !image.naturalWidth) return;

  const bounds = preview.getBoundingClientRect();
  const width = preview.offsetWidth;
  const height = preview.offsetHeight;
  const matrix = new DOMMatrix(getComputedStyle(preview).transform);
  const rotation = Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
  const startX = bounds.x + bounds.width / 2 - width / 2;
  const startY = bounds.y + bounds.height / 2 - height / 2;
  const from = `translate(${startX}px, ${startY}px) rotate(${rotation}deg) scale(1, 1)`;
  const overlay = document.createElement("img");
  overlay.className = "note-cover-flight";
  overlay.src = image.src;
  overlay.alt = "";
  overlay.setAttribute("aria-hidden", "true");
  Object.assign(overlay.style, { width: `${width}px`, height: `${height}px`, transform: from });
  document.body.append(overlay);

  let target: HTMLImageElement | undefined;
  let animation: Animation | undefined;

  function cleanup() {
    animation?.cancel();
    target?.classList.remove("is-cover-flight-target");
    overlay.remove();
  }

  return {
    prepare(container: Element) {
      const cover = container.querySelector<HTMLImageElement>(".note-cover");
      if (cover?.src !== image.src) return;
      target = cover;
      target.classList.add("is-cover-flight-target");
    },
    async play() {
      if (!target) {
        cleanup();
        return;
      }
      const rect = target.getBoundingClientRect();
      const matrix = new DOMMatrix(getComputedStyle(target).transform);
      const angle = Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
      const dx = rect.x + rect.width / 2 - width / 2 - startX;
      const dy = rect.y + rect.height / 2 - height / 2 - startY;
      const distance = Math.hypot(dx, dy);
      const bend = Math.min(distance * 0.35, 140);
      const arcX = distance ? dy / distance * bend : 0;
      const arcY = distance ? -Math.abs(dx) / distance * bend : 0;
      const scaleX = target.offsetWidth / width;
      const scaleY = target.offsetHeight / height;
      const transforms = Array.from({ length: 41 }, (_, index) => {
        const t = index / 40;
        const u = 1 - t;
        const x = u ** 3 * startX + 3 * u ** 2 * t * (startX + dx / 3 + arcX)
          + 3 * u * t ** 2 * (startX + dx * 2 / 3 + arcX) + t ** 3 * (startX + dx);
        const y = u ** 3 * startY + 3 * u ** 2 * t * (startY + dy / 3 + arcY)
          + 3 * u * t ** 2 * (startY + dy * 2 / 3 + arcY) + t ** 3 * (startY + dy);
        return `translate(${x}px, ${y}px) rotate(${rotation + (angle - rotation) * t}deg) scale(${1 + (scaleX - 1) * t}, ${1 + (scaleY - 1) * t})`;
      });
      animation = overlay.animate({
        transform: transforms,
        boxShadow: ["0 0 0 rgba(0, 0, 0, 0)", getComputedStyle(target).boxShadow],
      }, { duration: 680, easing: "cubic-bezier(.22, 1, .36, 1)", fill: "forwards" });
      await animation.finished.catch(() => {});
      cleanup();
    },
    cleanup,
  };
}
