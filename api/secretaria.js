"use strict";
/* /api/secretaria — tablero integral de la secretaría técnica (sesión de tipo "secretaria").
   GET  ?vista=resumen            tablero y listas de empresas, IES y grupos
   GET  ?vista=empresa&id=…       detalle de una empresa: inscripción, aceptaciones, autodiagnóstico, informe
   GET  ?vista=grupo&id=…         detalle de un grupo con su plan de trabajo
   PUT  ?vista=ies                {id, responsable_nombre, responsable_cargo, responsable_telefono} datos del coordinador
   POST ?accion=asignar           {grupoId, empresaId} empareja un grupo confirmado con una empresa
   POST ?accion=desasignar        {grupoId} deshace el emparejamiento
   DELETE ?vista=empresa|grupo|ies&id=…   elimina el registro y limpia sus vínculos (emparejamiento, informe, coordinador) */
const { responder, error, leerCuerpo, soloMetodos, sesionActual, texto } = require("../lib/http");
const secretaria = require("../lib/secretaria");
const empresas = require("../lib/empresas");
const ies = require("../lib/ies");
const grupos = require("../lib/grupos");
const correo = require("../lib/correo");
const informe = require("../lib/informe");
const CAT = require("../assets/js/catalogo-grupos.js");

function resumenEmpresa(e) {
  const d = e.datos || {}, dg = e.diagnostico || {};
  return { id: e.id, correo: e.correo, empresa: d.empresa, nit: d.nit, municipio: d.municipio, departamento: d.departamento, sector: d.sector, tamano: d.tamano, estado_operativo: d.estado_operativo,
    frente: d.frente_prioritario, contacto: d.contacto_nombre, telefono: d.contacto_telefono, estado: e.estado, creado: e.creado, aceptado: Boolean(e.aceptaciones && e.aceptaciones.terminos),
    diagnostico: { completado: Boolean(dg.completado), paso: dg.paso, version: dg.version || (dg.completado ? 1 : 0), global: dg.resultados && dg.resultados.global, nivel: dg.resultados && dg.resultados.nivelGlobal, finalizado: dg.finalizado },
    informe: Boolean(e.informe && e.informe.generado), grupoAsignado: e.grupoAsignado || null };
}
function resumenIes(i, lista) {
  const inst = i.institucion || {}, d = i.datos || {};
  const suyos = lista.filter((g) => g.iesId === i.id || (g.ies && inst.clave && g.ies.clave === inst.clave));
  return { id: i.id, correo: i.correo, nombre: inst.nombre, codigo: inst.codigo, caracter: inst.caracter, sector: inst.sector, municipio: inst.municipio, departamento: inst.departamento, declarada: Boolean(inst.declarada),
    coordinador: { nombre: d.responsable_nombre, cargo: d.responsable_cargo, telefono: d.responsable_telefono }, estado: i.estado, tieneClave: Boolean(i.clave), creado: i.creado,
    grupos: suyos.filter((g) => g.estado !== "cancelado").length, gruposConfirmados: suyos.filter((g) => g.estado === "confirmado" || g.estado === "asignado").length, personas: suyos.filter((g) => g.estado !== "cancelado").reduce((n, g) => n + grupos.personas(g), 0) };
}
function resumenGrupo(g) {
  return { id: g.id, nombre: g.nombre, ies: g.ies && g.ies.nombre, iesClave: g.ies && g.ies.clave, area: g.area, estado: g.estado, estadoTexto: CAT.ESTADOS[g.estado] || g.estado, lider: g.lider, integrantes: g.integrantes.map((m) => ({ nombre: m.nombre, vinculacion: m.vinculacion, correo: m.correo, telefono: m.telefono, estado: m.estado })),
    personas: grupos.personas(g), confirmados: g.integrantes.filter((m) => m.estado === "confirmado").length, creado: g.creado, empresaAsignada: g.empresaAsignada || null, coordinadorVinculado: Boolean(g.iesId), actividades: (g.plan && g.plan.actividades || []).length };
}

module.exports = async function (req, res) {
  if (!soloMetodos(req, res, ["GET", "PUT", "POST", "DELETE"])) return;
  try {
    const sesion = sesionActual(req, "secretaria");
    if (!sesion) return error(res, 401, "Inicie sesión como secretaría técnica.");
    const cuenta = await secretaria.cargarPorId(sesion.id);
    if (!cuenta || !cuenta.clave) return error(res, 401, "La sesión no es válida.");
    const url = new URL(req.url, "http://x");
    const vista = url.searchParams.get("vista") || "resumen", accion = url.searchParams.get("accion") || "";

    if (req.method === "GET") {
      if (vista === "empresa") {
        const e = await empresas.cargarPorId(texto(url.searchParams.get("id"), 64));
        if (!e) return error(res, 404, "No se encontró la empresa.");
        const c = Object.assign({}, e); delete c.clave;
        return responder(res, 200, { ok: true, empresa: c, resumen: resumenEmpresa(e) });
      }
      if (vista === "grupo") {
        const g = await grupos.cargarPorId(texto(url.searchParams.get("id"), 64));
        if (!g) return error(res, 404, "No se encontró el grupo.");
        const c = Object.assign({}, g); delete c.clave;
        return responder(res, 200, { ok: true, grupo: c });
      }
      const [todasEmpresas, todasIes, todosGrupos] = await Promise.all([empresas.listarTodas(), ies.listarTodas(), grupos.listarTodos()]);
      const porEstado = (lista) => lista.reduce((m, x) => { m[x.estado] = (m[x.estado] || 0) + 1; return m; }, {});
      const activos = todosGrupos.filter((g) => g.estado !== "cancelado");
      const tablero = {
        fecha: new Date().toISOString(),
        empresas: { total: todasEmpresas.length, porEstado: porEstado(todasEmpresas), conClave: todasEmpresas.filter((e) => e.clave).length, aceptadas: todasEmpresas.filter((e) => e.aceptaciones && e.aceptaciones.terminos).length, diagnosticosCompletados: todasEmpresas.filter((e) => e.diagnostico && e.diagnostico.completado).length, asignadas: todasEmpresas.filter((e) => e.grupoAsignado).length, sinAsignar: todasEmpresas.filter((e) => e.diagnostico && e.diagnostico.completado && !e.grupoAsignado).length },
        ies: { total: todasIes.length, conCoordinador: todasIes.filter((i) => i.clave).length },
        grupos: { total: todosGrupos.length, activos: activos.length, porEstado: porEstado(todosGrupos), personas: activos.reduce((n, g) => n + grupos.personas(g), 0), listosParaAsignar: todosGrupos.filter((g) => g.estado === "confirmado").length, asignados: todosGrupos.filter((g) => g.estado === "asignado").length }
      };
      return responder(res, 200, { ok: true, tablero, empresas: todasEmpresas.map(resumenEmpresa).sort((a, b) => (a.creado < b.creado ? 1 : -1)), ies: todasIes.map((i) => resumenIes(i, todosGrupos)).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es")), grupos: todosGrupos.map(resumenGrupo).sort((a, b) => (a.creado < b.creado ? 1 : -1)) });
    }

    if (req.method === "DELETE") {
      const id = texto(url.searchParams.get("id"), 64);
      if (!id) return error(res, 400, "Indique el id.");
      if (vista === "empresa") {
        const e = await empresas.cargarPorId(id);
        if (!e) return error(res, 404, "No se encontró la empresa.");
        if (e.grupoAsignado) {
          const g = await grupos.cargarPorId(e.grupoAsignado.id);
          if (g && g.empresaAsignada && g.empresaAsignada.id === e.id) { g.empresaAsignada = null; g.estado = "confirmado"; grupos.registrarEvento(g, "empresa_eliminada_por_secretaria"); await grupos.guardar(g); }
        }
        await informe.eliminarArchivado(e.id);
        await empresas.eliminar(e.id);
        secretaria.registrarEvento(cuenta, "empresa_eliminada:" + e.id + ":" + (e.datos && e.datos.empresa));
        await secretaria.guardar(cuenta);
        return responder(res, 200, { ok: true, eliminado: { tipo: "empresa", id: e.id, nombre: e.datos && e.datos.empresa } });
      }
      if (vista === "grupo") {
        const g = await grupos.cargarPorId(id);
        if (!g) return error(res, 404, "No se encontró el grupo.");
        if (g.empresaAsignada) {
          const e = await empresas.cargarPorId(g.empresaAsignada.id);
          if (e && e.grupoAsignado && e.grupoAsignado.id === g.id) { e.grupoAsignado = null; empresas.registrarEvento(e, "grupo_eliminado_por_secretaria"); await empresas.guardar(e); }
        }
        await grupos.eliminar(g.id);
        secretaria.registrarEvento(cuenta, "grupo_eliminado:" + g.id + ":" + g.nombre);
        await secretaria.guardar(cuenta);
        return responder(res, 200, { ok: true, eliminado: { tipo: "grupo", id: g.id, nombre: g.nombre } });
      }
      if (vista === "ies") {
        const inst = await ies.cargarPorId(id);
        if (!inst) return error(res, 404, "No se encontró la institución.");
        // Los grupos de la institución se conservan; quedan a la espera de un nuevo coordinador
        const suyos = (await grupos.listarTodos()).filter((g) => g.iesId === inst.id);
        for (const g of suyos) { g.iesId = null; grupos.registrarEvento(g, "coordinador_eliminado_por_secretaria"); await grupos.guardar(g); }
        await ies.eliminar(inst.id);
        secretaria.registrarEvento(cuenta, "ies_eliminada:" + inst.id + ":" + (inst.institucion && inst.institucion.nombre));
        await secretaria.guardar(cuenta);
        return responder(res, 200, { ok: true, eliminado: { tipo: "ies", id: inst.id, nombre: inst.institucion && inst.institucion.nombre, gruposDesvinculados: suyos.length } });
      }
      return error(res, 400, "Indique ?vista=empresa, grupo o ies.");
    }

    const cuerpo = await leerCuerpo(req);

    if (req.method === "PUT" && vista === "ies") {
      const inst = await ies.cargarPorId(texto(cuerpo.id, 64));
      if (!inst) return error(res, 404, "No se encontró la institución.");
      const nombre = texto(cuerpo.responsable_nombre, 120), cargo = texto(cuerpo.responsable_cargo, 120), tel = texto(cuerpo.responsable_telefono, 40);
      if (!nombre) return error(res, 400, "Indique el nombre del coordinador.", { campos: ["responsable_nombre"] });
      inst.datos = Object.assign({}, inst.datos, { responsable_nombre: nombre, responsable_cargo: cargo, responsable_telefono: tel });
      ies.registrarEvento(inst, "coordinador_editado_por_secretaria");
      await ies.guardar(inst);
      const todosGrupos = await grupos.listarTodos();
      return responder(res, 200, { ok: true, ies: resumenIes(inst, todosGrupos) });
    }

    if (req.method === "POST" && (accion === "asignar" || accion === "desasignar")) {
      const grupo = await grupos.cargarPorId(texto(cuerpo.grupoId, 64));
      if (!grupo) return error(res, 404, "No se encontró el grupo.");
      if (accion === "desasignar") {
        if (grupo.empresaAsignada) {
          const e = await empresas.cargarPorId(grupo.empresaAsignada.id);
          if (e && e.grupoAsignado && e.grupoAsignado.id === grupo.id) { e.grupoAsignado = null; empresas.registrarEvento(e, "grupo_desasignado"); await empresas.guardar(e); }
        }
        grupo.empresaAsignada = null;
        grupo.estado = "confirmado";
        grupos.registrarEvento(grupo, "empresa_desasignada_por_secretaria");
        await grupos.guardar(grupo);
        return responder(res, 200, { ok: true, grupo: resumenGrupo(grupo) });
      }
      if (grupo.estado !== "confirmado") return error(res, 409, "Solo se asignan grupos confirmados por su institución y sin empresa asignada.");
      const empresa = await empresas.cargarPorId(texto(cuerpo.empresaId, 64));
      if (!empresa) return error(res, 404, "No se encontró la empresa.");
      if (empresa.grupoAsignado) return error(res, 409, "Esa empresa ya tiene un grupo asignado (" + empresa.grupoAsignado.nombre + ").");
      if (!(empresa.aceptaciones && empresa.aceptaciones.terminos)) return error(res, 409, "La empresa aún no ha aceptado los términos del acompañamiento.");
      const ahora = new Date().toISOString();
      grupo.empresaAsignada = { id: empresa.id, nombre: empresa.datos.empresa, fecha: ahora, por: cuenta.correo };
      grupo.estado = "asignado";
      grupos.registrarEvento(grupo, "empresa_asignada:" + empresa.id);
      empresa.grupoAsignado = { id: grupo.id, nombre: grupo.nombre, ies: grupo.ies.nombre, area: grupo.area, lider: { nombre: grupo.lider.nombre, correo: grupo.lider.correo, telefono: grupo.lider.telefono }, fecha: ahora };
      empresas.registrarEvento(empresa, "grupo_asignado:" + grupo.id);
      const m1 = correo.empresaAsignadaLider(grupo, empresa), m2 = correo.grupoAsignadoEmpresa(empresa, grupo);
      const e1 = await correo.enviar({ para: grupo.correo, asunto: m1.asunto, html: m1.html });
      const e2 = await correo.enviar({ para: empresa.correo, asunto: m2.asunto, html: m2.html });
      grupo.correos.push({ tipo: "empresa_asignada", para: grupo.correo, fecha: e1.fecha, estado: e1.ok ? "enviado" : "fallido", error: e1.error });
      empresa.correos = empresa.correos || [];
      empresa.correos.push({ tipo: "grupo_asignado", para: empresa.correo, fecha: e2.fecha, estado: e2.ok ? "enviado" : "fallido", error: e2.error });
      await grupos.guardar(grupo);
      await empresas.guardar(empresa);
      return responder(res, 200, { ok: true, grupo: resumenGrupo(grupo), empresa: resumenEmpresa(empresa), correos: { lider: e1.ok, empresa: e2.ok } });
    }

    return error(res, 400, "Acción no reconocida.");
  } catch (e) {
    console.error("secretaria:", e);
    error(res, 500, "No fue posible procesar la solicitud.");
  }
};
