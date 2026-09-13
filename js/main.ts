import { galleryPhotos } from "./gallery-data";
import { replacePhotoUrl, startTransitions } from "./transitions";
import { startNotesHover } from "./notes-hover";

type LenisInstance = {
  readonly scroll: number;
  readonly options: Required<Pick<LenisOptions, "lerp">>;
  raf: (time: number) => void;
  resize: () => void;
  destroy: () => void;
  scrollTo: (
    target: number,
    options?: { immediate?: boolean },
  ) => void;
};

type LenisOptions = {
  autoRaf?: boolean;
  infinite?: boolean;
  syncTouch?: boolean;
  lerp?: number;
};

declare const Lenis: new (options?: LenisOptions) => LenisInstance;

function startSmoothScroll() {
  if (typeof Lenis === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const lenis = new Lenis();
  let frameId = 0;
  const frame = (time: number) => {
    lenis.raf(time);
    frameId = requestAnimationFrame(frame);
  };
  frameId = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(frameId);
    lenis.destroy();
  };
}

function startNoteCoverParallax(root: HTMLElement, signal: AbortSignal) {
  const cover = root.querySelector<HTMLElement>(".note-cover");
  if (!cover) return;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0;
  const render = () => {
    frame = 0;
    cover.style.setProperty("--cover-scroll-y", `${reducedMotion.matches ? 0 : Math.max(0, window.scrollY) * 0.15}px`);
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(render); };
  window.addEventListener("scroll", schedule, { passive: true, signal });
  reducedMotion.addEventListener("change", schedule, { signal });
  signal.addEventListener("abort", () => cancelAnimationFrame(frame), { once: true });
  render();
}

function startHomeParallax(root: HTMLElement, signal: AbortSignal) {
  const layers = Array.from(root.querySelectorAll<HTMLElement>(".work-gallery, .home-portrait"),
    element => ({ element, offset: 0, portrait: element.matches(".home-portrait") }));
  if (!layers.length) return;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0;
  const render = () => {
    frame = 0;
    const offsets = layers.map(({ element, offset, portrait }) => {
      const top = element.getBoundingClientRect().top - offset;
      if (reducedMotion.matches) return 0;
      return portrait
        ? Math.max(-60, Math.min(60, (innerHeight - top) * 0.2 - 60))
        : Math.max(-40, Math.min(40, (innerHeight / 2 - top) * 0.2));
    });
    layers.forEach((layer, index) => {
      layer.offset = offsets[index] ?? 0;
      layer.element.style.setProperty("--home-scroll-y", `${layer.offset}px`);
    });
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(render); };
  window.addEventListener("scroll", schedule, { passive: true, signal });
  window.addEventListener("resize", schedule, { signal });
  reducedMotion.addEventListener("change", schedule, { signal });
  signal.addEventListener("abort", () => cancelAnimationFrame(frame), { once: true });
  render();
}

function startWorkGallery(root: HTMLElement, signal: AbortSignal) {
  const gallery = root.querySelector<HTMLElement>("[data-work-gallery]");
  if (!gallery) return;
  const track = gallery.querySelector<HTMLElement>(".work-track");
  if (!track) return;
  const originals = Array.from(track.querySelectorAll<HTMLElement>(".work-project"));
  const first = originals[0];
  if (!first) return;
  for (const side of ["before", "after"]) {
    const copies = document.createDocumentFragment();
    originals.forEach((project) => {
      const copy = project.cloneNode(true);
      if (!(copy instanceof HTMLElement)) return;
      copy.setAttribute("aria-hidden", "true");
      copy.removeAttribute("aria-labelledby");
      copy.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
      copy.querySelectorAll<HTMLElement>("a, button, [tabindex]").forEach((element) => element.tabIndex = -1);
      copies.append(copy);
    });
    if (side === "before") track.prepend(copies);
    else track.append(copies);
  }
  const firstCopy = track.querySelector<HTMLElement>(".work-project");
  if (!firstCopy) return;
  let cycle = 0;
  let drag: { id: number; x: number; scroll: number; moved: boolean } | null = null;
  const wrapScroll = () => {
    if (!cycle) return;
    const current = gallery.scrollLeft;
    const wrapped = cycle + ((current - cycle) % cycle + cycle) % cycle;
    const shift = wrapped - current;
    if (Math.abs(shift) < 1) return;
    gallery.scrollLeft = wrapped;
    if (drag) drag.scroll += shift;
  };
  const sizeLoop = () => {
    const progress = cycle ? (gallery.scrollLeft - cycle) / cycle : 0;
    cycle = first.offsetLeft - firstCopy.offsetLeft;
    gallery.scrollLeft = cycle * (1 + progress);
    wrapScroll();
  };
  sizeLoop();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const layers = Array.from(gallery.querySelectorAll<HTMLElement>("[data-work-depth]"));
  let frame = 0;

  const render = () => {
    frame = 0;
    const bounds = gallery.getBoundingClientRect();
    const vertical = (window.innerHeight / 2 - bounds.top - bounds.height / 2) * 0.25;
    const positions = layers.map((layer) => {
      const project = layer.parentElement;
      const center = (project?.offsetLeft ?? 0) + (project?.offsetWidth ?? 0) / 2;
      const distance = gallery.scrollLeft + gallery.clientWidth / 2 - center;
      const depth = Number(layer.dataset.workDepth);
      return {
        x: reducedMotion.matches ? 0 : Math.max(-28, Math.min(28, distance * depth)),
        y: reducedMotion.matches ? 0 : Math.max(-16, Math.min(16, vertical * depth)),
      };
    });
    layers.forEach((layer, index) => {
      const position = positions[index];
      if (!position) return;
      layer.style.setProperty("--work-x", `${position.x}px`);
      layer.style.setProperty("--work-y", `${position.y}px`);
    });
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(render); };
  gallery.addEventListener("scroll", () => { wrapScroll(); schedule(); }, { passive: true });
  window.addEventListener("scroll", schedule, { passive: true, signal });
  window.addEventListener("resize", schedule, { signal });
  reducedMotion.addEventListener("change", schedule, { signal });
  const resizeObserver = new ResizeObserver(() => { sizeLoop(); schedule(); });
  resizeObserver.observe(gallery);

  let suppressClick = false;
  gallery.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    suppressClick = false;
    drag = { id: event.pointerId, x: event.clientX, scroll: gallery.scrollLeft, moved: false };
  });
  gallery.addEventListener("pointermove", (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const delta = event.clientX - drag.x;
    if (!drag.moved && Math.abs(delta) < 6) return;
    drag.moved = true;
    gallery.setPointerCapture(event.pointerId);
    gallery.classList.add("is-dragging");
    gallery.scrollLeft = drag.scroll - delta;
    wrapScroll();
  });
  const endDrag = () => {
    if (!drag) return;
    suppressClick = drag.moved;
    const pointerId = drag.id;
    drag = null;
    if (gallery.hasPointerCapture(pointerId)) gallery.releasePointerCapture(pointerId);
    gallery.classList.remove("is-dragging");
  };
  window.addEventListener("pointerup", endDrag, { signal });
  gallery.addEventListener("pointercancel", endDrag);
  gallery.addEventListener("lostpointercapture", endDrag);
  gallery.addEventListener("dragstart", (event) => event.preventDefault());
  gallery.addEventListener("click", (event) => {
    if (suppressClick) { event.preventDefault(); suppressClick = false; }
  }, true);
  gallery.addEventListener("keydown", (event) => {
    if (event.target !== gallery) return;
    const step = gallery.querySelector<HTMLElement>(".work-project")?.offsetWidth ?? 320;
    let target: number;
    switch (event.key) {
      case "ArrowRight": target = gallery.scrollLeft + step; break;
      case "ArrowLeft": target = gallery.scrollLeft - step; break;
      case "Home": target = cycle; break;
      case "End": target = cycle + (originals.at(-1)?.offsetLeft ?? first.offsetLeft) - first.offsetLeft; break;
      default: return;
    }
    event.preventDefault();
    gallery.scrollTo({ left: target, behavior: "instant" });
    wrapScroll();
  });

  gallery.querySelectorAll<HTMLVideoElement>("[data-work-video]").forEach((video) => {
    let visible = false;
    const syncPlayback = () => {
      if (visible && !reducedMotion.matches && !document.hidden) {
        void video.play().catch(() => { /* Keep the poster when autoplay is unavailable. */ });
      } else {
        video.pause();
      }
    };
    reducedMotion.addEventListener("change", syncPlayback, { signal });
    document.addEventListener("visibilitychange", syncPlayback, { signal });
    const observer = new IntersectionObserver(([entry]) => {
      visible = !!entry && entry.isIntersecting && entry.intersectionRatio >= 0.25;
      syncPlayback();
    }, { threshold: [0, 0.25] });
    observer.observe(video);
    signal.addEventListener("abort", () => {
      observer.disconnect();
      video.pause();
    }, { once: true });
  });
  signal.addEventListener("abort", () => {
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    endDrag();
  }, { once: true });
  schedule();
}

const RAIL_COPIES = 2;
const PHOTO_QUERY_PARAM = "photo";

function photoIndexFromUrl() {
  const photoId = new URL(window.location.href).searchParams.get(
    PHOTO_QUERY_PARAM,
  );
  if (photoId === null) return null;

  const photoIndex = galleryPhotos.findIndex((photo) => photo.id === photoId);
  return photoIndex >= 0 ? photoIndex : null;
}

function syncPhotoUrl(index: number) {
  const photo = galleryPhotos[index];
  if (!photo) return;

  const url = new URL(window.location.href);
  if (url.searchParams.get(PHOTO_QUERY_PARAM) === photo.id) return;

  url.searchParams.set(PHOTO_QUERY_PARAM, photo.id);
  replacePhotoUrl(url);
}

function createGalleryItems(
  rail: HTMLElement,
  focusList: HTMLElement,
  startIndex: number,
) {
  galleryPhotos.forEach((photo, index) => {
    const focusItem = document.createElement("figure");
    focusItem.className = "gallery-focus-item";
    focusItem.dataset.galleryFocus = String(index);
    focusItem.setAttribute("aria-hidden", "true");

    const focusImage = document.createElement("img");
    focusImage.alt = photo.alt;
    focusImage.decoding = "async";
    focusImage.loading = index === startIndex ? "eager" : "lazy";
    focusImage.src = `https://images.unsplash.com/photo-${photo.id}?auto=format&fit=crop&w=1600&q=86`;
    const caption = document.createElement("figcaption");
    const number = document.createElement("span");
    number.className = "gallery-photo-number";
    number.textContent = `#${String(index + 1).padStart(3, "0")}`;
    caption.append(number, ` ${photo.caption}`);
    focusItem.append(caption, focusImage);
    focusList.appendChild(focusItem);
  });

  for (let copyIndex = 0; copyIndex < RAIL_COPIES; copyIndex += 1) {
    galleryPhotos.forEach((photo, index) => {
      const thumbnail = document.createElement("button");
      thumbnail.className = `gallery-thumb ${photo.orientation}`;
      thumbnail.dataset.galleryThumb = String(index);
      thumbnail.type = "button";
      thumbnail.setAttribute("aria-label", `View photo ${index + 1}`);
      if (copyIndex !== 0) {
        thumbnail.tabIndex = -1;
        thumbnail.setAttribute("aria-hidden", "true");
      }

      const thumbnailImage = document.createElement("img");
      thumbnailImage.alt = "";
      thumbnailImage.decoding = "async";
      thumbnailImage.height = photo.orientation === "portrait" ? 240 : 180;
      thumbnailImage.loading = "eager";
      thumbnailImage.src = `https://images.unsplash.com/photo-${photo.id}?auto=format&fit=crop&w=240&q=70`;
      thumbnailImage.width = photo.orientation === "portrait" ? 180 : 240;
      thumbnail.appendChild(thumbnailImage);
      rail.appendChild(thumbnail);
    });
  }
}

function startGallery(root: HTMLElement, signal: AbortSignal) {
  const gallery = root.querySelector<HTMLElement>("[data-photo-gallery]");
  const rail = root.querySelector<HTMLElement>("[data-gallery-rail]");
  const focusList = root.querySelector<HTMLElement>(
    "[data-gallery-focus-list]",
  );
  const status = root.querySelector<HTMLElement>("[data-gallery-status]");
  if (!gallery || !rail || !focusList) return;
  if (typeof Lenis === "undefined") return;

  const startIndex =
    photoIndexFromUrl() ?? Math.floor(Math.random() * galleryPhotos.length);
  createGalleryItems(rail, focusList, startIndex);

  const thumbnails = Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-gallery-thumb]"),
  );
  const focusItems = Array.from(
    root.querySelectorAll<HTMLElement>("[data-gallery-focus]"),
  );
  if (thumbnails.length === 0) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const lenis = new Lenis({
    autoRaf: true,
    infinite: true,
    syncTouch: false,
    lerp: reducedMotion.matches ? 1 : 0.1,
  });
  reducedMotion.addEventListener("change", () => {
    lenis.options.lerp = reducedMotion.matches ? 1 : 0.1;
    if (reducedMotion.matches) lenis.scrollTo(lenis.scroll, { immediate: true });
  }, { signal });
  const dockPositions = new Map<HTMLButtonElement, number>();
  let activeIndex = -1;
  let displayedIndex = -1;
  const decodedImages = new Map<number, Promise<void>>();
  let cycleDistance = 0;

  const isMobile = () => window.innerWidth <= 768;

  const thumbnailCenter = (thumbnail: HTMLButtonElement) =>
    (isMobile()
      ? thumbnail.offsetLeft + thumbnail.offsetWidth / 2
      : thumbnail.offsetTop + thumbnail.offsetHeight / 2) - lenis.scroll;

  const scrollTarget = (thumbnail: HTMLButtonElement) =>
    isMobile()
      ? thumbnail.offsetLeft + thumbnail.offsetWidth / 2 - window.innerWidth / 2
      : thumbnail.offsetTop + thumbnail.offsetHeight / 2 - window.innerHeight / 2;

  const wrapToCycle = (position: number) =>
    cycleDistance > 0
      ? ((position % cycleDistance) + cycleDistance) % cycleDistance
      : position;

  const setActive = (index: number) => {
    if (index === activeIndex) return;
    activeIndex = index;
    thumbnails.forEach((thumbnail) => {
      thumbnail.classList.toggle(
        "is-active",
        thumbnail.dataset.galleryThumb === String(index),
      );
    });
    syncPhotoUrl(index);
    const image = focusItems[index]?.querySelector("img");
    if (!image) return;
    image.loading = "eager";
    if (status) {
      status.hidden = displayedIndex >= 0;
      status.textContent = "Loading photograph…";
    }
    let decoded = decodedImages.get(index);
    if (!decoded) {
      decoded = image.decode();
      decodedImages.set(index, decoded);
    }
    void decoded.then(() => {
      if (signal.aborted || activeIndex !== index) return;
      image.parentElement?.classList.toggle("is-tall", image.naturalWidth <= image.naturalHeight);
      focusItems.forEach((item, itemIndex) => {
        item.classList.toggle("is-entering", itemIndex === index && displayedIndex < 0);
        item.classList.toggle("is-active", itemIndex === index);
        item.setAttribute("aria-hidden", String(itemIndex !== index));
      });
      displayedIndex = index;
      if (status) status.hidden = true;
    }, () => {
      decodedImages.delete(index);
      if (signal.aborted || activeIndex !== index || !status) return;
      status.textContent = "Couldn’t load this photo. Choose another thumbnail.";
      status.hidden = false;
    });
  };

  const sizeGallery = () => {
    const firstThumbnail = thumbnails[0];
    const repeatedThumbnail = thumbnails[galleryPhotos.length];
    if (!firstThumbnail || !repeatedThumbnail) return;

    cycleDistance = isMobile()
      ? repeatedThumbnail.offsetLeft - firstThumbnail.offsetLeft
      : repeatedThumbnail.offsetTop - firstThumbnail.offsetTop;
    if (cycleDistance <= 0) return;

    gallery.style.height = `${window.innerHeight + cycleDistance}px`;
    lenis.resize();

    const selectedThumbnail = thumbnails[activeIndex >= 0 ? activeIndex : startIndex];
    if (!selectedThumbnail) return;
    lenis.scrollTo(wrapToCycle(scrollTarget(selectedThumbnail)), { immediate: true });
  };

  const scrollToThumbnail = (thumbnail: HTMLButtonElement) => {
    const viewportCenter = isMobile()
      ? window.innerWidth / 2
      : window.innerHeight / 2;
    const target = lenis.scroll + thumbnailCenter(thumbnail) - viewportCenter;
    lenis.scrollTo(target, { immediate: reducedMotion.matches });
  };

  thumbnails.forEach((thumbnail) => {
    thumbnail.addEventListener("click", () => scrollToThumbnail(thumbnail), { signal });
  });

  window.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
        (event.target instanceof HTMLElement &&
          (event.target.isContentEditable || event.target.matches("input, textarea, select")))) return;
    const nextKey = isMobile() ? "ArrowRight" : "ArrowDown";
    const previousKey = isMobile() ? "ArrowLeft" : "ArrowUp";
    if (event.key !== nextKey && event.key !== previousKey) return;
    const currentIndex = activeIndex >= 0 ? activeIndex : startIndex;
    const direction = event.key === nextKey ? 1 : -1;
    const nextIndex =
      (currentIndex + direction + focusItems.length) % focusItems.length;
    const viewportCenter = isMobile()
      ? window.innerWidth / 2
      : window.innerHeight / 2;
    const nextThumbnail = thumbnails
      .filter(
        (thumbnail) => thumbnail.dataset.galleryThumb === String(nextIndex),
      )
      .sort(
        (left, right) =>
          Math.abs(thumbnailCenter(left) - viewportCenter) -
          Math.abs(thumbnailCenter(right) - viewportCenter),
      )[0];
    if (!nextThumbnail) return;
    event.preventDefault();
    scrollToThumbnail(nextThumbnail);
  }, { signal });

  let frameId = 0;
  const render = () => {
    const currentScroll = lenis.scroll;
    rail.style.transform = isMobile()
      ? `translate3d(${-currentScroll}px, 0, 0)`
      : `translate3d(0, ${-currentScroll}px, 0)`;

    const viewportCenter = isMobile()
      ? window.innerWidth / 2
      : window.innerHeight / 2;
    const influence = isMobile() ? 220 : 280;
    const maxShift = isMobile() ? 22 : 48;
    let closestIndex = startIndex;
    let closestDistance = Number.POSITIVE_INFINITY;

    thumbnails.forEach((thumbnail) => {
      const center = thumbnailCenter(thumbnail);
      const distance = Math.abs(center - viewportCenter);
      const strength = Math.max(0, 1 - distance / influence);
      const wantedShift = reducedMotion.matches
        ? 0
        : strength * strength * maxShift;
      const currentShift = dockPositions.get(thumbnail) ?? 0;
      const shift = reducedMotion.matches ? 0 : currentShift + (wantedShift - currentShift) * 0.12;
      dockPositions.set(thumbnail, shift);
      thumbnail.style.setProperty("--dock-shift", `${shift}px`);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = Number(thumbnail.dataset.galleryThumb);
      }
    });

    setActive(closestIndex);
    frameId = requestAnimationFrame(render);
  };

  sizeGallery();
  const railResizeObserver = new ResizeObserver(sizeGallery);
  railResizeObserver.observe(rail);
  window.addEventListener("resize", sizeGallery, { signal });
  frameId = requestAnimationFrame(render);
  signal.addEventListener("abort", () => {
    cancelAnimationFrame(frameId);
    railResizeObserver.disconnect();
    lenis.destroy();
  }, { once: true });
}

function initializePage() {
  const root = document.querySelector<HTMLElement>("#swup");
  if (!root) throw new Error("Missing page container");
  const controller = new AbortController();
  const stopScroll = root.querySelector("[data-photo-gallery]") ? undefined : startSmoothScroll();
  startWorkGallery(root, controller.signal);
  startHomeParallax(root, controller.signal);
  startGallery(root, controller.signal);
  startNotesHover(root, controller.signal);
  startNoteCoverParallax(root, controller.signal);
  return () => {
    controller.abort();
    stopScroll?.();
  };
}

startTransitions(initializePage);
