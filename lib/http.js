"use strict";
/* Utilidades HTTP para las funciones de Vercel y el servidor local. */
const { firmarToken, verificarToken } = require("./cifrado");

const NOMBRE_COOKIE = "ppm_sesion";
const DIAS_SESION = 7;

function responder(res, estado, cuerpo) {
  res.statusCode = estado;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(cuerpo));
}

function error(res, estado, mensaje, extra) {
  responder(res, estado, Object.assign({ error: mensaje }, extra || {}));
}

async function leerCuerpo(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch (e) { return {}; } }
    return req.body;
  }
  return new Promise((resolver) => {
    let datos = "";
    req.on("data", (t) => { datos += t; if (datos.length > 1e6) req.destroy(); });
    req.on("end", () => { try { resolver(datos ? JSON.parse(datos) : {}); } catch (e) { resolver({}); } });
    req.on("error", () => resolver({}));
  });
}

function leerCookies(req) {
  if (req.cookies) return req.cookies;
  const salida = {};
  const cabecera = req.headers && req.headers.cookie;
  if (!cabecera) return salida;
  cabecera.split(";").forEach((par) => {
    const i = par.indexOf("=");
    if (i > 0) salida[par.slice(0, i).trim()] = decodeURIComponent(par.slice(i + 1).trim());
  });
  return salida;
}

function esSeguro(req) {
  const proto = (req.headers["x-forwarded-proto"] || "").split(",")[0];
  return proto === "https" || Boolean(process.env.VERCEL);
}

function iniciarSesion(req, res, id) {
  const token = firmarToken({ p: "sesion", id }, DIAS_SESION * 86400);
  const partes = [NOMBRE_COOKIE + "=" + token, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=" + DIAS_SESION * 86400];
  if (esSeguro(req)) partes.push("Secure");
  res.setHeader("Set-Cookie", partes.join("; "));
}

function cerrarSesion(req, res) {
  const partes = [NOMBRE_COOKIE + "=", "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (esSeguro(req)) partes.push("Secure");
  res.setHeader("Set-Cookie", partes.join("; "));
}

function sesionActual(req) {
  const cookies = leerCookies(req);
  const carga = verificarToken(cookies[NOMBRE_COOKIE], "sesion");
  return carga ? { id: carga.id } : null;
}

function soloMetodos(req, res, metodos) {
  if (metodos.includes(req.method)) return true;
  res.setHeader("Allow", metodos.join(", "));
  error(res, 405, "Método no permitido.");
  return false;
}

function texto(v, max) {
  if (v === undefined || v === null) return "";
  return String(v).trim().slice(0, max || 500);
}

module.exports = { responder, error, leerCuerpo, leerCookies, iniciarSesion, cerrarSesion, sesionActual, soloMetodos, texto };
