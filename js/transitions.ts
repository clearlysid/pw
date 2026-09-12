import Swup, { Location } from "swup";
import SwupHeadPlugin from "@swup/head-plugin";
import SwupBodyClassPlugin from "@swup/body-class-plugin";
import SwupA11yPlugin from "@swup/a11y-plugin";
import SwupParallelPlugin from "@swup/parallel-plugin";
import SwupScrollPlugin from "@swup/scroll-plugin";

const scrollPlugin = new SwupScrollPlugin({
  animateScroll: { betweenPages: false, samePageWithHash: false, samePage: false },
});

const swup = new Swup({
  animateHistoryBrowsing: true,
  containers: ["#swup"],
  animationSelector: ".transition-page, .transition-gallery-rail",
  plugins: [
    new SwupHeadPlugin({ awaitAssets: true, persistAssets: true }),
    new SwupBodyClassPlugin(),
    new SwupA11yPlugin({ headingSelector: "#swup:not(.is-previous-container) h1" }),
    scrollPlugin,
    new SwupParallelPlugin(),
  ],
});

let changingPage = false;

export function replacePhotoUrl(url: URL) {
  if (changingPage || location.pathname !== "/photos/") return;
  const destination = Location.fromUrl(url.href);
  window.history.replaceState({ ...window.history.state, url: destination.url }, "", url);
  swup.location = destination;
}

function updateNavigation() {
  const path = location.pathname;
  const section = path.startsWith("/notes/") ? "/notes/" : path;
  document.querySelectorAll<HTMLAnchorElement>(".site-nav-links a").forEach((link) => {
    const active = new URL(link.href).pathname === section;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  positionHighlight();
}

function positionHighlight() {
  const active = document.querySelector<HTMLElement>(".site-nav-links [aria-current]");
  const highlight = document.querySelector<HTMLElement>(".site-nav-highlight");
  if (!active || !highlight) return;
  highlight.style.width = `${active.offsetWidth}px`;
  highlight.style.height = `${active.offsetHeight}px`;
  highlight.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
  highlight.classList.add("is-positioned");
}

export function startTransitions(initializePage: () => () => void) {
  let cleanup = initializePage();
  updateNavigation();
  const nav = document.querySelector(".site-nav-links");
  if (nav) new ResizeObserver(positionHighlight).observe(nav);

  swup.hooks.on("visit:start", () => { changingPage = true; });
  swup.hooks.before("content:replace", () => cleanup());
  swup.hooks.before("content:insert", (_visit, { containers }) => {
    for (const { previous } of containers) {
      const rect = previous.getBoundingClientRect();
      previous.style.setProperty("--previous-top", `${rect.top}px`);
      previous.style.setProperty("--previous-height", `${rect.height}px`);
      previous.inert = true;
    }
  });
  swup.hooks.replace("content:scroll", (visit, args, defaultHandler) => {
    if (document.querySelector("#swup")?.querySelector("[data-photo-gallery]")) return true;
    if (visit.history.popstate && !visit.animation.animate) {
      const position = scrollPlugin.getCachedScrollPositions(visit.to.url)?.window;
      window.scrollTo({ top: position?.top ?? 0, left: position?.left ?? 0, behavior: "instant" });
      return true;
    }
    return defaultHandler?.(visit, args) ?? true;
  });
  swup.hooks.on("page:view", () => {
    changingPage = false;
    updateNavigation();
    cleanup = initializePage();
  });

  // Selecting the current section keeps gallery selection and scroll intact.
  swup.hooks.replace("link:click", (visit, args, defaultHandler) => {
    const { el, event } = args;
    if (!changingPage && el.closest(".site-nav") &&
        new URL(el.href).pathname === location.pathname && !new URL(el.href).hash) {
      event.preventDefault();
      return;
    }
    return defaultHandler?.(visit, args);
  });
}
