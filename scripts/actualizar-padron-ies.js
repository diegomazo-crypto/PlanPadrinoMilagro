#!/usr/bin/env node
"use strict";
/* Regenera assets/js/ies-snies.js a partir de una exportación oficial del SNIES
   (CSV o JSON descargado de datos.gov.co, conjunto n5yy-8nav, o del portal SNIES).
   Uso: node scripts/actualizar-padron-ies.js <archivo.csv|archivo.json>
   Conserva solo las IES con estado ACTIVA y detecta las columnas por nombre
   (código, nombre, estado, carácter, sector, departamento, municipio). */
const fs = require("fs");
const path = require("path");
const { normalizarFilas } = require("../lib/ies-padron");

const archivo = process.argv[2];
if (!archivo) { console.error("Uso: node scripts/actualizar-padron-ies.js <archivo.csv|archivo.json>"); process.exit(1); }

function leerCsv(texto) {
  const filas = [];
  let fila = [], celda = "", comillas = false;
  texto = texto.replace(/^﻿/, "");
  const sep = (texto.split("\n")[0].match(/;/g) || []).length > (texto.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') { celda += '"'; i++; }
      else if (c === '"') comillas = false;
      else celda += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) { fila.push(celda); celda = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && texto[i + 1] === "\n") i++; fila.push(celda); filas.push(fila); fila = []; celda = ""; }
    else celda += c;
  }
  if (celda || fila.length) { fila.push(celda); filas.push(fila); }
  const cab = filas.shift().map((h) => h.trim());
  return filas.filter((f) => f.some((v) => v.trim())).map((f) => Object.fromEntries(cab.map((h, i) => [h, f[i] || ""])));
}

const texto = fs.readFileSync(archivo, "utf8");
const filas = archivo.toLowerCase().endsWith(".json") ? JSON.parse(texto) : leerCsv(texto);
const lista = normalizarFilas(filas);
if (lista.length < 50) { console.error("Solo se reconocieron " + lista.length + " IES activas; revise las columnas del archivo."); process.exit(1); }

const invCaracter = { "Universidad": "U", "Institución universitaria / Escuela tecnológica": "IU", "Institución tecnológica": "IT", "Institución técnica profesional": "ITP" };
const invSector = { "Oficial": "O", "Privada": "P" };
const destino = path.join(__dirname, "..", "assets", "js", "ies-snies.js");
let fuente = fs.readFileSync(destino, "utf8");
const ini = fuente.indexOf("  var FILAS = [");
const fin = fuente.indexOf("  ];", ini) + 4;
const cuerpo = lista.map((i) => "    " + JSON.stringify([i.nombre, invCaracter[i.caracter] || i.caracter, invSector[i.sector] || i.sector, i.departamento, i.municipio, i.codigo])).join(",\n");
fuente = fuente.slice(0, ini) + "  var FILAS = [\n" + cuerpo + "\n  ];" + fuente.slice(fin);
fuente = fuente.replace(/ACTUALIZADO: "[^"]*"/, 'ACTUALIZADO: "' + new Date().toISOString().slice(0, 10) + '"');
fuente = fuente.replace(/FUENTE: "[^"]*"/, 'FUENTE: "SNIES – Ministerio de Educación Nacional (exportación oficial cargada con scripts/actualizar-padron-ies.js)"');
fs.writeFileSync(destino, fuente, "utf8");
console.log("Padrón actualizado: " + lista.length + " IES activas → " + path.relative(process.cwd(), destino));
