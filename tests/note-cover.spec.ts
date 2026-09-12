import { test, expect } from "@playwright/test";

test("article cover scrolls slightly slower and respects reduced motion", async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/notes/taste-needs-reps/");
    const cover = page.locator(".note-cover");
    const title = page.locator(".note-title");
    for (const reducedMotion of ["no-preference", "reduce"] as const) {
      await page.emulateMedia({ reducedMotion });
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await expect.poll(() => cover.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).f)).toBe(0);
      const beforeCover = await cover.boundingBox();
      const beforeTitle = await title.boundingBox();
      if (!beforeCover || !beforeTitle) throw new Error("Missing cover or title");
      await page.evaluate(() => window.scrollTo({ top: 200, behavior: "instant" }));
      const expectedTravel = reducedMotion === "reduce" ? 200 : 170;
      await expect.poll(async () => {
        const after = await cover.boundingBox();
        return after ? Math.abs(beforeCover.y - after.y - expectedTravel) : Infinity;
      }).toBeLessThan(1);
      const afterTitle = await title.boundingBox();
      if (!afterTitle) throw new Error("Missing article title");
      expect(beforeTitle.y - afterTitle.y).toBeCloseTo(200, 0);
    }
  }
});

test("article cover bleeds through the top but stays inside the right edge", async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/notes/taste-needs-reps/");
    const cover = await page.locator(".note-cover").boundingBox();
    if (!cover) throw new Error("Missing article cover");
    expect(cover.y).toBeLessThan(0);
    expect(cover.x + cover.width).toBeLessThanOrEqual(width);
    const header = await page.locator(".site-header").boundingBox();
    const title = await page.locator(".note-title").boundingBox();
    if (!header || !title) throw new Error("Missing header or article title");
    expect(Math.abs(cover.x + cover.width - header.x - header.width)).toBeLessThan(2);
    expect(title.x + title.width <= cover.x || title.y >= cover.y + cover.height).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  }
});
