# Plan Padrino Milagro — sitio web

Sitio estático del **Plan Padrino Milagro para la Reconstrucción Productiva**: acompañamiento técnico
de equipos de estudiantes y docentes de Instituciones de Educación Superior a micro y pequeñas empresas
afectadas por el terremoto del 10 de agosto de 2026.

## Páginas

| Archivo | Contenido |
|---|---|
| `index.html` | Qué es el Plan: contexto, propuesta, frentes, qué es y qué no es, ruta, cronograma, actores, principios. |
| `empresas.html` | Guía de participación para empresas y formulario de inscripción. |
| `ies.html` | Guía de participación para IES, estudiantes y docentes y formulario de vinculación institucional. |
| `recursos.html` | Documentos descargables, estructura del formato común de reporte, enlaces, preguntas frecuentes y contacto. |

## Estructura

```
├── index.html
├── empresas.html
├── ies.html
├── recursos.html
├── assets/
│   ├── css/styles.css      Hoja de estilos
│   ├── js/config.js        Configuración (endpoints de formularios, correo)
│   ├── js/main.js          Menú, índice lateral, validación y envío de formularios
│   └── img/logo.svg
└── docs/                   PDFs descargables (ver docs/README.md)
```

No requiere proceso de construcción ni dependencias. Puede publicarse directamente en GitHub Pages
(rama principal, carpeta raíz) o en cualquier servidor de archivos estáticos.

## Formularios de inscripción

Los formularios validan en el navegador y envían un `POST` con cuerpo JSON al endpoint configurado en
`assets/js/config.js`:

```js
window.PPM_CONFIG = {
  ENDPOINT_EMPRESAS: "https://…",   // recibe inscripciones de empresas
  ENDPOINT_IES: "https://…",        // recibe vinculaciones de IES
  CORREO_CONTACTO: "padrinomilagro@ceipa.edu.co"
};
```

Sirve cualquier servicio que acepte JSON: Formspree, Power Automate (flujo "Cuando se recibe una solicitud
HTTP" que escriba en una lista de SharePoint o en Excel), Netlify Forms, Google Apps Script o un backend
propio.

Mientras los endpoints estén vacíos, el formulario abre el cliente de correo del visitante con toda la
información diligenciada dirigida a `CORREO_CONTACTO`, de modo que el sitio funciona desde el primer día.

## Vista previa local

```bash
python3 -m http.server 8080
# abrir http://localhost:8080
```
