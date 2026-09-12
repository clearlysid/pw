import { galleryPhotos } from "./gallery-data";
import { replacePhotoUrl, startTransitions } from "./transitions";

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

function startWorkMedia(root: HTMLElement, signal: AbortSignal) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  root.querySelectorAll<HTMLVideoElement>("[data-work-video]").forEach((video) => {
    const button = video.closest("figure")?.querySelector<HTMLButtonElement>("[data-work-toggle]");
    if (!button) return;

    let visible = false;
    let manuallyPaused = false;
    video.controls = false;
    button.hidden = false;

    const updateLabel = () => {
      const action = video.paused ? "Play" : "Pause";
      button.textContent = `${action} video`;
      button.setAttribute("aria-label", `${action}: ${video.getAttribute("aria-label")}`);
    };
    const play = () => {
      video.play().catch(updateLabel);
    };
    const syncPlayback = () => {
      if (visible && !manuallyPaused && !reducedMotion.matches && !document.hidden) {
        play();
      } else {
        video.pause();
      }
    };

    button.addEventListener("click", () => {
      if (video.paused) {
        manuallyPaused = false;
        play();
      } else {
        manuallyPaused = true;
        video.pause();
      }
    }, { signal });
    video.addEventListener("play", updateLabel, { signal });
    video.addEventListener("pause", updateLabel, { signal });
    reducedMotion.addEventListener("change", syncPlayback, { signal });
    document.addEventListener("visibilitychange", syncPlayback, { signal });
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.25;
      syncPlayback();
    }, { threshold: 0.25 });
    observer.observe(video);
    signal.addEventListener("abort", () => {
      observer.disconnect();
      video.pause();
    }, { once: true });
    updateLabel();
  });
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
    focusItem.dataset.caption = photo.caption;
    focusItem.dataset.galleryFocus = String(index);
    focusItem.setAttribute("aria-hidden", "true");

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
      focusItems.forEach((item, itemIndex) => {
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
  startWorkMedia(root, controller.signal);
  startGallery(root, controller.signal);
  return () => {
    controller.abort();
    stopScroll?.();
  };
}

startTransitions(initializePage);
