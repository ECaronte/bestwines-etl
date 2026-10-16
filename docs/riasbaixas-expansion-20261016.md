# Ampliación Rías Baixas — 16/10/2026

19 candidatas adicionales documentadas en las páginas 1–2 del Consejo Regulador. No se afirma cobertura de todas las bodegas de la DO.
12 fichas individuales leídas; 7 devolvieron 403 y conservan solo datos del listado. No se intentó eludir ese bloqueo.
Laureatus, Pedralonga y Pentecostés contrastadas además con sus webs propias.
Seis borradores editoriales nuevos. Conteo consolidado: 178 candidatas, 32 borradores y cero autorizadas para publicación.

## Identidades y discrepancias
- Noelia Bebelia se conserva como alias de Adega San Salvador de Soutomaior.
- Pentecostés y Alberto Cabaco Mariño se mantienen en un solo registro.
- Dom Bardo se asocia a Agrupación de Cosecheros Albariño do Salnés.
- Gundián se conserva como marca asociada a Adega Valdés.
- Laureatus publica mínimo de ocho personas en texto y cinco en formulario: no se fija mínimo.
- Terra Santa indica número 23 en texto y s/n en dirección: pendiente de contraste.
- ATTIS menciona dominios .es y .com: enlace del Consejo no equivale a sitio actual comprobado.
- Nombres de titulares sin marca/establecimiento aclarado quedan en revisión de entidad.
- Todas las coordenadas nuevas son null; no se geocodifica una dirección por aproximación.

No hay coincidencias exactas de nombres/alias normalizados con las 161 filas originales. Este control no descarta duplicados semánticos, fincas compartidas o identidades ya presentes en AWS.

## Archivos y reproducción
La cola original de 159 se conserva. publication-queue-expanded-20261016.json añade las 19 y refleja los borradores de todos los paquetes. No es un archivo de importación.

```sh
python tools/consolidate-candidate-queue.py \
 data/review/publication-queue-20261016.json \
 data/review/spain-quality-review-20261016.json \
 data/review/riasbaixas-expansion-20261016.json \
 data/review/priority-editorial-profiles-20261016.json \
 data/review/do-editorial-drafts-20261016.json \
 data/review/murcia-primary-editorial-20261016.json \
 /tmp/new-expanded-queue.json
```

El archivo generado incorpora hashes de entrada. Los nombres de entrada usados en la ejecución local son abreviados; los bytes de paquetes corresponden al contenido documentado. Reejecutar con nombres del repositorio produce los mismos conteos y entradas, con nombres de hash adaptados.

Validación: rechazo de IDs/fuentes repetidas, registros indexables y borradores sin candidata; no mutación de cola base; 178 IDs únicos; 32 borradores. Sin escritura AWS, envío de correos, fusión o publicación.
