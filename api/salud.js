"use strict";
/* GET /api/salud — diagnóstico de configuración sin exponer secretos.
   Comprueba las variables de entorno y hace una prueba real de escritura y lectura cifrada.
   POST /api/salud?accion=correo-prueba {para?} — envía un correo de prueba con el modo de correo activo.
   Requiere sesión de secretaría técnica o la clave de administración. */
const { responder, error, soloMetodos, sesionActual, leerCuerpo } = require("../lib/http");
const { estadoConfiguracion, verificarClaveAdmin } = require("../lib/cifrado");
const almacen = require("../lib/almacen");
const correo = require("../lib/correo");

async function correoPrueba(req, res, url) {
  const autorizado = verificarClaveAdmin(req, url).ok || Boolean(sesionActual(req, "secretaria"));
  if (!autorizado) return error(res, 401, "Inicie sesión como secretaría técnica o indique la clave de administración.");
  const cuerpo = await leerCuerpo(req).catch(() => ({}));
  let para = String((cuerpo && cuerpo.para) || url.searchParams.get("para") || "").trim();
  if (!para) {
    const sesion = sesionActual(req, "secretaria");
    const cuenta = sesion ? await require("../lib/secretaria").cargarPorId(sesion.id) : null;
    para = (cuenta && cuenta.correo) || "";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(para)) return error(res, 400, "Indique el destinatario en ?para= o en el cuerpo {para}.");
  const html = correo.plantilla("Correo de prueba del portal", "<p>Este es un mensaje de prueba enviado desde <strong>" + (process.env.VERCEL_ENV || "local") + "</strong> con el modo <strong>" + correo.estado().modo + "</strong>. Si lo recibe, el envío de correos del Plan funciona.</p><p style='font-size:13px;color:#4C5A6E'>Fecha: " + new Date().toISOString() + "</p>");
  const envio = await correo.enviar({ para, asunto: "Plan Milagro · Correo de prueba", html, copia: "" });
  responder(res, envio.ok ? 200 : 502, Object.assign({ ok: envio.ok, para, correo: correo.estado() }, envio));
}

module.exports = async function (req, res) {
  if (!soloMetodos(req, res, ["GET", "POST"])) return;
  if (req.method === "POST") {
    const u = new URL(req.url, "http://x");
    if (u.searchParams.get("accion") === "correo-prueba") return correoPrueba(req, res, u);
    return error(res, 400, "Acción no reconocida.");
  }
  const variablesBlob = Object.keys(process.env).filter((k) => /BLOB|STORE_ID|READ_WRITE_TOKEN|OIDC/i.test(k)).sort();
  const url = new URL(req.url, "http://x");
  const configurada = String(process.env.PPM_CLAVE_ADMIN || "");
  const claveAdmin = { longitud: configurada.length, conEspacios: configurada !== configurada.trim(), soloLetrasYNumeros: /^[A-Za-z0-9]*$/.test(configurada.trim()) };
  if (url.searchParams.has("clave") || req.headers["x-clave-admin"]) {
    const v = verificarClaveAdmin(req, url);
    claveAdmin.pruebaConLaClaveRecibida = v.ok ? "coincide: puede usar /api/exportar y /api/clave?accion=enlace" : v.motivo;
  } else {
    claveAdmin.comoProbar = "abra /api/salud?clave=<valor> para comprobar si el valor que va a usar coincide";
  }
  const salida = { ok: true, configuracion: estadoConfiguracion(), claveAdmin, blob: almacen.USAR_BLOB ? "credenciales " + almacen.CREDENCIALES.modo + " (" + almacen.CREDENCIALES.variable + ")" : "sin credenciales", variablesRelacionadasConBlob: variablesBlob, correo: correo.estado() };
  try {
    salida.almacenamiento = await almacen.verificar();
  } catch (e) {
    salida.ok = false;
    salida.almacenamiento = { error: String((e && e.message) || e).slice(0, 300) };
  }
  if (salida.configuracion.claveCifrado === "ausente" || salida.configuracion.claveCifrado === "demasiado corta") salida.ok = false;
  if (process.env.VERCEL && !almacen.USAR_BLOB) {
    salida.ok = false;
    salida.accion = "Conecte el almacén Blob al proyecto (Storage → almacén → Connect Project, marcando Production, Preview y Development) y vuelva a desplegar.";
  }
  responder(res, salida.ok ? 200 : 500, salida);
};
