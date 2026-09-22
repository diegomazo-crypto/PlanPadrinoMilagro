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
| `portal.html` | Portal de empresas: inicio de sesión, aceptación del compromiso y los términos, autodiagnóstico por pasos y resultados. |

## Estructura

```
├── index.html
├── empresas.html
├── ies.html
├── recursos.html
├── portal.html
├── api/                    Funciones de servidor (Vercel): registro, clave, sesion, aceptacion, diagnostico, exportar
├── lib/                    Cifrado, almacenamiento, sesión y acceso a los registros
├── assets/
│   ├── css/styles.css      Hoja de estilos
│   ├── js/config.js        Configuración (endpoint del formulario de IES, correo)
│   ├── js/main.js          Menú, índice lateral, validación y envío de formularios
│   ├── js/instrumento.js   Instrumento de autodiagnóstico (modelo CRL), usado en navegador y servidor
│   ├── js/portal.js        Lógica del portal de empresas
│   └── img/
├── scripts/servidor-local.js   Servidor de desarrollo (sitio + API) para pruebas locales
└── docs/                   PDFs descargables (ver docs/README.md)
```

Las páginas públicas son estáticas. El portal de empresas usa las funciones de `api/`, que corren en
Vercel sin proceso de construcción.

## Portal de empresas y datos cifrados

Flujo de una empresa:

1. **Inscripción** en `empresas.html`. El servidor crea un registro cifrado y pide crear una **clave de
   acceso**. El usuario es el correo del interlocutor. La clave no puede ser ni contener ningún dato de la
   inscripción (empresa, NIT, nombres, teléfono, correo).
2. **Aceptación** en el portal de dos documentos: el compromiso de participación y los términos del
   acompañamiento y confidencialidad. Si la empresa no acepta, el proceso termina y se le agradece.
3. **Autodiagnóstico** de madurez de capacidades (modelo CRL): 5 capacidades, 46 factores en escala 0–5
   y datos de desempeño. Se guarda paso a paso; la empresa puede salir y retomar donde quedó.
4. **Resultados** ponderados por capacidad y globales, con nivel y recomendación.

Almacenamiento: un archivo por empresa en Vercel Blob (acceso privado), cifrado con AES-256-GCM antes de
guardarse. Las claves de acceso se guardan con hash scrypt. Las sesiones son cookies firmadas (HttpOnly).
Ninguna empresa puede ver datos de otra: cada solicitud opera solo sobre el registro de la sesión.

### Variables de entorno en Vercel (Settings → Environment Variables)

| Variable | Cómo obtenerla | Uso |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | Se crea sola al conectar un almacén Blob al proyecto (Storage → Create → Blob). | Guardar y leer los archivos cifrados. |
| `PPM_CLAVE_CIFRADO` | `openssl rand -hex 32` (64 caracteres hexadecimales). | Clave de cifrado de los registros. **Si se pierde, los datos no se pueden recuperar.** Guárdela en un gestor de secretos. |
| `PPM_SECRETO_SESION` | `openssl rand -hex 32`. | Firma de las cookies de sesión. |
| `PPM_CLAVE_ADMIN` | Una contraseña larga (mínimo 12 caracteres). | Autoriza la exportación de datos para la secretaría técnica. |

Después de definirlas hay que **redesplegar** el proyecto para que las funciones las tomen.

### Exportar los datos (secretaría técnica)

```
https://www.planpadrinomilagro.co/api/exportar?formato=csv     → resumen en CSV (una fila por empresa)
https://www.planpadrinomilagro.co/api/exportar                 → JSON completo (inscripción, aceptaciones, respuestas y resultados)
```

Envíe la clave de administración en la cabecera `x-clave-admin` (por ejemplo con `curl -H`) o como
parámetro `?clave=`. La exportación nunca incluye los hashes de las claves de acceso.

### Pruebas locales

```bash
npm install
npm run dev            # http://localhost:8765; datos cifrados en ./.datos-local
```

Sin `BLOB_READ_WRITE_TOKEN` el servidor local guarda los archivos en disco. Sin `PPM_CLAVE_CIFRADO`
usa una clave de desarrollo; en producción esa variable es obligatoria.

## Publicación en Vercel

El sitio se publica en Vercel desde la rama `main` en **https://www.planpadrinomilagro.co**
(dirección técnica de respaldo: https://plan-padrino-milagro.vercel.app).

El repositorio incluye `vercel.json` (URLs limpias, cabeceras de seguridad y caché de recursos).
Para reproducir la configuración en otra cuenta:

1. Entrar a [vercel.com](https://vercel.com) con la cuenta de GitHub e importar este repositorio.
2. En la configuración del proyecto dejar *Framework Preset* en **Other**, sin comando de compilación y
   con el directorio de salida vacío (raíz del repositorio).
3. Desplegar. Cada cambio en `main` publica una nueva versión; cada pull request genera una vista previa.
4. Para el dominio propio, agregarlo en *Settings → Domains* del proyecto y crear en el registrador los
   registros DNS que Vercel indique (por lo general un registro A para el dominio raíz y un CNAME para `www`).

## Formulario de vinculación de IES

El formulario de IES valida en el navegador y envía un `POST` con cuerpo JSON al endpoint configurado en
`assets/js/config.js` (`ENDPOINT_IES`): Formspree, Power Automate, Google Apps Script o un backend propio.
Mientras esté vacío, abre el cliente de correo del visitante con la información diligenciada dirigida a
`CORREO_CONTACTO`.

El formulario de empresas usa siempre la API propia (`/api/registro`); `ENDPOINT_EMPRESAS` solo se
tendría en cuenta si se quisiera enviar las inscripciones a un servicio externo en lugar del portal.

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
