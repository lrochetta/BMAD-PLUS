# BMAD+

<div align="center">
  <a href="../README.md">English</a> | <a href="README.fr.md">Français</a> | 🌐 <b>Español</b> | <a href="README.de.md">Deutsch</a>
</div>

[![Version](https://img.shields.io/badge/version-0.23.1-blue)](https://www.npmjs.com/package/bmad-plus)

**Versión 0.23.1** · Node.js `>=20.0.0` · MIT

Diez paquetes de roles y flujos de trabajo con IA propios de cada proyecto (diseño, SEO, GRC, OSINT, memoria), con un intake que pregunta antes de actuar, swarms con presupuesto, actualizaciones seguras y adaptadores para siete herramientas de programación con IA

[Sitio web](https://bmad-plus.rochetta.fr/es/) · [Empezar](https://bmad-plus.rochetta.fr/es/docs/#start) · [Ejemplos](https://bmad-plus.rochetta.fr/es/docs/#examples) · [Novedades](https://bmad-plus.rochetta.fr/es/docs/#news)

BMAD+ instala instrucciones de proyecto, roles y flujos de trabajo para la herramienta de programación con IA que ya utilizas. Por defecto, la ejecución la gestiona el anfitrión: tu herramienta aporta el modelo, los permisos, la ejecución de comandos y, si existe, la capacidad de agentes en paralelo. Nexus también puede lanzar un comando local o un proceso de Codex CLI planificado explícitamente bajo un supervisor en primer plano, registrar su resultado y exigir comprobaciones independientes antes de aceptarlo. Los permisos del anfitrión siguen aplicándose; no hay planificador en segundo plano ni integración universal con el ciclo de vida del anfitrión. Las suscripciones a modelos y el acceso a las API son independientes.

BMAD+ incluye diez paquetes. Preguntar primero: `bmad-plus intake` plantea las preguntas de un paquete de pocas en pocas, propone valores por defecto, registra lo que no sabes y genera el brief con el que el paquete trabaja después. Swarms: `bmad-plus swarm` reparte unidades simuladas, entrega un brief a cada subagente, valida cada respuesta y cuenta solo las válidas, dentro de un presupuesto que tú fijas. Atelier, el motor de diseño del paquete Design, construye, audita y rediseña interfaces con reglas comprobables.

Adaptadores: Claude Code, Gemini CLI, Antigravity, Cursor, Codex CLI, OpenCode, Aider.

## Empezar

Requiere Node.js `>=20.0.0`. Algunos paquetes opcionales pueden necesitar otros entornos de ejecución o acceso a API. Ejecuta los comandos de terminal desde la carpeta de tu proyecto.

### 1. Abrir la carpeta del proyecto

Abre una terminal en el repositorio en el que quieres trabajar y comprueba la versión de Node.js. Mantén tu flujo habitual de control de versiones.

**En la terminal del proyecto:**

```sh
node --version
```

La salida debe indicar v20 o posterior. Instala o actualiza Node.js por separado si hace falta.

### 2. Instalar BMAD+ y elegir herramientas

Ejecuta el instalador. Selecciona los adaptadores de tus herramientas de IA y los packs que necesita tu proyecto. Core incluye Atlas, Forge, Sentinel y Nexus.

**En la terminal del proyecto:**

```sh
npx bmad-plus@0.23.1 install
```

El instalador crea las instrucciones de los agentes, la base compartida y los adaptadores seleccionados. Algunos packs opcionales necesitan otros entornos o acceso a API.

### 3. Iniciar una sesión en la misma carpeta

Abre o reinicia tu asistente de programación con IA en este proyecto para que cargue su adaptador y AGENTS.md. Pídele los agentes y flujos instalados.

**En tu asistente de IA:**

```text
bmad-help
```

No hay un comando adicional de inicialización de BMAD+. bmad-help es un mensaje para el asistente, no un comando de terminal.

### 4. Asignar una tarea concreta a un rol

Describe tu objetivo, las restricciones y el resultado esperado. Para una idea nueva, empieza con Atlas. Para modificar código existente, empieza con Forge.

**En tu asistente de IA:**

```text
Atlas, ayúdame a definir una pequeña aplicación de facturación para autónomos. Pregunta por los usuarios, identifica el primer flujo útil y redacta un brief con criterios de aceptación.
```

Revisa el brief antes de pedir a Forge que implemente una historia. Un entregable concreto facilita comprobar el progreso.

### 5. Revisar el resultado y guardar el contexto

Pide a Sentinel que compruebe el cambio según los criterios de aceptación. Solicita resultados de pruebas y un breve resumen para continuar en otra sesión.

**En tu asistente de IA:**

```text
Sentinel, revisa este cambio según los criterios de aceptación. Comprueba los principales casos de éxito y fallo, informa de los problemas pendientes y resume lo que necesita saber la próxima sesión. Si el CLI de BMAD+ está disponible, sella el alcance con bmad-plus review scope, aplica las reglas de su lista de revisión, cita el código de cada hallazgo, da cuenta de cada archivo seleccionado y comunica lo que responde bmad-plus review gate.
```

Lee los cambios y los resultados de las pruebas. El asistente sigue los permisos y las capacidades de su herramienta anfitriona.

## Roles principales

| Rol | Ámbito | Propósito |
| --- | --- | --- |
| Atlas | Estrategia y producto | Decidir qué merece la pena construir. |
| Forge | Arquitectura y desarrollo | Convertir el plan en algo concreto. |
| Sentinel | Calidad y revisión | Encontrar lo que pasó desapercibido. |
| Nexus | Planificación y coordinación | Hacer que el trabajo avance en conjunto. |

## Paquetes

| Paquete | Qué aporta |
| --- | --- |
| Core | Estrategia, arquitectura, desarrollo, calidad y coordinación con los cuatro roles principales. |
| OSINT | Flujos de investigación para recopilar información pública y evaluar las fuentes. |
| Maker | Un flujo para diseñar, validar y distribuir tus propios agentes BMAD+. |
| Shield | Flujos especializados de cumplimiento y gobernanza, incluidos RGPD e ISO 27001. |
| SEO | SEO clásico y GEO, visibilidad en las respuestas generadas por IA: inspección técnica y rendimiento (Scout), calidad del contenido, datos estructurados y preparación para la búsqueda con IA (Judge), puntuación, estrategia e informes (Chief). |
| Memory | Notas del proyecto, registro de decisiones y traspasos entre sesiones para conservar el contexto útil. |
| Dev Studio | Roles y flujos especializados en producto, diseño, ingeniería y documentación. |
| Backup | Instrucciones y utilidades para copias con fecha, restauración y rotación. |
| Animated | Un flujo centrado en crear sitios cuyo desplazamiento utiliza vídeo. |
| Design | Atelier, el motor de diseño: construir, auditar y rediseñar interfaces con reglas verificables, empezando por una entrevista. |

## Ejemplos

### Convertir una idea en una primera versión

Úsalo después de describir los usuarios y el problema.

```text
Nexus, planifica la primera versión utilizable de mi aplicación de reservas. Pide a Atlas que defina el alcance, a Forge que proponga la implementación mínima y a Sentinel que defina las comprobaciones de aceptación. Enumera las dependencias y detente en la revisión del plan antes de implementar.
```

Resultado esperado: un plan priorizado, una primera historia pequeña y puntos de revisión explícitos.

### Corregir un error en un proyecto existente

Incluye el comportamiento observado, los pasos para reproducirlo y los mensajes de error relevantes.

```text
Forge, investiga por qué guardar una factura editada crea un duplicado. Reproduce el problema, localiza la causa y propone la corrección mínima. Añade una prueba de regresión que cubra el fallo real y pide a Sentinel que revise el flujo afectado.
```

Resultado esperado: un fallo reproducido, una corrección concreta y evidencia de cobertura de la regresión.

### Coordinar trabajo independiente

Úsalo cuando tu herramienta admita agentes en paralelo y las tareas no escriban en los mismos archivos.

```text
Nexus, divide el trabajo aprobado en tareas independientes. Asigna a cada rol un alcance, archivos a su cargo y una definición de terminado. Usa agentes en paralelo solo si esta herramienta lo permite; si no, ejecuta las tareas en secuencia. Integra los resultados y pide a Sentinel que compruebe todo el recorrido del usuario.
```

Resultado esperado: tareas delimitadas, dependencias explícitas y una revisión integrada. La herramienta anfitriona proporciona la ejecución en paralelo.

### Hacer que una persona confirme una entrega

Úselo cuando una versión llegue a su entorno de pruebas y alguien deba comprobarla en pantalla.

```text
Sentinel, escribe la receta de aceptación de esta entrega en nuestro entorno de pruebas. Un paso por gesto, un hecho verificable por línea, las etiquetas citadas desde el código y marca los pasos que escriben de verdad. Construye la página y dime el enlace, cuánto dura y qué no debo saltarme. Usa datos de prueba desechables cuando sea posible, indica la carpeta y los archivos que modifica cada comando y distingue las evidencias automáticas de las respuestas de la persona. Antes de entregarme la página, constrúyela con uat build, comprueba las garantías que enumera, recorre tú mismo el paso esencial en un navegador real —empezar, marcar, escribir una observación, recargar, todo vuelve— y dime qué comprobaciones se ejecutaron.
```

Resultado esperado: una página que una persona no técnica puede recorrer y una prueba que el agente relee para clasificar cada fallo antes de corregir nada.

### Guardar una sesión con Zecher

Úsalo antes de terminar una sesión, con el paquete opcional Memory instalado.

```text
Zecher, actualiza la memoria de este proyecto a partir de los cambios y comprobaciones realmente realizados. Distingue el trabajo implementado, probado, publicado y pendiente. Registra las decisiones y evidencias útiles, archiva las notas sustituidas sin borrarlas y escribe un breve prompt para la próxima sesión. Mantén la memoria en este proyecto y excluye los secretos.
```

Resultado esperado: un contexto actual conciso, un registro de sesión fechado y un prompt de reanudación que identifique la siguiente tarea pendiente.

### Revisar una prueba sin adivinar

Úsalo cuando una persona haya terminado o interrumpido una prueba de aceptación.

```text
Sentinel, lee la última prueba de aceptación y compara su huella con la receta actual. Pregunta qué se hizo realmente cuando las respuestas y las evidencias no coincidan. Clasifica los fallos antes de proponer cambios, verifica los pasos de escritura en solo lectura y distingue las observaciones humanas, las comprobaciones automáticas y cualquier aceptación explícita de riesgo por su responsable identificado. Nunca apruebes un paso que no se realizó.
```

Resultado esperado: un veredicto claro, evidencias de las escrituras confirmadas y una lista breve de las comprobaciones pendientes.

### Retomar sin perder decisiones

Úsalo al comenzar una sesión posterior en el mismo proyecto; no requiere ningún paquete opcional.

```text
Lee AGENTS.md y la memoria de proyecto disponible. Resume el último estado verificado, las decisiones abiertas y la siguiente tarea pendiente. Distingue las funciones publicadas de las candidatas locales, y las comprobaciones automáticas de la aceptación humana. Comprueba que las notas siguen coincidiendo con el código antes de continuar.
```

Resultado esperado: una reanudación breve y fundamentada. Las notas aportan contexto que debe contrastarse con el trabajo actual.

### Diseñar una pantalla con Atelier

Úsalo con el paquete opcional Design instalado. Atelier hace primero sus preguntas y luego sigue reglas comprobables.

```text
Atelier, haz la lectura de diseño de la lista de facturas de mi aplicación, construye la pantalla y termina con el veredicto de la comprobación previa.
```

Resultado esperado: la lectura de diseño registrada, la pantalla con todos sus estados cubiertos y el veredicto de la comprobación previa citado como última línea.

## Novedades de la 0.23.1

Un sitio más fiel, comandos más constantes

El sitio de documentación se rehace en cuatro idiomas, con siete vídeos. Varios comandos se comportan ahora exactamente como dicen sus páginas: las negativas se leen igual en todas partes, una revisión del árbol de trabajo parte de HEAD y el archivo de configuración es YAML simple. Instalar y actualizar funcionan como antes.

- El sitio tiene ahora 52 páginas de documentación, cada una en inglés, francés, español y alemán, una landing rehecha y siete vídeos de presentación con subtítulos y transcripciones descritas, incluido un caso práctico de cómo se rehízo el propio sitio con un enjambre de agentes.
- Una actualización --auto que la política no permite se rechaza con el mismo mensaje en todas partes: Update refused: automatic-updates-not-authorized. Los rechazos por inventario de propiedad antiguo y por conflictos locales usan la misma forma Update refused:.
- bmad-plus review scope --workspace parte de HEAD cuando no das --base, así que revisar trabajo sin confirmar ya no falla ni arrastra el último commit.
- _bmad/config.yaml se escribe como YAML simple (auto_role_activation: true, no un !!bool 'true' con etiqueta), sea cual sea la versión compatible de js-yaml que lo escriba.
- Los archivos de instrucciones generados indican omitir la comprobación de versión, sin mencionarla, cuando npx no encuentra una copia local de bmad-plus; los errores de Nexus llevan el prefijo Nexus: una vez en lugar de dos.
- Shield nombra PCI DSS v4.0.1 en todas partes, las habilidades de swarm dicen que hay tres tipos, la variante Bash del paquete Backup muestra el tamaño del archivo como la de PowerShell, y la descripción de npm, las palabras clave y los créditos del README se actualizan.

## Historial de versiones

Estas fechas identifican las notas revisadas del CHANGELOG, no las fechas de publicación en npm. El sitio web verifica por separado las fechas de publicación en npm.

| Versión | Fecha de las notas | Resumen revisado |
| --- | --- | --- |
| 0.23.1 | 2026-10-19 | El sitio de documentación se rehace en cuatro idiomas, con siete vídeos. Varios comandos se comportan ahora exactamente como dicen sus páginas: las negativas se leen igual en todas partes, una revisión del árbol de trabajo parte de HEAD y el archivo de configuración es YAML simple. Instalar y actualizar funcionan como antes. |
| 0.23.0 | 2026-10-17 | Un paquete declara ahora las preguntas que necesita respondidas antes de actuar, y Nexus puede lanzar un enjambre de subagentes, un panel simulado o un jurado, dentro de un presupuesto que tú fijas. Atelier, el motor de diseño, se incorpora como décimo paquete. Instalar y actualizar funcionan como antes. |
| 0.22.0 | 2026-09-29 | BMAD+ declara ahora cada envío de datos y cada proceso que inicia, y su CI rechaza todo lo que no esté declarado. La página de aceptación y el informe SEO ya no cargan nada de otros sitios, las llamadas OSINT van solo por HTTPS, y Shield incorpora un caso de seguridad basado en pruebas ejecutadas y un registro de tratamientos de IA. Nada cambia en la instalación ni en la actualización. |

[Historial de versiones y guía de actualización](https://bmad-plus.rochetta.fr/es/docs/#changelog) · [Todas las versiones publicadas en npm](https://www.npmjs.com/package/bmad-plus?activeTab=versions)

---

## Licencia

MIT — Basado en [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) (MIT)

BMAD+ es un proyecto comunitario independiente derivado de BMAD-METHOD (MIT) de BMad Code, LLC. No está afiliado a BMad Code, LLC ni cuenta con su aprobación o certificación. BMad™ y BMad Method™ son marcas de BMad Code, LLC; consulta las [directrices de marca de BMad](https://github.com/bmad-code-org/BMAD-METHOD/blob/main/TRADEMARK.md).
Atribuciones y condiciones de las fuentes incluidas: [Avisos de terceros](../THIRD-PARTY-LICENSES.md).

El paquete OSINT está regulado: investigar a una persona identificada exige una finalidad y una base jurídica registradas. Consulta el [aviso legal OSINT](../osint-agent-package/skills/bmad-osint-investigate/osint/references/gdpr-osint.md) (en inglés).

### Créditos

**Creador**
- **BMAD+** creado por [Laurent Rochetta](https://github.com/lrochetta) ([LinkedIn](https://www.linkedin.com/in/laurentrochetta/))

**Escrito por Laurent Rochetta**
- **Extensiones de Core** — Autopilot, Parallel y Sync (0.1.0), ejecución duradera de Nexus (0.15.0), recetas de aceptación humana (`uat`, 0.16.0), revisiones verificables (0.19.0) y, en 0.23.0, el intake de paquete (`bmad-plus intake`) y el runtime de swarm (`bmad-plus swarm`), con los campos del registro y la puerta de disparadores que los alimentan
- **Dev Studio** — 6 agentes SDLC especializados: Miriam (analista de negocio), Huldah (redactora técnica), Yosef (product manager), Rachel (diseñadora UX), Bezalel (arquitecto de sistemas), Oholiab (ingeniero sénior) — 38 workflows, escritos como instrucciones originales de BMAD+; los nombres de los personas y el linaje de los workflows reconocen a BMAD-METHOD 6.6.0 (MIT). El registro del paquete es `src/bmad-plus/packs/pack-dev-studio/upstream-sync.yaml`
- **Maker** — diseñar, construir, validar y empaquetar tus propios agentes BMAD+ (2026-03-17)
- **Design** — Atelier, construido sobre el paquete npm público del autor [design-skill](https://github.com/lrochetta/design-skill) (MIT): el paquete aporta las tres skills y sus reglas; BMAD+ añade el persona, el intake y el enrutamiento
- **Memory** — agente Zecher para una memoria persistente entre sesiones, con escáner de proyectos y detección de cerebro; las Karpathy guardrails que incorpora son una adaptación, véase más abajo
- **SEO** — 3 agentes (Scout, Chief, Judge), pipeline de auditoría de 6 fases, bucle de optimización PageSpeed, integraciones con Google Search Console y GA4; la versión 2.0 reconstruyó el primer agente de auditoría SEO, escrito en Oveanet, y conservó su playbook de PageSpeed
- **Backup** y **Animated** — copias de seguridad de proyecto con marca de tiempo y sitios web de desplazamiento con vídeo; escritos en Oveanet, la empresa de Laurent Rochetta, e integrados en BMAD+ en 0.2.0 (2026-03-18) junto con el primer agente SEO

**Derivado de BMAD-METHOD** (MIT)
- **BMAD-METHOD** de [bmad-code-org](https://github.com/bmad-code-org/BMAD-METHOD) — metodología multiagente original (MIT); BMAD+ es un derivado independiente, no una versión oficial
- **Core** — Atlas, Forge, Sentinel y Nexus: BMAD+ nació como un fork de BMAD-METHOD 6.2.0 y Laurent Rochetta lo ha ampliado (véase Extensiones de Core más arriba). Los cuatro personas siguen su formato de persona y conservan parte de la redacción de sus personas de analista (Atlas), arquitecto (Forge), QA (Sentinel) y scrum master (Nexus); fusionar roles en un persona conmutable y la activación automática son aportaciones de BMAD+

**Adaptado de otros proyectos de código abierto**
- **Shield** — 27 agentes de cumplimiento + 11 workflows adaptados de las [skills GRC de Hemant Naik](https://github.com/Sushegaad/Claude-Skills-Governance-Risk-and-Compliance) (MIT), con sus 79 archivos de referencia; los workflows de RGPD y AI Act se inspiran además en la arquitectura del catálogo de skills de [Lawve.ai](https://lawve.ai) (Oliver Schmidt-Prietz). El orquestador, el mapeo entre marcos, las plantillas de informe, el caso de aseguramiento, el registro de tratamientos de IA y las reglas de revisión de cumplimiento son aportaciones de BMAD+
- **OSINT** — pipeline y ayudantes Python adaptados de [smixs/osint-skill](https://github.com/smixs/osint-skill) (MIT); la puerta de base jurídica y el aviso legal son aportaciones de BMAD+
- **Integración Apify** — ayudante OSINT inspirado en las [Apify agent skills](https://github.com/apify/agent-skills) (el repositorio original declara Apache-2.0; véanse los avisos)
- **Karpathy Guardrails** — adaptación para Memory de las [pautas comunitarias de forrestchang](https://github.com/multica-ai/andrej-karpathy-skills), inspiradas en Andrej Karpathy (MIT declarada en el repositorio original)
