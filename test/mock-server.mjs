// A stand-in for the Static Pages upload API, which the CI workflow runs the
// action against. It accepts what the real endpoint accepts, a multipart POST
// to <path>/api/upload with a bearer token, and records each request as one
// JSON line on stdout: the path, whether a token came along, and the
// relative paths of the files in it.
//
// POST /api/upload answers 200 with the JSON the real server sends; any path
// under /fail/ answers 500, so the workflow can check the action fails.
//
// Usage: node test/mock-server.mjs [port]

import { createServer } from "node:http";

const port = Number(process.argv[2] ?? 8080);

const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200).end("ok");
    return;
  }

  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    const body = Buffer.concat(chunks).toString("latin1");
    const files = [...body.matchAll(/name="files\[([^\]"]*)\]"/g)].map((m) => m[1]).sort();
    const auth = req.headers.authorization ?? "";

    console.log(JSON.stringify({
      method: req.method,
      path: req.url,
      // An OIDC token is a JWT: three base64url parts.
      bearerJWT: /^Bearer [\w-]+\.[\w-]+\.[\w-]+$/.test(auth),
      files,
    }));

    if (req.method !== "POST" || !req.url.endsWith("/api/upload")) {
      res.writeHead(404, { "content-type": "application/json" }).end(JSON.stringify({ error: "not found" }));
    } else if (req.url.startsWith("/fail/")) {
      res.writeHead(500, { "content-type": "application/json" }).end(JSON.stringify({ error: "mock failure" }));
    } else {
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({
        url: "https://example.org/",
        preview_url: ["https://preview.example.org/"],
      }));
    }
  });
});

server.listen(port, "127.0.0.1");
