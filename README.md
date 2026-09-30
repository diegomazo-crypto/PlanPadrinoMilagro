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
| `portal.html` | **Portal único de ingreso** (empresas, líderes de grupo, coordinadores de IES y secretaría técnica; redirige según el correo), creación y restablecimiento de la clave, y portal de la empresa: aceptación, autodiagnóstico (con actualizaciones), plan de trabajo, datos de contacto y clave. |
| `portal-ies.html` | Portal de instituciones: tablero de control del coordinador (grupos, personas, confirmaciones, edición, aprobación y cancelación). |
| `portal-secretaria.html` | Tablero integral de la secretaría técnica: empresas, grupos, instituciones, edición de coordinadores y emparejamiento grupo–empresa. |
| `grupos.html` | Registro de un grupo que apadrina por su líder, con hasta cuatro integrantes, y creación de la clave. |
| `confirmar.html` | Confirmación de participación de un integrante desde el enlace recibido por correo. |
| `portal-grupo.html` | Área de trabajo del grupo (líder): confirmaciones e integrantes, empresa apadrinada (solo lectura), plan de trabajo y clave. |

## Estructura

```
├── index.html
├── empresas.html
├── ies.html
├── recursos.html
├── portal.html
├── portal-ies.html
├── api/                    Funciones de servidor (Vercel): registro, clave, sesion, aceptacion, diagnostico, informe,
│                           exportar, ies-padron, ies-registro, grupos
├── lib/                    Cifrado, almacenamiento, sesión, registros (empresas e IES), correo e informe PDF
├── assets/
│   ├── css/styles.css      Hoja de estilos
│   ├── js/config.js        Configuración (endpoint del formulario de IES, correo)
│   ├── js/main.js          Menú, índice lateral, validación y envío de formularios
│   ├── js/instrumento.js   Instrumento de autodiagnóstico (modelo CRL), usado en navegador y servidor
│   ├── js/ies-snies.js     Padrón de respaldo de IES activas (SNIES), usado en navegador y servidor
│   ├── js/portal.js        Ingreso único, claves y portal de la empresa
│   ├── js/portal-ies.js    Tablero del coordinador de la IES
│   ├── js/portal-secretaria.js Tablero integral de la secretaría técnica
│   ├── js/plan.js          Plan de trabajo: tabla de consulta y editor (compartido)
│   ├── js/grupos.js        Registro de grupos (líder)
│   ├── js/grupo-editor.js  Editor compartido de grupo (líder y coordinador)
│   ├── js/portal-grupo.js  Área de trabajo del grupo
│   ├── js/confirmar.js     Confirmación de integrantes
│   ├── js/catalogo-grupos.js Áreas, vinculaciones y estados (navegador y servidor)
│   └── img/
├── scripts/servidor-local.js   Servidor de desarrollo (sitio + API) para pruebas locales
├── scripts/actualizar-padron-ies.js   Regenera el padrón de IES desde una exportación oficial del SNIES
└── docs/                   PDFs descargables (ver docs/README.md)
```

Las páginas públicas son estáticas. El portal de empresas usa las funciones de `api/`, que corren en
Vercel sin proceso de construcción.

## Portal único e ingreso por perfil

Todos los perfiles ingresan por `portal.html` con su correo y su clave. `POST /api/sesion` busca la cuenta entre
la secretaría técnica, las empresas, los coordinadores de IES y los líderes de grupo, abre la sesión del perfil
cuya clave coincide y devuelve `destino`: `portal.html` (empresa), `portal-grupo.html` (líder),
`portal-ies.html` (coordinador) o `portal-secretaria.html` (secretaría). Las demás páginas remiten al portal
único cuando no hay sesión. La asesoría del Plan es **únicamente virtual**; los formularios ya no piden modalidad.

Claves (`/api/clave`): `POST {tokenRegistro, clave, confirmacion}` crea la clave tras el registro o la restablece
desde el enlace del correo; `POST ?accion=solicitar {correo}` envía un enlace (1 hora) para crear o restablecer la
clave de cualquier cuenta asociada al correo (`portal.html?restablecer=<token>`); `PUT {claveActual, clave,
confirmacion}` la cambia con la sesión abierta. Para la secretaría técnica, el enlace de "solicitar" es también la
forma de crear la cuenta: solo para los correos de `PPM_SECRETARIA` (por defecto `diego.mazo@ceipa.edu.co`).

Si el buzón del Plan no está disponible, la secretaría técnica puede obtener los mismos enlaces sin correo con la
clave de administración (`PPM_CLAVE_ADMIN`), abriendo en el navegador:

```
https://www.planpadrinomilagro.co/api/clave?accion=enlace&correo=<correo de la cuenta>&clave=<PPM_CLAVE_ADMIN>
```

La respuesta lista, por cada cuenta asociada al correo, el enlace `portal?restablecer=…` (vence en una hora) donde
la persona crea o restablece su clave. Sirve para crear la cuenta de secretaría y para asistir a empresas, IES o
líderes que no reciban el correo.

Perfiles y permisos:

| Perfil | Puede |
|---|---|
| **Empresario** | Ver y actualizar sus datos de contacto y de la empresa (excepto el correo), con constancia de cada actualización (`GET/PUT /api/registro`); cambiar la clave; actualizar el autodiagnóstico total o parcialmente con constancia (`PUT /api/diagnostico` registra los factores cambiados; `POST` recalcula y genera una nueva versión del informe); ver y descargar el plan de trabajo (`GET /api/grupos?accion=plan`, `GET /api/informe?tipo=plan`). |
| **Líder de grupo** | Integrantes e invitaciones; ver la inscripción y el autodiagnóstico de la empresa apadrinada (solo lectura) y descargar el informe (`GET /api/informe`); construir el plan de trabajo cuando el grupo está asignado (`PUT /api/grupos?accion=plan`): actividad, descripción, fecha esperada, responsable (empresario o integrante) y resultado, con la fecha de actualización de cada campo. |
| **Coordinador de IES** | Tablero de grupos de su institución (aprobados, pendientes de aprobar, personas); editar y cambiar integrantes; aprobar el grupo para el emparejamiento; cancelar. |
| **Secretaría técnica** | Tablero integral (`GET /api/secretaria?vista=resumen`): todas las empresas con inscripción y diagnóstico (`?vista=empresa&id=`, PDF en `/api/informe?id=`), instituciones con total de grupos y participantes, edición de los datos del coordinador (`PUT ?vista=ies`), grupos (`?vista=grupo&id=`), emparejamiento (`POST ?accion=asignar {grupoId, empresaId}` y `?accion=desasignar`, con correo al líder y a la empresa), exportaciones y **eliminación** de empresas, grupos e instituciones (`DELETE ?vista=empresa|grupo|ies&id=`, con confirmación escribiendo ELIMINAR; al borrar una empresa se elimina también su informe y se libera el grupo; al borrar un grupo la empresa queda sin grupo; al borrar una IES sus grupos se conservan a la espera de un nuevo coordinador). |

## Portal de empresas y datos cifrados

Flujo de una empresa:

1. **Inscripción** en `empresas.html`. El servidor crea un registro cifrado y pide crear una **clave de
   acceso**. El usuario es el correo del interlocutor. La clave no puede ser ni contener ningún dato de la
   inscripción (empresa, NIT, nombres, teléfono, correo).
2. **Aceptación** en el portal de dos documentos: el compromiso de participación y los términos del
   acompañamiento y confidencialidad. Si la empresa no acepta, el proceso termina y se le agradece.
3. **Autodiagnóstico** de madurez de capacidades (modelo CRL): 5 capacidades, 46 factores en escala 0–5
   y datos de desempeño. Se guarda paso a paso; la empresa puede salir y retomar donde quedó.
4. **Resultados** ponderados por capacidad y globales, con nivel y recomendación. Después, la empresa puede
   **actualizar** el autodiagnóstico: cada cambio guardado queda registrado (fecha y factores) y, al recorrer el
   instrumento hasta el final, se recalculan los resultados, sube la versión y se envía un nuevo informe.
5. **Plan de trabajo**: cuando la secretaría técnica asigna un grupo, la empresa ve su grupo padrino y consulta o
   descarga el plan que el líder construye.

Almacenamiento: un archivo por empresa en Vercel Blob (acceso privado), cifrado con AES-256-GCM antes de
guardarse. Las claves de acceso se guardan con hash scrypt. Las sesiones son cookies firmadas (HttpOnly).
Ninguna empresa puede ver datos de otra: cada solicitud opera solo sobre el registro de la sesión.

## Portal de instituciones (IES) y grupos que apadrinan

Flujo de una IES:

1. **Vinculación** en `ies.html`. El responsable (coordinador) busca la institución en el **padrón de IES activas
   del SNIES** (o la declara manualmente si no aparece), registra sus datos de contacto y acepta los compromisos
   institucionales. Cada institución admite un único coordinador con cuenta.
2. **Clave de acceso** con las mismas reglas que las empresas; recibe el correo de confirmación de la cuenta.
3. **Tablero de control** (`portal-ies.html`): cuántos grupos se han registrado y en qué estado, cuántas personas
   participan y cuántas han confirmado. El coordinador puede editar la información de un grupo, cambiar
   integrantes, **aprobar** un grupo para el emparejamiento o cancelarlo.

Flujo de un grupo (`grupos.html`):

1. El **líder** registra el grupo: institución (desplegable con las IES activas del padrón SNIES, marcando las que ya
   tienen coordinador vinculado), nombre, área de intervención
   (una de las cuatro), sus datos (nombre, vinculación, móvil, correo) y hasta **cuatro integrantes** (nombre,
   vinculación, móvil, correo). Luego crea su clave: su correo es el usuario del **área de trabajo del grupo**
   (`portal-grupo.html`).
2. Cada integrante recibe un **correo con un enlace personal** (30 días) para confirmar o declinar su participación
   (`confirmar.html`). El líder ve el estado de cada uno, puede reenviar invitaciones y reemplazar a quien no pueda.
3. Cuando **todos confirman**, el coordinador de la IES recibe por correo el grupo completo con todos los datos y lo
   **aprueba** en el tablero. El líder recibe el aviso y el grupo queda listo para la asignación de empresa. Si la
   IES aún no tiene coordinador, el grupo queda ligado a la institución por su clave del padrón y el aviso se envía
   cuando el coordinador se vincula y abre su tablero.

4. La **secretaría técnica** empareja el grupo aprobado con una empresa desde su tablero; líder y empresa reciben
   un correo con los datos de contacto y el líder abre el **plan de trabajo**.

Estados del grupo: `registrado` → `integrantes_confirmados` → `confirmado` (aprobado) → `asignado`, o `cancelado`.
Los grupos se guardan cifrados en `grupos/<id>.json` (id derivado del correo del líder); las IES en `ies/<id>.json`.
Las sesiones llevan el tipo de cuenta (`empresa`, `ies`, `lider`, `secretaria`) dentro del token firmado; la
secretaría se guarda en `secretaria/<id>.json`.

API: `GET /api/grupos?accion=ies` (padrón SNIES más IES declaradas, con marca de vinculada), `POST ?accion=registro`, `GET ?accion=invitacion&token=`,
`POST ?accion=confirmar`, y con sesión: `GET` (tablero o grupo propio), `PUT` (editar), `POST ?accion=reenviar`,
`POST ?accion=confirmar-grupo` (aprobar) y `POST ?accion=cancelar` (solo coordinador); plan de trabajo: `GET ?accion=plan`
(líder o empresa) y `PUT ?accion=plan` (líder, grupo asignado).

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

## Correos automáticos e informe de autodiagnóstico

El portal envía estos correos desde el buzón del Plan (`planpadrinomilagro@ceipa.edu.co`):

1. **Confirmación de cuenta**, al crear la clave (empresas, IES y líderes de grupo): usuario, enlace al portal y próximos pasos.
   Los grupos generan además: invitación a cada integrante, aviso al coordinador cuando todos confirman, y avisos al
   líder cuando el coordinador confirma o cancela el grupo.
2. **Informe de autodiagnóstico**, al finalizar el diagnóstico: correo a la empresa con el informe en PDF
   adjunto y copia al buzón del Plan, para compartirlo con la IES madrina. Cada nueva versión del
   autodiagnóstico genera y envía un nuevo informe.
3. **Clave de acceso**: enlace para crear o restablecer la clave (opción "¿Olvidó su clave?" del portal).
4. **Emparejamiento**: aviso al líder (con los datos de la empresa) y a la empresa (con los del grupo) cuando la
   secretaría técnica los asigna.

El informe (modelo CRL: resultado global, capacidades, factor por factor con observaciones y datos de
desempeño) se archiva cifrado en `informes/<id>.json` y se puede descargar:

```
/api/informe                          → la empresa, con su sesión (botón "Descargar el informe" en el portal)
/api/informe?id=<id>                  → la secretaría técnica (con su sesión, o ?clave=<admin>), cualquier empresa
/api/informe                          → el líder del grupo asignado, el informe de su empresa apadrinada
/api/informe?tipo=plan                → plan de trabajo en PDF (empresa, líder; secretaría con &grupo=<id>)
POST /api/informe                     → la empresa reenvía el informe a su correo
```

Si el correo falla, el flujo no se interrumpe: el informe queda archivado, el portal lo indica y el intento
se registra en el historial de la empresa (`correos`). `GET /api/salud` muestra el modo de correo activo.

### Configurar el buzón (Microsoft Graph, recomendado)

El envío usa **Microsoft Graph** con un registro de aplicación en Entra ID que solo tiene el permiso
`Mail.Send`, limitado por una directiva de acceso al buzón del Plan. No requiere SMTP autenticado ni la
contraseña del buzón. Variables en Vercel (Production; también Preview si se quiere probar en vistas previas):

| Variable | Valor |
|---|---|
| `TENANT_ID` | Identificador del tenant de Entra ID (lo entrega el equipo de TI). |
| `CLIENT_ID` | Identificador de la aplicación registrada. |
| `CLIENT_SECRET` | Secreto de la aplicación. Guardarlo solo en Vercel; al vencer, TI genera uno nuevo y se reemplaza. |
| `REMITENTE` | Buzón desde el que se envía: `planpadrinomilagro@ceipa.edu.co`. |
| `PPM_CORREO_REMITENTE` | Opcional; nombre visible, por defecto `Plan Milagro <planpadrinomilagro@ceipa.edu.co>`. |
| `PPM_CORREO_COPIA` | Opcional; buzón que recibe copia del informe. Por defecto el mismo buzón del Plan; vacío para no copiar. |
| `PPM_URL_SITIO` | Opcional; enlace usado en los correos (por defecto `https://www.planpadrinomilagro.co`). |

También se aceptan los nombres `PPM_GRAPH_TENANT_ID`, `PPM_GRAPH_CLIENT_ID`, `PPM_GRAPH_CLIENT_SECRET` y
`PPM_GRAPH_BUZON`, y los alias `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`. Después de definirlas
hay que redesplegar. `GET /api/salud` debe mostrar `correo.modo: "graph"`.

**Prueba de envío**: con la sesión de la secretaría técnica abierta o con la clave de administración,
`POST /api/salud?accion=correo-prueba&para=<correo>` (o `&clave=<PPM_CLAVE_ADMIN>`) envía un correo de prueba
y devuelve el resultado, incluido el error de Graph si lo hay (por ejemplo, secreto vencido o buzón no permitido
por la directiva).

Alternativa SMTP (solo si la organización permite SMTP autenticado): `PPM_CORREO_USUARIO` y `PPM_CORREO_CLAVE`
(`smtp.office365.com:587`, STARTTLS); Graph tiene prioridad si están definidas ambas configuraciones.

Sin credenciales, en desarrollo local los correos se guardan como archivos en `.datos-local/correos/`; en
Vercel se marcan como no enviados sin afectar el flujo.

### Variables de entorno en Vercel (Settings → Environment Variables)

| Variable | Cómo obtenerla | Uso |
|---|---|---|
| `BLOB_STORE_ID` o `BLOB_READ_WRITE_TOKEN` | Se crean solas al conectar un almacén Blob al proyecto (Storage → almacén → Connect Project). Las conexiones recientes usan la identidad del proyecto y solo definen `BLOB_STORE_ID`; el código admite ambos mecanismos. | Guardar y leer los archivos cifrados. |
| `PPM_CLAVE_CIFRADO` | `openssl rand -hex 32` (64 caracteres hexadecimales). | Clave de cifrado de los registros. **Si se pierde, los datos no se pueden recuperar.** Guárdela en un gestor de secretos. |
| `PPM_SECRETO_SESION` | `openssl rand -hex 32`. | Firma de las cookies de sesión. |
| `PPM_CLAVE_ADMIN` | Una contraseña larga (mínimo 12 caracteres). | Autoriza la exportación de datos por URL (alternativa a la sesión de la secretaría técnica). |
| `PPM_SECRETARIA` | Correos autorizados de la secretaría técnica, separados por comas. Opcional. | Quién puede crear la cuenta de secretaría técnica desde "¿Olvidó su clave?". Por defecto `diego.mazo@ceipa.edu.co`. |

Después de definirlas hay que **redesplegar** el proyecto para que las funciones las tomen.

### Diagnóstico

`GET /api/salud` informa, sin revelar valores, si cada variable está definida, qué credenciales de Blob
encontró y si una prueba real de escritura y lectura cifrada funcionó. Es lo primero que conviene abrir
cuando la inscripción falla en producción.

### Exportar los datos (secretaría técnica)

```
https://www.planpadrinomilagro.co/api/exportar?formato=csv     → resumen en CSV (una fila por empresa)
https://www.planpadrinomilagro.co/api/exportar                 → JSON completo (inscripción, aceptaciones, respuestas y resultados)
https://www.planpadrinomilagro.co/api/exportar?tipo=ies&formato=csv → IES vinculadas con conteo de grupos (una fila por IES)
https://www.planpadrinomilagro.co/api/exportar?tipo=grupos&formato=csv → grupos que apadrinan (una fila por persona, con estado)
https://www.planpadrinomilagro.co/api/exportar?tipo=ies | ?tipo=grupos → JSON completo
```

Con la sesión de la secretaría técnica abierta, los botones del tablero (`portal-secretaria.html`) descargan
estos archivos directamente. Sin sesión, envíe la clave de administración en la cabecera `x-clave-admin`
(por ejemplo con `curl -H`) o como parámetro `?clave=`. La exportación nunca incluye los hashes de las claves de acceso.

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

El sitio aplica el **Manual de Marca v2** (septiembre 2026). La denominación institucional sigue siendo
*Plan Padrino Milagro*; la marca visual de uso público es *Plan Milagro* y el descriptor «Para reconstrucción
productiva» forma parte del lockup.

| Elemento | Valor |
|---|---|
| Azul profundo (dominante: texto, botón primario, pie) | `#08366A` |
| Amarillo dorado (acento principal; nunca como texto sobre blanco) | `#E9A619` |
| Rojo institucional (acento puntual: etiquetas, cifras, llamados a la acción) | `#E3141E` |
| Gris claro (fondos, reglas, bordes; nunca texto) | `#C2C3C7` |
| Texto secundario (contraste AA) | `#4C5A6E` |
| Fondo claro / Borde | `#F4F6F9` / `#DCDEE2` |
| Titulares, botones y etiquetas | Archivo 600–800 (sustitutos: Arial Black, Helvetica Neue Bold) |
| Texto corrido | Source Sans 3 400–600 (sustitutos: Calibri, Segoe UI) |
| Barra de marca | azul · amarillo · rojo · gris |

Logos en `assets/img/` (nomenclatura del manual; versiones raster derivadas del JPG de propuesta mientras
se recibe el vectorial):

| Archivo | Uso |
|---|---|
| `PlanMilagro_Logo_Horizontal_Color_v2_202609.png` | Lockup horizontal a color: encabezado e imagen social. Mínimo 160 px de ancho. |
| `PlanMilagro_Simbolo_Color_v2_202609.png` | Símbolo aislado: favicon, avatares. Mínimo 32 px. |
| `PlanMilagro_Logo_Mono_Azul_v2_202609.png` | Monocromático azul (impresión a una tinta). |
| `PlanMilagro_Logo_Mono_Blanco_v2_202609.png` | Calado en blanco: pie de página sobre azul profundo. |
| `favicon.png`, `apple-touch-icon.png` | Símbolo con 12 % de margen. |

Mensajes del manual usados en el sitio: «Oportunidades que siembran más futuros» (portada) y «Juntos
reconstruimos más» (cierre del pie).
