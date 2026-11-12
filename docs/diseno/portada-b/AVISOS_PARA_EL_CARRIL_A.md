# AVISOS PARA EL CARRIL A

Encargo de origen: carril B · nueva portada de publicola.com.do con el diseño B (12-nov-2026).
Esta carpeta (`docs/`) no se publica en publicola.com.do (ver `_config.yml`).

## 1. El expediente público no carga (404 en la app)

Comprobado el 12-nov-2026 hacia las 21:20Z contra producción:

| Dirección | Respuesta |
|---|---|
| `https://publicola.com.do/app/ficha_editorial.js` | 404 (JSON del servidor de la app) |
| `https://publicola.com.do/app/ficha_editorial.css` | 404 (JSON del servidor de la app) |
| `https://publicola.com.do/api/v1/expedientes/destacado` | 404 (JSON del servidor de la app) |

Las tres las sirve la app en Oracle (`/opt/publicola`), no GitHub Pages. La causa está en archivos del carril A y este encargo no los toca.

**Evidencia:**
- La copia del árbol vivo del 11-nov-2026 a las 11:36 (`/private/tmp/publicola-vigencia-candidatos.xsUJF2yJ/app`) sí trae:
  - `interfaz/ficha_editorial.js`;
  - la ruta `@router.get("/expedientes/destacado")` en `api/rutas.py` (línea 1554), que devuelve `{"expediente": expediente_publico.construir(...), "servido_en": ...}`;
  - la ruta de descargas `/expedientes/destacado/{codigo}/descargas/{archivo}`;
  - el módulo `modulos/expediente_publico.py`.
- El commit ce4fc110 (`integracion/ia-normativa-activa-20261112`), que el 12-nov a las 20:10Z coincidía con todo el código activo, **no** contiene `ficha_editorial.*` ni la ruta `expedientes/destacado`.
- Causa probable: el despliegue del 11-nov a las 18:17Z (`publicar_app_en_una_ventana.sh`) apartó el árbol anterior con sus capas vivas en `/opt/publicola-anterior-codigo-20261111T180816Z` y no las trasladó.

**A quién afecta hoy:**
- la página publicada `/expedientes/` («Buscando un expediente vigente…» y luego «no está disponible»);
- la ficha de la portada, que mientras tanto muestra el ejemplo ilustrativo.

**Qué hace la portada nueva mientras tanto:**
- El botón de la portada dice «Abrir el Explorador» y lleva a `/app/#/oportunidades`.
- Los enlaces «Ver el expediente público» (sección 01 y pie) están ocultos.
- La ficha superpuesta muestra el ejemplo de la referencia con la marca «Ejemplo ilustrativo».

**Cuando el carril A restituya la ruta, la portada se arregla sola, sin publicar nada en la web.** `portada-b.js` consulta `/api/v1/expedientes/destacado`. Si recibe un expediente con `vence_en` posterior a `servido_en`:
- pinta la ficha real: modalidad, estado, cierre, código, título, institución, dirigido a, los 3 primeros requisitos de `cotejo.grupos` con su página citada y el enlace al SECP;
- vuelve a poner «Ver un expediente» → `/expedientes/`;
- muestra los enlaces ocultos.

La portada ya no carga `/app/ficha_editorial.js` ni `.css`. Esos dos archivos solo los necesita `/expedientes/`.

**Pedido:**
1. Restituir en producción `interfaz/ficha_editorial.js`, `interfaz/ficha_editorial.css`, las dos rutas `expedientes/destacado` y `modulos/expediente_publico.py`.
2. Consolidarlos en un commit que descienda de ce4fc110.

## 2. Pendientes de la especificación que no son de este encargo

- `/planes/` todavía atribuye a Publi Pro «adapta borradores con tu biblioteca». Según la regla de contenido, Publi no prepara ofertas ni borradores. Queda para el encargo de Planes (carril B).
- Confirmar que los filtros del ejemplo existen en el Explorador real: vigentes, rubro, cierre en 15 días o menos y reservado a MIPYME.
