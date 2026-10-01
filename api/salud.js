"use strict";
/* GET /api/salud — diagnóstico de configuración sin exponer secretos.
   Comprueba las variables de entorno y hace una prueba real de escritura y lectura cifrada.
   POST /api/salud?accion=correo-prueba {para?} — envía un correo de prueba con el modo de correo activo.
   GET  /api/salud?inventario=1&clave=… — inventario del almacenamiento (conteos, fechas y estados, sin datos
   personales) leído directamente del almacén, para contrastar con el tablero.
   Requieren sesión de secretaría técnica o la clave de administración. */
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

/* Inventario sin datos personales: id abreviado, fechas y estado de cada registro, leídos del almacén. */
async function inventario(req, res, url) {
  const autorizado = verificarClaveAdmin(req, url).ok || Boolean(sesionActual(req, "secretaria"));
  if (!autorizado) return error(res, 401, "Inicie sesión como secretaría técnica o indique la clave de administración.");
  const salida = { ok: true, fecha: new Date().toISOString(), almacen: almacen.USAR_BLOB ? "Vercel Blob" : "archivos locales" };
  const resumir = (lista, campos) => lista.map((r) => Object.assign({ id: String(r.id || "").slice(0, 8), creado: r.creado, estado: r.estado, tieneClave: Boolean(r.clave) }, campos(r)));
  try {
    const [empresas, instituciones, grupos] = await Promise.all([require("../lib/empresas").listarTodas(), require("../lib/ies").listarTodas(), require("../lib/grupos").listarTodos()]);
    const rutas = { empresas: await almacen.listarRutas("empresas/"), ies: await almacen.listarRutas("ies/"), grupos: await almacen.listarRutas("grupos/"), informes: await almacen.listarRutas("informes/"), secretaria: await almacen.listarRutas("secretaria/") };
    salida.archivos = Object.fromEntries(Object.entries(rutas).map(([k, v]) => [k, v.length]));
    salida.empresas = resumir(empresas, (e) => ({ diagnostico: e.diagnostico && e.diagnostico.completado ? "completado" : "paso " + ((e.diagnostico && e.diagnostico.paso) || 0), grupoAsignado: Boolean(e.grupoAsignado) }));
    salida.ies = resumir(instituciones, (i) => ({ institucion: i.institucion && i.institucion.nombre, clavePadron: i.institucion && i.institucion.clave }));
    salida.grupos = resumir(grupos, (g) => ({ nombre: g.nombre, ies: g.ies && g.ies.nombre, clavePadron: g.ies && g.ies.clave, iesId: g.iesId ? String(g.iesId).slice(0, 8) : null, integrantes: (g.integrantes || []).length, confirmados: (g.integrantes || []).filter((m) => m.estado === "confirmado").length, empresaAsignada: Boolean(g.empresaAsignada) }));
    salida.ilegibles = { empresas: rutas.empresas.length - empresas.length, ies: rutas.ies.length - instituciones.length, grupos: rutas.grupos.length - grupos.length };
    // Eliminaciones y emparejamientos hechos desde el tablero de la secretaría (sin datos personales)
    const cuentas = [];
    for (const r of rutas.secretaria) { const c = await almacen.leerRegistro(r); if (c) cuentas.push(c); }
    salida.accionesSecretaria = cuentas.flatMap((c) => (c.historial || []).filter((h) => /eliminad|asignacion|asignada/.test(h.evento)).map((h) => ({ fecha: h.fecha, evento: h.evento })));
  } catch (e) {
    salida.ok = false; salida.error = String((e && e.message) || e).slice(0, 300);
  }
  responder(res, salida.ok ? 200 : 500, salida);
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
  if (url.searchParams.get("inventario")) return inventario(req, res, url);
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
