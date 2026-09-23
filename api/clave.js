"use strict";
/* POST /api/clave — establece la clave de acceso tras el registro (empresas e IES).
   La clave no puede coincidir con ningún dato suministrado en la inscripción. */
const { responder, error, leerCuerpo, soloMetodos, iniciarSesion } = require("../lib/http");
const { verificarToken, hashClave } = require("../lib/cifrado");
const empresas = require("../lib/empresas");
const ies = require("../lib/ies");
const grupos = require("../lib/grupos");
const correo = require("../lib/correo");

function normal(s) { return String(s || "").trim().toLowerCase().replace(/\s+/g, " "); }

function validarClave(clave, confirmacion, empresa) {
  if (typeof clave !== "string" || clave.length < 8) return "La clave debe tener al menos 8 caracteres.";
  if (clave.length > 128) return "La clave es demasiado larga.";
  if (clave !== confirmacion) return "La clave y su confirmación no coinciden.";
  if (!/[a-zA-Z]/.test(clave) || !/[0-9]/.test(clave)) return "La clave debe combinar letras y números.";

  const c = normal(clave);
  const sinTildes = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const cPlano = sinTildes(c);
  const fuente = Object.assign({}, empresa.datos || {}, empresa.institucion || {}, empresa.lider || {}, empresa.ies || {}, { nombreGrupo: empresa.nombre });
  const valores = [];
  Object.values(fuente).forEach((v) => {
    if (typeof v === "string") valores.push(normal(v));
    else if (Array.isArray(v)) v.forEach((x) => { if (typeof x === "string") valores.push(normal(x)); });
  });
  const correo = normal(empresa.correo);
  valores.push(correo, correo.split("@")[0]);
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

module.exports = async function (req, res) {
  if (!soloMetodos(req, res, ["POST"])) return;
  try {
    const { tokenRegistro, clave, confirmacion } = await leerCuerpo(req);
    const carga = verificarToken(tokenRegistro, "registro");
    if (!carga) return error(res, 401, "El enlace de creación de clave expiró. Vuelva a diligenciar la inscripción.");
    const tipo = carga.t === "ies" || carga.t === "lider" ? carga.t : "empresa";
    const esIes = tipo === "ies";
    const modulo = tipo === "ies" ? ies : (tipo === "lider" ? grupos : empresas);
    const cuenta = await modulo.cargarPorId(carga.id);
    if (!cuenta) return error(res, 404, "No se encontró la inscripción.");
    if (cuenta.clave) return error(res, 409, "Esta cuenta ya tiene clave. Inicie sesión en el portal.");

    const problema = validarClave(clave, confirmacion, cuenta);
    if (problema) return error(res, 400, problema);

    cuenta.clave = hashClave(clave);
    if (tipo !== "lider") cuenta.estado = "clave_creada";   // el estado de un grupo describe su flujo, no la cuenta
    modulo.registrarEvento(cuenta, "clave_creada");
    // Correo de confirmación de la cuenta (no bloquea el flujo si falla)
    const mensaje = tipo === "ies" ? correo.confirmacionCuentaIes(cuenta) : (tipo === "lider" ? correo.confirmacionCuentaLider(cuenta) : correo.confirmacionCuentaEmpresa(cuenta));
    const envio = await correo.enviar({ para: cuenta.correo, asunto: mensaje.asunto, html: mensaje.html, copia: "" });
    cuenta.correos = cuenta.correos || [];
    cuenta.correos.push({ tipo: "confirmacion_cuenta", fecha: envio.fecha, estado: envio.ok ? "enviado" : "fallido", modo: envio.modo, error: envio.error });
    modulo.registrarEvento(cuenta, envio.ok ? "correo_confirmacion_enviado" : "correo_confirmacion_fallido");
    await modulo.guardar(cuenta);
    iniciarSesion(req, res, cuenta.id, tipo);
    const vista = modulo.vistaPublica(cuenta);
    responder(res, 200, tipo === "ies" ? { ok: true, tipo: "ies", ies: vista } : (tipo === "lider" ? { ok: true, tipo: "lider", grupo: vista } : { ok: true, tipo: "empresa", empresa: vista }));
  } catch (e) {
    console.error("clave:", e);
    error(res, 500, "No fue posible guardar la clave. Intente de nuevo.");
  }
};
