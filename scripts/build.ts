import { Glob } from "bun";
import { mkdir, rm, cp } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname, basename, extname } from "path";
const DIST = "dist";

// Simple template engine
function render(template: string, data: Record<string, unknown>): string {
  let result = template;

  // Raw/unescaped {{{ }}}
  result = result.replace(/\{\{\{\s*(\w+)\s*\}\}\}/g, (_, key) => {
    return String(data[key] ?? "");
  });

  // Escaped {{ }}
  result = result.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const val = data[key] ?? "";
    return String(val)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  });

  return result;
}

// Parse frontmatter
function parseFrontmatter(content: string): {
  data: Record<string, string>;
  content: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { data: {}, content };

  const data: Record<string, string> = {};
  match[1].split("\n").forEach((line) => {
    const [key, ...rest] = line.split(":");
    if (key && rest.length) {
      data[key.trim()] = rest
        .join(":")
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  });

  return { data, content: match[2] };
}

// Load templates
async function loadTemplates(): Promise<Record<string, string>> {
  const templates: Record<string, string> = {};
  const glob = new Glob("_*.html");

  for await (const path of glob.scan("pages")) {
    const name = basename(path, ".html").slice(1);
    templates[name] = await Bun.file(`pages/${path}`).text();
  }

  return templates;
}

// Load YAML data
async function loadData(): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {};

  if (existsSync("data")) {
    const glob = new Glob("*.{yaml,yml}");
    for await (const path of glob.scan("data")) {
      const name = basename(path, extname(path));
      data[name] = (await import(`../data/${path}`)).default;
    }
  }

  return data;
}

// Generate HTML
async function generateHTML() {
  console.log("Generating HTML...");

  // Clean and create dist
  if (existsSync(DIST)) await rm(DIST, { recursive: true });
  await mkdir(DIST, { recursive: true });

  const templates = await loadTemplates();
  const globalData = await loadData();
  const baseData = { year: new Date().getFullYear(), ...globalData };

  // Process pages (html and md)
  const pagesGlob = new Glob("**/*.{html,md}");
  for await (const path of pagesGlob.scan("pages")) {
    if (basename(path).startsWith("_")) continue;

    const ext = extname(path);
    const raw = await Bun.file(`pages/${path}`).text();
    const { data, content } = parseFrontmatter(raw);

    const rendered = ext === ".md" ? Bun.markdown.html(content, { autolinks: true }) : content;

    let outPath: string;
    if (data.permalink) {
      outPath = data.permalink.endsWith("/")
        ? `${data.permalink}index.html`
        : data.permalink;
    } else if (ext === ".md") {
      outPath = path.replace(".md", "/index.html");
    } else {
      outPath = path;
    }

    const layoutName = data.layout || "default";
    const html = templates[layoutName]
      ? render(templates[layoutName], {
          content: rendered,
          ...baseData,
          ...data,
        })
      : rendered;

    const fullPath = join(DIST, outPath);
    await mkdir(dirname(fullPath), { recursive: true });
    await Bun.write(fullPath, html);
  }

  // Process notes
  if (existsSync("notes")) {
    const notesGlob = new Glob("*.md");
    for await (const path of notesGlob.scan("notes")) {
      const raw = await Bun.file(`notes/${path}`).text();
      const { data, content } = parseFrontmatter(raw);

      if (data.published !== "true") continue;

      const slug = data.slug || basename(path, ".md");

      // Rewrite Obsidian image embeds to standard markdown
      const transformed = content.replace(
        /!\[\[([^\]]+)\]\]/g,
        (_, ref) => {
          const slugified = ref.replace(/\s+/g, "-").toLowerCase();
          return `![](./attachments/${slugified})`;
        },
      );

      const rendered = Bun.markdown.html(transformed, { autolinks: true });

      const html = render(templates["note"] || templates["default"], {
        content: rendered,
        title: data.title || slug,
        ...baseData,
        ...data,
      });

      const fullPath = join(DIST, `notes/${slug}/index.html`);
      await mkdir(dirname(fullPath), { recursive: true });
      await Bun.write(fullPath, html);
    }

    // Copy attachments to dist
    if (existsSync("notes/attachments")) {
      await cp("notes/attachments", join(DIST, "notes/attachments"), {
        recursive: true,
      });
    }
  }

  // Copy public assets
  if (existsSync("public")) {
    await cp("public", DIST, { recursive: true });
  }

  console.log("HTML generated");
}

// Main
const command = process.argv[2];

if (command === "generate") {
  await generateHTML();
} else if (command === "build") {
  await generateHTML();

  // Use Bun's bundler for final build with minification
  const htmlFiles: string[] = [];
  const glob = new Glob("**/*.html");
  for await (const path of glob.scan(DIST)) {
    htmlFiles.push(join(DIST, path));
  }

  if (htmlFiles.length > 0) {
    const result = await Bun.build({
      entrypoints: htmlFiles,
      outdir: DIST,
      minify: true,
    });

    if (!result.success) {
      console.error("Build failed:", result.logs);
      process.exit(1);
    }
  }

  console.log("Production build complete");
} else {
  await generateHTML();
  console.log("\nRun: bun dist/index.html");
}
