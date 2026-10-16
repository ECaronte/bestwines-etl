# Revisión documental — 16 octubre 2026

## Resultado acumulado
- 161 registros originales conservados.
- 29 registros con decisiones documentales; no equivale a revisión integral de sus fichas.
- Dos exclusiones de la cola de bodegas: DeOrtegas y Olimendros (almazaras).
- 159 candidatas restantes, todavía incluyendo duplicados sin resolver.
- 11 parejas de proximidad resueltas como entidades comerciales distintas.
- Seis registros conservan alertas de duplicado: Balcona (2), Lavia (2), Gorka Izagirre / Azurmendi (2).
- Cero aprobaciones para publicación y cero escrituras en producción.

## Parejas diferenciadas
Tierra / González Teso; Espada Ojeda / Casado Morales; Cosme Palacio / Solar de Samaniego; De Luis R. / El Mozo Wines; Casa Primicia / Torre de Oña; Casa Primicia / Mayor de Migueloa; Valdelana / Viña Salceda; Valdelana / Las Orcas; Viña Salceda / Las Orcas; Mayor de Migueloa / Carlos San Pedro; Carlos San Pedro / Cueva Dorretxe.

Las fuentes acreditan identidades comerciales distintas, no necesariamente independencia societaria. El contraste pendiente con el catálogo interno no se sustituye por esta revisión del lote.

## Incidencias que permanecen
- Balcona: dos registros con municipios/puntos distintos. Coordenada del Consejo de Bullas diferente del registro 6367.
- Lavia: propuesta de consolidación, con dirección postal en Cehegín según el Consejo. No inferir titularidad actual de una referencia histórica a MGWines.
- Gorka Izagirre / Azurmendi: distinguir complejo turístico de bodega; no afirmar identidad legal entre restaurante y bodega.
- Madrid Romero: contacto en Torre Pacheco frente a Jumilla en el origen. No se infiere traslado ni ubicación productiva.
- Carchelo: aproximadamente 10 km de diferencia entre puntos propuestos.
- Casa Primicia: dos sedes y teléfonos diferenciados; modelar por función antes de elegir la entrada principal.
- Torre de Oña: dirección oficial en Páganos; revisar coordenada del lote próxima a Casa Primicia.
- Viña Salceda: web y ayuntamiento aportan puntos distintos del lote; el texto de coordenadas de la web tiene un separador ambiguo. No interpretar automáticamente signo de longitud.
- Las Orcas: municipio/dirección no coherentes entre fuentes consultadas.
- De Luis R.: portada en Camino de Elvillar 22; aviso legal en número 18. No confundir domicilio legal y contacto.
- Cueva Dorretxe: actividad de visita a cueva-bodega documentada; elaboración propia actual no acreditada en esta revisión.
- Pío del Ramo: actividad vinícola acreditada; no excluir por la palabra almazara. Dirección publicada en Ontur, Albacete: el origen Murcia del dataset no determina provincia.
- Juan Gil / tienda GFE: separar comercio e instalaciones de elaboración.
- Museo Casa de la Ermita: evitar confusión con el Museo del Vino municipal en El Arsenal; no contar el museo como otra bodega.

Fuentes, IDs y hechos propuestos: `data/review/documentary-decisions-20261016.json`. Datos propuestos se guardan como evidencia, no sustituyen automáticamente campos canónicos. No se han contactado bodegas ni probado entregabilidad.

## Reproducción
```sh
python tools/apply-research.py data/review/spain-quality-review-20261016.json data/review/contact-enrichment-20261016.json data/review/murcia-location-evidence-20261016.json /tmp/spain-enriched.json
python tools/apply-documentary-review.py /tmp/spain-enriched.json data/review/documentary-decisions-20261016.json /tmp/spain-reviewed.json
python tools/test-documentary-review.py
```

La ejecución encadenada conserva 26 registros con contactos públicos y 16 correcciones de ejes corroboradas por turismo, así como 6 propuestas de sustitución sin aplicar. La revisión documental añade conflictos donde procede: una corrección de ejes no acredita entrada principal.

Las 5 pruebas comprueban conservación de datos originales e inmutabilidad de entrada, exclusiones exactas, bloqueo de publicación, resolución limitada a parejas documentadas, idempotencia y rechazo de IDs/parejas inválidos o sin evidencia. Todas pasan.

## Pendiente para publicación
Instantánea interna completa y reciente, validación de ubicación principal, resolución de duplicados restantes, condiciones de reutilización aplicables y contenido editorial. `resolvedDistinctBatchMatches` y `unresolvedBatchMatches` separan los resultados de revisión; `batchMatches` conserva la alerta original para trazabilidad.
