# Lote editorial prioritario — 16 octubre 2026

Se han preparado siete borradores editoriales con identidad, contactos, descripción, orientación de visita, preguntas frecuentes y fuentes oficiales. Son propuestas para integrar y revisar en staging, no fichas publicadas. No contienen tarifas, puntuaciones, reseñas ni fotografías copiadas.

## Prioridad
1. Loli Casado y Tierra: identidad/localidad documentadas y punto original corroborado a menos de 50 m por la web de la bodega. Distancias calculadas: 4,4 m y 24,2 m. No se ha realizado comprobación física de la entrada.
2. Ameztoi, Baigorri, Berroja, Ostatu y Luberri: borrador editorial y contactos documentados; pendiente resolver la ubicación exacta.
3. Resto de candidatas sin expediente editorial: continuar contraste de fuentes.
4. Registros con alcance de entidad o duplicados especialmente pendientes: resolver antes de preparar alta.

La cola contiene 159 registros únicos: 2 en prioridad 1, 5 en prioridad 2, 144 en prioridad 3 y 8 en prioridad 4. Las prioridades no son niveles de calidad ni aprobación para publicar.

## Hallazgos geográficos
- Baigorri: el enlace cartográfico de la web propia apunta a 42.566226, -2.686522. Es una propuesta de sustitución del dato del dataset. Se extrajo el destino del lugar (!3d/!4d), no el centro de la vista (@).
- Berroja: las indicaciones propias describen acceso por Ajuria e incluyen coordenadas DMS con notación tipográfica inconsistente. Distinguir acceso de emplazamiento.
- Ostatu: el iframe solo aporta un centro cartográfico; no se acepta como pin de entrada.
- Ameztoi y Luberri: dirección corroborada, punto exacto pendiente.
- Tierra: conversión reproducible de 42°35′29″N 2°47′38″W.
- Loli Casado: destino cartográfico del enlace de dirección de la propia web: 42.4899754, -2.5796162.

## Bloqueo operativo comprobado
Se reintentó el workflow de captura interna existente, sin alterar rol, permisos, entorno o código:
https://github.com/ECaronte/bestwines-infra/actions/runs/38411745634
Nuevo job 116973229144: failure, sin pasos ni logs disponibles por el conector. No se obtuvo captura ni se leyó DynamoDB. No se atribuye la causa a facturación ni permisos sin evidencia.

Para completar el contraste de duplicados con entidades ocultas y alias hace falta que esta captura de solo lectura pueda ejecutarse. El código existente no incorpora un ejecutor de altas en producción; la preparación editorial tampoco lo habilita.

## Archivos y reproducción
- data/review/priority-editorial-profiles-20261016.json: siete borradores y evidencia de ubicación.
- data/review/publication-queue-20261016.json: cola completa con bloqueos explícitos.
- tools/build-publication-queue.py: ordenación reproducible con validación geográfica.

Primero aplicar enriquecimiento y revisión documental según docs/documentary-review-20261016.md; después:

```sh
python tools/build-publication-queue.py /tmp/spain-reviewed.json data/review/priority-editorial-profiles-20261016.json /tmp/publication-queue.json
```

Verificados 159 IDs únicos, dos prioridades geográficas corroboradas, bloqueo de publicación en toda la cola y rechazo de una coordenada falsamente marcada como corroborada. La cola vincula sus entradas mediante SHA-256.

Los borradores deberán integrarse en el registro editorial real con el ID definitivo que resulte del contraste interno. No inventar IDs públicos, slugs, geohashes, idiomas de visitas, disponibilidad ni autorización de fotografías.
