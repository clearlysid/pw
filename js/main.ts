import { galleryPhotos, type GalleryPhoto } from "./gallery-data";

type LenisInstance = {
  raf: (time: number) => void;
};

declare const Lenis: new () => LenisInstance;

function startSmoothScroll() {
  if (typeof Lenis === "undefined") return;
  const lenis = new Lenis();
  const frame = (time: number) => {
    lenis.raf(time);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function shufflePhotos(photos: readonly GalleryPhoto[]) {
  const shuffled = [...photos];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

function createGalleryItems(
  rail: HTMLElement,
  focusList: HTMLElement,
) {
  shufflePhotos(galleryPhotos).forEach((photo, index) => {
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
    rail.appendChild(thumbnail);

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
    focusList.appendChild(focusItem);
  });
}

function startGallery() {
  const gallery = document.querySelector<HTMLElement>("[data-photo-gallery]");
  const rail = document.querySelector<HTMLElement>("[data-gallery-rail]");
  const focusList = document.querySelector<HTMLElement>(
    "[data-gallery-focus-list]",
  );
  if (!gallery || !rail || !focusList) return;

  createGalleryItems(rail, focusList);

  const thumbnails = Array.from(
    document.querySelectorAll<HTMLButtonElement>("[data-gallery-thumb]"),
  );
  const focusItems = Array.from(
    document.querySelectorAll<HTMLElement>("[data-gallery-focus]"),
  );
  if (thumbnails.length === 0) return;

  const dockPositions = new Map<HTMLButtonElement, number>();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let displayedScroll = window.scrollY;
  let activeIndex = -1;

  const isMobile = () => window.innerWidth <= 768;

  const setActive = (index: number) => {
    if (index === activeIndex) return;
    activeIndex = index;
    thumbnails.forEach((thumbnail, thumbnailIndex) => {
      thumbnail.classList.toggle("is-active", thumbnailIndex === index);
    });
    focusItems.forEach((item, itemIndex) => {
      item.classList.toggle("is-active", itemIndex === index);
    });
  };

  const sizeGallery = () => {
    rail.style.transform = "none";
    const firstThumbnail = thumbnails[0];
    const lastThumbnail = thumbnails[thumbnails.length - 1];
    if (!firstThumbnail || !lastThumbnail) return;

    if (isMobile()) {
      rail.style.paddingTop = "0";
      rail.style.paddingBottom = "0";
      rail.style.paddingLeft = `${window.innerWidth / 2 - firstThumbnail.offsetWidth / 2}px`;
      rail.style.paddingRight = `${window.innerWidth / 2 - lastThumbnail.offsetWidth / 2}px`;
    } else {
      rail.style.paddingLeft = "0";
      rail.style.paddingRight = "0";
      rail.style.paddingTop = `${window.innerHeight / 2 - firstThumbnail.offsetHeight / 2}px`;
      rail.style.paddingBottom = `${window.innerHeight / 2 - lastThumbnail.offsetHeight / 2}px`;
    }

    const scrollDistance = isMobile()
      ? Math.max(0, rail.scrollWidth - window.innerWidth)
      : Math.max(0, rail.scrollHeight - window.innerHeight);
    gallery.style.height = `${window.innerHeight + scrollDistance}px`;
  };

  const scrollToThumbnail = (thumbnail: HTMLButtonElement) => {
    const target = isMobile()
      ? thumbnail.offsetLeft + thumbnail.offsetWidth / 2 - window.innerWidth / 2
      : thumbnail.offsetTop + thumbnail.offsetHeight / 2 - window.innerHeight / 2;
    window.scrollTo({
      behavior: reducedMotion.matches ? "auto" : "smooth",
      top: target,
    });
  };

  thumbnails.forEach((thumbnail) => {
    thumbnail.addEventListener("click", () => scrollToThumbnail(thumbnail));
  });

  window.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const nextIndex = Math.min(
      thumbnails.length - 1,
      Math.max(0, activeIndex + (event.key === "ArrowDown" ? 1 : -1)),
    );
    const nextThumbnail = thumbnails[nextIndex];
    if (!nextThumbnail) return;
    event.preventDefault();
    scrollToThumbnail(nextThumbnail);
  });

  const render = () => {
    const targetScroll = window.scrollY;
    displayedScroll = reducedMotion.matches
      ? targetScroll
      : displayedScroll + (targetScroll - displayedScroll) * 0.1;
    rail.style.transform = isMobile()
      ? `translate3d(${-displayedScroll}px, 0, 0)`
      : `translate3d(0, ${-displayedScroll}px, 0)`;

    const viewportCenter = isMobile()
      ? window.innerWidth / 2
      : window.innerHeight / 2;
    const influence = isMobile() ? 220 : 280;
    const maxShift = isMobile() ? 22 : 48;
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    thumbnails.forEach((thumbnail, index) => {
      const rect = thumbnail.getBoundingClientRect();
      const center = isMobile()
        ? rect.left + rect.width / 2
        : rect.top + rect.height / 2;
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
        closestIndex = index;
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
  startSmoothScroll();
  startGallery();
});
