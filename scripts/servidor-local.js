#!/usr/bin/env node
"use strict";
/* Servidor local de desarrollo: sirve el sitio estático con URLs limpias y ejecuta
   las funciones de /api como lo haría Vercel. Los datos se guardan cifrados en
   ./.datos-local (o en PPM_DATOS_DIR). Uso: npm run dev  (puerto 8765 o PORT). */
const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const RAIZ = path.resolve(__dirname, "..");
const PUERTO = Number(process.env.PORT || 8765);
const TIPOS = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8", ".pdf": "application/pdf", ".ico": "image/x-icon" };

function leerCuerpo(req) {
  return new Promise((resolver) => {
    let datos = "";
    req.on("data", (t) => { datos += t; });
    req.on("end", () => resolver(datos));
  });
}

function adaptarRespuesta(res) {
  res.status = function (c) { res.statusCode = c; return res; };
  res.json = function (o) { res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify(o)); return res; };
  res.send = function (b) { res.end(b); return res; };
  return res;
}

async function manejarApi(req, res, ruta) {
  const nombre = ruta.replace(/^\/api\//, "").split("/")[0].replace(/\.js$/, "");
  const archivo = path.join(RAIZ, "api", nombre + ".js");
  if (!/^[a-z0-9_-]+$/i.test(nombre) || !fs.existsSync(archivo)) { res.statusCode = 404; return res.end(JSON.stringify({ error: "No existe /api/" + nombre })); }
  const crudo = await leerCuerpo(req);
  const tipo = req.headers["content-type"] || "";
  if (tipo.includes("application/json")) { try { req.body = crudo ? JSON.parse(crudo) : {}; } catch (e) { req.body = {}; } }
  else req.body = crudo;
  req.query = Object.fromEntries(new URL(req.url, "http://x").searchParams.entries());
  delete require.cache[require.resolve(archivo)];
  const manejador = require(archivo);
  await manejador(req, adaptarRespuesta(res));
}

function servirEstatico(req, res, ruta) {
  let archivo = path.normalize(path.join(RAIZ, decodeURIComponent(ruta)));
  if (!archivo.startsWith(RAIZ)) { res.statusCode = 403; return res.end("Prohibido"); }
  if (ruta.endsWith("/")) archivo = path.join(archivo, "index.html");
  if (!fs.existsSync(archivo) && !path.extname(archivo) && fs.existsSync(archivo + ".html")) archivo += ".html";
  if (!fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) { res.statusCode = 404; return res.end("No encontrado"); }
  res.setHeader("Content-Type", TIPOS[path.extname(archivo).toLowerCase()] || "application/octet-stream");
  fs.createReadStream(archivo).pipe(res);
}

http.createServer(async (req, res) => {
  const ruta = url.parse(req.url).pathname;
  try {
    if (ruta.startsWith("/api/")) await manejarApi(req, res, ruta);
    else servirEstatico(req, res, ruta);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) { res.statusCode = 500; res.setHeader("Content-Type", "application/json"); }
    res.end(JSON.stringify({ error: "Error interno del servidor local." }));
  }
}).listen(PUERTO, () => {
  console.log("Plan Padrino Milagro en http://localhost:" + PUERTO + "  (datos cifrados en " + (process.env.PPM_DATOS_DIR || ".datos-local") + ")");
});
