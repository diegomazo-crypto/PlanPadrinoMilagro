"use strict";
/* /api/clave — claves de acceso de todos los perfiles.
   POST {tokenRegistro, clave, confirmacion}: crea la clave tras el registro (token "registro") o la
        restablece desde el enlace enviado por correo (token "restablecer"). El tipo de cuenta va en el token.
   POST ?accion=solicitar {correo}: envía al correo un enlace para crear o restablecer la clave. Para la
        secretaría técnica es también la forma de crear la cuenta (solo correos autorizados).
   GET  ?accion=enlace&correo=…: devuelve los mismos enlaces sin enviar correo. Requiere la clave de
        administración (cabecera x-clave-admin o ?clave=), para cuando el buzón del Plan no está disponible.
   PUT {claveActual, clave, confirmacion}: cambia la clave con la sesión abierta.
   La clave no puede coincidir con ningún dato suministrado en la inscripción. */
const { responder, error, leerCuerpo, soloMetodos, iniciarSesion, sesionCualquiera } = require("../lib/http");
const { verificarToken, firmarToken, hashClave, verificarClave, normalizarCorreo, verificarClaveAdmin } = require("../lib/cifrado");
const empresas = require("../lib/empresas");
const ies = require("../lib/ies");
const grupos = require("../lib/grupos");
const secretaria = require("../lib/secretaria");
const correo = require("../lib/correo");

const MODULOS = { empresa: empresas, ies, lider: grupos, secretaria };
const DESTINOS = { empresa: "portal.html", ies: "portal-ies.html", lider: "portal-grupo.html", secretaria: "portal-secretaria.html" };
const NOMBRES = { empresa: "portal de empresas", ies: "portal de instituciones", lider: "área de trabajo del grupo", secretaria: "tablero de la secretaría técnica" };

function normal(s) { return String(s || "").trim().toLowerCase().replace(/\s+/g, " "); }

function validarClave(clave, confirmacion, cuenta) {
  if (typeof clave !== "string" || clave.length < 8) return "La clave debe tener al menos 8 caracteres.";
  if (clave.length > 128) return "La clave es demasiado larga.";
  if (clave !== confirmacion) return "La clave y su confirmación no coinciden.";
  if (!/[a-zA-Z]/.test(clave) || !/[0-9]/.test(clave)) return "La clave debe combinar letras y números.";
  const c = normal(clave);
  const sinTildes = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const cPlano = sinTildes(c);
  const fuente = Object.assign({}, cuenta.datos || {}, cuenta.institucion || {}, cuenta.lider || {}, cuenta.ies || {}, { nombreGrupo: cuenta.nombre });
  const valores = [];
  Object.values(fuente).forEach((v) => {
    if (typeof v === "string") valores.push(normal(v));
    else if (Array.isArray(v)) v.forEach((x) => { if (typeof x === "string") valores.push(normal(x)); });
  });
  const cta = normal(cuenta.correo);
  valores.push(cta, cta.split("@")[0]);
  const fragmentos = new Set();
  valores.forEach((v) => {
    const plano = sinTildes(v);
    if (plano.length >= 3) fragmentos.add(plano);
    plano.split(/[^a-z0-9]+/).forEach((palabra) => { if (palabra.length >= 4) fragmentos.add(palabra); });
  });
  for (const f of fragmentos) {
    if (cPlano === f || cPlano.includes(f) || (f.length >= 6 && f.includes(cPlano))) {
      return "La clave no puede ser ni contener ningún dato que suministró en la inscripción (nombre, empresa, NIT, correo, teléfono, etc.).";
    }
  }
  if (/^(12345678|password|contrasena|contraseña|qwerty123|abcd1234)$/i.test(clave)) return "La clave es demasiado común.";
  return null;
}

function tipoDeToken(carga) {
  return MODULOS[carga.t] ? carga.t : "empresa";
}

/* Enlaces de creación o restablecimiento de clave (1 hora) para todas las cuentas asociadas a un correo.
   Para la secretaría técnica crea el registro si el correo está autorizado. */
async function enlacesPara(correoN) {
  const enlaces = [];
  for (const tipo of ["empresa", "ies", "lider"]) {
    const cuenta = await MODULOS[tipo].cargarPorCorreo(correoN);
    if (cuenta) enlaces.push({ tipo, cuenta });
  }
  if (secretaria.esPermitido(correoN)) {
    const cuenta = (await secretaria.cargarPorCorreo(correoN)) || (await secretaria.guardar(secretaria.nueva(correoN)));
    enlaces.push({ tipo: "secretaria", cuenta });
  }
  return enlaces.map((e) => {
    const token = firmarToken({ p: "restablecer", id: e.cuenta.id, t: e.tipo }, 60 * 60);
    return { tipo: e.tipo, nombre: NOMBRES[e.tipo], nueva: !e.cuenta.clave, url: correo.SITIO + "/portal?restablecer=" + encodeURIComponent(token) };
  });
}

async function solicitarEnlace(req, res) {
  const { correo: c } = await leerCuerpo(req);
  const correoN = normalizarCorreo(c);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoN)) return error(res, 400, "Indique un correo válido.");
  const enlaces = await enlacesPara(correoN);
  if (enlaces.length) {
    const filas = enlaces.map((e) => "<p style='text-align:center;margin:16px 0'><a href='" + e.url + "' style='display:inline-block;background:#08366A;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:8px'>" + (e.nueva ? "Crear la clave" : "Restablecer la clave") + " · " + e.nombre + "</a></p>").join("");
    const html = correo.plantilla("Clave de acceso al portal del Plan Milagro",
      "<p>Recibimos una solicitud para " + (enlaces.some((e) => !e.nueva) ? "restablecer" : "crear") + " la clave de acceso asociada a <strong>" + correoN + "</strong>. Use el botón correspondiente; el enlace vence en una hora.</p>" + filas +
      "<p style='font-size:14px;color:#4C5A6E'>Si no hizo esta solicitud, ignore este mensaje: su clave actual sigue vigente.</p>");
    await correo.enviar({ para: correoN, asunto: "Plan Milagro · Clave de acceso", html, copia: "" });
  }
  // Misma respuesta exista o no la cuenta, para no revelar quién está inscrito
  responder(res, 200, { ok: true, mensaje: "Si el correo corresponde a una cuenta del Plan, recibirá un enlace para crear o restablecer su clave." });
}


async function enlaceAdmin(req, res, url) {
  const v = verificarClaveAdmin(req, url);
  if (!v.ok) return error(res, 401, "No autorizado: " + v.motivo + ". Compruebe en /api/salud?clave=… el estado de la clave de administración.");
  const correoN = normalizarCorreo(url.searchParams.get("correo") || "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoN)) return error(res, 400, "Indique un correo válido en ?correo=.");
  const enlaces = await enlacesPara(correoN);
  if (!enlaces.length) return error(res, 404, "No hay cuentas asociadas a ese correo.");
  responder(res, 200, { ok: true, correo: correoN, vence: "1 hora", enlaces });
}

module.exports = async function (req, res) {
  if (!soloMetodos(req, res, ["GET", "POST", "PUT"])) return;
  try {
    const url = new URL(req.url, "http://x");
    if (req.method === "GET") {
      if (url.searchParams.get("accion") === "enlace") return enlaceAdmin(req, res, url);
      return error(res, 405, "Método no permitido.");
    }
    if (req.method === "POST" && url.searchParams.get("accion") === "solicitar") return solicitarEnlace(req, res);

    if (req.method === "PUT") {
      const sesion = sesionCualquiera(req);
      if (!sesion || !MODULOS[sesion.tipo]) return error(res, 401, "Inicie sesión para cambiar su clave.");
      const modulo = MODULOS[sesion.tipo];
      const cuenta = await modulo.cargarPorId(sesion.id);
      if (!cuenta || !cuenta.clave) return error(res, 401, "La sesión no es válida.");
      const { claveActual, clave, confirmacion } = await leerCuerpo(req);
      if (!verificarClave(String(claveActual || ""), cuenta.clave)) return error(res, 400, "La clave actual no es correcta.");
      const problema = validarClave(clave, confirmacion, cuenta);
      if (problema) return error(res, 400, problema);
      cuenta.clave = hashClave(clave);
      modulo.registrarEvento(cuenta, "clave_cambiada");
      await modulo.guardar(cuenta);
      return responder(res, 200, { ok: true });
    }

    const { tokenRegistro, clave, confirmacion } = await leerCuerpo(req);
    const carga = verificarToken(tokenRegistro, "registro") || verificarToken(tokenRegistro, "restablecer");
    if (!carga) return error(res, 401, "El enlace expiró. Vuelva a diligenciar la inscripción o solicite un nuevo enlace.");
    const tipo = tipoDeToken(carga);
    const modulo = MODULOS[tipo];
    const cuenta = await modulo.cargarPorId(carga.id);
    if (!cuenta) return error(res, 404, "No se encontró la cuenta.");
    if (carga.p === "registro" && cuenta.clave) return error(res, 409, "Esta cuenta ya tiene clave. Inicie sesión en el portal.");

    const problema = validarClave(clave, confirmacion, cuenta);
    if (problema) return error(res, 400, problema);

    const esNueva = !cuenta.clave;
    cuenta.clave = hashClave(clave);
    if (tipo !== "lider" && cuenta.estado === "registrado") cuenta.estado = "clave_creada";   // el estado de un grupo describe su flujo
    modulo.registrarEvento(cuenta, esNueva ? "clave_creada" : "clave_restablecida");
    if (esNueva && tipo !== "secretaria") {
      const mensaje = tipo === "ies" ? correo.confirmacionCuentaIes(cuenta) : (tipo === "lider" ? correo.confirmacionCuentaLider(cuenta) : correo.confirmacionCuentaEmpresa(cuenta));
      const envio = await correo.enviar({ para: cuenta.correo, asunto: mensaje.asunto, html: mensaje.html, copia: "" });
      cuenta.correos = cuenta.correos || [];
      cuenta.correos.push({ tipo: "confirmacion_cuenta", fecha: envio.fecha, estado: envio.ok ? "enviado" : "fallido", modo: envio.modo, error: envio.error });
      modulo.registrarEvento(cuenta, envio.ok ? "correo_confirmacion_enviado" : "correo_confirmacion_fallido");
    }
    await modulo.guardar(cuenta);
    iniciarSesion(req, res, cuenta.id, tipo);
    const vista = modulo.vistaPublica(cuenta);
    const salida = { ok: true, tipo, destino: DESTINOS[tipo], cuenta: vista };
    if (tipo === "empresa") salida.empresa = vista;
    if (tipo === "ies") salida.ies = vista;
    if (tipo === "lider") salida.grupo = vista;
    responder(res, 200, salida);
  } catch (e) {
    console.error("clave:", e);
    error(res, 500, "No fue posible guardar la clave. Intente de nuevo.");
  }
};
