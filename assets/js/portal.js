/* =========================================================
   Portal único — Plan Padrino Milagro
   Ingreso para todos los perfiles (redirige según el correo), creación y restablecimiento
   de la clave, y portal de la empresa: aceptación de compromisos, autodiagnóstico por pasos
   (con actualizaciones registradas), plan de trabajo, datos de contacto y clave.
   ========================================================= */
(function () {
  "use strict";
  var I = window.PPM_INSTRUMENTO;
  var CAPS = I.CAPACIDADES;
  var estado = { empresa: null, diagnostico: null, paso: 0, sucio: false, actualizando: false, pestana: "diagnostico" };

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var vistas = ["cargando", "login", "restablecer", "aceptacion", "declinado", "panel"];

  function mostrar(nombre) {
    vistas.forEach(function (v) { var el = $("#vista-" + v); if (el) el.hidden = v !== nombre; });
    $("#boton-salir").hidden = !estado.empresa;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function escapar(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function fecha(iso) { return iso ? String(iso).slice(0, 10) : ""; }
  function fechaHora(iso) { return iso ? String(iso).slice(0, 16).replace("T", " ") : ""; }

  function aviso(contenedor, tono, html) {
    if (!contenedor) return;
    contenedor.innerHTML = html ? "<div class='aviso aviso--" + tono + "' role='status'><svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><circle cx='12' cy='12' r='10'/><path d='M12 8v4M12 16h.01'/></svg><div>" + html + "</div></div>" : "";
  }

  function api(metodo, ruta, cuerpo) {
    var opciones = { method: metodo, headers: { "Accept": "application/json" }, credentials: "same-origin" };
    if (cuerpo !== undefined) { opciones.headers["Content-Type"] = "application/json"; opciones.body = JSON.stringify(cuerpo); }
    return fetch(ruta, opciones).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { j._estado = r.status; if (!r.ok) throw j; return j; });
    });
  }

  function ocupado(form, si, textoOcupado) {
    var b = form.querySelector("button[type=submit]");
    if (!b) return;
    b.disabled = si;
    b.textContent = si ? (textoOcupado || "Guardando…") : (b.getAttribute("data-texto") || b.textContent);
  }

  /* ---------- Arranque ---------- */
  function arrancar() {
    var params = new URLSearchParams(window.location.search);
    var token = params.get("restablecer");
    if (token) {
      $("#form-restablecer").setAttribute("data-token", token);
      $("#boton-salir").hidden = true;
      return mostrar("restablecer");
    }
    api("GET", "/api/sesion").then(function (r) {
      if (r.tipo !== "empresa") { window.location.href = r.destino || "portal.html"; return; }
      estado.empresa = r.empresa; enrutar();
    }).catch(function () { estado.empresa = null; mostrar("login"); });
  }

  function enrutar() {
    var e = estado.empresa;
    if (!e) return mostrar("login");
    if (e.estado === "declinado") return mostrar("declinado");
    if (e.estado === "clave_creada" || e.estado === "registrado") {
      $("#acept-empresa").textContent = e.empresa || "su empresa";
      var yaCompromiso = Boolean(e.aceptaciones && e.aceptaciones.compromiso);
      $("#form-compromiso").hidden = yaCompromiso;
      $("#form-terminos").hidden = !yaCompromiso;
      $(".pasos-aceptacion").hidden = yaCompromiso;
      if (!yaCompromiso) {
        $("#acept-titulo").textContent = "Compromiso y términos del acompañamiento";
        $("#acept-intro").innerHTML = "Para iniciar el acompañamiento, <strong id='acept-empresa'>" + escapar(e.empresa || "su empresa") + "</strong> debe aceptar dos documentos. Si no los acepta, el proceso termina aquí.";
      }
      return mostrar("aceptacion");
    }
    if (e.estado === "aceptado" || e.estado === "diagnostico_completado") return abrirPanel();
    mostrar("login");
  }

  /* ---------- Inicio, cierre y claves ---------- */
  $("#form-login").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var form = ev.target, est = $(".formulario__estado", form);
    var correo = form.correo.value.trim(), clave = form.clave.value;
    if (!correo || !clave) { aviso(est, "rojo", "Indique su correo y su clave."); return; }
    ocupado(form, true, "Ingresando…"); aviso(est, "", "");
    api("POST", "/api/sesion", { correo: correo, clave: clave })
      .then(function (r) {
        if (r.tipo !== "empresa") { window.location.href = r.destino; return; }
        estado.empresa = r.empresa; form.reset(); enrutar();
      })
      .catch(function (e) {
        if (e.sinCuenta) aviso(est, "rojo", "<strong>" + escapar(e.error) + "</strong> Si ya se inscribió y aún no tiene clave, use la opción <em>¿Olvidó su clave o aún no la ha creado?</em>.");
        else aviso(est, "rojo", escapar(e.error || "No fue posible iniciar sesión."));
      })
      .then(function () { ocupado(form, false); });
  });

  $("#login-olvide").addEventListener("click", function () {
    $("#form-login").hidden = true; $("#form-solicitar").hidden = false;
    $("#sol-correo").value = $("#login-correo").value; $("#sol-correo").focus();
  });
  $("#sol-volver").addEventListener("click", function () { $("#form-solicitar").hidden = true; $("#form-login").hidden = false; });

  $("#form-solicitar").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var form = ev.target, est = $(".formulario__estado", form), correo = form.correo.value.trim();
    form.correo.closest(".campo").classList.toggle("invalido", !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return;
    ocupado(form, true, "Enviando…"); aviso(est, "", "");
    api("POST", "/api/clave?accion=solicitar", { correo: correo })
      .then(function (r) { aviso(est, "verde", "<strong>Revise su correo.</strong> " + escapar(r.mensaje || "")); })
      .catch(function (e) { aviso(est, "rojo", escapar(e.error || "No fue posible enviar el enlace.")); })
      .then(function () { ocupado(form, false); });
  });

  function validarNuevaClave(form, clave, conf) {
    var ok = clave.length >= 8 && /[a-zA-Z]/.test(clave) && /[0-9]/.test(clave);
    form.clave.closest(".campo").classList.toggle("invalido", !ok);
    form.confirmacion.closest(".campo").classList.toggle("invalido", conf !== clave);
    return ok && conf === clave;
  }

  $("#form-restablecer").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var form = ev.target, est = $(".formulario__estado", form);
    if (!validarNuevaClave(form, form.clave.value, form.confirmacion.value)) return;
    ocupado(form, true); aviso(est, "", "");
    api("POST", "/api/clave", { tokenRegistro: form.getAttribute("data-token"), clave: form.clave.value, confirmacion: form.confirmacion.value })
      .then(function (r) { window.location.href = r.destino || "portal.html"; })
      .catch(function (e) { aviso(est, "rojo", "<strong>" + escapar(e.error || "No fue posible guardar la clave.") + "</strong>" + (e._estado === 401 ? " <a href='portal.html'>Solicite un nuevo enlace</a>." : "")); ocupado(form, false); });
  });

  $("#form-cambiar-clave").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var form = ev.target, est = $(".formulario__estado", form);
    form.claveActual.closest(".campo").classList.toggle("invalido", !form.claveActual.value);
    if (!form.claveActual.value || !validarNuevaClave(form, form.clave.value, form.confirmacion.value)) return;
    ocupado(form, true); aviso(est, "", "");
    api("PUT", "/api/clave", { claveActual: form.claveActual.value, clave: form.clave.value, confirmacion: form.confirmacion.value })
      .then(function () { form.reset(); aviso(est, "verde", "<strong>Clave actualizada.</strong> Úsela en su próximo ingreso."); })
      .catch(function (e) { aviso(est, "rojo", escapar(e.error || "No fue posible cambiar la clave.")); })
      .then(function () { ocupado(form, false); });
  });

  $("#boton-salir").addEventListener("click", function () {
    var seguir = function () { api("DELETE", "/api/sesion").then(function () { estado.empresa = null; estado.diagnostico = null; mostrar("login"); }); };
    if (estado.sucio && !$("#vista-panel").hidden && !$("#pan-diagnostico").hidden) guardarPaso(false).then(seguir, seguir); else seguir();
  });

  /* ---------- Aceptaciones ---------- */
  $("#form-compromiso").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var form = ev.target, est = $(".formulario__estado", form);
    var ok = form.acepta_compromiso.checked, nombre = form.nombreFirma.value.trim();
    $(".campo--grupo", form).classList.toggle("invalido", !ok);
    form.nombreFirma.closest(".campo").classList.toggle("invalido", !nombre);
    if (!ok || !nombre) return;
    estado.nombreFirma = nombre;
    aviso(est, "", "");
    form.hidden = true;
    $("#form-terminos").hidden = false;
    $$(".pasos-aceptacion__item").forEach(function (li) { li.classList.toggle("activo", li.getAttribute("data-doc") === "terminos"); li.classList.toggle("hecho", li.getAttribute("data-doc") === "compromiso"); });
    window.scrollTo({ top: $("#vista-aceptacion").offsetTop - 80, behavior: "smooth" });
  });

  $("#form-terminos").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var form = ev.target, est = $(".formulario__estado", form);
    var ok = form.acepta_terminos.checked, nombre = form.nombreFirma.value.trim();
    $(".campo--grupo", form).classList.toggle("invalido", !ok);
    form.nombreFirma.closest(".campo").classList.toggle("invalido", !nombre);
    if (!ok || !nombre) return;
    ocupado(form, true);
    api("POST", "/api/aceptacion", { compromiso: true, terminos: true, nombreFirma: nombre })
      .then(function (r) { estado.empresa = r.empresa; enrutar(); })
      .catch(function (e) { aviso(est, "rojo", escapar(e.error || "No fue posible registrar la aceptación.")); })
      .then(function () { ocupado(form, false); });
  });

  $$("[data-declinar]").forEach(function (b) {
    b.addEventListener("click", function () {
      var cual = b.getAttribute("data-declinar");
      if (!window.confirm("Si no acepta, el proceso de acompañamiento termina aquí. ¿Confirma que no acepta?")) return;
      api("POST", "/api/aceptacion", { compromiso: cual === "terminos", terminos: false })
        .then(function () { estado.empresa = null; mostrar("declinado"); })
        .catch(function (e) { window.alert(e.error || "No fue posible registrar su respuesta."); });
    });
  });

  /* ---------- Panel de la empresa ---------- */
  function abrirPanel() {
    pintarCabecera();
    mostrar("panel");
    return cargarDiagnostico();
  }

  function pintarCabecera() {
    var e = estado.empresa;
    $("#pe-nombre").textContent = e.empresa || "Su empresa";
    $("#pe-meta").textContent = "Interlocutor: " + (e.contacto || "") + " · " + e.correo;
    var g = e.grupoAsignado;
    $("#pe-grupo").innerHTML = g
      ? "<div class='aviso aviso--verde'><svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><circle cx='12' cy='12' r='10'/><path d='M8 12l3 3 5-6'/></svg><div><strong>Grupo padrino asignado:</strong> " + escapar(g.nombre) + " (" + escapar(g.ies) + ") · " + escapar(g.area) + ".<br>Líder: " + escapar(g.lider.nombre) + " · <a href='mailto:" + escapar(g.lider.correo) + "'>" + escapar(g.lider.correo) + "</a> · " + escapar(g.lider.telefono) + ". Asignado el " + fecha(g.fecha) + ".</div></div>"
      : "<p class='panel-ies__meta'>Aún no tiene grupo universitario asignado. La secretaría técnica le avisará por correo cuando se realice el emparejamiento.</p>";
  }

  function pestana(nombre) {
    estado.pestana = nombre;
    $$(".pestana").forEach(function (b) { b.classList.toggle("activo", b.getAttribute("data-pestana") === nombre); });
    var visible = nombre === "diagnostico" ? (estado.diagnostico && estado.diagnostico.completado && !estado.actualizando ? "resultados" : "diagnostico") : nombre;
    ["diagnostico", "resultados", "plan", "datos", "clave"].forEach(function (p) { $("#pan-" + p).hidden = p !== visible; });
    if (nombre === "plan") cargarPlan();
    if (nombre === "datos") cargarDatos();
  }
  $$(".pestana").forEach(function (b) {
    b.addEventListener("click", function () {
      var ir = function () { pestana(b.getAttribute("data-pestana")); };
      if (estado.sucio && !$("#pan-diagnostico").hidden) guardarPaso(false).then(ir, ir); else ir();
    });
  });

  /* ---------- Autodiagnóstico ---------- */
  function cargarDiagnostico() {
    return api("GET", "/api/diagnostico").then(function (r) {
      estado.diagnostico = r.diagnostico;
      estado.empresa = r.empresa;
      pintarCabecera();
      if (r.diagnostico.completado) { estado.actualizando = false; mostrarResultados(r.diagnostico.resultados); return; }
      estado.paso = Math.min(r.diagnostico.paso || 0, CAPS.length);
      pintarEscala();
      pintarPaso();
      pestana("diagnostico");
    }).catch(function (e) { window.alert(e.error || "No fue posible cargar el autodiagnóstico."); mostrar("login"); });
  }

  function pintarEscala() {
    $("#escala-lista").innerHTML = I.ESCALA.map(function (n) {
      return "<li><span class='escala__num'>" + n.valor + "</span><div><strong>" + escapar(n.nombre) + "</strong><br><span>" + escapar(n.descripcion) + "</span></div></li>";
    }).join("");
  }

  function pintarProgreso() {
    var contestados = Object.keys(estado.diagnostico.respuestas || {}).length, total = I.totalFactores();
    var items = ["Introducción"].concat(CAPS.map(function (c) { return c.numero + ". " + c.corto; }));
    $("#progreso-lista").innerHTML = items.map(function (t, i) {
      var clase = i === estado.paso ? "activo" : (i < estado.paso ? "hecho" : "");
      return "<li class='" + clase + "'><button type='button' data-ir='" + i + "'" + (i > estado.paso ? " disabled" : "") + ">" + escapar(t) + "</button></li>";
    }).join("");
    $("#progreso-relleno").style.width = Math.round(contestados / total * 100) + "%";
    $("#progreso-texto").textContent = contestados + " de " + total + " factores respondidos";
    $$("[data-ir]").forEach(function (b) { b.addEventListener("click", function () { irA(Number(b.getAttribute("data-ir"))); }); });
  }

  function irA(paso) {
    var seguir = function () { estado.paso = paso; pintarPaso(); };
    if (estado.sucio) guardarPaso(false).then(seguir, seguir); else seguir();
  }

  function pintarPaso() {
    var d = estado.diagnostico, cont = $("#diag-contenido");
    aviso($(".formulario__estado", $("#form-diagnostico")), "", "");
    pintarProgreso();
    $("#diag-atras").hidden = estado.paso === 0;
    $("#diag-continuar").textContent = estado.paso === CAPS.length ? "Guardar y ver resultados" : (estado.paso === 0 ? "Comenzar" : "Guardar y continuar");
    $("#diag-continuar").setAttribute("data-texto", $("#diag-continuar").textContent);

    if (estado.paso === 0) {
      cont.innerHTML =
        "<div class='documento__cuerpo'>" +
        "<h2>Cómo diligenciar el autodiagnóstico</h2>" +
        "<p>El instrumento mide la madurez de cinco capacidades de su empresa a partir de <strong>" + I.totalFactores() + " factores</strong> o actividades de gestión, agrupados así:</p>" +
        "<ul>" + CAPS.map(function (c) { return "<li><strong>" + escapar(c.nombre) + "</strong> (" + c.factores.length + " factores): " + escapar(c.descripcion) + "</li>"; }).join("") + "</ul>" +
        "<p>Para cada factor elija el nivel de la escala de madurez que mejor describe la situación <em>real y actual</em> de su empresa, pensando en la evidencia que podría mostrar (documentos, informes, rutinas). Si un factor no aplica o no existe, marque 0.</p>" +
        "<p>Al final de cada capacidad hay unos pocos datos numéricos. Respóndalos con la mejor información disponible.</p>" +
        "<div class='aviso aviso--info'><svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='10'/><path d='M12 16v-4M12 8h.01'/></svg><p>Su avance se guarda al pulsar <strong>Guardar y continuar</strong> o <strong>Guardar y salir</strong>. Puede retomar el diagnóstico en otra sesión desde el paso en que lo dejó. La información es confidencial.</p></div>" +
        "</div>";
      estado.sucio = false;
      return;
    }

    var cap = CAPS[estado.paso - 1];
    var html = "<div class='cap__cabecera'><span class='sobretitulo'>Capacidad " + cap.numero + " de " + CAPS.length + "</span><h2>" + escapar(cap.nombre) + "</h2><p class='entradilla'>" + escapar(cap.descripcion) + "</p></div>";
    cap.factores.forEach(function (f) {
      var v = d.respuestas[f.codigo];
      html += "<fieldset class='factor' data-codigo='" + f.codigo + "'>" +
        "<legend><span class='factor__codigo'>" + f.codigo + "</span> " + escapar(f.texto) + "</legend>" +
        "<div class='likert' role='radiogroup' aria-label='Nivel de madurez del factor " + f.codigo + "'>" +
        I.ESCALA.map(function (n) {
          var id = "f_" + f.codigo.replace(".", "_") + "_" + n.valor;
          return "<label class='likert__opcion' for='" + id + "'><input type='radio' id='" + id + "' name='r_" + f.codigo + "' value='" + n.valor + "'" + (v === n.valor ? " checked" : "") + "><span class='likert__num'>" + n.valor + "</span><span class='likert__nombre'>" + escapar(n.nombre) + "</span></label>";
        }).join("") +
        "</div>" +
        "<details class='factor__evidencia'><summary>Evidencia que respaldaría este factor</summary><p>" + escapar(f.evidencia) + "</p>" +
        "<label class='factor__obs' for='o_" + f.codigo.replace(".", "_") + "'>Observación (opcional)</label>" +
        "<textarea id='o_" + f.codigo.replace(".", "_") + "' name='o_" + f.codigo + "' rows='2' maxlength='1000' placeholder='Ej.: tenemos el manual pero no se actualiza desde 2023'>" + escapar(d.observaciones[f.codigo] || "") + "</textarea></details>" +
        "<span class='error'>Seleccione un nivel para este factor.</span>" +
        "</fieldset>";
    });
    if (cap.extras) {
      html += "<div class='extras'><h3>" + escapar(cap.extras.titulo) + "</h3>" + (cap.extras.nota ? "<p class='diag__nota'>" + escapar(cap.extras.nota) + "</p>" : "");
      cap.extras.campos.forEach(function (campo) {
        var val = d.extras[campo.id] || {};
        html += "<div class='extra'><div class='extra__etiqueta'>" + escapar(campo.etiqueta) + "</div>";
        if (campo.tipo === "numero") {
          html += "<div class='extra__campos'><label><span>" + escapar(campo.unidad) + "</span><input type='number' name='x_" + campo.id + "' step='any'" + (campo.permiteNegativo ? "" : " min='0'") + " value='" + (d.extras[campo.id] == null ? "" : d.extras[campo.id]) + "'></label></div>";
        } else {
          var claves = campo.tipo === "anios" ? campo.anios : campo.columnas;
          html += "<div class='extra__campos'>" + claves.map(function (k) {
            return "<label><span>" + escapar(k) + (campo.unidad ? " (" + escapar(campo.unidad) + ")" : "") + "</span><input type='number' name='x_" + campo.id + "__" + k + "' step='any' min='0' value='" + (val[k] == null ? "" : val[k]) + "'></label>";
          }).join("") + "</div>";
        }
        html += "</div>";
      });
      html += "</div>";
    }
    cont.innerHTML = html;
    estado.sucio = false;
  }

  $("#form-diagnostico").addEventListener("change", function () { estado.sucio = true; });
  $("#form-diagnostico").addEventListener("input", function () { estado.sucio = true; });
  window.addEventListener("beforeunload", function (ev) { if (estado.sucio) { ev.preventDefault(); ev.returnValue = ""; } });

  function recogerPaso() {
    var form = $("#form-diagnostico"), cap = CAPS[estado.paso - 1];
    var carga = { paso: estado.paso, respuestas: {}, observaciones: {}, extras: {} };
    if (!cap) return carga;
    cap.factores.forEach(function (f) {
      var marcado = form.querySelector("input[name='r_" + f.codigo + "']:checked");
      carga.respuestas[f.codigo] = marcado ? Number(marcado.value) : null;
      var obs = form.querySelector("textarea[name='o_" + f.codigo + "']");
      carga.observaciones[f.codigo] = obs ? obs.value : "";
    });
    if (cap.extras) cap.extras.campos.forEach(function (campo) {
      if (campo.tipo === "numero") { var el = form.querySelector("input[name='x_" + campo.id + "']"); carga.extras[campo.id] = el ? el.value : ""; }
      else {
        var claves = campo.tipo === "anios" ? campo.anios : campo.columnas, obj = {};
        claves.forEach(function (k) { var el = form.querySelector("input[name='x_" + campo.id + "__" + k + "']"); obj[k] = el ? el.value : ""; });
        carga.extras[campo.id] = obj;
      }
    });
    return carga;
  }

  function guardarPaso(avanzar) {
    var carga = recogerPaso();
    if (avanzar) carga.paso = Math.min(estado.paso + 1, CAPS.length);
    return api("PUT", "/api/diagnostico", carga).then(function (r) { estado.diagnostico = r.diagnostico; estado.sucio = false; return r; });
  }

  function validarPaso() {
    var cap = CAPS[estado.paso - 1], ok = true, primero = null;
    if (!cap) return true;
    $$(".factor", $("#form-diagnostico")).forEach(function (fs) {
      var falta = !fs.querySelector("input[type=radio]:checked");
      fs.classList.toggle("invalido", falta);
      if (falta) { ok = false; primero = primero || fs; }
    });
    if (primero) primero.scrollIntoView({ behavior: "smooth", block: "center" });
    return ok;
  }

  $("#form-diagnostico").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var form = ev.target, est = $(".formulario__estado", form);
    if (estado.paso === 0) { estado.paso = 1; pintarPaso(); return; }
    if (!validarPaso()) { aviso(est, "rojo", "Faltan factores por responder en esta capacidad."); return; }
    ocupado(form, true); aviso(est, "", "");
    var ultimo = estado.paso === CAPS.length;
    guardarPaso(!ultimo).then(function () {
      if (!ultimo) { estado.paso += 1; pintarPaso(); return; }
      return api("POST", "/api/diagnostico", { finalizar: true }).then(function (r) { estado.diagnostico = r.diagnostico; estado.empresa = r.empresa; estado.actualizando = false; pintarCabecera(); mostrarResultados(r.diagnostico.resultados); });
    }).catch(function (e) {
      if (e.pendientes) { aviso(est, "rojo", "Faltan factores por responder: " + escapar(e.pendientes.join(", ")) + ". Use la barra de avance para volver a esa capacidad."); }
      else aviso(est, "rojo", escapar(e.error || "No fue posible guardar. Revise su conexión e intente de nuevo."));
    }).then(function () { ocupado(form, false); });
  });

  $("#diag-atras").addEventListener("click", function () { irA(Math.max(0, estado.paso - 1)); });
  $("#diag-salir").addEventListener("click", function () {
    var form = $("#form-diagnostico"), est = $(".formulario__estado", form);
    guardarPaso(false).then(function () {
      return api("DELETE", "/api/sesion");
    }).then(function () {
      estado.empresa = null; estado.diagnostico = null; mostrar("login");
      aviso($(".formulario__estado", $("#form-login")), "verde", "<strong>Su avance quedó guardado.</strong> Cuando vuelva a ingresar continuará desde el paso en que lo dejó.");
    }).catch(function (e) { aviso(est, "rojo", escapar(e.error || "No fue posible guardar.")); });
  });
  $("#diag-volver-resultados").addEventListener("click", function () {
    var form = $("#form-diagnostico"), est = $(".formulario__estado", form);
    guardarPaso(false).then(function () { estado.actualizando = false; mostrarResultados(estado.diagnostico.resultados); })
      .catch(function (e) { aviso(est, "rojo", escapar(e.error || "No fue posible guardar.")); });
  });

  /* Actualización de un autodiagnóstico ya finalizado: se recorre de nuevo el instrumento con las
     respuestas actuales; cada cambio guardado queda registrado y los resultados se recalculan al final. */
  $("#res-actualizar").addEventListener("click", function () {
    estado.actualizando = true;
    estado.paso = 1;
    pintarEscala();
    pintarPaso();
    aviso($("#diag-aviso-actualizacion"), "info", "<strong>Está actualizando el autodiagnóstico (versión actual: " + (estado.diagnostico.version || 1) + ").</strong> Puede cambiar uno o varios factores; cada cambio guardado queda registrado con su fecha. Al llegar al final y pulsar <em>Guardar y ver resultados</em> se recalculan los resultados y se genera una nueva versión del informe.");
    $("#diag-volver-resultados").hidden = false;
    $("#diag-salir").hidden = true;
    pestana("diagnostico");
  });

  /* ---------- Resultados ---------- */
  function mostrarResultados(r) {
    var d = estado.diagnostico;
    $("#res-empresa").textContent = (estado.empresa && estado.empresa.empresa) || "su empresa";
    $("#res-version").textContent = "Autodiagnóstico completado · versión " + (d.version || 1) + (d.finalizado ? " · " + fecha(d.finalizado) : "");
    var html = "<div class='res__global'><div class='res__num'>" + r.global.toFixed(2) + "<span>/ 5</span></div><div><div class='res__nivel'>Nivel global: " + escapar(r.nivelGlobal) + "</div><div class='diag__nota'>Promedio de las cinco capacidades, cada una ponderada según el modelo CRL.</div></div></div>";
    html += "<figure class='res__radar'>" + window.PPM_RADAR.svg(r.capacidades) + "<figcaption>Perfil de capacidades en escala 0–5: cuanto más se acerca el polígono al borde, más madura es la capacidad.</figcaption></figure>";
    html += "<div class='res__lista'>" + r.capacidades.map(function (c) {
      var pct = Math.round(c.ponderado / 5 * 100);
      return "<div class='res__item'><div class='res__fila'><strong>" + escapar(c.nombre) + "</strong><span>" + c.ponderado.toFixed(2) + " · " + escapar(c.nivel) + "</span></div>" +
        "<div class='res__barra'><div class='res__relleno' style='width:" + pct + "%'></div></div>" +
        "<p class='res__reco'>" + escapar(c.recomendacion) + "</p></div>";
    }).join("") + "</div>";
    html += "<div class='tabla-envoltura' style='margin-top:24px'><table><thead><tr><th>Capacidad</th><th>Ponderado</th><th>Promedio simple</th><th>Nivel</th></tr></thead><tbody>" +
      r.capacidades.map(function (c) { return "<tr><td>" + escapar(c.nombre) + "</td><td>" + c.ponderado.toFixed(2) + "</td><td>" + c.promedio.toFixed(2) + "</td><td>" + escapar(c.nivel) + "</td></tr>"; }).join("") +
      "</tbody></table></div>";
    $("#res-contenido").innerHTML = html;
    var pendientes = (d.actualizaciones || []).filter(function (a) { return !a.aplicada; });
    aviso($("#res-pendiente"), pendientes.length ? "ambar" : "", pendientes.length ? "<strong>Tiene cambios guardados que aún no se reflejan en estos resultados</strong> (última actualización: " + fechaHora(pendientes[pendientes.length - 1].fecha) + "). Pulse <em>Actualizar el autodiagnóstico</em> y recorra el instrumento hasta el final para recalcularlos." : "");
    var hist = d.actualizaciones || [];
    $("#res-historial").innerHTML = hist.length
      ? "<h3 style='margin-bottom:6px'>Constancia de actualizaciones</h3><ul class='historial'>" + hist.slice().reverse().map(function (a) { return "<li>" + fechaHora(a.fecha) + " · " + (a.factores && a.factores.length ? a.factores.length + " factor(es): " + escapar(a.factores.join(", ")) : "datos complementarios") + (a.aplicada ? " · aplicada en la versión " + a.version : " · pendiente de recalcular") + "</li>"; }).join("") + "</ul>"
      : "";
    pintarInforme();
    $("#diag-volver-resultados").hidden = true;
    $("#diag-salir").hidden = false;
    aviso($("#diag-aviso-actualizacion"), "", "");
    pestana("diagnostico");
  }

  function pintarInforme() {
    var inf = estado.empresa && estado.empresa.informe, cont = $("#res-informe");
    if (!inf) { aviso(cont, "info", "El informe en PDF se genera al descargarlo con el botón de abajo."); return; }
    if (inf.error) { aviso(cont, "ambar", escapar(inf.error) + " Puede intentar descargarlo de nuevo."); return; }
    if (inf.correo && inf.correo.estado === "enviado") {
      aviso(cont, "verde", "<strong>Informe archivado y enviado a " + escapar(inf.correo.para) + ".</strong> La secretaría técnica recibió copia para compartirlo con el grupo que apadrinará a su empresa.");
    } else {
      aviso(cont, "ambar", "<strong>El informe quedó archivado, pero no fue posible enviarlo por correo.</strong> Descárguelo con el botón de abajo o intente reenviarlo.");
    }
  }

  $("#res-reenviar").addEventListener("click", function () {
    var b = $("#res-reenviar"), cont = $("#res-informe");
    b.disabled = true; b.textContent = "Enviando…";
    api("POST", "/api/informe")
      .then(function (r) { estado.empresa = r.empresa; pintarInforme(); })
      .catch(function (e) { if (e.empresa) estado.empresa = e.empresa; aviso(cont, "rojo", "<strong>" + escapar(e.error || "No fue posible reenviar el informe.") + "</strong>" + (e.causa ? " (" + escapar(e.causa) + ")" : "")); })
      .then(function () { b.disabled = false; b.textContent = "Reenviar el informe a mi correo"; });
  });

  /* ---------- Plan de trabajo (solo lectura para la empresa) ---------- */
  function cargarPlan() {
    var cont = $("#plan-contenido");
    cont.innerHTML = "<p class='entradilla'>Cargando…</p>";
    api("GET", "/api/grupos?accion=plan").then(function (r) {
      if (!r.asignado) { $("#plan-descargar").hidden = true; cont.innerHTML = "<div class='grupos__vacio'><strong>Aún no hay plan de trabajo.</strong><br>Se construirá cuando la secretaría técnica asigne el grupo universitario que acompañará a su empresa.</div>"; return; }
      $("#plan-descargar").hidden = false;
      cont.innerHTML = window.PPM_PLAN.tablaHtml(r.plan, r.grupo, r.empresa);
    }).catch(function (e) { cont.innerHTML = ""; aviso(cont, "rojo", escapar(e.error || "No fue posible cargar el plan.")); });
  }

  /* ---------- Mis datos ---------- */
  var FIJOS = [["tipo_identificacion", "Tipo de identificación"], ["nit", "Número"], ["tamano", "Tamaño"], ["sector", "Sector"], ["anios_operacion", "Años de operación"], ["departamento", "Departamento"], ["municipio", "Municipio"], ["camara_comercio", "Registro en cámara de comercio"], ["camara_nombre", "Cámara"], ["empleos_antes", "Empleos antes del terremoto"], ["tipo_afectacion", "Tipo de afectación"], ["frente_prioritario", "Frente prioritario"], ["disponibilidad", "Disponibilidad"]];
  function cargarDatos() {
    var form = $("#form-datos");
    api("GET", "/api/registro").then(function (r) {
      var d = r.datos || {};
      ["contacto_nombre", "contacto_cargo", "contacto_telefono", "contacto_correo", "empresa", "direccion", "estado_operativo", "empleos_actuales", "reto_principal"].forEach(function (k) { if (form[k]) form[k].value = d[k] || ""; });
      $("#d-fijos").innerHTML = "<div class='ficha__k' style='grid-column:1/-1'>Otros datos de la inscripción (para cambiarlos, escriba a la secretaría técnica)</div>" + FIJOS.filter(function (f) { return d[f[0]]; }).map(function (f) {
        var v = d[f[0]]; return "<div><span class='ficha__k'>" + escapar(f[1]) + "</span><span class='ficha__v'>" + escapar(Array.isArray(v) ? v.join(", ") : v) + "</span></div>";
      }).join("");
      pintarHistorialDatos(r.empresa);
    }).catch(function (e) { aviso($(".formulario__estado", form), "rojo", escapar(e.error || "No fue posible cargar sus datos.")); });
  }
  function pintarHistorialDatos(e) {
    var h = (e && e.actualizacionesDatos) || [];
    $("#d-historial").innerHTML = h.length ? "<h3 style='margin-bottom:6px'>Constancia de actualizaciones</h3><ul class='historial'>" + h.slice().reverse().map(function (a) { return "<li>" + fechaHora(a.fecha) + " · campos: " + escapar((a.campos || []).join(", ")) + "</li>"; }).join("") + "</ul>" : "";
  }
  $("#form-datos").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var form = ev.target, est = $(".formulario__estado", form), ok = true;
    ["contacto_nombre", "contacto_cargo", "contacto_telefono", "empresa", "estado_operativo"].forEach(function (k) { var falta = !form[k].value.trim(); form[k].closest(".campo").classList.toggle("invalido", falta); if (falta) ok = false; });
    if (!ok) { aviso(est, "rojo", "Complete los campos obligatorios."); return; }
    var carga = {};
    ["contacto_nombre", "contacto_cargo", "contacto_telefono", "empresa", "direccion", "estado_operativo", "empleos_actuales", "reto_principal"].forEach(function (k) { carga[k] = form[k].value.trim(); });
    ocupado(form, true); aviso(est, "", "");
    api("PUT", "/api/registro", carga)
      .then(function (r) {
        estado.empresa = r.empresa; pintarCabecera(); pintarHistorialDatos(r.empresa);
        aviso(est, "verde", r.cambiados && r.cambiados.length ? "<strong>Datos actualizados</strong> (" + escapar(r.cambiados.join(", ")) + "). Quedó constancia de la fecha." : "No hubo cambios que guardar.");
      })
      .catch(function (e) { aviso(est, "rojo", "<strong>" + escapar(e.error || "No fue posible guardar.") + "</strong>" + (e.campos ? " Campos: " + escapar(e.campos.join(", ")) : "")); })
      .then(function () { ocupado(form, false); });
  });

  arrancar();
})();
