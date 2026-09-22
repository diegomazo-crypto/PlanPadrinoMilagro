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

No requiere proceso de construcción ni dependencias. Puede servirse desde cualquier alojamiento de
archivos estáticos.

## Publicación en Vercel

El sitio se publica en Vercel desde la rama `main`: https://plan-padrino-milagro.vercel.app

El repositorio incluye `vercel.json` (URLs limpias, cabeceras de seguridad y caché de recursos).
Para reproducir la configuración en otra cuenta:

1. Entrar a [vercel.com](https://vercel.com) con la cuenta de GitHub e importar este repositorio.
2. En la configuración del proyecto dejar *Framework Preset* en **Other**, sin comando de compilación y
   con el directorio de salida vacío (raíz del repositorio).
3. Desplegar. Cada cambio en `main` publica una nueva versión; cada pull request genera una vista previa.
4. Para el dominio propio, agregarlo en *Settings → Domains* del proyecto y crear en el registrador los
   registros DNS que Vercel indique (por lo general un registro A para el dominio raíz y un CNAME para `www`).

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

## Identidad visual

El sitio aplica el *Manual de Identidad Visual v1* del Plan (logo "Sol de la Reconstrucción", septiembre 2026):

| Elemento | Valor |
|---|---|
| Amarillo Sol (acento) | `#FCD116` |
| Azul Institucional (enlaces, botón primario) | `#003893` |
| Rojo Bandera (acentos, alertas, etiquetas) | `#CE1126` |
| Azul Marino (texto, íconos, fondos oscuros) | `#14213D` |
| Gris Texto | `#5B6472` |
| Fondo Claro / Borde | `#F4F5F7` / `#E4E6EA` |
| Tipografía | Manrope 800 (H1), 700 (H2, botones, etiquetas), 500 (cuerpo) |

Logos en `assets/img/`: `logo.svg` (uso principal), `logo-blanco.svg` (fondos oscuros),
`logo-uncolor.svg` (impresión a un color) y `favicon.svg` (sol y brote).
