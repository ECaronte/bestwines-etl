# Avance adicional Murcia — 16/10/2026

Ocho revisiones: Castaño, Barahonda, Luzón, Viña Elena, La Purísima, Alceño, Silvano García y Bleda.
Siete borradores originales en español con FAQ/contacto. Bleda permanece sin borrador por anomalía en el contenido recuperado: publicidad ajena al vino. No se afirma compromiso del servidor; se exige corroboración antes de reutilizar datos.

Estas revisiones amplían evidencia anterior de Murcia y no deben contarse automáticamente como ocho candidatas nuevas o ocho primeras revisiones.
No se modifican coordenadas originales, estados de publicación ni producción.

## Balance de contenido preparado
7 fichas en priority-editorial-profiles-20261016.json.
12 fichas en do-editorial-drafts-20261016.json.
7 fichas nuevas embebidas en murcia-primary-editorial-20261016.json.
Total: 26 borradores de candidatas, IDs distintos, pendientes de revisión e integración.
Cola original: 159 candidatas después de excluir dos almazaras, sin nuevas altas en AWS.

## Calidad
- Contactos públicos, sin enviar comunicaciones ni comprobar entrega.
- Horarios de tienda separados de visitas; reservas siempre pendientes de confirmación.
- Condiciones de edad no se generalizan entre modalidades de Luzón.
- Mínimos distintos para visitas y eventos en La Purísima.
- Silvano García: dirección urbana de visitas no se equipara a planta productiva.
- Sin precios, premios, disponibilidad o fotografías de terceros importados.
- Validación local: ocho IDs conocidos/únicos; siete borradores; todos indexable=false/publicationReady=false.

## Pendiente operativo
PR infra #13 abierta con CI y guardrails correctos; requiere revisión/fusión normal. No cambiar protección production/main. Después se podrá solicitar manualmente inventario privado desde main y revisar alias/entidades antes de importar. El importador de producción sigue pendiente.
