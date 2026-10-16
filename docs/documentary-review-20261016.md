# Revisión documental adicional — 16 octubre 2026

Se han registrado decisiones documentales para **10 de 161 registros**, no una validación manual completa del lote. Dos registros se excluyen de la cola de bodegas: DeOrtegas y Olimendros, cuya actividad acreditada es la elaboración de aceite. Quedan **159 candidatas**, todavía incluyendo duplicados pendientes. Ninguna recibe aprobación de publicación.

## Incidencias
- Balcona: dos registros, municipios y puntos distintos. El Consejo de la DO aporta otra coordenada; corregir ejes no resuelve la ubicación.
- Lavia: mismo nombre y coordenadas originales; el Consejo relaciona la bodega con MGWines y dirección en Cehegín. Consolidación propuesta, no ejecutada.
- Gorka Izagirre / Azurmendi: evitar contar el complejo turístico como otra bodega; la evidencia no equipara entidades legales.
- Madrid Romero: dirección de contacto en Torre Pacheco distinta del origen Jumilla. Coordenadas del enlace cartográfico y datos estructurados conservadas como propuestas, no como ubicación productiva validada.
- Carchelo: discrepancia de aproximadamente 10 km pendiente. El mapa por búsqueda de nombre no prueba un punto exacto.

Fuentes, IDs, hechos propuestos y limitaciones están en `data/review/documentary-decisions-20261016.json`. No se han contactado bodegas ni probado entregabilidad de correos.

## Uso reproducible
Aplicar después del enriquecimiento existente de contactos y coordenadas, conservando todos los originales:

```sh
python tools/apply-research.py data/review/spain-quality-review-20261016.json data/review/contact-enrichment-20261016.json data/review/murcia-location-evidence-20261016.json /tmp/spain-enriched.json
python tools/apply-documentary-review.py /tmp/spain-enriched.json data/review/documentary-decisions-20261016.json /tmp/spain-reviewed.json
```

El segundo paso no modifica latitud, longitud ni municipio; añade decisiones y excluye únicamente dos registros de esta cola. No borra entidades de producción ni fusiona registros. Rechaza IDs desconocidos o repetidos y es idempotente. Verificados conservación de registros/coordenadas, exclusiones, bloqueo de indexación, idempotencia y rechazo de ID desconocido.

Para publicar siguen pendientes el contraste con una instantánea completa del catálogo interno, validación de ubicación principal, resolución de duplicados, condiciones de reutilización aplicables y contenido editorial. Las alertas de cercanía por sí solas nunca justifican fusionar bodegas.
