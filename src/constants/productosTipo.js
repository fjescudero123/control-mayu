// ─── PRODUCTOS TIPO ──────────────────────────────────────────────────────────
// Biblioteca viva de productos recurrentes (no a medida). Cada producto tipo
// agrupa documentos reutilizables organizados en dos áreas: Comercial e
// Ingeniería. No hay cliente, fechas de entrega ni flujo de aprobación
// multi-rol — el objetivo es mantener una versión viva de los planos, BOM,
// lista de precios y costo de cada producto recurrente.

// Roles que pueden crear / subir archivos a productos tipo. El resto de roles
// autorizados a la app solo pueden consultar.
export const PT_EDIT_ROLES = [
  'Gerente General',
  'Gerente Comercial',
  'Subgerente Comercial',
  'Project Manager',
  'Administrador del sistema',
];

const makeDoc = (id, name) => ({
  id,
  name,
  version: '-',
  fileUrl: null,
  originalFileName: null,
  history: [],
  messages: [],
});

const buildAreas = () => ({
  comercial: {
    name: 'Comercial',
    docs: [
      makeDoc('c1', 'Lista de precios'),
      makeDoc('c2', 'Costo'),
    ],
  },
  ingenieria: {
    name: 'Ingeniería',
    docs: [
      makeDoc('i1', 'Planos de fabricación'),
      makeDoc('i2', 'Planos de montaje'),
      makeDoc('i3', 'BOM'),
      makeDoc('i4', 'Itemizado producto terminado'),
    ],
  },
});

// Seed — si la colección chk_productos_tipo está vacía, se siembra con esto.
export const PT_SEED = [
  {
    id: 'PT-VIVIENDA-EMERGENCIA',
    name: 'Vivienda de Emergencia',
    description: 'Vivienda de emergencia 28 m² panel PIR',
    areas: buildAreas(),
  },
  {
    id: 'PT-GALPON-15X30',
    name: 'Galpón 15x30',
    description: 'Galpón industrial modular 15 × 30 metros',
    areas: buildAreas(),
  },
  {
    id: 'PT-BANOS-FV',
    name: 'Baños FV',
    description: 'Baños FV',
    areas: buildAreas(),
  },
];
