# Revisión de 15 candidatas por DO — 16/10/2026

Se añade evidencia para las 15 candidatas ya descubiertas: cinco Rueda, cinco Ribera del Duero y cinco Rías Baixas. No son 15 altas nuevas ni una publicación. Cola total de candidatas permanece 159.

- 15 revisiones documentales adicionales; 12 borradores españoles con una FAQ y fuentes.
- 4 propuestas geográficas: AALTO, Campo Elíseo, Pazos de Lusco y Condes de Albarei. Ninguna aplicada al dataset.
- 12 referencias web propias/grupo verificadas; 3 sin web propia verificada (41 Norte, ADE GUMIEL, Destinos Cruzados). No afirmar que carecen de web.
- 14 contactos email documentados; entrega no comprobada. ADE GUMIEL sin contacto verificado.
- Las siete fichas prioritarias anteriores permanecen intactas; ahora hay 19 borradores entre ambos paquetes, sin integración en producción.

## Distinciones importantes
AALTO publica coordenadas separadas para entrada de camino y bodega: se propone el segundo punto, 41.6036111111,-4.2652777778.
Campo Elíseo: target del mapa enlazado por su contacto 41.4135633,-4.907783; no usar el centro del visor.
Condes de Albarei: target del mapa oficial 42.4898432,-8.8045563; no mezclar con Pazo Baión.
Pazos de Lusco: GPS del grupo 42°05′51.1″N,8°31′27.2″W, convertido a decimal.
Los dos enlaces abreviados mostraron el destino en la redirección, pero no se pudo leer el mapa; el método y sus límites se conservan.

Cuatro Rayas distingue domicilio general y punto de encuentro de la experiencia. Emina Rueda se separa de Emina Ribera; se omiten horarios contradictorios.
Abadía de Tortoreos tiene texto de email corroborado por Consejo, pero enlaces mailto discordantes: no importarlos.
Agrícola Riova se identifica como Palacio de Villachica Ribera y muestra dos teléfonos: mantener revisión de alias, no inventar dos entidades.
41 Norte: Consejo enlaza dominio .com; búsqueda encuentra .es cuyo acceso agotó tiempo. No asumir migración.
ADE GUMIEL: dirección de sociedad solamente, sin afirmar entrada de visitas.
Destinos Cruzados: no convertir una práctica ecológica expresamente no certificada en certificación.

## Archivos
- data/review/do-primary-evidence-20261016.json: propuestas de datos, fuentes y bloqueos.
- data/review/do-editorial-drafts-20261016.json: 12 textos originales breves, sin fotografías copiadas, precios, disponibilidad o valoraciones inventadas.
- Ninguno reemplaza data/review/publication-queue-20261016.json; integrar después de revisión semántica con el inventario privado.

## Validación
IDs únicos y presentes entre las 161 filas originales, 15 expedientes y 12 borradores; publicación e indexación desactivadas en todos. Cuenta de propuestas geográficas: 4. Los contactos no se han utilizado para enviar mensajes.

## Inventario interno
PR infra #13: https://github.com/ECaronte/bestwines-infra/pull/13
Commit 4778d1db5d57c767e5fe1d8d11807e2f78d53d49.
16 pruebas locales correctas y CI GitHub correcto (38906436711,38906401012); guardrails correcto (38906437214).
Es una propuesta acotada para revisión e incorporación normal a main. No fusionada ni ejecutada en AWS. Mantiene production y BestWinesGitHubReadRole.
