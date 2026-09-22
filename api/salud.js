"use strict";
/* GET /api/salud — diagnóstico de configuración sin exponer secretos.
   Comprueba las variables de entorno y hace una prueba real de escritura y lectura cifrada. */
const { responder, soloMetodos } = require("../lib/http");
const { estadoConfiguracion } = require("../lib/cifrado");
const almacen = require("../lib/almacen");

module.exports = async function (req, res) {
  if (!soloMetodos(req, res, ["GET"])) return;
  const variablesBlob = Object.keys(process.env).filter((k) => /BLOB|STORE_ID|READ_WRITE_TOKEN|OIDC/i.test(k)).sort();
  const salida = { ok: true, configuracion: estadoConfiguracion(), blob: almacen.USAR_BLOB ? "credenciales " + almacen.CREDENCIALES.modo + " (" + almacen.CREDENCIALES.variable + ")" : "sin credenciales", variablesRelacionadasConBlob: variablesBlob };
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
