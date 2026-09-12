import { expect, test } from "bun:test";
import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("Notes remains a valid route without local note sources", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "pw-notes-build-"));
  try {
    await mkdir(join(fixture, "pages"));
    await copyFile(
      new URL("../pages/_notes.html", import.meta.url),
      join(fixture, "pages/_notes.html"),
    );
    const build = Bun.spawn([process.execPath, import.meta.dir + "/build.ts"], {
      cwd: fixture,
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(await build.exited).toBe(0);
    const listing = Bun.file(join(fixture, "dist/notes/index.html"));
    expect(await listing.exists()).toBe(true);
    expect(await listing.text()).toContain("No notes yet.");
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
