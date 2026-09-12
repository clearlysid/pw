import { existsSync, watch } from "fs";
import { extname, join, resolve, sep } from "path";
import { generateHTML } from "./build";

const DIST_ROOT = resolve("dist");
const RELOAD_PATH = "/__dev_reload";
const WATCH_ROOTS = ["pages", "notes", "styles", "js", "public"];
const port = Number.parseInt(Bun.env.PORT ?? "4174", 10);

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const reloadClient = `<script>
(() => {
  const connect = () => {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(protocol + "//" + location.host + "${RELOAD_PATH}");
    socket.addEventListener("message", () => location.reload());
    socket.addEventListener("close", () => setTimeout(connect, 500));
  };
  connect();
})();
</script>`;

function resolveRequestPath(pathname: string) {
  const decoded = decodeURIComponent(pathname);
  let filePath = resolve(DIST_ROOT, `.${decoded}`);
  const insideDist =
    filePath === DIST_ROOT || filePath.startsWith(`${DIST_ROOT}${sep}`);
  if (!insideDist) return null;

  if (decoded.endsWith("/")) {
    filePath = join(filePath, "index.html");
  } else if (!extname(filePath) && existsSync(join(filePath, "index.html"))) {
    filePath = join(filePath, "index.html");
  }
  return filePath;
}

await generateHTML();
let buildInProgress: Promise<void> | undefined;

const server = Bun.serve({
  hostname: "0.0.0.0",
  port,
  async fetch(request, server) {
    const url = new URL(request.url);
    if (url.pathname === RELOAD_PATH) {
      if (server.upgrade(request)) return;
      return new Response("WebSocket upgrade required", { status: 426 });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", {
        headers: { Allow: "GET, HEAD" },
        status: 405,
      });
    }

    while (buildInProgress) {
      await buildInProgress;
    }

    let filePath: string | null;
    try {
      filePath = resolveRequestPath(url.pathname);
    } catch {
      return new Response("Bad request", { status: 400 });
    }
    if (!filePath) return new Response("Forbidden", { status: 403 });

    const file = Bun.file(filePath);
    if (!(await file.exists())) return new Response("Not found", { status: 404 });

    const isHTML = extname(filePath) === ".html";
    const headers = new Headers({ "Content-Type": file.type });
    if (isHTML) {
      headers.set("Cache-Control", "no-store");
    } else {
      const etag = `"${file.size}-${file.lastModified}"`;
      headers.set("Cache-Control", "no-cache");
      headers.set("ETag", etag);
      if (request.headers.get("If-None-Match") === etag) {
        return new Response(null, { headers, status: 304 });
      }
    }
    if (request.method === "HEAD") return new Response(null, { headers });

    if (isHTML) {
      const html = (await file.text()).replace("</body>", `${reloadClient}</body>`);
      return new Response(html, { headers });
    }
    return new Response(file, { headers });
  },
  websocket: {
    open(socket) {
      socket.subscribe("reload");
    },
    message() {},
    close(socket) {
      socket.unsubscribe("reload");
    },
  },
});

let rebuildTimer: ReturnType<typeof setTimeout> | undefined;
let rebuilding = false;
let pending = false;

async function rebuild() {
  if (rebuilding) {
    pending = true;
    return;
  }

  rebuilding = true;
  buildInProgress = generateHTML();
  try {
    await buildInProgress;
    server.publish("reload", "reload");
  } catch (error) {
    console.error("Build failed", error);
  } finally {
    buildInProgress = undefined;
    rebuilding = false;
    if (pending) {
      pending = false;
      void rebuild();
    }
  }
}

function scheduleRebuild() {
  if (rebuildTimer) clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => void rebuild(), 100);
}

const watchers = WATCH_ROOTS.filter(existsSync).map((root) =>
  watch(root, { recursive: true }, scheduleRebuild),
);

function shutdown() {
  watchers.forEach((watcher) => watcher.close());
  server.stop();
  process.exit(0);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

console.log(`Watching ${WATCH_ROOTS.join(", ")}`);
console.log(`Serving http://0.0.0.0:${server.port}`);
