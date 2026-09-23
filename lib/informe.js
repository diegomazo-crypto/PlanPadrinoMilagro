"use strict";
/* Informe de autodiagnóstico en PDF (modelo CRL) y su archivo cifrado en el almacén,
   para compartirlo con la secretaría técnica y la IES que apadrine a la empresa. */
const { leerRegistro, guardarRegistro } = require("./almacen");
const instrumento = require("../assets/js/instrumento.js");

const AZUL = "#08366A", AMARILLO = "#E9A619", ROJO = "#E3141E", GRIS = "#C2C3C7", TEXTO = "#1F2A3A", TEXTO2 = "#4C5A6E", FONDO = "#F4F6F9";

function ruta(id) { return "informes/" + id + ".json"; }

function slug(s) {
  return String(s || "empresa").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "").slice(0, 40) || "Empresa";
}

function nombreArchivo(empresa) {
  const fecha = new Date().toISOString().slice(0, 7).replace("-", "");
  return "PlanMilagro_Informe_Autodiagnostico_" + slug(empresa.datos && empresa.datos.empresa) + "_" + fecha + ".pdf";
}

function fechaLarga(iso) {
  try { return new Date(iso).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric", timeZone: "America/Bogota" }); }
  catch (e) { return String(iso).slice(0, 10); }
}

function valor(v) { return v === null || v === undefined || v === "" ? "—" : String(v); }

/* Genera el PDF y devuelve un Buffer. */
function generarPdf(empresa) {
  const PDFDocument = require("pdfkit");
  const d = empresa.datos || {}, diag = empresa.diagnostico || {}, r = diag.resultados;
  if (!r) throw new Error("El autodiagnóstico no tiene resultados.");
  return new Promise((resolver, rechazar) => {
    const doc = new PDFDocument({ size: "LETTER", margins: { top: 64, bottom: 64, left: 56, right: 56 }, bufferPages: true, info: { Title: "Informe de autodiagnóstico — " + (d.empresa || ""), Author: "Plan Milagro", Subject: "Modelo CRL" } });
    const trozos = [];
    doc.on("data", (t) => trozos.push(t));
    doc.on("end", () => resolver(Buffer.concat(trozos)));
    doc.on("error", rechazar);

    const ancho = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const x0 = doc.page.margins.left;

    function cabecera() {
      doc.save();
      const y = 28, w = doc.page.width;
      doc.rect(0, 0, w, 6).fill(AZUL);
      [[0.25, AZUL], [0.25, AMARILLO], [0.25, ROJO], [0.25, GRIS]].reduce((x, [p, c]) => { doc.rect(x, 0, w * p, 6).fill(c); return x + w * p; }, 0);
      doc.font("Helvetica-Bold").fontSize(8).fillColor(ROJO).text("PLAN MILAGRO  ·  PARA RECONSTRUCCIÓN PRODUCTIVA", x0, y, { width: ancho * 0.62, characterSpacing: 0.8, lineBreak: false });
      doc.font("Helvetica").fontSize(8).fillColor(TEXTO2).text("Informe de autodiagnóstico · modelo CRL", x0 + ancho * 0.62, y, { width: ancho * 0.38, align: "right", lineBreak: false });
      doc.restore();
      doc.y = doc.page.margins.top;   // el texto de la cabecera no desplaza el contenido
    }

    function asegurarEspacio(alto) {
      if (doc.y + alto > doc.page.height - doc.page.margins.bottom) doc.addPage();
    }

    function titulo(t) {
      asegurarEspacio(70);
      doc.moveDown(0.6);
      doc.font("Helvetica-Bold").fontSize(15).fillColor(AZUL).text(t, x0, doc.y, { width: ancho });
      doc.moveTo(x0, doc.y + 2).lineTo(x0 + ancho, doc.y + 2).lineWidth(1).strokeColor(AZUL).stroke();
      doc.moveDown(0.6);
    }

    function fila(etiqueta, texto, anchoEtiqueta) {
      const we = anchoEtiqueta || 150, t = valor(texto);
      doc.font("Helvetica-Bold").fontSize(10);
      const he = doc.heightOfString(etiqueta, { width: we });
      doc.font("Helvetica").fontSize(10);
      const hv = doc.heightOfString(t, { width: ancho - we - 6 });
      asegurarEspacio(Math.max(he, hv) + 6);
      const y = doc.y;
      doc.font("Helvetica-Bold").fontSize(10).fillColor(TEXTO2).text(etiqueta, x0, y, { width: we });
      doc.font("Helvetica").fontSize(10).fillColor(TEXTO).text(t, x0 + we + 6, y, { width: ancho - we - 6 });
      doc.y = y + Math.max(he, hv) + 5;
    }

    doc.on("pageAdded", cabecera);
    cabecera();

    // Portada resumida
    doc.font("Helvetica-Bold").fontSize(22).fillColor(AZUL).text(d.empresa || "Empresa", x0, 72, { width: ancho });
    doc.font("Helvetica").fontSize(11).fillColor(TEXTO2).text("Informe de autodiagnóstico de capacidades empresariales · " + fechaLarga(diag.finalizado || new Date().toISOString()), { width: ancho });
    doc.moveDown(1);

    // Resultado global destacado
    const yG = doc.y;
    doc.roundedRect(x0, yG, ancho, 84, 8).fill(AZUL);
    doc.font("Helvetica-Bold").fontSize(34).fillColor("#FFFFFF").text(r.global.toFixed(2), x0 + 22, yG + 18, { continued: true }).fontSize(14).fillColor(AMARILLO).text("  / 5");
    doc.font("Helvetica-Bold").fontSize(13).fillColor("#FFFFFF").text("Nivel global: " + r.nivelGlobal, x0 + 190, yG + 22, { width: ancho - 210 });
    doc.font("Helvetica").fontSize(9.5).fillColor("#FFFFFF").text("Promedio de las cinco capacidades, cada una ponderada según los pesos del modelo CRL. Escala 0 (no existe) a 5 (optimizado).", x0 + 190, yG + 42, { width: ancho - 210 });
    doc.y = yG + 84 + 14;

    // Barras por capacidad
    r.capacidades.forEach((c) => {
      asegurarEspacio(60);
      const y = doc.y;
      doc.font("Helvetica-Bold").fontSize(10.5).fillColor(AZUL).text(c.nombre, x0, y, { width: ancho - 120 });
      doc.font("Helvetica-Bold").fontSize(10.5).fillColor(TEXTO).text(c.ponderado.toFixed(2) + "  ·  " + c.nivel, x0, y, { width: ancho, align: "right" });
      const yb = doc.y + 3;
      doc.roundedRect(x0, yb, ancho, 8, 4).fill("#E6EBF2");
      doc.roundedRect(x0, yb, Math.max(8, ancho * c.ponderado / 5), 8, 4).fill(c.ponderado >= 3 ? AZUL : (c.ponderado >= 2 ? AMARILLO : ROJO));
      doc.y = yb + 12;
      doc.font("Helvetica").fontSize(9.5).fillColor(TEXTO2).text(c.recomendacion, x0, doc.y, { width: ancho });
      doc.moveDown(0.7);
    });

    // Datos de la empresa
    titulo("Datos de la empresa");
    fila("Identificación", d.tipo_identificacion ? d.tipo_identificacion + (d.nit ? " " + d.nit : "") : d.nit);
    fila("Ubicación", [d.municipio, d.departamento].filter(Boolean).join(", "));
    fila("Sector y tamaño", [d.sector, d.tamano].filter(Boolean).join(" · "));
    fila("Años de operación", d.anios_operacion);
    fila("Estado operativo", d.estado_operativo);
    fila("Afectación", d.tipo_afectacion);
    fila("Empleos antes / ahora", [d.empleos_antes, d.empleos_actuales].map(valor).join(" / "));
    fila("Frente prioritario", d.frente_prioritario);
    fila("Interlocutor", [d.contacto_nombre, d.contacto_cargo].filter(Boolean).join(", ") + (empresa.correo ? " · " + empresa.correo : "") + (d.contacto_telefono ? " · " + d.contacto_telefono : ""));
    if (d.descripcion_afectacion) { fila("Descripción de la afectación", d.descripcion_afectacion); }
    if (d.reto_principal) { fila("Reto principal", d.reto_principal); }

    // Detalle por capacidad
    instrumento.CAPACIDADES.forEach((cap) => {
      const rc = r.capacidades.find((c) => c.id === cap.id) || {};
      asegurarEspacio(120);
      titulo(cap.numero + ". " + cap.nombre + "  —  " + (rc.ponderado !== undefined ? rc.ponderado.toFixed(2) : "") + " · " + (rc.nivel || ""));
      doc.font("Helvetica-Oblique").fontSize(9.5).fillColor(TEXTO2).text(cap.descripcion, x0, doc.y, { width: ancho });
      doc.moveDown(0.5);
      cap.factores.forEach((f) => {
        const v = diag.respuestas ? diag.respuestas[f.codigo] : undefined;
        const esc = v === undefined || v === null ? null : instrumento.ESCALA[Number(v)];
        asegurarEspacio(48);
        const y = doc.y;
        doc.roundedRect(x0, y - 2, 28, 16, 3).fill(esc ? (Number(v) >= 3 ? AZUL : (Number(v) >= 2 ? AMARILLO : ROJO)) : GRIS);
        doc.font("Helvetica-Bold").fontSize(9).fillColor("#FFFFFF").text(esc ? String(v) : "—", x0, y + 1, { width: 28, align: "center" });
        doc.font("Helvetica-Bold").fontSize(9.5).fillColor(TEXTO).text(f.codigo + "  " + (esc ? esc.nombre : "Sin respuesta") + "  (peso " + Math.round(f.peso * 100) + " %)", x0 + 36, y, { width: ancho - 36 });
        doc.font("Helvetica").fontSize(9).fillColor(TEXTO2).text(f.texto, x0 + 36, doc.y, { width: ancho - 36 });
        const obs = diag.observaciones && diag.observaciones[f.codigo];
        if (obs) doc.font("Helvetica-Oblique").fontSize(9).fillColor(TEXTO).text("Observación: " + obs, x0 + 36, doc.y, { width: ancho - 36 });
        doc.moveDown(0.5);
      });
      if (cap.extras) {
        asegurarEspacio(60);
        doc.font("Helvetica-Bold").fontSize(10).fillColor(AZUL).text(cap.extras.titulo, x0, doc.y, { width: ancho });
        doc.moveDown(0.2);
        cap.extras.campos.forEach((campo) => {
          const x = diag.extras ? diag.extras[campo.id] : undefined;
          let texto;
          if (x && typeof x === "object") {
            const claves = campo.tipo === "anios" ? campo.anios : campo.columnas;
            texto = claves.map((k) => k + ": " + valor(x[k])).join("   ·   ");
          } else texto = valor(x);
          if (campo.unidad && texto !== "—") texto += "  (" + campo.unidad + ")";
          fila(campo.etiqueta, texto, 250);
        });
      }
    });

    // Cierre
    asegurarEspacio(90);
    doc.moveDown(1);
    doc.roundedRect(x0, doc.y, ancho, 62, 8).fill(FONDO);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(AZUL).text("Confidencialidad y uso del informe", x0 + 14, doc.y + 10, { width: ancho - 28 });
    doc.font("Helvetica").fontSize(9).fillColor(TEXTO2).text("Este informe fue diligenciado por la empresa y es el punto de partida del acompañamiento. Solo lo conocen la secretaría técnica del Plan y la Institución de Educación Superior que apadrine a la empresa, que lo contrastará con evidencias en la primera sesión. Modelo CRL: Castrillón, Urrego y Trejos.", x0 + 14, doc.y + 4, { width: ancho - 28 });

    // Numeración de páginas
    const total = doc.bufferedPageRange().count;
    for (let i = 0; i < total; i++) {
      doc.switchToPage(i);
      const margenInferior = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;   // escribir en el margen no debe crear páginas nuevas
      doc.font("Helvetica").fontSize(8.5).fillColor(TEXTO2).text("Plan Milagro · " + (d.empresa || "") + " · Página " + (i + 1) + " de " + total, x0, doc.page.height - 40, { width: ancho, align: "center", lineBreak: false });
      doc.page.margins.bottom = margenInferior;
    }
    doc.end();
  });
}

/* Guarda el PDF cifrado en el almacén y devuelve el resumen que se anota en la empresa. */
async function guardarInforme(empresa, pdf) {
  const nombre = nombreArchivo(empresa);
  const generado = new Date().toISOString();
  await guardarRegistro(ruta(empresa.id), { nombre, tipo: "application/pdf", generado, base64: pdf.toString("base64") });
  return { nombre, generado, bytes: pdf.length };
}

async function cargarInforme(id) {
  if (!/^[0-9a-f]{64}$/.test(id || "")) return null;
  const reg = await leerRegistro(ruta(id));
  if (!reg || !reg.base64) return null;
  return { nombre: reg.nombre, tipo: reg.tipo || "application/pdf", generado: reg.generado, contenido: Buffer.from(reg.base64, "base64") };
}

module.exports = { generarPdf, guardarInforme, cargarInforme, nombreArchivo };
