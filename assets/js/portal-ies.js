/* Portal de instituciones (coordinador): tablero de control y gestión de los grupos que apadrinan. */
(function () {
  "use strict";
  var E = window.PPM_EDITOR_GRUPO, CAT = window.PPM_GRUPOS;
  var estado = { ies: null, grupos: [], tablero: null, filtro: "activos", editando: null };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var escapar = E.escapar;
  var vistas = ["cargando", "login", "panel", "grupo"];

  function mostrar(nombre) {
    vistas.forEach(function (v) { var el = $("#vista-" + v); if (el) el.hidden = v !== nombre; });
    $("#boton-salir").hidden = !estado.ies;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function aviso(cont, tono, html) { if (cont) cont.innerHTML = html ? "<div class='aviso aviso--" + tono + "' role='status'><svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><circle cx='12' cy='12' r='10'/><path d='M12 8v4M12 16h.01'/></svg><div>" + html + "</div></div>" : ""; }
  function api(metodo, ruta, cuerpo) {
    var op = { method: metodo, headers: { "Accept": "application/json" }, credentials: "same-origin" };
    if (cuerpo !== undefined) { op.headers["Content-Type"] = "application/json"; op.body = JSON.stringify(cuerpo); }
    return fetch(ruta, op).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j._estado = r.status; if (!r.ok) throw j; return j; }); });
  }
  function ocupado(form, si) { var b = form.querySelector("button[type=submit]"); if (!b) return; b.disabled = si; b.textContent = si ? "Guardando…" : (b.getAttribute("data-texto") || b.textContent); }

  /* ---------- Sesión ---------- */
  function arrancar() {
    api("GET", "/api/sesion").then(function (r) {
      if (r.tipo !== "ies") { estado.ies = null; mostrar("login"); return; }
      estado.ies = r.ies; return cargarGrupos().then(function () { pintarCabecera(); mostrar("panel"); });
    }).catch(function () { estado.ies = null; mostrar("login"); });
  }
  function cargarGrupos() {
    return api("GET", "/api/grupos").then(function (r) { estado.grupos = r.grupos; estado.tablero = r.tablero; pintarTablero(); pintarGrupos(); });
  }
  $("#form-login").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var form = ev.target, est = $(".formulario__estado", form);
    var correo = form.correo.value.trim(), clave = form.clave.value;
    if (!correo || !clave) { aviso(est, "rojo", "Indique su correo y su clave."); return; }
    ocupado(form, true); aviso(est, "", "");
    api("POST", "/api/sesion", { correo: correo, clave: clave, tipo: "ies" })
      .then(function (r) { estado.ies = r.ies; form.reset(); return cargarGrupos().then(function () { pintarCabecera(); mostrar("panel"); }); })
      .catch(function (e) { aviso(est, "rojo", escapar(e.error || "No fue posible iniciar sesión.")); })
      .then(function () { ocupado(form, false); });
  });
  $("#boton-salir").addEventListener("click", function () { api("DELETE", "/api/sesion").then(function () { estado.ies = null; estado.grupos = []; mostrar("login"); }); });

  /* ---------- Tablero ---------- */
  function pintarCabecera() {
    var i = estado.ies, inst = i.institucion || {}, r = i.responsable || {};
    $("#panel-ies-nombre").textContent = inst.nombre || "Institución";
    $("#panel-ies-meta").textContent = [inst.caracter, inst.sector, [inst.municipio, inst.departamento].filter(Boolean).join(", "), inst.codigo ? "Código SNIES " + inst.codigo : ""].filter(Boolean).join(" · ");
    $("#panel-responsable").textContent = "Coordinador: " + (r.nombre || "") + (r.cargo ? ", " + r.cargo : "") + " · " + i.correo;
  }
  function pintarTablero() {
    var t = estado.tablero || { grupos: 0, activos: 0, porEstado: {}, personasTotal: 0, personasConfirmadas: 0, integrantesPendientes: 0 };
    var tarjeta = function (valor, etiqueta, alerta) { return "<div class='tablero__tarjeta'><div class='tablero__valor" + (alerta ? " tablero__valor--alerta" : "") + "'>" + valor + "</div><div class='tablero__etiqueta'>" + etiqueta + "</div></div>"; };
    $("#tablero").innerHTML =
      tarjeta(t.activos, "grupos activos" + (t.porEstado.cancelado ? " (" + t.porEstado.cancelado + " cancelados)" : "")) +
      tarjeta(t.personasTotal, "personas participando (líderes e integrantes)") +
      tarjeta(t.personasConfirmadas, "personas confirmadas") +
      tarjeta(t.porEstado.integrantes_confirmados || 0, "grupos listos para su confirmación", (t.porEstado.integrantes_confirmados || 0) > 0) +
      tarjeta(t.porEstado.confirmado || 0, "grupos confirmados") +
      tarjeta(t.integrantesPendientes, "integrantes sin confirmar", t.integrantesPendientes > 0);
  }

  function filtrados() {
    var f = estado.filtro;
    return estado.grupos.filter(function (g) { return f === "todos" ? true : (f === "activos" ? g.estado !== "cancelado" : g.estado === f); });
  }
  function personaHtml(p, rol, m) {
    return "<li><span class='quien'><strong>" + escapar(p.nombre) + "</strong> · " + escapar(rol) + " · " + escapar(p.vinculacion) + "<small>" + escapar(p.correo) + " · " + escapar(p.telefono) + "</small></span>" + (m ? E.etiquetaEstado(m) : "<span class='estado estado--confirmado'>Líder</span>") + "</li>";
  }
  function pintarGrupos() {
    var cont = $("#lista-grupos"), lista = filtrados();
    if (!lista.length) { cont.innerHTML = "<div class='grupos__vacio'><strong>No hay grupos en esta vista.</strong><br>Los líderes registran sus grupos en <a href='grupos.html'>el formulario público</a>; aquí aparecerán con el estado de las confirmaciones.</div>"; return; }
    cont.innerHTML = lista.map(function (g) {
      var confirmados = g.integrantes.filter(function (m) { return m.estado === "confirmado"; }).length;
      var acciones = "";
      if (g.estado !== "cancelado") {
        acciones += "<button class='boton boton--contorno boton--peq' type='button' data-editar='" + escapar(g.id) + "'>Editar / cambiar integrantes</button>";
        if (g.estado === "integrantes_confirmados") acciones += "<button class='boton boton--primario boton--peq' type='button' data-confirmar='" + escapar(g.id) + "'>Confirmar el grupo</button>";
        if (g.estado === "registrado") acciones += "<button class='boton boton--primario boton--peq' type='button' data-confirmar='" + escapar(g.id) + "' disabled title='Faltan integrantes por confirmar'>Confirmar el grupo</button>";
        acciones += "<button class='boton boton--contorno boton--peq' type='button' data-cancelar='" + escapar(g.id) + "'>Cancelar el grupo</button>";
      }
      return "<article class='grupo grupo--ancho' data-id='" + escapar(g.id) + "'>" +
        "<div class='grupo__cabecera'><h3>" + escapar(g.nombre) + "</h3><span class='grupo__estado grupo__estado--" + escapar(g.estado) + "'>" + escapar(g.estadoTexto) + "</span></div>" +
        "<div class='grupo__campo'>" + escapar(g.area) + "</div>" +
        "<dl><dt>Registrado</dt><dd>" + escapar((g.creado || "").slice(0, 10)) + "</dd><dt>Personas</dt><dd>" + (1 + g.integrantes.length) + " · " + confirmados + " de " + g.integrantes.length + " integrantes confirmados</dd>" +
        (g.confirmaciones && g.confirmaciones.coordinador ? "<dt>Confirmado</dt><dd>" + escapar(g.confirmaciones.coordinador.fecha.slice(0, 10)) + " por " + escapar(g.confirmaciones.coordinador.nombre || "") + "</dd>" : "") +
        (g.cancelacion ? "<dt>Cancelado</dt><dd>" + escapar(g.cancelacion.fecha.slice(0, 10)) + (g.cancelacion.motivo ? " · " + escapar(g.cancelacion.motivo) : "") + "</dd>" : "") + "</dl>" +
        "<ul class='grupo__personas'>" + personaHtml(g.lider, "Líder") + g.integrantes.map(function (m) { return personaHtml(m, "Integrante", m); }).join("") + "</ul>" +
        "<div class='grupo__acciones'>" + acciones + "</div></article>";
    }).join("");
  }
  $("#filtro-estado").addEventListener("change", function () { estado.filtro = this.value; pintarGrupos(); });

  function grupoPorId(id) { return estado.grupos.filter(function (g) { return g.id === id; })[0]; }
  function refrescar(r, mensaje) {
    return cargarGrupos().then(function () { if (mensaje) window.alert(mensaje); });
  }

  $("#lista-grupos").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-editar], button[data-confirmar], button[data-cancelar]");
    if (!b || b.disabled) return;
    var id = b.getAttribute("data-editar") || b.getAttribute("data-confirmar") || b.getAttribute("data-cancelar");
    var g = grupoPorId(id);
    if (!g) return;
    if (b.hasAttribute("data-editar")) { abrirEditor(g); return; }
    if (b.hasAttribute("data-confirmar")) {
      if (!window.confirm("¿Confirmar el grupo \"" + g.nombre + "\"? La secretaría técnica iniciará la asignación de la empresa.")) return;
      b.disabled = true;
      api("POST", "/api/grupos?accion=confirmar-grupo", { id: id }).then(function () { return cargarGrupos(); })
        .catch(function (err) { window.alert(err.error || "No fue posible confirmar el grupo."); b.disabled = false; });
      return;
    }
    var motivo = window.prompt("Motivo de la cancelación del grupo \"" + g.nombre + "\" (se enviará al líder):", "");
    if (motivo === null) return;
    b.disabled = true;
    api("POST", "/api/grupos?accion=cancelar", { id: id, motivo: motivo }).then(function () { return cargarGrupos(); })
      .catch(function (err) { window.alert(err.error || "No fue posible cancelar el grupo."); b.disabled = false; });
  });

  /* ---------- Editor ---------- */
  var form = $("#form-grupo");
  function abrirEditor(g) {
    estado.editando = g;
    $("#e-id").value = g.id;
    $("#grupo-titulo").textContent = "Editar el grupo " + g.nombre;
    E.montar(form, g);
    aviso($(".formulario__estado", form), "", "");
    mostrar("grupo");
  }
  $("#e-cancelar").addEventListener("click", function () { mostrar("panel"); });
  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var est = $(".formulario__estado", form);
    if (!E.validar(form)) { var primero = $(".invalido", form) || $("#e-integrantes-error"); if (primero) primero.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    var carga = E.recoger(form); carga.id = $("#e-id").value;
    ocupado(form, true); aviso(est, "", "");
    api("PUT", "/api/grupos", carga)
      .then(function () { return cargarGrupos(); }).then(function () { mostrar("panel"); })
      .catch(function (e) { aviso(est, "rojo", "<strong>" + escapar(e.error || "No fue posible guardar.") + "</strong>" + (e.campos ? " Campos: " + escapar(e.campos.join(", ")) : "")); })
      .then(function () { ocupado(form, false); });
  });
  form.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-reenviar]");
    if (!b || !estado.editando) return;
    b.disabled = true;
    api("POST", "/api/grupos?accion=reenviar", { id: estado.editando.id, correo: b.getAttribute("data-reenviar") })
      .then(function () { b.textContent = "Invitación reenviada"; })
      .catch(function (err) { b.disabled = false; window.alert(err.error || "No fue posible reenviar la invitación."); });
  });

  var toggle = $(".nav-toggle"), nav = $(".nav");
  if (toggle && nav) toggle.addEventListener("click", function () { var abierto = nav.classList.toggle("abierto"); toggle.setAttribute("aria-expanded", abierto ? "true" : "false"); });
  $$("[data-anio]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
  arrancar();
})();
