import { Glob } from "bun";
import { mkdir, rm, cp } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname, basename, extname } from "path";
import markdownIt from "markdown-it";

// Config
const DIST = "dist";
const isDev = process.env.NODE_ENV !== "production";

// Markdown setup
const md = markdownIt({ html: true, linkify: true, typographer: true });

// Simple template engine - replaces {{ variable }} and {{{ raw }}}
function render(template, data) {
  let result = template;

  // Raw/unescaped {{{ }}}
  result = result.replace(/\{\{\{\s*(\w+)\s*\}\}\}/g, (_, key) => {
    return data[key] ?? "";
  });

  // Escaped {{ }}
  result = result.replace(/\{\{\s*(\w+)\s*\}\}\}/g, (_, key) => {
    const val = data[key] ?? "";
    return String(val)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  });

  return result;
}

// Parse frontmatter from markdown
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { data: {}, content };

  const frontmatter = {};
  match[1].split("\n").forEach((line) => {
    const [key, ...rest] = line.split(":");
    if (key && rest.length) {
      frontmatter[key.trim()] = rest
        .join(":")
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  });

  return { data: frontmatter, content: match[2] };
}

// Load templates (files prefixed with _)
async function loadTemplates() {
  const templates = {};
  const glob = new Glob("_*.html");

  for await (const path of glob.scan("pages")) {
    const name = basename(path, ".html").slice(1); // remove _ prefix
    templates[name] = await Bun.file(`pages/${path}`).text();
  }

  return templates;
}

// Load data files (supports .json, .yaml, .yml)
async function loadData() {
  const data = {};

  if (existsSync("data")) {
    const glob = new Glob("*.{json,yaml,yml}");
    for await (const path of glob.scan("data")) {
      const name = basename(path, extname(path));
      const file = `data/${path}`;

      if (path.endsWith(".yaml") || path.endsWith(".yml")) {
        data[name] = (await import(`./../${file}`)).default;
      } else {
        data[name] = await Bun.file(file).json();
      }
    }
  }

  return data;
}

// Process a single page
async function processPage(filePath, templates, globalData) {
  const ext = extname(filePath);
  const raw = await Bun.file(filePath).text();

  let content, data;

  if (ext === ".md") {
    const parsed = parseFrontmatter(raw);
    data = parsed.data;
    content = md.render(parsed.content);
  } else {
    const parsed = parseFrontmatter(raw);
    data = parsed.data;
    content = parsed.content;
  }

  // Determine output path
  const relativePath = filePath.replace("pages/", "");
  let outPath;

  if (data.permalink) {
    outPath = data.permalink.endsWith("/")
      ? `${data.permalink}index.html`
      : data.permalink;
  } else if (ext === ".md") {
    outPath = relativePath.replace(".md", "/index.html");
  } else {
    outPath = relativePath;
  }

  // Apply layout
  const layoutName = data.layout || "default";
  let html = content;

  if (templates[layoutName]) {
    html = render(templates[layoutName], {
      content,
      title: data.title || "",
      description: data.description || "",
      date: data.date || "",
      year: new Date().getFullYear(),
      ...globalData,
      ...data,
    });
  }

  return { outPath, html };
}

// Build notes from markdown files
async function buildNotes(templates, globalData) {
  const notes = [];

  if (!existsSync("notes")) return notes;

  const glob = new Glob("*.md");
  for await (const path of glob.scan("notes")) {
    const filePath = `notes/${path}`;
    const raw = await Bun.file(filePath).text();
    const { data, content } = parseFrontmatter(raw);

    const slug = data.slug || basename(path, ".md");
    const html = md.render(content);

    // Use note template
    const noteHtml = render(templates["note"] || templates["default"], {
      content: html,
      title: data.title || slug,
      description: data.description || "",
      date: data.date || "",
      year: new Date().getFullYear(),
      ...globalData,
      ...data,
    });

    notes.push({
      slug,
      title: data.title || slug,
      date: data.date,
      outPath: `notes/${slug}/index.html`,
      html: noteHtml,
    });
  }

  return notes;
}

// Main build
async function build() {
  console.log("Building...");
  const start = performance.now();

  // Clean dist
  if (existsSync(DIST)) await rm(DIST, { recursive: true });
  await mkdir(DIST, { recursive: true });

  // Load templates and data
  const templates = await loadTemplates();
  const globalData = await loadData();

  // Process pages (skip _ prefixed templates)
  const pagesGlob = new Glob("**/*.{html,md}");
  for await (const path of pagesGlob.scan("pages")) {
    if (basename(path).startsWith("_")) continue;

    const { outPath, html } = await processPage(
      `pages/${path}`,
      templates,
      globalData,
    );
    const fullPath = join(DIST, outPath);
    await mkdir(dirname(fullPath), { recursive: true });
    await Bun.write(fullPath, html);
  }

  // Build notes
  const notes = await buildNotes(templates, globalData);
  for (const note of notes) {
    const fullPath = join(DIST, note.outPath);
    await mkdir(dirname(fullPath), { recursive: true });
    await Bun.write(fullPath, note.html);
  }

  // Copy public assets
  if (existsSync("public")) {
    await cp("public", DIST, { recursive: true });
  }

  // Bundle CSS
  const cssGlob = new Glob("**/*.css");
  let css = "";
  for await (const path of cssGlob.scan("styles")) {
    css += (await Bun.file(`styles/${path}`).text()) + "\n";
  }
  if (css) {
    await mkdir(`${DIST}/assets`, { recursive: true });
    await Bun.write(`${DIST}/assets/main.css`, css);
  }

  // Bundle JS
  if (existsSync("js/main.js")) {
    const result = await Bun.build({
      entrypoints: ["js/main.js"],
      outdir: `${DIST}/assets`,
      minify: !isDev,
      sourcemap: isDev ? "external" : "none",
    });
    if (!result.success) {
      console.error("JS build failed:", result.logs);
    }
  }

  const elapsed = (performance.now() - start).toFixed(0);
  console.log(`Built in ${elapsed}ms`);
}

// Dev server
async function serve() {
  await build();

  const server = Bun.serve({
    port: 3000,
    async fetch(req) {
      const url = new URL(req.url);
      let path = url.pathname;

      // Default to index.html
      if (path.endsWith("/")) path += "index.html";
      if (!extname(path)) path += "/index.html";

      const filePath = join(DIST, path);

      if (existsSync(filePath)) {
        return new Response(Bun.file(filePath));
      }

      return new Response("Not Found", { status: 404 });
    },
  });

  console.log(`Dev server: http://localhost:${server.port}`);

  // Watch for changes
  const watchDirs = ["pages", "notes", "styles", "js", "public", "data"];
  const watchers = watchDirs.filter(existsSync).map((dir) =>
    require("fs").watch(dir, { recursive: true }, async (event, filename) => {
      console.log(`Change: ${dir}/${filename}`);
      await build();
    }),
  );

  process.on("SIGINT", () => {
    watchers.forEach((w) => w.close());
    server.stop();
    process.exit(0);
  });
}

// CLI
const command = process.argv[2];
if (command === "serve" || command === "dev") {
  serve();
} else {
  build();
}
