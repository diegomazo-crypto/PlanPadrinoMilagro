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
| `portal-ies.html` | Portal de instituciones: inicio de sesión del responsable y administración de los grupos que apadrinan empresas. |

## Estructura

```
├── index.html
├── empresas.html
├── ies.html
├── recursos.html
├── portal.html
├── portal-ies.html
├── api/                    Funciones de servidor (Vercel): registro, clave, sesion, aceptacion, diagnostico, exportar,
│                           ies-padron, ies-registro, grupos
├── lib/                    Cifrado, almacenamiento, sesión y acceso a los registros (empresas e IES)
├── assets/
│   ├── css/styles.css      Hoja de estilos
│   ├── js/config.js        Configuración (endpoint del formulario de IES, correo)
│   ├── js/main.js          Menú, índice lateral, validación y envío de formularios
│   ├── js/instrumento.js   Instrumento de autodiagnóstico (modelo CRL), usado en navegador y servidor
│   ├── js/ies-snies.js     Padrón de respaldo de IES activas (SNIES), usado en navegador y servidor
│   ├── js/portal.js        Lógica del portal de empresas
│   ├── js/portal-ies.js    Lógica del portal de instituciones (grupos)
│   └── img/
├── scripts/servidor-local.js   Servidor de desarrollo (sitio + API) para pruebas locales
├── scripts/actualizar-padron-ies.js   Regenera el padrón de IES desde una exportación oficial del SNIES
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

## Portal de instituciones (IES) y grupos

Flujo de una IES:

1. **Vinculación** en `ies.html`. El responsable designado busca la institución en el **padrón de IES activas
   del SNIES** (o la declara manualmente si no aparece), registra sus datos de contacto, la capacidad de
   acompañamiento y acepta los compromisos institucionales en bloque. Cada institución admite un único
   responsable con cuenta; un segundo intento recibe un aviso con el correo enmascarado del responsable actual.
2. **Clave de acceso** con las mismas reglas que las empresas (no puede ser ni contener datos de la inscripción).
   El usuario es el correo institucional del responsable.
3. **Portal de instituciones** (`portal-ies.html`): el responsable crea, edita y elimina los **grupos que
   apadrinan**. Cada grupo registra nombre, programa, campo de asesoramiento principal y secundarios, temas,
   modalidad, territorios, periodo de inicio, capacidad de empresas, docente tutor (contacto principal) y los
   miembros con rol, programa, semestre y contacto. Con esos datos la secretaría técnica hace el emparejamiento.

Los registros de IES se guardan cifrados en `ies/<id>.json`, separados de los de empresas. Las sesiones llevan
el tipo de cuenta dentro del token firmado, de modo que una cuenta de empresa no puede usar las rutas de IES ni
al contrario, aunque compartan correo.

### Padrón de IES activas (SNIES)

`GET /api/ies-padron` devuelve el padrón que usa el formulario. Orden de fuentes:

1. **Datos abiertos del MEN**: conjunto `MEN_INSTITUCIONES EDUCACIÓN SUPERIOR` (datos.gov.co, `n5yy-8nav`),
   que replica el SNIES. Se filtran las IES con estado *activa*, se guarda una copia cifrada y se cachea 24 h.
   La URL puede cambiarse con la variable `PPM_URL_PADRON_IES`.
2. **Última copia** descargada, si la consulta en vivo falla.
3. **Padrón de respaldo** incorporado en `assets/js/ies-snies.js` (227 IES, sin código SNIES), que también se
   usa en el navegador mientras responde la API.

Para reemplazar el respaldo por una exportación oficial (CSV o JSON del SNIES o de datos.gov.co):

```
node scripts/actualizar-padron-ies.js exportacion-snies.csv
```

La respuesta de `/api/ies-padron` indica en `fuente` cuál de las tres se está usando.

### Variables de entorno en Vercel (Settings → Environment Variables)

| Variable | Cómo obtenerla | Uso |
|---|---|---|
| `BLOB_STORE_ID` o `BLOB_READ_WRITE_TOKEN` | Se crean solas al conectar un almacén Blob al proyecto (Storage → almacén → Connect Project). Las conexiones recientes usan la identidad del proyecto y solo definen `BLOB_STORE_ID`; el código admite ambos mecanismos. | Guardar y leer los archivos cifrados. |
| `PPM_CLAVE_CIFRADO` | `openssl rand -hex 32` (64 caracteres hexadecimales). | Clave de cifrado de los registros. **Si se pierde, los datos no se pueden recuperar.** Guárdela en un gestor de secretos. |
| `PPM_SECRETO_SESION` | `openssl rand -hex 32`. | Firma de las cookies de sesión. |
| `PPM_CLAVE_ADMIN` | Una contraseña larga (mínimo 12 caracteres). | Autoriza la exportación de datos para la secretaría técnica. |

Después de definirlas hay que **redesplegar** el proyecto para que las funciones las tomen.

### Diagnóstico

`GET /api/salud` informa, sin revelar valores, si cada variable está definida, qué credenciales de Blob
encontró y si una prueba real de escritura y lectura cifrada funcionó. Es lo primero que conviene abrir
cuando la inscripción falla en producción.

### Exportar los datos (secretaría técnica)

```
https://www.planpadrinomilagro.co/api/exportar?formato=csv     → resumen en CSV (una fila por empresa)
https://www.planpadrinomilagro.co/api/exportar                 → JSON completo (inscripción, aceptaciones, respuestas y resultados)
https://www.planpadrinomilagro.co/api/exportar?tipo=ies&formato=csv → IES vinculadas y sus grupos (una fila por grupo)
https://www.planpadrinomilagro.co/api/exportar?tipo=ies        → JSON completo de las IES, responsables y grupos
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
