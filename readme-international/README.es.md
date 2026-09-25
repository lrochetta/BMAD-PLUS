# BMAD+

<div align="center">
  <a href="../README.md">English</a> | <a href="README.fr.md">Français</a> | 🌐 <b>Español</b> | <a href="README.de.md">Deutsch</a>
</div>

[![Version](https://img.shields.io/badge/version-0.18.0-blue)](https://www.npmjs.com/package/bmad-plus)

**Versión 0.18.0** · Node.js `>=20.0.0` · MIT

Flujos de desarrollo con IA propios de cada proyecto, con roles claros, contexto compartido, actualizaciones seguras y adaptadores para herramientas de programación.

[Sitio web](https://bmad-plus.rochetta.fr/es/) · [Empezar](https://bmad-plus.rochetta.fr/es/docs/#start) · [Ejemplos](https://bmad-plus.rochetta.fr/es/docs/#examples) · [Novedades](https://bmad-plus.rochetta.fr/es/docs/#news)

BMAD+ instala instrucciones de proyecto, roles y flujos de trabajo para la herramienta de programación con IA que ya utilizas. Por defecto, la ejecución la gestiona el anfitrión: tu herramienta aporta el modelo, los permisos, la ejecución de comandos y, si existe, la capacidad de agentes en paralelo. Nexus también puede lanzar un comando local o un proceso de Codex CLI planificado explícitamente bajo un supervisor en primer plano, registrar su resultado y exigir comprobaciones independientes antes de aceptarlo. Los permisos del anfitrión siguen aplicándose; no hay planificador en segundo plano ni integración universal con el ciclo de vida del anfitrión. Las suscripciones a modelos y el acceso a las API son independientes.

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
npx bmad-plus@0.18.0 install
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
Sentinel, revisa este cambio según los criterios de aceptación. Comprueba los principales casos de éxito y fallo, informa de los problemas pendientes y resume lo que necesita saber la próxima sesión.
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
| SEO | Inspección técnica, análisis de contenido y optimización para buscadores con herramientas de apoyo. |
| Memory | Notas del proyecto, registro de decisiones y traspasos entre sesiones para conservar el contexto útil. |
| Dev Studio | Roles y flujos especializados en producto, diseño, ingeniería y documentación. |
| Backup | Instrucciones y utilidades para copias con fecha, restauración y rotación. |
| Animated | Un flujo centrado en crear sitios cuyo desplazamiento utiliza vídeo. |

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

## Novedades de la 0.18.0

Páginas de aceptación que conservan cada respuesta

La página de aceptación ahora verifica cada guardado, restaura tus respuestas al recargar antes que nada, mantiene separadas las pruebas de otras versiones y otras pestañas, y nombra dieciséis garantías que la construcción se niega a perder. Nada cambia en la instalación ni en la actualización; reconstruye tus páginas de receta para obtener la nueva página.

- Una escritura en el navegador solo cuenta una vez releída. Un guardado rechazado (cuota, ventana privada, almacenamiento bloqueado) se indica en la página, salir se cuestiona y la exportación sigue disponible: la página nunca dice «guardado» sin comprobarlo.
- Tus respuestas vuelven al recargar antes de que respondan el servidor local o la base del artefacto, y la copia más reciente siempre gana: una copia remota más antigua nunca sobrescribe lo que acabas de marcar.
- Una prueba que respondió a otra versión de la receta se ofrece, no se vuelca: las líneas sin cambios conservan sus respuestas, las modificadas se preguntan de nuevo, la prueba anterior queda intacta y exportable, y la nueva registra de dónde vienen sus respuestas.
- Dos pestañas o dos dispositivos sobre la misma prueba convergen en el último cambio y lo indican. Una prueba guardada que no se puede leer se informa y se puede exportar, nunca se borra.
- La barra de progreso muestra la proporción de líneas respondidas —respondidas, no superadas— con los recuentos de visto, no visto y bloqueado; la página dice dónde viven las respuestas y qué puede hacerlas desaparecer.
- Terminar con líneas sin responder se cuestiona en la propia página y se confirma con un segundo clic; una prueba terminada indica que no es una aceptación, y un cambio hecho después de terminar queda fechado y visible.
- uat build enumera las dieciséis garantías que lleva la página y rechaza una plantilla que haya perdido una; uat serve rechaza una copia más antigua de una prueba y cualquier nombre de host distinto del suyo. Un nombre sin letras latinas firma su prueba con una huella estable.
- La habilidad de aceptación indica al agente que construya la página con el comando, nunca a mano, que recorra el paso esencial en un navegador real antes de entregarla y que diga qué comprobaciones se ejecutaron. Los textos de la página ganan veintidós frases en diez idiomas.

## Historial de versiones

Estas fechas identifican las notas revisadas del CHANGELOG, no las fechas de publicación en npm. El sitio web verifica por separado las fechas de publicación en npm.

| Versión | Fecha de las notas | Resumen revisado |
| --- | --- | --- |
| 0.18.0 | 2026-09-25 | La página de aceptación ahora verifica cada guardado, restaura tus respuestas al recargar antes que nada, mantiene separadas las pruebas de otras versiones y otras pestañas, y nombra dieciséis garantías que la construcción se niega a perder. Nada cambia en la instalación ni en la actualización; reconstruye tus páginas de receta para obtener la nueva página. |
| 0.17.1 | 2026-09-24 | Instalar sobre otra versión ahora se detiene y remite a update, una reinstalación conserva tus ajustes y las actualizaciones eliminan los archivos que una versión ya no incluye, con una copia restaurable. Algunos comportamientos de instalación cambian: revisa tus scripts antes de volver a ejecutarlos. |
| 0.17.0 | 2026-09-22 | Las páginas de aceptación evitan la pérdida silenciosa de respuestas y las exportaciones vacías. Las recetas se generan por su identificador y los controles de publicación usan Node directamente en Windows. Las guías añaden prompts para revisar resultados y conservar el contexto del proyecto. |

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

**Paquetes originales** (creados por Laurent Rochetta)
- **Dev Studio** — 6 agentes SDLC especializados: Miriam (analista de negocio), Huldah (redactora técnica), Yosef (product manager), Rachel (diseñadora UX), Bezalel (arquitecto de sistemas), Oholiab (ingeniero sénior) — 38 workflows que cubren todo el ciclo, de la lluvia de ideas al despliegue
- **SEO Engine** — 3 agentes (Scout, Chief, Judge), pipeline de auditoría en 6 fases, bucle de optimización PageSpeed, integraciones con Google Search Console y GA4
- **Memory Pack** — agente Zecher para una memoria persistente entre sesiones, con escáner de proyectos

**Fuentes externas e inspiraciones**
- **BMAD-METHOD** de [bmad-code-org](https://github.com/bmad-code-org/BMAD-METHOD) — metodología multiagente original (MIT)
- **Shield GRC** — 27 agentes de cumplimiento y 11 workflows adaptados de las [habilidades GRC de Hemant Naik](https://github.com/Sushegaad/Claude-Skills-Governance-Risk-and-Compliance) (MIT)
- **Pipeline OSINT** basado en [smixs/osint-skill](https://github.com/smixs/osint-skill) (MIT)
- **Integración con Apify** — asistente OSINT inspirado en las [habilidades de agente de Apify](https://github.com/apify/agent-skills) (el origen declara Apache-2.0; consulta los avisos)
- **Karpathy Guardrails** — adaptación para el Memory Pack de las [pautas comunitarias de forrestchang](https://github.com/multica-ai/andrej-karpathy-skills), inspiradas en Andrej Karpathy (MIT declarada en el origen)
