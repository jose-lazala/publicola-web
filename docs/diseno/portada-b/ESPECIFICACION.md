# Portada de publicola.com.do · Propuesta B "Azul profundo"

Aprobada por José Lazala el 12 de noviembre de 2026. Esta carpeta es la **referencia visual**; el código final se escribe dentro de la web real, siguiendo sus convenciones.

## Archivos

| Archivo | Qué es |
|---|---|
| `portada-escritorio.html` | Referencia completa a 1440 px. Ábrela en el navegador. |
| `portada-movil.html` | Referencia completa a 390 px. |
| `publicola-logo-blanco.png` | Logo en negativo (texto blanco) para fondo oscuro. Generado a partir de `/marca/publicola-logo-v3.png`; provisional hasta tener el logo original en vector. |
| `publicola-logo-color.png` | Logo actual con fondo transparente. |

Las referencias cargan las fuentes desde Google Fonts solo para poder verse. **En producción las fuentes se sirven desde `/tipografia/`** (regla de la web: sin fuentes ni librerías de internet).

## Tipografía

- **Mona Sans** (variable; ancho 75–125 %, peso 200–900; licencia OFL).
  - Titulares: `font-stretch: 112–118%`, peso 680–760, interletrado −0.02 a −0.03 em.
  - H1 portada: `clamp(44px, 4.6vw, 68px)`, interlineado 0.98, peso 760, ancho 115 %.
  - H2 de sección: `clamp(36px, 3.8vw, 54px)`, interlineado 1.02, peso 720, ancho 112 %.
  - Texto: ancho 100 %, 17–19 px, interlineado 1.6. Interfaz: 13–15 px, peso 500–600.
- **JetBrains Mono** 500 (licencia OFL): antetítulos de sección, códigos (43211708), páginas citadas (p. 7), etiquetas de estado. 11–13 px, mayúsculas con espaciado 0.08–0.14 em.

## Color (variables CSS)

| Token | Valor | Uso |
|---|---|---|
| `--noche` | `#050B1E` | Fondo base |
| `--noche-2` | `#060E24` | Fondo de secciones alternas |
| `--pie` | `#030816` | Pie de página |
| `--panel` | degradado `#0D1A3B → #0A1531` | Paneles |
| `--panel-elevado` | `#12244F → #0D1B3E` | Panel superpuesto (ficha) |
| `--panel-hundido` | `#071330` | Interfaces dentro de paneles |
| `--filete` | `#1B2A52` | Bordes |
| `--filete-2` | `#24386B` | Bordes de campos y chips |
| `--texto` | `#F2F5FC` | Texto principal |
| `--texto-2` | `#C3CDE4` | Texto de lectura |
| `--apoyo` | `#8E9CC0` / `#AEBBD8` | Texto secundario |
| `--azul` | `#2A62F0` (hover `#2559E0`, activo `#1E4BC2`) | Botón principal |
| `--azul-luz` | `#8FB0FF` | Enlaces, Publi, acentos |
| `--oro` | `#F4B740` | Workflow, servicios, datos citados, cierre próximo |
| `--verde` | `#4CD69A` | Vigente, Listo |

Contraste comprobado: texto-2 sobre noche 12.3:1 · apoyo 7.1:1 · blanco sobre azul 5.1:1 · oro sobre panel 9.8:1.

**Significado del color:** azul = Publi e investigación; oro = Workflow, preparación de ofertas, servicios y páginas citadas. El oro nunca se usa como fondo de texto largo.

## Luz y profundidad (discreta)

- Halo radial azul (≈30 % de opacidad) detrás del producto en la portada y en el cierre.
- Cuadrícula de 72 px al 7 % con máscara radial, solo en portada y cierre.
- Filete de 1 px con degradado (azul u oro) en el borde superior de cada panel.
- Sombra profunda solo en los paneles del producto de la portada.

## Componentes y estados

- **Botones**: principal (azul), secundario (contorno claro), contorno oro (servicios y Pro), fantasma (Iniciar sesión). Alturas 56 / 46 / 38 / 30 px; radio 12 / 10 / 9 / 8. Estados: hover, activo (baja 1 px), foco visible (anillo `#8FB0FF` con separación) y desactivado.
- **Chips de filtro** con `aria-pressed`; **filas de resultado** seleccionables con halo azul; **citas de página** en mono oro; **estados** Listo / Pendiente / En preparación.
- Iconos de trazo 1.8 sobre 24 px (sin emojis).
- Objetivos táctiles de 44 px o más en móvil. Respeta `prefers-reduced-motion`.

## Secciones y procedencia del texto

Todos los textos salen de la web actual. No reescribir sin aprobación de José.

1. **Cabecera**: logo blanco; Plataforma (ancla), Planes, Servicios, Recursos (anclas en la portada), Contacto; "Iniciar sesión"; "Crear mi cuenta gratis".
2. **Portada**: antetítulo, H1 "Compite mejor por contratos del Estado", texto, "Crear mi cuenta gratis" + "Ver un expediente", "Cuenta gratis, sin tarjeta." A la derecha, el Explorador con la ficha superpuesta.
3. **Pasos** Encuentra · Entiende · Comprueba + línea de fuentes (texto de /fuentes/) con enlace a "Fuentes y metodología".
4. **01 · Explorador**: "Encuentra una oportunidad. Abre el expediente." Explorador, Ficha con IA, Seguimiento, Radar por correo, Inteligencia normativa.
5. **02 · Inteligencia de mercado**: "Conoce a quien compra. Cotiza con contexto." Referencias de precios (dato real), Instituciones e InfoPago, Compras futuras, Competidores.
6. **03 · Publi y Workflow**: "Publi investiga. Workflow prepara." + Trabajo en equipo.
7. **04 · Planes**: Gratis US$0 · Plus US$75 · Pro US$150 al mes por empresa (precios de /planes/ al 12 nov. 2026). Bloque independiente: si cambia el modelo de cobro, se reemplaza solo esta sección.
8. **05 · Servicios profesionales**: lista "De la idea a la licitación", plazos publicados (5 a 6 y 15 días laborables) y los cinco servicios de /servicios/.
9. **06 · Centro de Recursos**: las tres guías que hoy destaca la portada, con fecha y extracto.
10. **Cierre**: "Primero entiende la licitación. Después decide." + "Crear mi cuenta gratis" y "Entrar a Mi Publicola".
11. **Pie**: lema, enlaces, contacto (correo, LinkedIn, Instagram) y el aviso de /fuentes/: "Publicola es una plataforma privada independiente. No está afiliada, patrocinada ni respaldada por la Dirección General de Contrataciones Públicas."

## Datos reales e ilustrativos

- **Real**: RD$ 371.94 por unidad, mediana contratada para mouse de computadora (43211708), 480 compras verificadas, consulta del 31 oct. 2026.
- **Ilustrativo** (marcado "Ejemplo ilustrativo"): las tres licitaciones del Explorador, la ficha, la conversación con Publi y el tablero de Workflow.
- **En producción**: la ficha de la portada debe usar el expediente destacado real cuando exista; si no hay uno vigente, se muestra el ejemplo con su marca.

## Reglas de contenido

- Publi busca licitaciones y suplidores y apoya la investigación. **Publi no prepara ofertas ni borradores de ofertas**; eso es Workflow.
- Las funciones se presentan sin etiquetas de plan; el detalle por plan vive solo en la sección 04.
- No inventar cifras, clientes, testimonios ni precios.

## Adaptación

- Escritorio: contenedor de 1344 px con márgenes de 56 px; rejillas `auto-fit` que pasan a una columna.
- Móvil: márgenes de 20 px, botones a todo el ancho, filtros con desplazamiento horizontal, ficha superpuesta con desplazamiento de 18 px.

## Pendientes conocidos

- El expediente público no carga hoy: `/app/ficha_editorial.js`, `/app/ficha_editorial.css` y `/api/v1/expedientes/destacado` responden 404.
- Confirmar que los filtros del ejemplo (vigentes, rubro, cierre, MIPYME) existen en el Explorador real.
- `/planes/` todavía atribuye a Publi Pro "adapta borradores con tu biblioteca"; pendiente de corregir en otro encargo.
