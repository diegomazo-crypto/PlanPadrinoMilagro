/* Área de trabajo del grupo (líder): estado de las confirmaciones, reenvío de invitaciones y edición. */
(function () {
  "use strict";
  var E = window.PPM_EDITOR_GRUPO;
  var estado = { grupo: null };
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
      if (r.tipo !== "lider") { estado.grupo = null; mostrar("login"); return; }
      return cargar();
    }).catch(function () { estado.grupo = null; mostrar("login"); });
  }
  function cargar() {
    return api("GET", "/api/grupos").then(function (r) { estado.grupo = r.grupo; pintar(); mostrar("panel"); })
      .catch(function (e) { aviso($("#pg-aviso"), "rojo", escapar(e.error || "No fue posible cargar el grupo.")); if (e._estado === 401) mostrar("login"); });
  }

  $("#form-login").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var form = ev.target, est = $(".formulario__estado", form);
    var correo = form.correo.value.trim(), clave = form.clave.value;
    if (!correo || !clave) { aviso(est, "rojo", "Indique su correo y su clave."); return; }
    ocupado(form, true); aviso(est, "", "");
    api("POST", "/api/sesion", { correo: correo, clave: clave, tipo: "lider" })
      .then(function () { form.reset(); return cargar(); })
      .catch(function (e) { aviso(est, "rojo", escapar(e.error || "No fue posible iniciar sesión.")); })
      .then(function () { ocupado(form, false); });
  });
  $("#boton-salir").addEventListener("click", function () { api("DELETE", "/api/sesion").then(function () { estado.grupo = null; mostrar("login"); }); });

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
    if (g.estado === "registrado") pasos = "<p><strong>Siguiente paso:</strong> esperar la confirmación de los integrantes. Puede reenviar la invitación a quien no la haya recibido o reemplazar a quien no pueda participar.</p>";
    else if (g.estado === "integrantes_confirmados") pasos = "<p><strong>Siguiente paso:</strong> todos confirmaron. El coordinador de " + escapar(g.ies.nombre) + " recibió el grupo y debe confirmarlo en el portal de instituciones.</p>";
    else if (g.estado === "confirmado") pasos = "<p><strong>Grupo confirmado</strong> por " + escapar((g.confirmaciones.coordinador || {}).nombre || "el coordinador") + ". La secretaría técnica le asignará la empresa que acompañarán y le avisará por correo.</p>";
    else if (g.estado === "asignado") pasos = "<p><strong>Empresa asignada:</strong> " + escapar((g.empresaAsignada || {}).nombre || "") + ".</p>";
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

  var toggle = $(".nav-toggle"), nav = $(".nav");
  if (toggle && nav) toggle.addEventListener("click", function () { var abierto = nav.classList.toggle("abierto"); toggle.setAttribute("aria-expanded", abierto ? "true" : "false"); });
  $$("[data-anio]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
  arrancar();
})();
