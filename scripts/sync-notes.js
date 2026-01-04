import { Dropbox } from "dropbox";
import { mkdir, rm, writeFile, readdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { unzipSync } from "bun";

const DROPBOX_TOKEN = process.env.DROPBOX_TOKEN;
const BLOG_DIR = "/Notes/blog";
const DEST = "src/notes";

if (!DROPBOX_TOKEN) {
  console.warn("No DROPBOX_TOKEN found in environment");
  process.exit(1);
}

const dbx = new Dropbox({ accessToken: DROPBOX_TOKEN });

async function syncNotes() {
  console.log("Syncing notes from Dropbox...");

  try {
    // Download zip from Dropbox
    const response = await dbx.filesDownloadZip({ path: BLOG_DIR });
    const buffer = response.result.fileBinary;

    // Extract zip using Bun's built-in unzip
    const files = unzipSync(buffer);

    // Ensure destination exists
    if (!existsSync(DEST)) {
      await mkdir(DEST, { recursive: true });
    }

    // Write each file
    let count = 0;
    for (const [path, content] of Object.entries(files)) {
      // Skip directories and hidden files
      if (path.endsWith("/") || path.startsWith(".") || path.includes("/."))
        continue;

      // Get filename and slugify
      const filename = path.split("/").pop();
      if (!filename.endsWith(".md")) continue;

      const slug = filename.replace(/\s+/g, "-").toLowerCase();
      await writeFile(join(DEST, slug), content);
      count++;
    }

    console.log(`Synced ${count} notes`);
  } catch (err) {
    console.error("Failed to sync notes:", err.message);
    process.exit(1);
  }
}

syncNotes();
