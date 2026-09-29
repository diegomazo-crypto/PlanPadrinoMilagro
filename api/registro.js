"use strict";
/* /api/registro — POST crea el registro cifrado de la empresa y devuelve un token de corta
   duración para crear la clave. GET (con sesión) devuelve los datos de la empresa para editarlos;
   PUT (con sesión) los actualiza, excepto el correo, que es el usuario de la cuenta. */
const { responder, error, leerCuerpo, soloMetodos, texto, sesionActual } = require("../lib/http");
const { normalizarCorreo, firmarToken } = require("../lib/cifrado");
const empresas = require("../lib/empresas");
const T = require("../assets/js/territorios.js");

const CAMPOS = [
  "empresa", "tipo_identificacion", "nit", "tamano", "sector", "anios_operacion", "departamento", "municipio", "direccion",
  "camara_comercio", "camara_nombre", "estado_operativo", "empleos_antes", "empleos_actuales",
  "tipo_afectacion", "descripcion_afectacion", "frente_prioritario", "reto_principal",
  "contacto_nombre", "contacto_cargo", "contacto_telefono", "contacto_correo",
  "disponibilidad", "como_se_entero"
];
const NO_EDITABLES = ["contacto_correo"];
const OBLIGATORIOS = ["empresa", "tipo_identificacion", "tamano", "sector", "departamento", "municipio", "estado_operativo",
  "tipo_afectacion", "descripcion_afectacion", "frente_prioritario", "contacto_nombre", "contacto_cargo",
  "contacto_telefono", "contacto_correo", "disponibilidad"];

/* Valida y normaliza los datos de inscripción. Devuelve { datos } o { estado, mensaje, extra }. */
function validarDatos(cuerpo) {
  const datos = {};
  CAMPOS.forEach((k) => { datos[k] = texto(cuerpo[k], k.startsWith("descripcion") || k === "reto_principal" ? 4000 : 300); });
  const faltantes = OBLIGATORIOS.filter((k) => !datos[k]);
  if (faltantes.length) return { estado: 400, mensaje: "Faltan campos obligatorios.", extra: { campos: faltantes } };

  const correo = normalizarCorreo(datos.contacto_correo);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return { estado: 400, mensaje: "El correo electrónico no es válido." };
  datos.contacto_correo = correo;

  // Identificación con formato colombiano
  const problemaId = T.validarIdentificacion(datos.tipo_identificacion, datos.nit);
  if (problemaId) return { estado: 400, mensaje: problemaId, extra: { campos: ["nit"] } };
  if (datos.tipo_identificacion === "NIT") datos.nit = T.normalizarNit(datos.nit);
  if (datos.tipo_identificacion === "Sin registro") datos.nit = "";

  // Municipio y cámara coherentes con el departamento
  const depto = T.departamento(datos.departamento);
  if (depto) {
    if (datos.municipio !== T.OTRO && !depto.municipios.includes(datos.municipio)) {
      return { estado: 400, mensaje: "El municipio no corresponde al departamento seleccionado.", extra: { campos: ["municipio"] } };
    }
  } else if (datos.departamento !== T.OTRO) {
    return { estado: 400, mensaje: "Departamento no válido.", extra: { campos: ["departamento"] } };
  }
  return { datos };
}

module.exports = async function (req, res) {
  if (!soloMetodos(req, res, ["GET", "POST", "PUT"])) return;
  try {
    if (req.method !== "POST") {
      const sesion = sesionActual(req, "empresa");
      if (!sesion) return error(res, 401, "Inicie sesión para ver sus datos.");
      const empresa = await empresas.cargarPorId(sesion.id);
      if (!empresa || !empresa.clave) return error(res, 401, "La sesión no es válida.");
      if (req.method === "GET") return responder(res, 200, { ok: true, datos: empresa.datos, campos: CAMPOS, noEditables: NO_EDITABLES, empresa: empresas.vistaPublica(empresa) });
      // PUT: actualización de datos de contacto y de la empresa, sin cambiar el correo
      const cuerpo = await leerCuerpo(req);
      const entrada = Object.assign({}, empresa.datos, cuerpo, { contacto_correo: empresa.correo });
      const r = validarDatos(entrada);
      if (r.estado) return error(res, r.estado, r.mensaje, r.extra);
      const cambiados = CAMPOS.filter((k) => (empresa.datos[k] || "") !== (r.datos[k] || ""));
      empresa.datos = r.datos;
      empresa.actualizacionesDatos = empresa.actualizacionesDatos || [];
      if (cambiados.length) empresa.actualizacionesDatos.push({ fecha: new Date().toISOString(), campos: cambiados });
      empresas.registrarEvento(empresa, "datos_actualizados:" + cambiados.join(","));
      await empresas.guardar(empresa);
      return responder(res, 200, { ok: true, datos: empresa.datos, cambiados, empresa: empresas.vistaPublica(empresa) });
    }

    const cuerpo = await leerCuerpo(req);
    if (cuerpo._trampa) return error(res, 400, "Solicitud no válida.");
    const r = validarDatos(cuerpo);
    if (r.estado) return error(res, r.estado, r.mensaje, r.extra);
    const datos = r.datos;
    const correo = datos.contacto_correo;

    // Compromiso de participación: una sola aceptación en la inscripción
    const acepta = cuerpo.acepta_compromisos;
    if (acepta !== "sí" && acepta !== "on" && acepta !== true) return error(res, 400, "Debe aceptar el compromiso de participación.");

    const existente = await empresas.cargarPorCorreo(correo);
    if (existente && existente.clave) {
      return error(res, 409, "Ya existe una cuenta con este correo. Inicie sesión en el portal de empresas.", { existe: true });
    }
    let empresa;
    if (existente) {
      existente.datos = datos;
      empresas.registrarEvento(existente, "registro_actualizado");
      empresa = existente;
    } else {
      empresa = empresas.nueva(correo, datos);
    }
    // El compromiso aceptado aquí no se vuelve a pedir en el portal.
    empresa.aceptaciones = Object.assign({}, empresa.aceptaciones || {}, {
      compromiso: true, fechaCompromiso: new Date().toISOString(), nombreFirmaCompromiso: datos.contacto_nombre, version: "2026-09"
    });
    empresas.registrarEvento(empresa, "acepta_compromiso_en_inscripcion");
    await empresas.guardar(empresa);

    const tokenRegistro = firmarToken({ p: "registro", id: empresa.id }, 30 * 60);
    responder(res, 201, { ok: true, tokenRegistro, correo });
  } catch (e) {
    console.error("registro:", e);
    const causa = String((e && e.message) || "").slice(0, 160);
    error(res, 500, "No fue posible guardar la inscripción. Intente de nuevo.", { causa });
  }
};
