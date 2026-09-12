import { galleryPhotos } from "./gallery-data";

type LenisInstance = {
  readonly scroll: number;
  raf: (time: number) => void;
  resize: () => void;
  scrollTo: (
    target: number,
    options?: { immediate?: boolean },
  ) => void;
};

type LenisOptions = {
  autoRaf?: boolean;
  infinite?: boolean;
  syncTouch?: boolean;
};

declare const Lenis: new (options?: LenisOptions) => LenisInstance;

function startSmoothScroll() {
  if (typeof Lenis === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const lenis = new Lenis();
  const frame = (time: number) => {
    lenis.raf(time);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function startWorkGallery() {
  const gallery = document.querySelector<HTMLElement>("[data-work-gallery]");
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
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  reducedMotion.addEventListener("change", schedule);
  new ResizeObserver(() => { sizeLoop(); schedule(); }).observe(gallery);

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
  window.addEventListener("pointerup", endDrag);
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
    reducedMotion.addEventListener("change", syncPlayback);
    document.addEventListener("visibilitychange", syncPlayback);
    new IntersectionObserver(([entry]) => {
      visible = !!entry && entry.isIntersecting && entry.intersectionRatio >= 0.25;
      syncPlayback();
    }, { threshold: [0, 0.25] }).observe(video);
  });
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
  window.history.replaceState(window.history.state, "", url);
}

function createGalleryItems(
  rail: HTMLElement,
  focusList: HTMLElement,
  startIndex: number,
) {
  galleryPhotos.forEach((photo, index) => {
    const focusItem = document.createElement("figure");
    focusItem.className = "gallery-focus-item";
    focusItem.dataset.caption = photo.caption;
    focusItem.dataset.galleryFocus = String(index);

    const focusImage = document.createElement("img");
    focusImage.alt = photo.alt;
    focusImage.decoding = "async";
    focusImage.loading = index === startIndex ? "eager" : "lazy";
    focusImage.src = `https://images.unsplash.com/photo-${photo.id}?auto=format&fit=crop&w=1600&q=86`;
    focusItem.appendChild(focusImage);
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

function startGallery() {
  const gallery = document.querySelector<HTMLElement>("[data-photo-gallery]");
  const rail = document.querySelector<HTMLElement>("[data-gallery-rail]");
  const focusList = document.querySelector<HTMLElement>(
    "[data-gallery-focus-list]",
  );
  if (!gallery || !rail || !focusList) return;
  if (typeof Lenis === "undefined") return;

  const startIndex =
    photoIndexFromUrl() ?? Math.floor(Math.random() * galleryPhotos.length);
  createGalleryItems(rail, focusList, startIndex);

  const thumbnails = Array.from(
    document.querySelectorAll<HTMLButtonElement>("[data-gallery-thumb]"),
  );
  const focusItems = Array.from(
    document.querySelectorAll<HTMLElement>("[data-gallery-focus]"),
  );
  if (thumbnails.length === 0) return;

  const lenis = new Lenis({
    autoRaf: true,
    infinite: true,
    syncTouch: false,
  });
  const dockPositions = new Map<HTMLButtonElement, number>();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let activeIndex = -1;
  let cycleDistance = 0;
  let hasSized = false;

  const isMobile = () => window.innerWidth <= 768;

  const thumbnailCenter = (thumbnail: HTMLButtonElement) => {
    const rect = thumbnail.getBoundingClientRect();
    return isMobile()
      ? rect.left + rect.width / 2
      : rect.top + rect.height / 2;
  };

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
    focusItems.forEach((item, itemIndex) => {
      item.classList.toggle("is-active", itemIndex === index);
    });
    syncPhotoUrl(index);
  };

  const sizeGallery = () => {
    const previousCycleDistance = cycleDistance;
    const previousProgress = hasSized
      ? lenis.scroll / previousCycleDistance
      : null;
    const firstThumbnail = thumbnails[0];
    const repeatedThumbnail = thumbnails[galleryPhotos.length];
    if (!firstThumbnail || !repeatedThumbnail) return;

    cycleDistance = isMobile()
      ? repeatedThumbnail.offsetLeft - firstThumbnail.offsetLeft
      : repeatedThumbnail.offsetTop - firstThumbnail.offsetTop;
    if (cycleDistance <= 0) return;

    gallery.style.height = `${window.innerHeight + cycleDistance}px`;
    lenis.resize();

    const startThumbnail = thumbnails[startIndex];
    if (!startThumbnail) return;
    const nextScroll =
      previousProgress === null
        ? wrapToCycle(scrollTarget(startThumbnail))
        : previousProgress * cycleDistance;
    lenis.scrollTo(nextScroll, { immediate: true });
    hasSized = true;
  };

  const scrollToThumbnail = (thumbnail: HTMLButtonElement) => {
    const viewportCenter = isMobile()
      ? window.innerWidth / 2
      : window.innerHeight / 2;
    const target = lenis.scroll + thumbnailCenter(thumbnail) - viewportCenter;
    lenis.scrollTo(target, { immediate: reducedMotion.matches });
  };

  thumbnails.forEach((thumbnail) => {
    thumbnail.addEventListener("click", () => scrollToThumbnail(thumbnail));
  });

  window.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const currentIndex = activeIndex >= 0 ? activeIndex : startIndex;
    const direction = event.key === "ArrowDown" ? 1 : -1;
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
  });

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
      const shift = currentShift + (wantedShift - currentShift) * 0.12;
      dockPositions.set(thumbnail, shift);
      thumbnail.style.setProperty("--dock-shift", `${shift}px`);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = Number(thumbnail.dataset.galleryThumb);
      }
    });

    setActive(closestIndex);
    requestAnimationFrame(render);
  };

  sizeGallery();
  const railResizeObserver = new ResizeObserver(sizeGallery);
  railResizeObserver.observe(rail);
  window.addEventListener("resize", sizeGallery);
  requestAnimationFrame(render);
}

document.addEventListener("DOMContentLoaded", () => {
  if (!document.querySelector("[data-photo-gallery]")) startSmoothScroll();
  startWorkGallery();
  startGallery();
});
