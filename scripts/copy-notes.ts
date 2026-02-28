import { Glob } from "bun";
import { join } from "path";
import { existsSync } from "fs";
import { mkdir, copyFile, rm } from "fs/promises";

// Copies .md files and assets from corresponding dirs into `/notes`
// I point it to my Obsidian Vault but they could come from anywhere

const BLOG_DIR = process.env.BLOG_DIR;
const ASSETS_DIR = process.env.ASSETS_DIR || BLOG_DIR;

if (!BLOG_DIR || !ASSETS_DIR) {
  console.error("Missing BLOG/ASSETS dir vars. See .env.example");
  process.exit(1);
}

const localNotesFolder = "notes";
const localAttachmentsFolder = join(localNotesFolder, "attachments");

const slugify = (s: string) => s.replace(/\s+/g, "-").toLowerCase();

if (!existsSync(BLOG_DIR)) {
  console.error(`Blog folder not found: ${BLOG_DIR}`);
  process.exit(1);
}

// Clean and recreate local folders
if (existsSync(localNotesFolder))
  await rm(localNotesFolder, { recursive: true });
await mkdir(localNotesFolder, { recursive: true });
await mkdir(localAttachmentsFolder, { recursive: true });

// Copy markdown files
const mdGlob = new Glob("*.md");
const assetRefs = new Set<string>();
let noteCount = 0;

for await (const path of mdGlob.scan(BLOG_DIR)) {
  const content = await Bun.file(join(BLOG_DIR, path)).text();
  const slug = slugify(path);
  await Bun.write(join(localNotesFolder, slug), content);
  noteCount++;

  // Collect asset references
  const matches = content.matchAll(/!\[\[([^\]]+)\]\]/g);
  for (const match of matches) {
    assetRefs.add(match[1]);
  }
}

// Copy only referenced assets
let assetCount = 0;
for (const ref of assetRefs) {
  const src = join(ASSETS_DIR, ref);
  if (existsSync(src)) {
    await copyFile(src, join(localAttachmentsFolder, slugify(ref)));
    assetCount++;
  } else {
    console.warn(`Asset not found: ${ref}`);
  }
}

console.log(`Copied ${noteCount} notes, ${assetCount} assets`);
