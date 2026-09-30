/* Área de trabajo del grupo (líder): confirmaciones e integrantes, empresa apadrinada (solo lectura),
   plan de trabajo y clave. El ingreso se hace desde el portal único (portal.html). */
(function () {
  "use strict";
  var E = window.PPM_EDITOR_GRUPO;
  var estado = { grupo: null, empresa: null };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var escapar = E.escapar;
  var vistas = ["cargando", "login", "panel", "editar"];

  function mostrar(nombre) {
    vistas.forEach(function (v) { var el = $("#vista-" + v); if (el) el.hidden = v !== nombre; });
    $("#boton-salir").hidden = !estado.grupo;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function aviso(cont, tono, html) { if (cont) cont.innerHTML = html ? "<div class='aviso aviso--" + tono + "' role='status'><svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><circle cx='12' cy='12' r='10'/><path d='M12 8v4M12 16h.01'/></svg><div>" + html + "</div></div>" : ""; }
  function api(metodo, ruta, cuerpo) {
    var op = { method: metodo, headers: { "Accept": "application/json" }, credentials: "same-origin" };
    if (cuerpo !== undefined) { op.headers["Content-Type"] = "application/json"; op.body = JSON.stringify(cuerpo); }
    return fetch(ruta, op).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j._estado = r.status; if (!r.ok) throw j; return j; }); });
  }
  function ocupado(form, si) { var b = form.querySelector("button[type=submit]"); if (!b) return; b.disabled = si; b.textContent = si ? "Guardando…" : (b.getAttribute("data-texto") || b.textContent); }

  function arrancar() {
    api("GET", "/api/sesion").then(function (r) {
      if (r.tipo !== "lider") { window.location.href = r.destino || "portal.html"; return; }
      return cargar();
    }).catch(function () { estado.grupo = null; mostrar("login"); });
  }
  function cargar() {
    return api("GET", "/api/grupos").then(function (r) { estado.grupo = r.grupo; estado.empresa = r.empresa; pintar(); pintarEmpresa(); mostrar("panel"); })
      .catch(function (e) { aviso($("#pg-aviso"), "rojo", escapar(e.error || "No fue posible cargar el grupo.")); if (e._estado === 401) mostrar("login"); });
  }
  $("#boton-salir").addEventListener("click", function () { api("DELETE", "/api/sesion").then(function () { estado.grupo = null; window.location.href = "portal.html"; }); });

  /* ---------- Pestañas ---------- */
  function pestana(nombre) {
    $$(".pestana").forEach(function (b) { b.classList.toggle("activo", b.getAttribute("data-pestana") === nombre); });
    ["grupo", "empresa", "plan", "clave"].forEach(function (p) { $("#pan-" + p).hidden = p !== nombre; });
    if (nombre === "plan") cargarPlan();
  }
  $$(".pestana").forEach(function (b) { b.addEventListener("click", function () { pestana(b.getAttribute("data-pestana")); }); });

  function personaHtml(p, rol, m) {
    return "<li><span class='quien'><strong>" + escapar(p.nombre) + "</strong> · " + escapar(rol) + " · " + escapar(p.vinculacion) + "<small>" + escapar(p.correo) + " · " + escapar(p.telefono) + "</small></span>" +
      (m ? "<span>" + E.etiquetaEstado(m) + (m.estado !== "confirmado" && estado.grupo.estado !== "cancelado" ? " <button class='enlace' type='button' data-reenviar='" + escapar(m.correo) + "'>Reenviar invitación</button>" : "") + "</span>" : "<span class='estado estado--confirmado'>Líder</span>") + "</li>";
  }

  function pintar() {
    var g = estado.grupo;
    $("#pg-nombre").textContent = g.nombre;
    $("#pg-meta").textContent = g.ies.nombre + " · " + g.area;
    $("#pg-estado").innerHTML = "<span class='grupo__estado grupo__estado--" + escapar(g.estado) + "'>" + escapar(g.estadoTexto) + "</span>";
    var confirmados = g.integrantes.filter(function (m) { return m.estado === "confirmado"; }).length;
    $("#pg-resumen").textContent = (1 + g.integrantes.length) + " personas · " + confirmados + " de " + g.integrantes.length + " integrantes confirmados";
    $("#pg-editar").hidden = !(g.estado === "registrado" || g.estado === "integrantes_confirmados");
    var pasos = "";
    if (g.estado === "registrado") pasos = "<p><strong>Siguiente paso:</strong> esperar la confirmación de los integrantes. Puede reenviar la invitación a quien no la haya recibido o reemplazar a quien no pueda participar.</p>" + (g.coordinadorVinculado ? "" : "<p>" + escapar(g.ies.nombre) + " aún no tiene coordinador vinculado al Plan; el grupo aparecerá en su tablero cuando se <a href='ies.html#inscripcion'>vincule</a>.</p>");
    else if (g.estado === "integrantes_confirmados") pasos = g.coordinadorVinculado
      ? "<p><strong>Siguiente paso:</strong> todos confirmaron. El coordinador de " + escapar(g.ies.nombre) + " recibió el grupo y debe confirmarlo en el portal de instituciones.</p>"
      : "<p><strong>Todos confirmaron.</strong> " + escapar(g.ies.nombre) + " aún no tiene coordinador vinculado al Plan: pídale al responsable de su institución que la <a href='ies.html#inscripcion'>vincule</a>; en ese momento recibirá el grupo para confirmarlo.</p>";
    else if (g.estado === "confirmado") pasos = "<p><strong>Grupo aprobado</strong> por " + escapar((g.confirmaciones.coordinador || {}).nombre || "el coordinador") + ". La secretaría técnica le asignará la empresa que acompañarán y le avisará por correo.</p>";
    else if (g.estado === "asignado") pasos = "<p><strong>Empresa asignada:</strong> " + escapar((g.empresaAsignada || {}).nombre || "") + " (desde el " + escapar(((g.empresaAsignada || {}).fecha || "").slice(0, 10)) + "). Revise la pestaña <em>Empresa apadrinada</em> para conocer su inscripción y autodiagnóstico, y construya el <em>Plan de trabajo</em> a partir de las sesiones virtuales.</p>";
    else if (g.estado === "cancelado") pasos = "<p><strong>El grupo fue cancelado</strong> por la institución" + ((g.cancelacion || {}).motivo ? ": " + escapar(g.cancelacion.motivo) : "") + ". Si es un error, escriba al coordinador.</p>";
    $("#pg-detalle").innerHTML = pasos + "<h3 style='margin-top:12px'>Personas del grupo</h3><ul class='grupo__personas'>" + personaHtml(g.lider, "Líder") + g.integrantes.map(function (m) { return personaHtml(m, "Integrante", m); }).join("") + "</ul>";
  }

  $("#pg-detalle").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-reenviar]");
    if (!b) return;
    b.disabled = true; b.textContent = "Enviando…";
    api("POST", "/api/grupos?accion=reenviar", { correo: b.getAttribute("data-reenviar") })
      .then(function (r) { estado.grupo = r.grupo; pintar(); aviso($("#pg-aviso"), "verde", "Invitación reenviada a " + escapar(b.getAttribute("data-reenviar")) + "."); })
      .catch(function (e) { if (e.grupo) { estado.grupo = e.grupo; pintar(); } aviso($("#pg-aviso"), "rojo", escapar(e.error || "No fue posible reenviar la invitación.") + (e.causa ? " (" + escapar(e.causa) + ")" : "")); });
  });

  var form = $("#form-grupo");
  $("#pg-editar").addEventListener("click", function () { E.montar(form, estado.grupo); aviso($(".formulario__estado", form), "", ""); mostrar("editar"); });
  $("#e-cancelar").addEventListener("click", function () { mostrar("panel"); });
  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var est = $(".formulario__estado", form);
    if (!E.validar(form)) { var primero = $(".invalido", form) || $("#e-integrantes-error"); if (primero) primero.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    ocupado(form, true); aviso(est, "", "");
    api("PUT", "/api/grupos", E.recoger(form))
      .then(function (r) { estado.grupo = r.grupo; pintar(); mostrar("panel"); aviso($("#pg-aviso"), "verde", "Cambios guardados. Los integrantes nuevos recibieron su invitación."); })
      .catch(function (e) { aviso(est, "rojo", "<strong>" + escapar(e.error || "No fue posible guardar.") + "</strong>" + (e.campos ? " Campos: " + escapar(e.campos.join(", ")) : "")); })
      .then(function () { ocupado(form, false); });
  });
  form.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-reenviar]");
    if (!b || !estado.grupo) return;
    b.disabled = true;
    api("POST", "/api/grupos?accion=reenviar", { correo: b.getAttribute("data-reenviar") })
      .then(function (r) { estado.grupo = r.grupo; b.textContent = "Invitación reenviada"; })
      .catch(function (e) { b.disabled = false; window.alert(e.error || "No fue posible reenviar la invitación."); });
  });

  /* ---------- Empresa apadrinada (solo lectura) ---------- */
  var CAMPOS_EMPRESA = [["empresa", "Empresa"], ["tipo_identificacion", "Tipo de identificación"], ["nit", "Número"], ["tamano", "Tamaño"], ["sector", "Sector"], ["anios_operacion", "Años de operación"], ["departamento", "Departamento"], ["municipio", "Municipio"], ["direccion", "Dirección"], ["camara_comercio", "Cámara de comercio"], ["camara_nombre", "Cámara"], ["estado_operativo", "Estado operativo"], ["empleos_antes", "Empleos antes"], ["empleos_actuales", "Empleos actuales"], ["tipo_afectacion", "Tipo de afectación"], ["descripcion_afectacion", "Descripción de la afectación"], ["frente_prioritario", "Frente prioritario"], ["reto_principal", "Reto principal"], ["contacto_nombre", "Interlocutor"], ["contacto_cargo", "Cargo"], ["contacto_telefono", "Teléfono"], ["contacto_correo", "Correo"], ["disponibilidad", "Disponibilidad"]];
  function pintarEmpresa() {
    var cont = $("#pg-empresa"), e = estado.empresa;
    if (!e) { cont.innerHTML = "<div class='grupos__vacio'><strong>Aún no tienen empresa asignada.</strong><br>Cuando el coordinador apruebe el grupo, la secretaría técnica hará el emparejamiento y le avisará por correo.</div>"; return; }
    var d = e.datos || {}, dg = e.diagnostico || {}, r = dg.resultados;
    var html = "<div class='seccion__cabecera'><span class='sobretitulo'>Empresa apadrinada</span><h2 class='portal__titulo'>" + escapar(d.empresa) + "</h2><p class='entradilla'>Información de la inscripción y del autodiagnóstico, tal como la registró la empresa. Es confidencial y de solo lectura: úsela para preparar las sesiones.</p></div>";
    html += "<div class='ficha ficha--blanca'>" + CAMPOS_EMPRESA.filter(function (c) { return d[c[0]]; }).map(function (c) { var v = d[c[0]]; return "<div><span class='ficha__k'>" + escapar(c[1]) + "</span><span class='ficha__v'>" + escapar(Array.isArray(v) ? v.join(", ") : v) + "</span></div>"; }).join("") + "</div>";
    if (!dg.completado || !r) {
      html += "<div class='grupos__vacio'><strong>La empresa aún no ha finalizado el autodiagnóstico.</strong>" + (dg.paso ? "<br>Va en el paso " + dg.paso + "." : "") + "</div>";
    } else {
      html += "<h3>Autodiagnóstico · versión " + (dg.version || 1) + (dg.finalizado ? " · " + escapar(String(dg.finalizado).slice(0, 10)) : "") + "</h3>";
      html += "<div class='res__global'><div class='res__num'>" + r.global.toFixed(2) + "<span>/ 5</span></div><div><div class='res__nivel'>Nivel global: " + escapar(r.nivelGlobal) + "</div></div></div>";
      html += "<figure class='res__radar'>" + window.PPM_RADAR.svg(r.capacidades) + "<figcaption>Perfil de capacidades en escala 0–5.</figcaption></figure>";
      html += "<div class='tabla-envoltura'><table><thead><tr><th>Capacidad</th><th>Ponderado</th><th>Nivel</th><th>Recomendación</th></tr></thead><tbody>" + r.capacidades.map(function (c) { return "<tr><td>" + escapar(c.nombre) + "</td><td>" + c.ponderado.toFixed(2) + "</td><td>" + escapar(c.nivel) + "</td><td>" + escapar(c.recomendacion) + "</td></tr>"; }).join("") + "</tbody></table></div>";
      var I = window.PPM_INSTRUMENTO;
      if (I && dg.respuestas) {
        html += "<details style='margin-top:12px'><summary><strong>Respuestas por factor</strong></summary><div class='tabla-envoltura' style='margin-top:10px'><table><thead><tr><th>Factor</th><th>Nivel</th><th>Observación</th></tr></thead><tbody>";
        I.CAPACIDADES.forEach(function (cap) {
          html += "<tr><td colspan='3'><strong>" + escapar(cap.nombre) + "</strong></td></tr>";
          cap.factores.forEach(function (f) { html += "<tr><td>" + escapar(f.codigo) + " " + escapar(f.texto) + "</td><td>" + escapar(dg.respuestas[f.codigo] == null ? "" : dg.respuestas[f.codigo]) + "</td><td>" + escapar((dg.observaciones || {})[f.codigo] || "") + "</td></tr>"; });
        });
        html += "</tbody></table></div></details>";
      }
      if ((dg.actualizaciones || []).length) html += "<p class='diag__nota'>La empresa ha registrado " + dg.actualizaciones.length + " actualización(es) del autodiagnóstico; la última el " + escapar(String(dg.actualizaciones[dg.actualizaciones.length - 1].fecha).slice(0, 10)) + ".</p>";
      html += "<div class='formulario__acciones'><a class='boton boton--primario' href='/api/informe' download>Descargar el informe del autodiagnóstico (PDF)</a></div>";
    }
    cont.innerHTML = html;
  }

  /* ---------- Plan de trabajo ---------- */
  var P = window.PPM_PLAN, formPlan = $("#form-plan"), editor = $("#plan-editor");
  estado.responsables = [];
  function cargarPlan() {
    api("GET", "/api/grupos?accion=plan").then(function (r) {
      if (!r.asignado) { formPlan.hidden = true; $("#pg-plan-cabecera").innerHTML = ""; $("#pg-plan-vacio").innerHTML = "<div class='grupos__vacio'><strong>El plan de trabajo se construye cuando el grupo tiene una empresa asignada.</strong></div>"; return; }
      formPlan.hidden = false; $("#pg-plan-vacio").innerHTML = "";
      estado.responsables = r.responsables;
      $("#pg-plan-cabecera").innerHTML = P.cabeceraHtml(r.grupo, r.empresa) + (r.plan.actualizado ? "<p class='diag__nota'>Última actualización: " + escapar(String(r.plan.actualizado).slice(0, 16).replace("T", " ")) + ".</p>" : "");
      P.montarEditor(editor, r.plan, r.responsables);
    }).catch(function (e) { aviso($(".formulario__estado", formPlan), "rojo", escapar(e.error || "No fue posible cargar el plan.")); });
  }
  $("#plan-agregar").addEventListener("click", function () { P.agregarFila(editor, estado.responsables); });
  editor.addEventListener("click", function (e) {
    var b = e.target.closest("[data-quitar]");
    if (!b) return;
    if (!window.confirm("¿Quitar esta actividad del plan?")) return;
    P.quitarFila(editor, Number(b.getAttribute("data-quitar")));
  });
  formPlan.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var est = $(".formulario__estado", formPlan);
    if (!P.validarEditor(editor)) { aviso(est, "rojo", "Cada actividad necesita al menos el nombre de la actividad."); return; }
    ocupado(formPlan, true); aviso(est, "", "");
    api("PUT", "/api/grupos?accion=plan", { actividades: P.recogerEditor(editor) })
      .then(function (r) { estado.responsables = r.responsables; P.montarEditor(editor, r.plan, r.responsables); $("#pg-plan-cabecera").innerHTML = P.cabeceraHtml(r.grupo, r.empresa) + "<p class='diag__nota'>Última actualización: " + escapar(String(r.plan.actualizado).slice(0, 16).replace("T", " ")) + ".</p>"; aviso(est, "verde", "<strong>Plan guardado.</strong> La empresa ya puede consultarlo en su portal."); })
      .catch(function (e) { aviso(est, "rojo", escapar(e.error || "No fue posible guardar el plan.")); })
      .then(function () { ocupado(formPlan, false); });
  });

  /* ---------- Clave ---------- */
  $("#form-cambiar-clave").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var f = ev.target, est = $(".formulario__estado", f), clave = f.clave.value, conf = f.confirmacion.value;
    var ok = clave.length >= 8 && /[a-zA-Z]/.test(clave) && /[0-9]/.test(clave);
    f.claveActual.closest(".campo").classList.toggle("invalido", !f.claveActual.value);
    f.clave.closest(".campo").classList.toggle("invalido", !ok);
    f.confirmacion.closest(".campo").classList.toggle("invalido", conf !== clave);
    if (!f.claveActual.value || !ok || conf !== clave) return;
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
