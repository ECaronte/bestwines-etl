# Ampliación del catálogo — 16 octubre 2026

## Trabajo ejecutado

104 registros normalizados del conjunto oficial de bodegas de Open Data Euskadi. Fuente de licencia: https://datos.gob.es/es/catalogo/a16003011-bodegas-de-vino-y-txakoli-de-euskadi (CC BY 4.0). Conservar atribución al Gobierno Vasco y enlace a licencia en las fichas que incorporen estos datos. No se importan textos descriptivos ni fotografías.

104 tienen coordenadas dentro del área esperada; 8 no incluyen web. Ysios coincide por nombre normalizado con una ficha pública existente: no crear otra. La coincidencia de nombres es orientativa y no sustituye contrastar IDs internos, dominios y distancias. El fichero incluye al menos una escuela de vino y un complejo enogastronómico; la clasificación original no basta para publicar todos como bodegas.

## Ejecución reproducible

Descargar el JSON desde la URL datasetUrl de los candidatos y un listado público completo de /wineries, recorriendo nextCursor hasta agotarlo. Ejecutar:

    python tools/import-euskadi.py source.json public.json data/euskadi-candidates-20261016.json

El importador no escribe AWS ni modifica el dataset principal. Genera candidatos con indexable=false y flags de revisión. No inferir disponibilidad de visitas de la bandera visit del proveedor.

## Fuentes siguientes

- España / Murcia: https://datos.gob.es/es/catalogo/a14036695-bodegas — comprobar distribución, licencia y vigencia antes de adaptar.
- España / Rioja Alavesa: https://rutadelvinoderiojaalavesa.com/es/asociados/bodegas — contraste de identidad y canales oficiales; no es una licencia de extracción masiva.
- Portugal / CVR Tejo: https://www.cvrtejo.pt/enoturismo — directorio de la comisión regional, con localidades y fichas individuales; contrastar cada bodega en su web. No se ha acreditado licencia abierta.
- Italia / Movimento Turismo del Vino: https://movimentoturismovino.it/ricerca-cantine/ — directorio por regiones, advierte que está en actualización. Usar para descubrir y contrastar; no se ha acreditado licencia abierta.

## Siguiente puerta de publicación

Reconciliar con bw-dev-main y bw-dev-slug; verificar identidad, municipio, coordenadas y web; redactar descripción propia con fuentes; conservar imagen ilustrativa aprobada; preparar lote con IDs y slugs estables para el proceso de publicación existente. No cambiar IDs existentes ni activar candidatos masivamente.

La API pública observada contenía 219 registros: FR142 DE44 AT19 CH6 ES3 IT2 GR1 GB1 HU1 PT0. Esta medición no cuenta los registros privados de DynamoDB.
