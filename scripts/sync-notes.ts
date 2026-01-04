import { Dropbox } from "dropbox";
import { mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import AdmZip from "adm-zip";

const DROPBOX_TOKEN = process.env.DROPBOX_TOKEN;
const BLOG_DIR = "/Notes/blog";
const DEST = "notes";

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
    const result = response.result as unknown as { fileBinary: Buffer };
    const buffer = Buffer.from(result.fileBinary);

    // Extract zip
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();

    // Ensure destination exists
    if (!existsSync(DEST)) {
      await mkdir(DEST, { recursive: true });
    }

    // Write each file
    let count = 0;
    for (const entry of entries) {
      // Skip directories and hidden files
      if (
        entry.isDirectory ||
        entry.entryName.startsWith(".") ||
        entry.entryName.includes("/.")
      )
        continue;

      // Get filename and slugify
      const filename = entry.entryName.split("/").pop();
      if (!filename || !filename.endsWith(".md")) continue;

      const content = entry.getData();
      const slug = filename.replace(/\s+/g, "-").toLowerCase();
      await writeFile(join(DEST, slug), content);
      count++;
    }

    console.log(`Synced ${count} notes`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Failed to sync notes:", message);
    process.exit(1);
  }
}

syncNotes();
