# bestwines-etl

ETL upstream para BestWines: genera `out/dataset.json` canonical + `out/dataset.csv` y publica a S3.
El backend (infra) permanece congelado y solo ingesta desde S3 con `seed-big.ts`.

## Requisitos
- Node >= 20
- Credenciales AWS configuradas (en Replit o local)

## Instalación
```bash
npm i

