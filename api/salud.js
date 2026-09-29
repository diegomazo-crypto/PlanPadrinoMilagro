"use strict";
/* GET /api/salud — diagnóstico de configuración sin exponer secretos.
   Comprueba las variables de entorno y hace una prueba real de escritura y lectura cifrada. */
const { responder, soloMetodos } = require("../lib/http");
const { estadoConfiguracion, verificarClaveAdmin } = require("../lib/cifrado");
const almacen = require("../lib/almacen");
const correo = require("../lib/correo");

module.exports = async function (req, res) {
  if (!soloMetodos(req, res, ["GET"])) return;
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
