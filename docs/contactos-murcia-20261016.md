# Revisión de contactos y Murcia — 16 octubre 2026

27 fichas revisadas; 26 con teléfono o correo publicado; 19 con web identificada. No se ha comprobado la entrega de emails ni se han enviado comunicaciones. No se ha publicado nada en producción.

Las 27 carecían de URL en nuestro archivo: no eran 27 bodegas demostrablemente sin web. Quince eran semillas de descubrimiento pendientes de completar.

## Contactos y fuentes

Cada contacto y URL tiene fuente individual en `data/review/contact-enrichment-20261016.json`. Las webs identificadas requieren comprobar disponibilidad e identidad antes de publicar.

| Bodega | Contactos publicados | Web identificada |
|---|---|---|
| Espada Ojeda | espadaojeda@telefonica.net; bodegas@espadaojeda.com; 945627349 | https://www.espadaojeda.com |
| Bodegas Juan José García Berrueco | bodegb@hotmail.com; bodegab@hotmail.com; 659 756 184 / 945 609 119 | No localizada; no prueba ausencia |
| Miguel Angel Muro y Otros | info@bodegasmiguelangelmuro.com; info@bodegasmuro.es; 0034659135108 | https://www.bodegasmuro.es |
| Bodega Txakoli Uriarte | info@txakoli-uriarte.com | https://txakoli-uriarte.com/ |
| El Txakoli | 945890703 | No localizada; no prueba ausencia |
| Urki Txakolina | info@urkitxakolina.com; 943140888 | No localizada; no prueba ausencia |
| Zabala Txakolina | zabalatxakolina@gmail.com; 656767954 | https://www.zabalatxakolina.com |
| Bodegas Páganos | 945600590 | No localizada; no prueba ausencia |
| BODEGA LLORET |  968 56 00 97 | No localizada; no prueba ausencia |
| BODEGAS SERRANO | info@bodegasserrano.es; 660 162 755 | No localizada; no prueba ausencia |
| CASA BOQUERA | winery@casaboquera.com; 605 40 90 40 - 968 01 15 11 | https://casaboquera.es/ |
| Jorge Piernas Bodegas y Viñedos | info@jorgepiernas.com; 660187177 | https://jorgepiernas.com/ |
| Bodega Campo Eliseo | bodega@campoeliseo.com; 983034030 | https://www.campoeliseo.es/ |
| Bodega Cuatro Rayas | info@cuatrorayas.es | https://cuatrorayas.es/ |
| Javier Sanz Viticultor | info@bodegajaviersanz.com; 983816669 | https://bodegajaviersanz.com/ |
| Bodegas Garciarévalo, S.L. | comunicacion@garciarevalo.com; 983832914 | https://www.garciarevalo.com/ |
| Bodega Emina | 983803346 | https://emina.es/ |
| 41 Norte, S.L. | info@41norte.com | http://www.41norte.com |
| AALTO BODEGAS Y VIÑEDOS | aalto@aalto.es; 983036949 | https://aalto.es/ |
| Abadía de Acón, S.L. | info@abadiadeacon.com; 947509292 | https://www.abadiadeacon.com/ |
| ADE GUMIEL, S.L. | No localizado | No localizada; no prueba ausencia |
| AGRICOLA RIOVA, S.L. | mgarcia@agricolariova.com; 620854802 / 663797346 | https://agricolariova.com/home/ |
| A. Pazos de Lusco, S.L. | info@lusco.es; 986658519 | http://www.lusco.es |
| Abadía de Tortoreos, S.L. | adegasluz@gmail.com; 615270704 | http://www.abadiadetortoreos.com |
| ADEGA CONDES DE ALBAREI, S.A.U. | inf@condesdealbarei.com; 986543535 | https://condesdealbarei.com/ |
| Adega Destinos Cruzados, S.L. | i.destinoscruzados@gmail.com; 600536154 | No localizada; no prueba ausencia |
| Adega dos Eidos, S.L. | info@adegaeidos.com | https://adegaeidos.com/ |

## Murcia

16 intercambios de ejes corroborados individualmente por las coordenadas explícitas de la ficha turística oficial. Se aplican en el informe de revisión, conservando los valores originales. Otras 6 ubicaciones se guardan como propuestas: cinco sustituyen valores proyectados de CRS desconocido; Carchelo difiere de su posición antigua. No se convierte ningún CRS por suposición. Veinte de los 42 registros aún no tienen nueva evidencia de ubicación.

Madrid Romero requiere aclarar municipio/ubicación. Carchelo requiere resolver discrepancia. Se mantienen las alertas de museos, tiendas, almazaras y duplicados. La fuente turística no sustituye la comprobación del acceso principal de cada bodega.

## Discrepancias relevantes

- García Berrueco: el dataset y el ayuntamiento publican emails distintos. Confirmar por teléfono.
- Lloret: la tienda encontrada en Los Alcázares no se ha asignado al registro de La Unión.
- Zabala: el consejo documenta un traslado en 2017; revisar posición antigua.
- ADE GUMIEL: la ficha del consejo no aporta teléfono, correo ni web.
- Los nombres comerciales Muro, Viñedos de Páganos y Palacio de Villachica exigen revisar alias, sin fusionar por suposición.

## Reproducir

```sh
python tools/apply-research.py data/review/spain-quality-review-20261016.json data/review/contact-enrichment-20261016.json data/review/murcia-location-evidence-20261016.json /tmp/spain-enriched-review.json
```

El informe conserva los bloqueos de publicación y la necesidad de snapshot interno completo y reciente.

## Hipótesis comercial

Probar con un grupo pequeño de bodegas con necesidad digital confirmada: ficha validada, fotos autorizadas, contenido útil y solicitudes medibles. Mantener una ficha básica gratuita y evaluar servicios adicionales cuando exista demanda. No prometer posiciones en Google ni tráfico que todavía no se haya demostrado. El correo público no se considera permiso de marketing. No se ha preparado ningún envío automático.
