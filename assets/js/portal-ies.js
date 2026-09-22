/* =========================================================
   Portal de instituciones — Plan Padrino Milagro
   Inicio de sesión del responsable y administración de los grupos que apadrinan.
   ========================================================= */
(function () {
  "use strict";
  var estado = { ies: null, grupos: [], editando: null };
  var ROLES = ["Estudiante líder", "Estudiante", "Docente tutor", "Egresado", "Otro"];

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var vistas = ["cargando", "login", "panel", "grupo"];

  function mostrar(nombre) {
    vistas.forEach(function (v) { var el = $("#vista-" + v); if (el) el.hidden = v !== nombre; });
    $("#boton-salir").hidden = !estado.ies;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function escapar(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }

  function aviso(contenedor, tono, html) {
    if (!contenedor) return;
    contenedor.innerHTML = html ? "<div class='aviso aviso--" + tono + "' role='status'><svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><circle cx='12' cy='12' r='10'/><path d='M12 8v4M12 16h.01'/></svg><div>" + html + "</div></div>" : "";
  }

  function api(metodo, ruta, cuerpo) {
    var opciones = { method: metodo, headers: { "Accept": "application/json" }, credentials: "same-origin" };
    if (cuerpo !== undefined) { opciones.headers["Content-Type"] = "application/json"; opciones.body = JSON.stringify(cuerpo); }
    return fetch(ruta, opciones).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (datos) { datos._estado = r.status; if (!r.ok) throw datos; return datos; });
    });
  }

  function ocupado(form, si) {
    var b = form.querySelector("button[type=submit]");
    if (!b) return;
    b.disabled = si;
    b.textContent = si ? "Guardando…" : (b.getAttribute("data-texto") || b.textContent);
  }

  /* ---------- Arranque y sesión ---------- */
  function arrancar() {
    api("GET", "/api/sesion").then(function (r) {
      if (r.tipo !== "ies") { estado.ies = null; mostrar("login"); return; }
      estado.ies = r.ies; estado.grupos = r.ies.grupos || []; pintarPanel(); mostrar("panel");
    }).catch(function () { estado.ies = null; mostrar("login"); });
  }

  $("#form-login").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var form = ev.target, est = $(".formulario__estado", form);
    var correo = form.correo.value.trim(), clave = form.clave.value;
    if (!correo || !clave) { aviso(est, "rojo", "Indique su correo y su clave."); return; }
    ocupado(form, true); aviso(est, "", "");
    api("POST", "/api/sesion", { correo: correo, clave: clave, tipo: "ies" })
      .then(function (r) { estado.ies = r.ies; estado.grupos = r.ies.grupos || []; form.reset(); pintarPanel(); mostrar("panel"); })
      .catch(function (e) { aviso(est, "rojo", escapar(e.error || "No fue posible iniciar sesión.")); })
      .then(function () { ocupado(form, false); });
  });

  $("#boton-salir").addEventListener("click", function () {
    api("DELETE", "/api/sesion").then(function () { estado.ies = null; estado.grupos = []; mostrar("login"); });
  });

  /* ---------- Panel ---------- */
  function pintarPanel() {
    var i = estado.ies, inst = i.institucion || {}, r = i.responsable || {};
    $("#panel-ies-nombre").textContent = inst.nombre || "Institución";
    $("#panel-ies-meta").textContent = [inst.caracter, inst.sector, [inst.municipio, inst.departamento].filter(Boolean).join(", "), inst.codigo ? "Código SNIES " + inst.codigo : (inst.declarada ? "Institución declarada, pendiente de verificación en el SNIES" : "")].filter(Boolean).join(" · ");
    $("#panel-responsable").textContent = "Responsable: " + (r.nombre || "") + (r.cargo ? ", " + r.cargo : "") + " · " + i.correo;
    pintarGrupos();
  }

  function pintarGrupos() {
    var cont = $("#lista-grupos");
    var g = estado.grupos;
    var disponibles = g.filter(function (x) { return x.estado === "disponible"; }).length;
    $("#panel-resumen").textContent = g.length ? g.length + " grupo" + (g.length === 1 ? "" : "s") + " · " + disponibles + " disponible" + (disponibles === 1 ? "" : "s") + " para emparejar" : "Aún no hay grupos. Cree el primero.";
    if (!g.length) {
      cont.innerHTML = "<div class='grupos__vacio'><strong>Aún no ha creado grupos.</strong><br>Cada grupo reúne a los estudiantes y al docente tutor que acompañarán a una empresa. Necesitamos su campo de asesoramiento, modalidad, territorios y contactos para hacer el emparejamiento.</div>";
      return;
    }
    cont.innerHTML = g.map(function (x) {
      var etiqueta = { disponible: "Disponible", asignado: "Asignado", inactivo: "Inactivo" }[x.estado] || x.estado;
      return "<article class='grupo' data-id='" + escapar(x.id) + "'>" +
        "<div class='grupo__cabecera'><h3>" + escapar(x.nombre) + "</h3><span class='grupo__estado grupo__estado--" + escapar(x.estado) + "'>" + etiqueta + "</span></div>" +
        "<div class='grupo__campo'>" + escapar(x.campo) + "</div>" +
        "<dl>" +
        "<dt>Programa</dt><dd>" + escapar(x.programa) + "</dd>" +
        (x.campos_secundarios && x.campos_secundarios.length ? "<dt>También</dt><dd>" + escapar(x.campos_secundarios.join("; ")) + "</dd>" : "") +
        "<dt>Modalidad</dt><dd>" + escapar((x.modalidad || []).join(", ")) + "</dd>" +
        "<dt>Territorios</dt><dd>" + escapar((x.territorios || []).join(", ")) + "</dd>" +
        (x.periodo ? "<dt>Inicio</dt><dd>" + escapar(x.periodo) + "</dd>" : "") +
        "<dt>Capacidad</dt><dd>" + escapar(x.empresas_capacidad) + " empresa" + (x.empresas_capacidad === 1 ? "" : "s") + "</dd>" +
        "<dt>Tutor</dt><dd>" + escapar(x.tutor.nombre) + " · " + escapar(x.tutor.correo) + (x.tutor.telefono ? " · " + escapar(x.tutor.telefono) : "") + "</dd>" +
        "</dl>" +
        "<details><summary>" + x.miembros.length + " miembro" + (x.miembros.length === 1 ? "" : "s") + "</summary><ul class='grupo__miembros'>" +
        x.miembros.map(function (m) { return "<li>" + escapar(m.nombre) + " (" + escapar(m.rol) + (m.programa ? ", " + escapar(m.programa) : "") + (m.semestre ? ", sem. " + escapar(m.semestre) : "") + ")" + (m.correo ? " · " + escapar(m.correo) : "") + (m.telefono ? " · " + escapar(m.telefono) : "") + "</li>"; }).join("") +
        "</ul></details>" +
        "<div class='grupo__acciones'><button class='boton boton--contorno boton--peq' type='button' data-editar='" + escapar(x.id) + "'>Editar</button>" +
        "<button class='boton boton--contorno boton--peq' type='button' data-eliminar='" + escapar(x.id) + "'>Eliminar</button></div>" +
        "</article>";
    }).join("");
  }

  $("#lista-grupos").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-editar], button[data-eliminar]");
    if (!b) return;
    var id = b.getAttribute("data-editar") || b.getAttribute("data-eliminar");
    var grupo = estado.grupos.filter(function (g) { return g.id === id; })[0];
    if (!grupo) return;
    if (b.hasAttribute("data-editar")) { abrirFormulario(grupo); return; }
    if (!window.confirm("¿Eliminar el grupo \"" + grupo.nombre + "\"? Esta acción no se puede deshacer.")) return;
    b.disabled = true;
    api("DELETE", "/api/grupos?id=" + encodeURIComponent(id))
      .then(function (r) { estado.grupos = r.grupos; pintarGrupos(); })
      .catch(function (err) { window.alert(err.error || "No fue posible eliminar el grupo."); b.disabled = false; });
  });

  $("#boton-nuevo-grupo").addEventListener("click", function () { abrirFormulario(null); });
  $("#boton-cancelar-grupo").addEventListener("click", function () { mostrar("panel"); });

  /* ---------- Formulario de grupo ---------- */
  var form = $("#form-grupo");

  function filaMiembro(m) {
    m = m || {};
    var div = document.createElement("div");
    div.className = "miembro";
    div.innerHTML =
      "<div><label>Nombre *</label><input type='text' name='m_nombre' value='" + escapar(m.nombre) + "' placeholder='Nombre completo'></div>" +
      "<div><label>Rol</label><select name='m_rol'>" + ROLES.map(function (r) { return "<option" + (m.rol === r ? " selected" : "") + ">" + r + "</option>"; }).join("") + "</select></div>" +
      "<div><label>Programa</label><input type='text' name='m_programa' value='" + escapar(m.programa) + "'></div>" +
      "<div><label>Semestre</label><input type='text' name='m_semestre' value='" + escapar(m.semestre) + "' placeholder='Ej.: 7'></div>" +
      "<div><label>Correo</label><input type='email' name='m_correo' value='" + escapar(m.correo) + "'></div>" +
      "<div><label>Teléfono</label><input type='tel' name='m_telefono' value='" + escapar(m.telefono) + "'></div>" +
      "<button class='miembro__quitar' type='button' aria-label='Quitar miembro'>Quitar</button>";
    div.querySelector(".miembro__quitar").addEventListener("click", function () { div.remove(); });
    return div;
  }

  $("#boton-agregar-miembro").addEventListener("click", function () {
    var cont = $("#miembros");
    if (cont.children.length >= 12) return;
    var fila = filaMiembro();
    cont.appendChild(fila);
    fila.querySelector("input").focus();
  });

  function abrirFormulario(grupo) {
    estado.editando = grupo;
    form.reset();
    aviso($(".formulario__estado", form), "", "");
    $$(".invalido", form).forEach(function (el) { el.classList.remove("invalido"); });
    $("#grupo-titulo").textContent = grupo ? "Editar el grupo" : "Crear un grupo";
    $("#grupo-id").value = grupo ? grupo.id : "";
    var cont = $("#miembros"); cont.innerHTML = "";
    if (grupo) {
      form.nombre.value = grupo.nombre; form.programa.value = grupo.programa; form.campo.value = grupo.campo;
      form.estado.value = grupo.estado; form.temas.value = grupo.temas || "";
      $$("input[name=campos_secundarios]", form).forEach(function (c) { c.checked = (grupo.campos_secundarios || []).indexOf(c.value) >= 0; });
      $$("input[name=modalidad]", form).forEach(function (c) { c.checked = (grupo.modalidad || []).indexOf(c.value) >= 0; });
      $$("input[name=territorios]", form).forEach(function (c) { c.checked = (grupo.territorios || []).indexOf(c.value) >= 0; });
      form.periodo.value = grupo.periodo || ""; form.empresas_capacidad.value = String(grupo.empresas_capacidad || 1);
      form.disponibilidad.value = grupo.disponibilidad || "";
      form.tutor_nombre.value = grupo.tutor.nombre; form.tutor_cargo.value = grupo.tutor.cargo || "";
      form.tutor_correo.value = grupo.tutor.correo; form.tutor_telefono.value = grupo.tutor.telefono || "";
      form.observaciones.value = grupo.observaciones || "";
      (grupo.miembros || []).forEach(function (m) { cont.appendChild(filaMiembro(m)); });
    } else {
      for (var i = 0; i < 4; i++) cont.appendChild(filaMiembro());
    }
    mostrar("grupo");
  }

  function recogerMiembros() {
    return $$(".miembro", form).map(function (fila) {
      var v = function (n) { var el = fila.querySelector("[name=" + n + "]"); return el ? el.value.trim() : ""; };
      return { nombre: v("m_nombre"), rol: v("m_rol"), programa: v("m_programa"), semestre: v("m_semestre"), correo: v("m_correo"), telefono: v("m_telefono"), _fila: fila };
    }).filter(function (m) { return m.nombre || m.correo || m.telefono; });
  }

  function validarFormulario() {
    var ok = true;
    $$(".campo", form).forEach(function (campo) {
      var bien = true;
      if (campo.classList.contains("campo--grupo")) {
        var min = parseInt(campo.getAttribute("data-min") || "0", 10);
        if (min > 0 && campo.querySelectorAll("input:checked").length < min) bien = false;
      } else {
        var c = campo.querySelector("input, select, textarea");
        if (c && c.required && !c.value.trim()) bien = false;
        if (c && bien && c.type === "email" && c.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.value.trim())) bien = false;
      }
      campo.classList.toggle("invalido", !bien);
      if (!bien) ok = false;
    });
    var miembros = recogerMiembros();
    var errorMiembros = false;
    $$(".miembro", form).forEach(function (f) { f.classList.remove("invalido"); });
    miembros.forEach(function (m) {
      var mal = !m.nombre || (!m.correo && !m.telefono) || (m.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.correo));
      m._fila.classList.toggle("invalido", mal);
      if (mal) errorMiembros = true;
    });
    if (!miembros.length) errorMiembros = true;
    $("#miembros-error").style.display = errorMiembros ? "block" : "none";
    if (errorMiembros) ok = false;
    return ok;
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var est = $(".formulario__estado", form);
    if (!validarFormulario()) {
      var primero = $(".invalido", form) || $("#miembros-error");
      if (primero) primero.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    var marcados = function (n) { return $$("input[name=" + n + "]:checked", form).map(function (c) { return c.value; }); };
    var carga = {
      id: form.id.value || undefined,
      nombre: form.nombre.value.trim(), programa: form.programa.value.trim(), campo: form.campo.value,
      campos_secundarios: marcados("campos_secundarios"), temas: form.temas.value.trim(),
      modalidad: marcados("modalidad"), territorios: marcados("territorios"),
      periodo: form.periodo.value, empresas_capacidad: form.empresas_capacidad.value, disponibilidad: form.disponibilidad.value.trim(),
      tutor_nombre: form.tutor_nombre.value.trim(), tutor_cargo: form.tutor_cargo.value.trim(),
      tutor_correo: form.tutor_correo.value.trim(), tutor_telefono: form.tutor_telefono.value.trim(),
      miembros: recogerMiembros().map(function (m) { delete m._fila; return m; }),
      observaciones: form.observaciones.value.trim(), estado: form.estado.value
    };
    ocupado(form, true); aviso(est, "", "");
    api(carga.id ? "PUT" : "POST", "/api/grupos", carga)
      .then(function (r) { estado.grupos = r.grupos; pintarGrupos(); mostrar("panel"); })
      .catch(function (e) {
        var detalle = e.campos ? " Campos: " + e.campos.join(", ") + "." : "";
        aviso(est, "rojo", "<strong>" + escapar(e.error || "No fue posible guardar el grupo.") + "</strong>" + escapar(detalle));
        if (e._estado === 401) mostrar("login");
      })
      .then(function () { ocupado(form, false); });
  });

  /* ---------- Menú móvil y pie ---------- */
  var toggle = $(".nav-toggle"), nav = $(".nav");
  if (toggle && nav) toggle.addEventListener("click", function () { var abierto = nav.classList.toggle("abierto"); toggle.setAttribute("aria-expanded", abierto ? "true" : "false"); });
  $$("[data-anio]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  arrancar();
})();
