import Swup, { Location } from "swup";
import SwupHeadPlugin from "@swup/head-plugin";
import SwupBodyClassPlugin from "@swup/body-class-plugin";
import SwupA11yPlugin from "@swup/a11y-plugin";
import SwupParallelPlugin from "@swup/parallel-plugin";
import SwupScrollPlugin from "@swup/scroll-plugin";
import { createCoverTransition } from "./cover-transition";

const scrollPlugin = new SwupScrollPlugin({
  animateScroll: { betweenPages: false, samePageWithHash: false, samePage: false },
});

const swup = new Swup({
  animateHistoryBrowsing: true,
  containers: ["#swup"],
  animationSelector: ".transition-page, .transition-page :is(h1, [data-page-reveal], .note-cover), .transition-gallery-rail",
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
  const nav = document.querySelector(".site-nav-links");
  if (nav) {
    const rect = nav.getBoundingClientRect();
    const shape = Array.from(nav.querySelectorAll("a"), link => {
      const button = link.getBoundingClientRect();
      const x = button.left - rect.left;
      const y = button.top - rect.top;
      const right = x + button.width;
      const bottom = y + button.height;
      const radius = Number.parseFloat(getComputedStyle(link).borderTopLeftRadius);
      return `M${x + radius},${y} H${right - radius} Q${right},${y} ${right},${y + radius}
        V${bottom - radius} Q${right},${bottom} ${right - radius},${bottom}
        H${x + radius} Q${x},${bottom} ${x},${bottom - radius}
        V${y + radius} Q${x},${y} ${x + radius},${y} Z`;
    }).join(" ").replace(/\s+/g, " ");
    const style = document.body.style;
    style.setProperty("--nav-blur-left", `${rect.left}px`);
    style.setProperty("--nav-blur-top", `${rect.top}px`);
    style.setProperty("--nav-blur-width", `${rect.width}px`);
    style.setProperty("--nav-blur-height", `${rect.height}px`);
    style.setProperty("--nav-blur-shape", `path("${shape}")`);
  }
}

export function startTransitions(initializePage: () => () => void) {
  let cleanup = initializePage();
  let coverTransition: ReturnType<typeof createCoverTransition>;
  let coverAnimation: Promise<void> | undefined;
  const clearCoverTransition = () => {
    coverTransition?.cleanup();
    coverTransition = undefined;
    coverAnimation = undefined;
  };
  updateNavigation();
  const nav = document.querySelector(".site-nav-links");
  if (nav) new ResizeObserver(positionHighlight).observe(nav);
  window.addEventListener("resize", positionHighlight);

  swup.hooks.on("visit:start", () => { changingPage = true; });
  swup.hooks.before("content:replace", visit => {
    clearCoverTransition();
    if (visit.animation.animate) coverTransition = createCoverTransition(visit.trigger.el);
    cleanup();
  });
  swup.hooks.before("content:insert", (_visit, { containers }) => {
    for (const { previous, next } of containers) {
      coverTransition?.prepare(next);
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
    coverAnimation = coverTransition?.play();
    changingPage = false;
    updateNavigation();
    cleanup = initializePage();
  });

  swup.hooks.replace("animation:in:await", async (visit, args, defaultHandler) => {
    await Promise.all([defaultHandler?.(visit, args), coverAnimation]);
  });
  swup.hooks.on("visit:end", clearCoverTransition);
  swup.hooks.on("visit:abort", clearCoverTransition);
  window.addEventListener("resize", clearCoverTransition);

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
