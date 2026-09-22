"use strict";
/* POST /api/registro — crea el registro cifrado de la empresa y devuelve un token
   de corta duración para el paso siguiente: creación de la clave de acceso. */
const { responder, error, leerCuerpo, soloMetodos, texto } = require("../lib/http");
const { normalizarCorreo, firmarToken } = require("../lib/cifrado");
const empresas = require("../lib/empresas");
const T = require("../assets/js/territorios.js");

const CAMPOS = [
  "empresa", "tipo_identificacion", "nit", "tamano", "sector", "anios_operacion", "departamento", "municipio", "direccion",
  "camara_comercio", "camara_nombre", "estado_operativo", "empleos_antes", "empleos_actuales",
  "tipo_afectacion", "descripcion_afectacion", "frente_prioritario", "reto_principal",
  "contacto_nombre", "contacto_cargo", "contacto_telefono", "contacto_correo", "modalidad",
  "disponibilidad", "como_se_entero"
];
const OBLIGATORIOS = ["empresa", "tipo_identificacion", "tamano", "sector", "departamento", "municipio", "estado_operativo",
  "tipo_afectacion", "descripcion_afectacion", "frente_prioritario", "contacto_nombre", "contacto_cargo",
  "contacto_telefono", "contacto_correo", "disponibilidad"];

module.exports = async function (req, res) {
  if (!soloMetodos(req, res, ["POST"])) return;
  try {
    const cuerpo = await leerCuerpo(req);
    if (cuerpo._trampa) return error(res, 400, "Solicitud no válida.");

    const datos = {};
    CAMPOS.forEach((k) => { datos[k] = texto(cuerpo[k], k.startsWith("descripcion") || k === "reto_principal" ? 4000 : 300); });
    const faltantes = OBLIGATORIOS.filter((k) => !datos[k]);
    if (faltantes.length) return error(res, 400, "Faltan campos obligatorios.", { campos: faltantes });

    const correo = normalizarCorreo(datos.contacto_correo);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return error(res, 400, "El correo electrónico no es válido.");
    datos.contacto_correo = correo;

    // Identificación con formato colombiano
    const problemaId = T.validarIdentificacion(datos.tipo_identificacion, datos.nit);
    if (problemaId) return error(res, 400, problemaId, { campos: ["nit"] });
    if (datos.tipo_identificacion === "NIT") datos.nit = T.normalizarNit(datos.nit);
    if (datos.tipo_identificacion === "Sin registro") datos.nit = "";

    // Municipio y cámara coherentes con el departamento
    const depto = T.departamento(datos.departamento);
    if (depto) {
      if (datos.municipio !== T.OTRO && !depto.municipios.includes(datos.municipio)) {
        return error(res, 400, "El municipio no corresponde al departamento seleccionado.", { campos: ["municipio"] });
      }
    } else if (datos.departamento !== T.OTRO) {
      return error(res, 400, "Departamento no válido.", { campos: ["departamento"] });
    }

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
