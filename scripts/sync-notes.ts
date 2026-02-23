import { Glob } from "bun";
import { mkdir, copyFile, rm } from "fs/promises";
import { existsSync } from "fs";
import { join, basename } from "path";

const VAULT_PATH = process.env.VAULT_PATH;
const BLOG_DIR = "Notes/blog";
const ASSETS_DIR = "assets";
const DEST = "notes";
const ATTACHMENTS = join(DEST, "attachments");

function slugify(filename: string): string {
  return filename.replace(/\s+/g, "-").toLowerCase();
}

if (!VAULT_PATH) {
  console.error("VAULT_PATH not set");
  process.exit(1);
}

const blogPath = join(VAULT_PATH, BLOG_DIR);
const assetsPath = join(VAULT_PATH, ASSETS_DIR);

if (!existsSync(blogPath)) {
  console.error(`Blog dir not found: ${blogPath}`);
  process.exit(1);
}

// Clean and recreate dest
if (existsSync(DEST)) await rm(DEST, { recursive: true });
await mkdir(DEST, { recursive: true });
await mkdir(ATTACHMENTS, { recursive: true });

// Copy markdown files
const mdGlob = new Glob("*.md");
const imageRefs = new Set<string>();
let noteCount = 0;

for await (const path of mdGlob.scan(blogPath)) {
  const content = await Bun.file(join(blogPath, path)).text();
  const slug = slugify(path);
  await Bun.write(join(DEST, slug), content);
  noteCount++;

  // Collect image references
  const matches = content.matchAll(/!\[\[([^\]]+)\]\]/g);
  for (const match of matches) {
    imageRefs.add(match[1]);
  }
}

// Copy only referenced images
let imageCount = 0;
for (const ref of imageRefs) {
  const src = join(assetsPath, ref);
  if (existsSync(src)) {
    await copyFile(src, join(ATTACHMENTS, slugify(ref)));
    imageCount++;
  } else {
    console.warn(`Image not found: ${ref}`);
  }
}

console.log(`Synced ${noteCount} notes, ${imageCount} images`);
