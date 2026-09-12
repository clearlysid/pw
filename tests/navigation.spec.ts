import { test, expect, type Page } from "@playwright/test";

async function settled(page: Page, path: string) {
  await expect(page).toHaveURL(new RegExp(path));
  await expect(page.locator(".site-nav-links [aria-current]"))
    .toHaveAttribute("href", path.startsWith("/notes/") ? "/notes/" : path.split("?")[0]);
  await expect(page.locator("html")).not.toHaveClass(/is-changing/);
  await expect(page.locator("#swup")).toHaveCount(1);
}

async function navigate(page: Page, name: string, path: string) {
  await page.getByRole("link", { name, exact: true }).click();
  await settled(page, path);
}

test("notes previews follow the pointer and clean up after navigation", async ({ page }) => {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    await page.emulateMedia({ reducedMotion });
    await page.goto("/notes/");
    const link = page.locator(".notes-list a").filter({ has: page.locator(".note-list-image") }).first();
    const preview = page.locator(".note-hover-preview");
    await link.hover({ position: { x: 80, y: 20 } });
    await expect(preview).toHaveCSS("opacity", "1");
    await expect.poll(() => preview.locator("img.is-active").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    const before = await preview.boundingBox();
    if (!before) throw new Error("Missing note preview");
    await link.hover({ position: { x: 240, y: 20 } });
    await expect.poll(async () => {
      const rect = await preview.boundingBox();
      return rect ? rect.x - before.x : 0;
    }).toBeGreaterThan(5);
    const date = await link.locator(".note-list-date").boundingBox();
    if (!date) throw new Error("Missing note date");
    await expect.poll(async () => {
      const rect = await preview.boundingBox();
      return rect ? Math.abs(rect.x + rect.width / 2 - (date.x - 134)) : Infinity;
    }).toBeLessThan(45);
    await expect(link).toHaveCSS("background-color", "rgba(23, 23, 18, 0.07)");
    const firstImage = await preview.locator("img.is-active").elementHandle();
    const imageCount = await preview.locator("img").count();
    await page.locator(".notes-list a").filter({ has: page.locator(".note-list-image") }).nth(1).hover();
    await expect(preview).toHaveCSS("opacity", "1");
    await expect(preview.locator("img.is-active")).toHaveCount(1);
    expect(await firstImage?.evaluate(image => image.isConnected)).toBe(true);
    await expect(preview.locator("img")).toHaveCount(imageCount);
    await page.mouse.move(0, 0);
    await expect(preview).toHaveCSS("opacity", "0");
    await link.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(preview).toHaveCSS("opacity", "1");
    await navigate(page, "~ SID", "/");
    await expect(preview).toHaveCount(0);
    await navigate(page, "NOTES", "/notes/");
    await expect(preview).toHaveCount(1);
  }
});

test("hovered note image moves into the article cover", async ({ page }) => {
  await page.goto("/notes/");
  const link = page.locator(".notes-list a").filter({ has: page.locator(".note-list-image") }).first();
  await link.hover();
  const preview = page.locator(".note-hover-preview img.is-active");
  await expect.poll(() => preview.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  const src = await preview.getAttribute("src");
  await link.click();
  const flight = page.locator(".note-cover-flight");
  await expect(flight).toBeVisible();
  await expect(flight).toHaveAttribute("src", src ?? "");
  await expect(page.locator(".note-cover")).toHaveCSS("visibility", "hidden");
  await expect(flight).toHaveCount(0);
  await expect(page.locator(".note-cover")).toBeVisible();
  await expect(page.locator("html")).not.toHaveClass(/is-changing/);
  await expect(page.locator("#swup")).toHaveCount(1);
});

test("navbar stays mounted and accepts presses across animation completion", async ({ page }) => {
  await page.goto("/");
  const header = await page.locator(".site-header").elementHandle();
  await page.getByRole("link", { name: "NOTES", exact: true }).click();
  await expect(page.locator(".notes-page")).toBeVisible();
  const photoLink = page.getByRole("link", { name: "PHOTOS", exact: true });
  const rect = await photoLink.boundingBox();
  if (!rect) throw new Error("Missing Photos link");
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await expect(page.locator("html")).not.toHaveClass(/is-changing/);
  await page.mouse.up();
  await settled(page, "/photos/");
  expect(await header?.evaluate(el => el === document.querySelector(".site-header"))).toBe(true);
  await navigate(page, "NOTES", "/notes/");
  const highlight = await page.locator(".site-nav-highlight").boundingBox();
  const active = await page.locator(".site-nav-links [aria-current]").boundingBox();
  expect(Math.abs((highlight?.x ?? 0) - (active?.x ?? 100))).toBeLessThan(2);
});

test("latest click wins while a page request is pending", async ({ page }) => {
  await page.goto("/");
  await page.route("**/notes/", async route => {
    await new Promise(resolve => setTimeout(resolve, 500));
    await route.continue();
  });
  await page.getByRole("link", { name: "NOTES", exact: true }).click();
  await page.getByRole("link", { name: "PHOTOS", exact: true }).click();
  await settled(page, "/photos/");
  await expect(page.locator("[data-photo-gallery]")).toHaveCount(1);
  await page.waitForTimeout(600);
  await settled(page, "/photos/");
});

test("history restores scroll with normal and reduced motion", async ({ page }) => {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    await page.emulateMedia({ reducedMotion });
    await page.goto("/");
    await page.evaluate(() => window.scrollTo({ top: 650, behavior: "instant" }));
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(650);
    await navigate(page, "NOTES", "/notes/");
    await page.goBack();
    await settled(page, "/");
    await expect.poll(() => page.evaluate(() => Math.abs(scrollY - 650))).toBeLessThan(3);
    await page.goForward();
    await settled(page, "/notes/");
  }
});

for (const { width, reducedMotion } of [
  { width: 1440, reducedMotion: "no-preference" },
  { width: 390, reducedMotion: "no-preference" },
  { width: 1440, reducedMotion: "reduce" },
] as const) {
  test(`gallery URLs, self-links, and reinitialization survive repeated visits (${width}px, ${reducedMotion})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion });
    const failures: string[] = [];
    page.on("pageerror", error => failures.push(error.message));
    const initialPhoto = "1470770841072-f978cf4d019e";
    await page.goto(`/photos/?photo=${initialPhoto}`);
    await expect(page.locator(".gallery-thumb.is-active")).toHaveCount(2);
    await expect(page).toHaveURL(new RegExp(initialPhoto));
    for (let visit = 0; visit < 3; visit++) {
      const count = await page.locator("[data-gallery-thumb]").count();
      const before = page.url();
      await page.keyboard.press(width === 390 ? "ArrowRight" : "ArrowDown");
      await expect.poll(() => page.url()).not.toBe(before);
      await page.waitForTimeout(800);
      const selected = page.url();
      await navigate(page, "NOTES", "/notes/");
      await page.goBack();
      await settled(page, "/photos/");
      await expect(page).toHaveURL(selected);
      await expect(page.locator("[data-gallery-thumb]")).toHaveCount(count);
      await page.getByRole("link", { name: "PHOTOS", exact: true }).click();
      await expect(page).toHaveURL(selected);
      await expect(page.locator("html")).not.toHaveClass(/is-changing/);
    }
    await page.reload();
    await expect(page.locator(".gallery-thumb.is-active")).toHaveCount(2);
    expect(failures).toEqual([]);
  });
}

test("article navigation updates metadata and preserves the navbar", async ({ page }) => {
  await page.goto("/notes/");
  const note = page.locator(".notes-list a").first();
  test.skip(await note.count() === 0, "Local note sources are optional");
  const title = await note.locator(".note-list-title").textContent();
  const header = await page.locator(".site-header").elementHandle();
  await note.click();
  await expect(page.locator(".note-title")).toHaveText(title ?? "");
  await expect(page).toHaveTitle(new RegExp(title ?? ""));
  await expect(page.locator("html")).not.toHaveClass(/is-changing/);
  expect(await header?.evaluate(el => el === document.querySelector(".site-header"))).toBe(true);
  await navigate(page, "PHOTOS", "/photos/");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", "Photographs by Siddharth.");
  await expect(page.locator("body")).toHaveClass("photos-body");
});

test("touch, keyboard, modified clicks, and native fallback", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${baseURL}/`);
  await page.getByRole("link", { name: "NOTES", exact: true }).tap();
  await settled(page, "/notes/");
  await page.getByRole("link", { name: "PHOTOS", exact: true }).focus();
  await page.keyboard.press("Enter");
  await settled(page, "/photos/");
  for (const click of [{ modifiers: ["Control" as const] }, { button: "middle" as const }]) {
    const popup = context.waitForEvent("page");
    await page.getByRole("link", { name: "NOTES", exact: true }).click(click);
    const opened = await popup;
    await expect(opened).toHaveURL(/\/notes\/$/);
    await opened.close();
  }
  await context.close();
  const nativeContext = await browser.newContext({ javaScriptEnabled: false });
  const nativePage = await nativeContext.newPage();
  await nativePage.goto(`${baseURL}/`);
  await nativePage.getByRole("link", { name: "NOTES", exact: true }).click();
  await expect(nativePage).toHaveURL(/\/notes\/$/);
  await expect(nativePage.locator(".notes-page")).toBeVisible();
  await nativeContext.close();
});

test("work carousel initializes and cleans up across page visits", async ({ page }) => {
  await page.goto("/");
  const gallery = page.locator("[data-work-gallery]");
  await expect.poll(() => gallery.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  const projects = await gallery.locator(".work-project").count();
  for (let visit = 0; visit < 3; visit++) {
    const oldGallery = await gallery.elementHandle();
    await gallery.focus();
    const before = await gallery.evaluate(el => el.scrollLeft);
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => gallery.evaluate(el => el.scrollLeft)).not.toBe(before);
    await navigate(page, "NOTES", "/notes/");
    expect(await oldGallery?.evaluate(el =>
      Array.from(el.querySelectorAll("video")).every(video => video.paused),
    )).toBe(true);
    await navigate(page, "~ SID", "/");
    await expect(gallery.locator(".work-project")).toHaveCount(projects);
    await expect.poll(() => gallery.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  }
});
