/* Tablero integral de la secretaría técnica: empresas (inscripción y autodiagnóstico), grupos,
   instituciones (con edición del coordinador) y emparejamiento grupo–empresa.
   El ingreso se hace desde el portal único (portal.html). */
(function () {
  "use strict";
  var E = window.PPM_EDITOR_GRUPO, P = window.PPM_PLAN, I = window.PPM_INSTRUMENTO;
  var estado = { cuenta: null, tablero: null, empresas: [], grupos: [], ies: [] };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var escapar = E.escapar;
  var vistas = ["cargando", "login", "panel"];
  var ESTADOS_EMPRESA = { registrado: "Registrada sin clave", clave_creada: "Con clave, sin aceptar términos", aceptado: "Términos aceptados", diagnostico_completado: "Diagnóstico completado", declinado: "Declinó" };

  function mostrar(nombre) {
    vistas.forEach(function (v) { var el = $("#vista-" + v); if (el) el.hidden = v !== nombre; });
    $("#boton-salir").hidden = !estado.cuenta;
  }
  function aviso(cont, tono, html) { if (cont) cont.innerHTML = html ? "<div class='aviso aviso--" + tono + "' role='status'><svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><circle cx='12' cy='12' r='10'/><path d='M12 8v4M12 16h.01'/></svg><div>" + html + "</div></div>" : ""; }
  function api(metodo, ruta, cuerpo) {
    var op = { method: metodo, headers: { "Accept": "application/json" }, credentials: "same-origin" };
    if (cuerpo !== undefined) { op.headers["Content-Type"] = "application/json"; op.body = JSON.stringify(cuerpo); }
    return fetch(ruta, op).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j._estado = r.status; if (!r.ok) throw j; return j; }); });
  }
  function ocupado(form, si) { var b = form.querySelector("button[type=submit]"); if (!b) return; b.disabled = si; b.textContent = si ? "Guardando…" : (b.getAttribute("data-texto") || b.textContent); }
  function fecha(iso) { return iso ? String(iso).slice(0, 10) : ""; }
  function fechaHora(iso) { return iso ? String(iso).slice(0, 16).replace("T", " ") : ""; }
  function coincide(texto, filtro) { return !filtro || String(texto || "").toLowerCase().indexOf(filtro.toLowerCase()) >= 0; }

  /* ---------- Sesión ---------- */
  function arrancar() {
    api("GET", "/api/sesion").then(function (r) {
      if (r.tipo !== "secretaria") { window.location.href = r.destino || "portal.html"; return; }
      estado.cuenta = r.cuenta; return cargar().then(function () { mostrar("panel"); });
    }).catch(function () { estado.cuenta = null; mostrar("login"); });
  }
  function cargar() {
    return api("GET", "/api/secretaria?vista=resumen").then(function (r) {
      estado.tablero = r.tablero; estado.empresas = r.empresas; estado.grupos = r.grupos; estado.ies = r.ies;
      $("#st-meta").textContent = "Corte: " + fechaHora(r.tablero.fecha).replace(" ", " a las ") + " (UTC) · sesión de " + estado.cuenta.correo;
      pintarTablero(); pintarEmpresas(); pintarGrupos(); pintarIes(); pintarAsignacion();
    }).catch(function (e) { aviso($("#st-aviso"), "rojo", escapar(e.error || "No fue posible cargar el tablero.")); if (e._estado === 401) mostrar("login"); });
  }
  $("#boton-salir").addEventListener("click", function () { api("DELETE", "/api/sesion").then(function () { window.location.href = "portal.html"; }); });
  $("#st-refrescar").addEventListener("click", function () { cargar(); });

  /* ---------- Pestañas ---------- */
  function pestana(nombre) {
    $$(".pestana").forEach(function (b) { b.classList.toggle("activo", b.getAttribute("data-pestana") === nombre); });
    ["empresas", "grupos", "ies", "asignacion"].forEach(function (p) { $("#pan-" + p).hidden = p !== nombre; });
  }
  $$(".pestana").forEach(function (b) { b.addEventListener("click", function () { pestana(b.getAttribute("data-pestana")); }); });

  /* ---------- Tablero ---------- */
  function pintarTablero() {
    var t = estado.tablero, e = t.empresas, g = t.grupos, i = t.ies;
    var tarjeta = function (valor, etiqueta, alerta) { return "<div class='tablero__tarjeta'><div class='tablero__valor" + (alerta ? " tablero__valor--alerta" : "") + "'>" + valor + "</div><div class='tablero__etiqueta'>" + etiqueta + "</div></div>"; };
    $("#tablero").innerHTML =
      tarjeta(e.total, "empresas inscritas" + (e.porEstado.declinado ? " (" + e.porEstado.declinado + " declinaron)" : "")) +
      tarjeta(e.aceptadas, "aceptaron los términos") +
      tarjeta(e.diagnosticosCompletados, "autodiagnósticos completados") +
      tarjeta(e.sinAsignar, "empresas listas sin grupo", e.sinAsignar > 0) +
      tarjeta(i.total, "instituciones vinculadas (" + i.conCoordinador + " con coordinador activo)") +
      tarjeta(g.activos, "grupos activos" + (g.porEstado.cancelado ? " (" + g.porEstado.cancelado + " cancelados)" : "")) +
      tarjeta(g.personas, "personas en los grupos") +
      tarjeta(g.listosParaAsignar, "grupos aprobados sin empresa", g.listosParaAsignar > 0) +
      tarjeta(g.asignados, "emparejamientos vigentes");
  }

  /* ---------- Empresas ---------- */
  function pintarEmpresas() {
    var f = $("#f-empresas").value.trim(), fe = $("#f-empresas-estado").value;
    var lista = estado.empresas.filter(function (e) { return (!fe || e.estado === fe) && (coincide([e.empresa, e.municipio, e.departamento, e.correo, e.contacto, e.nit].join(" "), f)); });
    $("#t-empresas tbody").innerHTML = lista.length ? lista.map(function (e) {
      var d = e.diagnostico || {};
      return "<tr><td><strong>" + escapar(e.empresa) + "</strong><br><small>" + escapar(e.nit || "") + " · inscrita " + fecha(e.creado) + "</small></td><td>" + escapar(e.municipio) + (e.departamento ? "<br><small>" + escapar(e.departamento) + "</small>" : "") + "</td><td>" + escapar(e.sector) + "<br><small>" + escapar(e.tamano) + "</small></td><td>" + escapar(e.contacto) + "<br><small>" + escapar(e.correo) + " · " + escapar(e.telefono) + "</small></td><td>" + escapar(ESTADOS_EMPRESA[e.estado] || e.estado) + "</td><td>" + (d.completado ? "v" + d.version + " · " + Number(d.global).toFixed(2) + " · " + escapar(d.nivel) : (d.paso ? "paso " + d.paso : "sin iniciar")) + "</td><td>" + (e.grupoAsignado ? escapar(e.grupoAsignado.nombre) + "<br><small>" + escapar(e.grupoAsignado.ies) + "</small>" : "—") + "</td><td><button class='enlace' type='button' data-empresa='" + escapar(e.id) + "'>Ver</button>" + (e.informe ? " · <a href='/api/informe?id=" + encodeURIComponent(e.id) + "' download>PDF</a>" : "") + "</td></tr>";
    }).join("") : "<tr><td colspan='8'>No hay empresas en esta vista.</td></tr>";
  }
  $("#f-empresas").addEventListener("input", pintarEmpresas);
  $("#f-empresas-estado").addEventListener("change", pintarEmpresas);

  function detalleEmpresa(id) {
    api("GET", "/api/secretaria?vista=empresa&id=" + encodeURIComponent(id)).then(function (r) {
      var e = r.empresa, d = e.datos || {}, dg = e.diagnostico || {}, res = dg.resultados;
      var html = "<div class='ficha ficha--blanca'>" + Object.keys(d).filter(function (k) { return d[k]; }).map(function (k) { return "<div><span class='ficha__k'>" + escapar(k.replace(/_/g, " ")) + "</span><span class='ficha__v'>" + escapar(Array.isArray(d[k]) ? d[k].join(", ") : d[k]) + "</span></div>"; }).join("") + "</div>";
      html += "<p class='diag__nota'>Estado: " + escapar(ESTADOS_EMPRESA[e.estado] || e.estado) + " · Inscrita: " + fechaHora(e.creado) + (e.aceptaciones && e.aceptaciones.terminos ? " · Términos aceptados el " + fechaHora(e.aceptaciones.terminos.fecha || e.aceptaciones.fecha) + (e.aceptaciones.nombreFirma ? " por " + escapar(e.aceptaciones.nombreFirma) : "") : " · Sin aceptar los términos") + "</p>";
      if ((e.actualizacionesDatos || []).length) html += "<p class='diag__nota'>Actualizaciones de datos: " + e.actualizacionesDatos.map(function (a) { return fechaHora(a.fecha) + " (" + escapar((a.campos || []).join(", ")) + ")"; }).join("; ") + "</p>";
      if (dg.completado && res) {
        html += "<h3>Autodiagnóstico · versión " + (dg.version || 1) + " · " + fecha(dg.finalizado) + "</h3><div class='res__global'><div class='res__num'>" + res.global.toFixed(2) + "<span>/ 5</span></div><div><div class='res__nivel'>" + escapar(res.nivelGlobal) + "</div></div></div>";
        html += "<div class='tabla-envoltura'><table><thead><tr><th>Capacidad</th><th>Ponderado</th><th>Nivel</th></tr></thead><tbody>" + res.capacidades.map(function (c) { return "<tr><td>" + escapar(c.nombre) + "</td><td>" + c.ponderado.toFixed(2) + "</td><td>" + escapar(c.nivel) + "</td></tr>"; }).join("") + "</tbody></table></div>";
        if ((dg.actualizaciones || []).length) html += "<p class='diag__nota'>Actualizaciones del autodiagnóstico: " + dg.actualizaciones.map(function (a) { return fechaHora(a.fecha) + (a.aplicada ? " (v" + a.version + ")" : " (pendiente)"); }).join("; ") + "</p>";
        html += "<div class='formulario__acciones'><a class='boton boton--primario boton--peq' href='/api/informe?id=" + encodeURIComponent(e.id) + "' download>Descargar el informe (PDF)</a></div>";
      } else {
        html += "<p class='diag__nota'>Autodiagnóstico " + (dg.paso ? "en curso (paso " + dg.paso + ")" : "sin iniciar") + ".</p>";
      }
      if (e.grupoAsignado) html += "<p><strong>Grupo padrino:</strong> " + escapar(e.grupoAsignado.nombre) + " · " + escapar(e.grupoAsignado.ies) + " · líder " + escapar(e.grupoAsignado.lider.nombre) + " (" + escapar(e.grupoAsignado.lider.correo) + ") · desde " + fecha(e.grupoAsignado.fecha) + "</p>";
      abrirModal(d.empresa || "Empresa", html);
    }).catch(function (e) { window.alert(e.error || "No fue posible cargar la empresa."); });
  }

  /* ---------- Grupos ---------- */
  function pintarGrupos() {
    var f = $("#f-grupos").value.trim(), fe = $("#f-grupos-estado").value;
    var lista = estado.grupos.filter(function (g) { return (!fe || g.estado === fe) && coincide([g.nombre, g.ies, g.lider.nombre, g.lider.correo, g.area].join(" "), f); });
    $("#t-grupos tbody").innerHTML = lista.length ? lista.map(function (g) {
      return "<tr><td><strong>" + escapar(g.nombre) + "</strong><br><small>registrado " + fecha(g.creado) + "</small></td><td>" + escapar(g.ies) + (g.coordinadorVinculado ? "" : "<br><small>sin coordinador vinculado</small>") + "</td><td>" + escapar(g.area) + "</td><td>" + escapar(g.lider.nombre) + "<br><small>" + escapar(g.lider.correo) + " · " + escapar(g.lider.telefono) + "</small></td><td>" + g.personas + "<br><small>" + g.confirmados + " de " + g.integrantes.length + " confirmados</small></td><td><span class='grupo__estado grupo__estado--" + escapar(g.estado) + "'>" + escapar(g.estadoTexto) + "</span></td><td>" + (g.empresaAsignada ? escapar(g.empresaAsignada.nombre) : "—") + "</td><td><button class='enlace' type='button' data-grupo='" + escapar(g.id) + "'>Ver</button></td></tr>";
    }).join("") : "<tr><td colspan='8'>No hay grupos en esta vista.</td></tr>";
  }
  $("#f-grupos").addEventListener("input", pintarGrupos);
  $("#f-grupos-estado").addEventListener("change", pintarGrupos);

  function detalleGrupo(id) {
    api("GET", "/api/secretaria?vista=grupo&id=" + encodeURIComponent(id)).then(function (r) {
      var g = r.grupo;
      var persona = function (p, rol, m) { return "<li><span class='quien'><strong>" + escapar(p.nombre) + "</strong> · " + rol + " · " + escapar(p.vinculacion) + "<small>" + escapar(p.correo) + " · " + escapar(p.telefono) + "</small></span>" + (m ? E.etiquetaEstado({ estado: m.estado, estadoTexto: window.PPM_GRUPOS.ESTADOS_INTEGRANTE[m.estado] || m.estado }) : "<span class='estado estado--confirmado'>Líder</span>") + "</li>"; };
      var html = "<p class='diag__nota'>" + escapar(g.ies.nombre) + " · " + escapar(g.area) + " · <span class='grupo__estado grupo__estado--" + escapar(g.estado) + "'>" + escapar(window.PPM_GRUPOS.ESTADOS[g.estado] || g.estado) + "</span></p>";
      html += "<ul class='grupo__personas'>" + persona(g.lider, "Líder") + g.integrantes.map(function (m) { return persona(m, "Integrante", m); }).join("") + "</ul>";
      if (g.confirmaciones && g.confirmaciones.coordinador) html += "<p class='diag__nota'>Aprobado por " + escapar(g.confirmaciones.coordinador.nombre || "el coordinador") + " el " + fecha(g.confirmaciones.coordinador.fecha) + ".</p>";
      if (g.empresaAsignada) {
        html += "<h3>Plan de trabajo con " + escapar(g.empresaAsignada.nombre) + "</h3>" + P.tablaHtml(g.plan || { actividades: [] }, g, { nombre: g.empresaAsignada.nombre });
        html += "<div class='formulario__acciones'><a class='boton boton--primario boton--peq' href='/api/informe?tipo=plan&grupo=" + encodeURIComponent(g.id) + "' download>Descargar el plan (PDF)</a></div>";
      }
      abrirModal(g.nombre, html);
    }).catch(function (e) { window.alert(e.error || "No fue posible cargar el grupo."); });
  }

  /* ---------- Instituciones ---------- */
  function pintarIes() {
    var f = $("#f-ies").value.trim();
    var lista = estado.ies.filter(function (i) { return coincide([i.nombre, i.municipio, i.coordinador.nombre, i.correo].join(" "), f); });
    $("#t-ies tbody").innerHTML = lista.length ? lista.map(function (i) {
      return "<tr><td><strong>" + escapar(i.nombre) + "</strong><br><small>" + escapar([i.caracter, i.sector, i.codigo ? "SNIES " + i.codigo : ""].filter(Boolean).join(" · ")) + "</small></td><td>" + escapar(i.municipio) + "</td><td>" + escapar(i.coordinador.nombre) + (i.coordinador.cargo ? "<br><small>" + escapar(i.coordinador.cargo) + "</small>" : "") + "</td><td>" + escapar(i.correo) + (i.coordinador.telefono ? "<br><small>" + escapar(i.coordinador.telefono) + "</small>" : "") + (i.tieneClave ? "" : "<br><small>sin clave creada</small>") + "</td><td>" + i.grupos + "<br><small>" + i.gruposConfirmados + " aprobados</small></td><td>" + i.personas + "</td><td><button class='enlace' type='button' data-ies='" + escapar(i.id) + "'>Editar coordinador</button></td></tr>";
    }).join("") : "<tr><td colspan='7'>No hay instituciones vinculadas.</td></tr>";
  }
  $("#f-ies").addEventListener("input", pintarIes);

  function editarIes(id) {
    var i = estado.ies.filter(function (x) { return x.id === id; })[0];
    if (!i) return;
    var html = "<form class='formulario' id='form-ies' novalidate><div class='campos'>" +
      "<div class='campo'><label for='i-nombre'>Nombre del coordinador *</label><input type='text' id='i-nombre' name='responsable_nombre' value='" + escapar(i.coordinador.nombre) + "' required></div>" +
      "<div class='campo'><label for='i-cargo'>Cargo</label><input type='text' id='i-cargo' name='responsable_cargo' value='" + escapar(i.coordinador.cargo) + "'></div>" +
      "<div class='campo'><label for='i-telefono'>Teléfono</label><input type='tel' id='i-telefono' name='responsable_telefono' value='" + escapar(i.coordinador.telefono) + "'></div>" +
      "<div class='campo'><label>Correo (usuario de la cuenta)</label><input type='email' value='" + escapar(i.correo) + "' readonly><span class='ayuda'>Para cambiar el correo, la institución debe vincularse de nuevo con el nuevo coordinador.</span></div>" +
      "</div><div class='formulario__acciones'><button class='boton boton--primario' type='submit' data-texto='Guardar'>Guardar</button></div><div class='formulario__estado' aria-live='polite'></div></form>";
    abrirModal("Coordinador de " + i.nombre, html);
    $("#form-ies").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var form = ev.target, est = $(".formulario__estado", form);
      if (!form.responsable_nombre.value.trim()) { aviso(est, "rojo", "Indique el nombre del coordinador."); return; }
      ocupado(form, true);
      api("PUT", "/api/secretaria?vista=ies", { id: id, responsable_nombre: form.responsable_nombre.value.trim(), responsable_cargo: form.responsable_cargo.value.trim(), responsable_telefono: form.responsable_telefono.value.trim() })
        .then(function (r) { estado.ies = estado.ies.map(function (x) { return x.id === id ? r.ies : x; }); pintarIes(); aviso(est, "verde", "<strong>Datos del coordinador actualizados.</strong>"); })
        .catch(function (e) { aviso(est, "rojo", escapar(e.error || "No fue posible guardar.")); })
        .then(function () { ocupado(form, false); });
    });
  }

  /* ---------- Emparejamiento ---------- */
  function pintarAsignacion() {
    var gruposListos = estado.grupos.filter(function (g) { return g.estado === "confirmado"; });
    var empresasListas = estado.empresas.filter(function (e) { return e.aceptado && !e.grupoAsignado && e.estado !== "declinado"; });
    $("#a-grupo").innerHTML = "<option value=''>Seleccione…</option>" + gruposListos.map(function (g) { return "<option value='" + escapar(g.id) + "'>" + escapar(g.nombre) + " · " + escapar(g.ies) + " · " + escapar(g.area) + "</option>"; }).join("");
    $("#a-empresa").innerHTML = "<option value=''>Seleccione…</option>" + empresasListas.map(function (e) { return "<option value='" + escapar(e.id) + "'>" + escapar(e.empresa) + " · " + escapar(e.municipio) + " · " + escapar(e.frente || "") + (e.diagnostico.completado ? " · diagnóstico " + Number(e.diagnostico.global).toFixed(2) : " · sin diagnóstico") + "</option>"; }).join("");
    var asignados = estado.grupos.filter(function (g) { return g.estado === "asignado"; });
    $("#t-asignados tbody").innerHTML = asignados.length ? asignados.map(function (g) {
      return "<tr><td>" + escapar(g.nombre) + "</td><td>" + escapar(g.ies) + "</td><td>" + escapar(g.empresaAsignada && g.empresaAsignada.nombre) + "</td><td>" + fecha(g.empresaAsignada && g.empresaAsignada.fecha) + "</td><td>" + g.actividades + "</td><td><button class='enlace' type='button' data-grupo='" + escapar(g.id) + "'>Ver</button> · <button class='enlace' type='button' data-desasignar='" + escapar(g.id) + "'>Deshacer</button></td></tr>";
    }).join("") : "<tr><td colspan='6'>Aún no hay emparejamientos.</td></tr>";
  }
  $("#form-asignar").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var form = ev.target, est = $(".formulario__estado", form), g = $("#a-grupo").value, e = $("#a-empresa").value;
    if (!g || !e) { aviso(est, "rojo", "Seleccione el grupo y la empresa."); return; }
    if (!window.confirm("¿Asignar el grupo seleccionado a esta empresa? Ambos recibirán un correo con los datos de contacto.")) return;
    ocupado(form, true); aviso(est, "", "");
    api("POST", "/api/secretaria?accion=asignar", { grupoId: g, empresaId: e })
      .then(function (r) { aviso(est, "verde", "<strong>Emparejamiento realizado.</strong> Correo al líder: " + (r.correos.lider ? "enviado" : "falló") + " · a la empresa: " + (r.correos.empresa ? "enviado" : "falló") + "."); return cargar(); })
      .catch(function (err) { aviso(est, "rojo", escapar(err.error || "No fue posible asignar.")); })
      .then(function () { ocupado(form, false); });
  });

  /* ---------- Acciones en las tablas y modal ---------- */
  document.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-empresa], button[data-grupo], button[data-ies], button[data-desasignar]");
    if (!b) return;
    if (b.hasAttribute("data-empresa")) return detalleEmpresa(b.getAttribute("data-empresa"));
    if (b.hasAttribute("data-grupo")) return detalleGrupo(b.getAttribute("data-grupo"));
    if (b.hasAttribute("data-ies")) return editarIes(b.getAttribute("data-ies"));
    if (b.hasAttribute("data-desasignar")) {
      if (!window.confirm("¿Deshacer este emparejamiento? El grupo volverá a estar disponible y la empresa quedará sin grupo.")) return;
      api("POST", "/api/secretaria?accion=desasignar", { grupoId: b.getAttribute("data-desasignar") }).then(function () { return cargar(); }).catch(function (err) { window.alert(err.error || "No fue posible deshacer."); });
    }
  });
  function abrirModal(titulo, html) { $("#modal-titulo").textContent = titulo; $("#modal-cuerpo").innerHTML = html; $("#modal").hidden = false; }
  $("#modal-cerrar").addEventListener("click", function () { $("#modal").hidden = true; });
  $("#modal").addEventListener("click", function (e) { if (e.target === $("#modal")) $("#modal").hidden = true; });

  /* ---------- Clave ---------- */
  $("#st-clave-abrir").addEventListener("click", function () { $("#st-clave").hidden = false; $("#st-clave").scrollIntoView({ behavior: "smooth" }); });
  $("#st-clave-cerrar").addEventListener("click", function () { $("#st-clave").hidden = true; });
  $("#form-cambiar-clave").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var f = ev.target, est = $(".formulario__estado", f), clave = f.clave.value, conf = f.confirmacion.value;
    var ok = clave.length >= 8 && /[a-zA-Z]/.test(clave) && /[0-9]/.test(clave);
    if (!f.claveActual.value || !ok || conf !== clave) { aviso(est, "rojo", "Revise la clave actual, la nueva (mínimo 8 caracteres con letras y números) y su confirmación."); return; }
    ocupado(f, true); aviso(est, "", "");
    api("PUT", "/api/clave", { claveActual: f.claveActual.value, clave: clave, confirmacion: conf })
      .then(function () { f.reset(); aviso(est, "verde", "<strong>Clave actualizada.</strong>"); })
      .catch(function (e) { aviso(est, "rojo", escapar(e.error || "No fue posible cambiar la clave.")); })
      .then(function () { ocupado(f, false); });
  });

  var toggle = $(".nav-toggle"), nav = $(".nav");
  if (toggle && nav) toggle.addEventListener("click", function () { var abierto = nav.classList.toggle("abierto"); toggle.setAttribute("aria-expanded", abierto ? "true" : "false"); });
  $$("[data-anio]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
  arrancar();
})();
