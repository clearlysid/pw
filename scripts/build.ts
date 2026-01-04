import { Glob } from "bun";
import { mkdir, rm, cp } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname, basename, extname } from "path";
import markdownIt from "markdown-it";

const DIST = "dist";
const isDev = process.env.NODE_ENV !== "production";

const md = markdownIt({ html: true, linkify: true, typographer: true });

// Types
interface Frontmatter {
  layout?: string;
  title?: string;
  description?: string;
  date?: string;
  slug?: string;
  permalink?: string;
  [key: string]: string | undefined;
}

interface ParsedContent {
  data: Frontmatter;
  content: string;
}

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
function parseFrontmatter(content: string): ParsedContent {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { data: {}, content };

  const frontmatter: Frontmatter = {};
  match[1].split("\n").forEach((line) => {
    const [key, ...rest] = line.split(":");
    if (key && rest.length) {
      frontmatter[key.trim()] = rest.join(":").trim().replace(/^["']|["']$/g, "");
    }
  });

  return { data: frontmatter, content: match[2] };
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

// Process pages and notes into dist (HTML only, no CSS/JS bundling)
async function generateHTML() {
  console.log("Generating HTML...");

  // Clean and create dist
  if (existsSync(DIST)) await rm(DIST, { recursive: true });
  await mkdir(DIST, { recursive: true });

  const templates = await loadTemplates();
  const globalData = await loadData();
  const baseData = { year: new Date().getFullYear(), ...globalData };

  // Process pages
  const pagesGlob = new Glob("**/*.{html,md}");
  for await (const path of pagesGlob.scan("pages")) {
    if (basename(path).startsWith("_")) continue;

    const filePath = `pages/${path}`;
    const ext = extname(path);
    const raw = await Bun.file(filePath).text();
    const { data, content } = parseFrontmatter(raw);

    const rendered = ext === ".md" ? md.render(content) : content;

    // Output path
    let outPath: string;
    if (data.permalink) {
      outPath = data.permalink.endsWith("/") ? `${data.permalink}index.html` : data.permalink;
    } else if (ext === ".md") {
      outPath = path.replace(".md", "/index.html");
    } else {
      outPath = path;
    }

    // Apply layout
    const layoutName = data.layout || "default";
    const html = templates[layoutName]
      ? render(templates[layoutName], { content: rendered, ...baseData, ...data })
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

      const slug = data.slug || basename(path, ".md");
      const rendered = md.render(content);

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
  // Just generate HTML (for use with bun's dev server)
  await generateHTML();
} else if (command === "build") {
  // Full production build
  await generateHTML();

  // Use Bun's bundler for final build with minification
  const htmlFiles = [];
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
  // Dev mode - generate then let bun serve handle the rest
  await generateHTML();
  console.log("\nRun: bun --hot dist/index.html");
}
