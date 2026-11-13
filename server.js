const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.SELFCHAT_PORT) || 47832;
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filename = path.resolve(root, relative);
  const outsideRoot = path.relative(root, filename).startsWith("..");
  if (outsideRoot || !fs.existsSync(filename) || fs.statSync(filename).isDirectory()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  response.writeHead(200, { "Content-Type": types[path.extname(filename)] || "application/octet-stream", "Cache-Control": "no-cache" });
  fs.createReadStream(filename).pipe(response);
});

server.on("error", error => {
  if (error.code === "EADDRINUSE") process.exit(0);
  throw error;
});

server.listen(port, "127.0.0.1", () => console.log(`SelfChat is running at http://127.0.0.1:${port}`));
