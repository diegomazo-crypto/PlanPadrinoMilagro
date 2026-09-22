/* =========================================================
   Plan Padrino Milagro — comportamiento del sitio
   ========================================================= */
(function () {
  "use strict";

  var CONFIG = window.PPM_CONFIG || {};

  /* ---------- Menú móvil ---------- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var abierto = nav.classList.toggle("abierto");
      toggle.setAttribute("aria-expanded", abierto ? "true" : "false");
    });
    document.addEventListener("click", function (e) {
      if (!nav.contains(e.target) && !toggle.contains(e.target)) {
        nav.classList.remove("abierto");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---------- Índice lateral de las guías ---------- */
  var enlacesIndice = document.querySelectorAll(".guia__indice a[href^='#']");
  if (enlacesIndice.length && "IntersectionObserver" in window) {
    var secciones = [];
    enlacesIndice.forEach(function (a) {
      var destino = document.querySelector(a.getAttribute("href"));
      if (destino) secciones.push({ enlace: a, seccion: destino });
    });
    var activar = function (id) {
      secciones.forEach(function (s) {
        s.enlace.classList.toggle("activo", s.seccion.id === id);
      });
    };
    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (en) {
        if (en.isIntersecting) activar(en.target.id);
      });
    }, { rootMargin: "-30% 0px -60% 0px", threshold: 0 });
    secciones.forEach(function (s) { obs.observe(s.seccion); });
  }

  /* ---------- Formularios ---------- */
  /* Solo los formularios de inscripción (data-tipo) usan el envío genérico.
     Los del portal y el de creación de clave tienen su propia lógica. */
  var formularios = document.querySelectorAll("form.formulario[data-tipo]");
  formularios.forEach(function (form) {
    form.setAttribute("novalidate", "novalidate");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!validar(form)) {
        var primero = form.querySelector(".invalido");
        if (primero) primero.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      enviar(form);
    });
    form.addEventListener("input", function (e) {
      var campo = e.target.closest(".campo");
      if (campo && campo.classList.contains("invalido")) validarCampo(campo);
    });
    form.addEventListener("change", function (e) {
      var campo = e.target.closest(".campo");
      if (campo && campo.classList.contains("invalido")) validarCampo(campo);
    });
  });

  function validar(form) {
    var valido = true;
    form.querySelectorAll(".campo").forEach(function (campo) {
      if (!validarCampo(campo)) valido = false;
    });
    // Institución (IES): del padrón o declarada manualmente
    var buscarIes = form.querySelector("#ies-buscar");
    if (buscarIes) {
      var manual = form.querySelector("#ies-manual").checked;
      var campoIes = buscarIes.closest(".campo");
      var faltaIes = !manual && !form.querySelector("#ies-clave").value;
      campoIes.classList.toggle("invalido", faltaIes);
      if (faltaIes) valido = false;
    }
    // Identificación de la empresa (tipo + número con dígito de verificación)
    var selTipo = form.querySelector("#emp-tipo-id"), inpNit = form.querySelector("#emp-nit");
    if (selTipo && inpNit && window.PPM_TERRITORIOS && selTipo.value && !inpNit.disabled) {
      var problema = window.PPM_TERRITORIOS.validarIdentificacion(selTipo.value, inpNit.value);
      var campo = inpNit.closest(".campo");
      campo.classList.toggle("invalido", Boolean(problema));
      if (problema) { document.getElementById("emp-nit-error").textContent = problema; valido = false; }
    }
    return valido;
  }

  function validarCampo(campo) {
    var ok = true;
    var error = campo.querySelector(".error");

    // Grupos de casillas con mínimo de selección
    if (campo.classList.contains("campo--grupo")) {
      var min = parseInt(campo.getAttribute("data-min") || "0", 10);
      var marcadas = campo.querySelectorAll("input:checked").length;
      if (min > 0 && marcadas < min) ok = false;
    } else {
      var control = null;
      campo.querySelectorAll("input, select, textarea").forEach(function (c) { if (!control && !c.disabled && !c.hidden) control = c; });
      if (control) {
        if (control.type === "checkbox") {
          if (control.required && !control.checked) ok = false;
        } else {
          var valor = (control.value || "").trim();
          if (control.required && !valor) ok = false;
          if (ok && valor && control.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) ok = false;
          if (ok && valor && control.type === "url" && !/^https?:\/\/.+/i.test(valor)) ok = false;
          if (ok && valor && control.pattern && !(new RegExp("^(?:" + control.pattern + ")$")).test(valor)) ok = false;
        }
      }
    }
    campo.classList.toggle("invalido", !ok);
    if (error) error.setAttribute("aria-live", "polite");
    return ok;
  }

  function recolectar(form) {
    var datos = {};
    var fd = new FormData(form);
    fd.forEach(function (valor, clave) {
      if (clave === "_trampa") return;
      if (Object.prototype.hasOwnProperty.call(datos, clave)) {
        if (!Array.isArray(datos[clave])) datos[clave] = [datos[clave]];
        datos[clave].push(valor);
      } else {
        datos[clave] = valor;
      }
    });
    // Casillas no marcadas de compromisos quedan como "no"
    form.querySelectorAll("input[type=checkbox][data-compromiso]").forEach(function (c) {
      datos[c.name] = c.checked ? "sí" : "no";
    });
    if (datos.institucion_manual === "sí") {
      datos.institucion_clave = "";
      datos.institucion = datos.institucion_nombre_manual || "";
    }
    delete datos.institucion_busqueda; delete datos.institucion_nombre_manual; delete datos.institucion_manual;
    if (datos.municipio === "Otro" || (!datos.municipio && datos.municipio_otro)) datos.municipio = datos.municipio_otro || "";
    if (datos.camara_nombre === "Otra" || (!datos.camara_nombre && datos.camara_otra)) datos.camara_nombre = datos.camara_otra || "";
    delete datos.municipio_otro; delete datos.camara_otra;
    datos._formulario = form.getAttribute("data-tipo") || form.id;
    datos._fecha = new Date().toISOString();
    datos._pagina = window.location.href;
    return datos;
  }

  function etiquetaDe(form, nombre) {
    var control = form.querySelector("[name='" + nombre + "']");
    if (!control) return nombre;
    var campo = control.closest(".campo");
    var etiqueta = campo ? campo.querySelector("label, legend, .campo__titulo") : null;
    if (etiqueta) return etiqueta.textContent.replace(/\*/g, "").trim();
    return nombre;
  }

  function texto(form, datos) {
    var lineas = [];
    Object.keys(datos).forEach(function (k) {
      if (k.charAt(0) === "_") return;
      var v = datos[k];
      if (Array.isArray(v)) v = v.join(", ");
      if (v === "" || v == null) return;
      lineas.push(etiquetaDe(form, k) + ": " + v);
    });
    return lineas.join("\n");
  }

  function enviar(form) {
    var tipo = form.getAttribute("data-tipo");
    var endpoint = tipo === "ies" ? CONFIG.ENDPOINT_IES : CONFIG.ENDPOINT_EMPRESAS;
    var estado = form.querySelector(".formulario__estado");
    var boton = form.querySelector("button[type=submit]");
    var trampa = form.querySelector("input[name=_trampa]");
    if (trampa && trampa.value) return; // bot

    var datos = recolectar(form);

    if (!endpoint && (tipo === "empresas" || tipo === "ies")) {
      enviarRegistro(form, datos, estado, boton, tipo);
      return;
    }
    if (!endpoint) {
      enviarPorCorreo(form, datos, estado);
      return;
    }

    boton.disabled = true;
    boton.textContent = "Enviando…";
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(datos)
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      mostrar(estado, "verde", "<strong>Inscripción recibida.</strong> Gracias por sumarse al Plan Padrino Milagro. La secretaría técnica se pondrá en contacto por el correo indicado.");
      form.reset();
      form.querySelectorAll(".invalido").forEach(function (c) { c.classList.remove("invalido"); });
      estado.scrollIntoView({ behavior: "smooth", block: "center" });
    }).catch(function () {
      mostrar(estado, "rojo", "<strong>No fue posible enviar la inscripción.</strong> Intente de nuevo en unos minutos o envíe la información a <a href='mailto:" + CONFIG.CORREO_CONTACTO + "'>" + CONFIG.CORREO_CONTACTO + "</a>.");
    }).finally(function () {
      boton.disabled = false;
      boton.textContent = boton.getAttribute("data-texto") || "Enviar inscripción";
    });
  }

  /* Inscripción de empresas: crea la cuenta en el portal (API propia). Si la API no
     está disponible (sitio servido sin funciones), cae al envío por correo. */
  var RUTAS = {
    empresas: { api: "/api/registro", portal: "portal.html", quien: "de empresas" },
    ies: { api: "/api/ies-registro", portal: "portal-ies.html", quien: "de instituciones" }
  };

  function enviarRegistro(form, datos, estado, boton, tipo) {
    var ruta = RUTAS[tipo] || RUTAS.empresas;
    boton.disabled = true;
    boton.textContent = "Enviando…";
    fetch(ruta.api, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(datos)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { j._estado = r.status; return j; });
    }).then(function (j) {
      if (j._estado === 201 && j.tokenRegistro) {
        mostrar(estado, "verde", "<strong>Inscripción recibida.</strong> Ahora cree su clave de acceso al portal.");
        var panel = document.getElementById("crear-clave");
        panel.hidden = false;
        panel.setAttribute("data-token", j.tokenRegistro);
        document.getElementById("clave-correo").textContent = j.correo;
        form.querySelectorAll("input, select, textarea, button").forEach(function (el) { el.disabled = true; });
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (j._estado === 409 && j.responsableExistente) {
        mostrar(estado, "ambar", "<strong>" + escapar(j.error) + "</strong> Escriba a <a href='mailto:" + CONFIG.CORREO_CONTACTO + "'>" + CONFIG.CORREO_CONTACTO + "</a>.");
        return;
      }
      if (j._estado === 409) {
        mostrar(estado, "ambar", "<strong>Este correo ya tiene una cuenta.</strong> <a href='" + ruta.portal + "'>Ingrese al portal " + ruta.quien + "</a> con su clave. Si la olvidó, escriba a <a href='mailto:" + CONFIG.CORREO_CONTACTO + "'>" + CONFIG.CORREO_CONTACTO + "</a>.");
        return;
      }
      if (j._estado === 404 || j._estado === 405) { enviarPorCorreo(form, datos, estado); return; }
      var detalle = j.campos ? " Campos: " + j.campos.join(", ") + "." : (j.causa ? " (" + j.causa + ")" : "");
      mostrar(estado, "rojo", "<strong>" + escapar(j.error || "No fue posible enviar la inscripción.") + "</strong>" + escapar(detalle));
    }).catch(function () {
      enviarPorCorreo(form, datos, estado);
    }).then(function () {
      boton.disabled = false;
      boton.textContent = boton.getAttribute("data-texto") || "Enviar inscripción";
    });
  }

  var formClave = document.getElementById("form-clave");
  if (formClave) {
    formClave.addEventListener("submit", function (e) {
      e.preventDefault();
      var estado = formClave.querySelector(".formulario__estado");
      var boton = formClave.querySelector("button[type=submit]");
      var token = document.getElementById("crear-clave").getAttribute("data-token");
      var clave = formClave.clave.value, conf = formClave.confirmacion.value;
      formClave.clave.closest(".campo").classList.toggle("invalido", clave.length < 8);
      formClave.confirmacion.closest(".campo").classList.toggle("invalido", conf.length < 8 || conf !== clave);
      if (clave.length < 8) return;
      if (conf !== clave) { mostrar(estado, "rojo", "La clave y su confirmación no coinciden."); return; }
      boton.disabled = true; boton.textContent = "Creando…";
      fetch("/api/clave", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ tokenRegistro: token, clave: clave, confirmacion: conf })
      }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j._estado = r.status; return j; }); })
        .then(function (j) {
          if (j.ok) { window.location.href = j.tipo === "ies" ? "portal-ies.html" : "portal.html"; return; }
          mostrar(estado, "rojo", "<strong>" + escapar(j.error || "No fue posible crear la clave.") + "</strong>");
        }).catch(function () { mostrar(estado, "rojo", "No fue posible conectar con el servidor. Intente de nuevo."); })
        .then(function () { boton.disabled = false; boton.textContent = boton.getAttribute("data-texto"); });
    });
  }

  function enviarPorCorreo(form, datos, estado) {
    var asunto = form.getAttribute("data-asunto") || "Inscripción Plan Padrino Milagro";
    var cuerpo = texto(form, datos);
    var url = "mailto:" + CONFIG.CORREO_CONTACTO +
      "?subject=" + encodeURIComponent(asunto) +
      "&body=" + encodeURIComponent(cuerpo + "\n\n(Enviado desde " + window.location.href + ")");
    window.PPM_ULTIMO_MAILTO = url; // registro para pruebas automáticas
    window.location.href = url;
    mostrar(estado, "info",
      "<strong>Se abrió su cliente de correo con la inscripción diligenciada.</strong> Revise el mensaje y pulse enviar. " +
      "Si no se abrió automáticamente, copie la información y envíela a <a href='mailto:" + CONFIG.CORREO_CONTACTO + "'>" + CONFIG.CORREO_CONTACTO + "</a>." +
      "<details style='margin-top:10px'><summary>Ver información diligenciada</summary><pre style='white-space:pre-wrap;font-size:.9rem'>" + escapar(cuerpo) + "</pre></details>");
    estado.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function mostrar(contenedor, tono, html) {
    if (!contenedor) return;
    contenedor.innerHTML = "<div class='aviso aviso--" + tono + "' role='status'>" + iconoAviso() + "<div>" + html + "</div></div>";
  }

  function iconoAviso() {
    return "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><circle cx='12' cy='12' r='10'/><path d='M12 8v4M12 16h.01'/></svg>";
  }

  function escapar(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- Formulario de empresas: listas dependientes y NIT ---------- */
  var T = window.PPM_TERRITORIOS;
  var selDepto = document.getElementById("emp-departamento");
  if (T && selDepto) {
    var selMun = document.getElementById("emp-municipio"), munOtro = document.getElementById("emp-municipio-otro");
    var selCam = document.getElementById("emp-camara-nombre"), camOtra = document.getElementById("emp-camara-otra");

    function llenar(select, opciones, primera) {
      select.innerHTML = "";
      var o0 = document.createElement("option"); o0.value = ""; o0.textContent = primera; select.appendChild(o0);
      opciones.forEach(function (t) { var o = document.createElement("option"); o.value = t; o.textContent = t; select.appendChild(o); });
    }

    function alCambiarDepto() {
      var d = T.departamento(selDepto.value);
      if (d) {
        llenar(selMun, d.municipios.concat([T.OTRO]), "Seleccione el municipio…");
        selMun.disabled = false; selMun.required = true; selMun.hidden = false;
        munOtro.hidden = true; munOtro.required = false; munOtro.value = "";
        llenar(selCam, d.camaras.concat(["Otra", "Ninguna"]), "Seleccione la cámara…");
        selCam.disabled = false; selCam.hidden = false;
        camOtra.hidden = true; camOtra.value = "";
      } else if (selDepto.value === "Otro") {
        selMun.hidden = true; selMun.disabled = true; selMun.required = false; selMun.value = "";
        munOtro.hidden = false; munOtro.required = true;
        selCam.hidden = true; selCam.disabled = true; selCam.value = "";
        camOtra.hidden = false;
      } else {
        llenar(selMun, [], "Seleccione primero el departamento"); selMun.disabled = true; selMun.hidden = false;
        munOtro.hidden = true; munOtro.required = false;
        llenar(selCam, [], "Seleccione primero el departamento"); selCam.disabled = true; selCam.hidden = false;
        camOtra.hidden = true;
      }
    }
    selDepto.addEventListener("change", alCambiarDepto);
    selMun.addEventListener("change", function () {
      var otro = selMun.value === T.OTRO;
      munOtro.hidden = !otro; munOtro.required = otro; if (!otro) munOtro.value = "";
    });
    selCam.addEventListener("change", function () {
      var otra = selCam.value === "Otra";
      camOtra.hidden = !otra; if (!otra) camOtra.value = "";
    });
    alCambiarDepto();

    // Identificación: ayuda y validación según el tipo
    var selTipo = document.getElementById("emp-tipo-id"), inpNit = document.getElementById("emp-nit");
    var ayudaNit = document.getElementById("emp-nit-ayuda"), errorNit = document.getElementById("emp-nit-error");
    function ajustarIdentificacion() {
      var t = selTipo.value;
      inpNit.disabled = t === "Sin registro";
      inpNit.required = t === "NIT" || t === "Cédula de ciudadanía";
      if (t === "Sin registro") inpNit.value = "";
      ayudaNit.textContent = t === "NIT" ? "Nueve dígitos y dígito de verificación, por ejemplo 900123456-7." : (t === "Cédula de ciudadanía" ? "Cédula del propietario, solo números." : "NIT con dígito de verificación (900123456-7) o cédula del propietario.");
    }
    selTipo.addEventListener("change", ajustarIdentificacion);
    ajustarIdentificacion();
    inpNit.addEventListener("blur", function () {
      var campo = inpNit.closest(".campo");
      var problema = inpNit.value.trim() ? T.validarIdentificacion(selTipo.value, inpNit.value) : (inpNit.required ? "Indique el número." : null);
      campo.classList.toggle("invalido", Boolean(problema));
      errorNit.textContent = problema || "Indique un número válido.";
    });
  }

  /* ---------- Formulario de IES: búsqueda en el padrón ---------- */
  var inpBuscar = document.getElementById("ies-buscar");
  if (inpBuscar && window.PPM_IES) {
    var listaSug = document.getElementById("ies-sugerencias"), inpClave = document.getElementById("ies-clave"),
      inpNombre = document.getElementById("ies-nombre"), ficha = document.getElementById("ies-ficha"),
      campoFicha = document.getElementById("ies-seleccionada"), notaPadron = document.getElementById("ies-padron-nota"),
      chkManual = document.getElementById("ies-manual"), camposManual = document.getElementById("ies-manual-campos");
    var padron = { lista: window.PPM_IES.LISTA, fuente: "respaldo" };
    var activa = -1;

    function describirPadron() {
      var n = padron.lista.length;
      notaPadron.textContent = padron.fuente === "respaldo"
        ? n + " IES en el padrón de respaldo (SNIES). Escriba para buscar."
        : n + " IES activas según el SNIES (datos abiertos del MEN). Escriba para buscar.";
    }
    describirPadron();
    fetch("/api/ies-padron", { headers: { "Accept": "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && j.ok && j.ies && j.ies.length) { padron = { lista: j.ies, fuente: j.fuente }; describirPadron(); } })
      .catch(function () { /* se mantiene el respaldo */ });

    function cerrarSugerencias() { listaSug.hidden = true; listaSug.innerHTML = ""; activa = -1; inpBuscar.setAttribute("aria-expanded", "false"); }

    function seleccionar(ies) {
      inpClave.value = ies.clave || "";
      inpNombre.value = ies.nombre;
      inpBuscar.value = ies.nombre;
      ficha.innerHTML = "<strong>" + escapar(ies.nombre) + "</strong>" +
        "<span>" + escapar([ies.caracter, ies.sector].filter(Boolean).join(" · ")) + "</span>" +
        "<span>" + escapar([ies.municipio, ies.departamento].filter(Boolean).join(", ")) + (ies.codigo ? " · Código SNIES " + escapar(ies.codigo) : "") + "</span>";
      campoFicha.hidden = false;
      inpBuscar.closest(".campo").classList.remove("invalido");
      cerrarSugerencias();
    }

    function pintarSugerencias() {
      var q = inpBuscar.value.trim();
      if (inpClave.value && q === inpNombre.value) { cerrarSugerencias(); return; }
      inpClave.value = ""; inpNombre.value = ""; campoFicha.hidden = true;
      if (q.length < 2) { cerrarSugerencias(); return; }
      var resultados = window.PPM_IES.buscar(q, padron.lista, 10);
      if (!resultados.length) {
        listaSug.innerHTML = "<li class='sugerencias__vacio'>No hay coincidencias. Pruebe con otra palabra o marque \"Mi institución no aparece\".</li>";
      } else {
        listaSug.innerHTML = resultados.map(function (ies, i) {
          return "<li role='option' id='ies-op-" + i + "' data-clave='" + escapar(ies.clave) + "'><strong>" + escapar(ies.nombre) + "</strong><small>" +
            escapar([ies.caracter, ies.municipio || ies.departamento].filter(Boolean).join(" · ")) + "</small></li>";
        }).join("");
      }
      listaSug.hidden = false; activa = -1;
      inpBuscar.setAttribute("aria-expanded", "true");
      listaSug._resultados = resultados;
    }

    inpBuscar.addEventListener("input", pintarSugerencias);
    inpBuscar.addEventListener("focus", function () { if (!inpClave.value) pintarSugerencias(); });
    inpBuscar.addEventListener("keydown", function (e) {
      var items = listaSug.querySelectorAll("li[role=option]");
      if (listaSug.hidden || !items.length) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        activa = (activa + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items.forEach(function (li, i) { li.classList.toggle("activa", i === activa); });
        inpBuscar.setAttribute("aria-activedescendant", items[activa].id);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (activa >= 0) seleccionar(listaSug._resultados[activa]);
        else if (items.length === 1) seleccionar(listaSug._resultados[0]);
      } else if (e.key === "Escape") { cerrarSugerencias(); }
    });
    listaSug.addEventListener("mousedown", function (e) {
      var li = e.target.closest("li[role=option]");
      if (!li) return;
      e.preventDefault();
      var clave = li.getAttribute("data-clave");
      var ies = null;
      (listaSug._resultados || []).forEach(function (x) { if (x.clave === clave) ies = x; });
      if (ies) seleccionar(ies);
    });
    document.addEventListener("click", function (e) { if (!inpBuscar.contains(e.target) && !listaSug.contains(e.target)) cerrarSugerencias(); });

    function alternarManual() {
      var manual = chkManual.checked;
      camposManual.hidden = !manual;
      document.getElementById("campo-ies-buscar").hidden = manual;
      campoFicha.hidden = manual || !inpClave.value;
      ["ies-nombre-manual", "ies-caracter", "ies-departamento", "ies-ciudad"].forEach(function (id) { document.getElementById(id).required = manual; });
      if (manual) { inpClave.value = ""; inpNombre.value = ""; inpBuscar.value = ""; cerrarSugerencias(); inpBuscar.closest(".campo").classList.remove("invalido"); }
    }
    chkManual.addEventListener("change", alternarManual);
    alternarManual();
  }

  /* ---------- Año en el pie ---------- */
  document.querySelectorAll("[data-anio]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();
