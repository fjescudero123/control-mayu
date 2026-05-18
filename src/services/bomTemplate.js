// Plantilla Excel del BOM con codigo SKU validado contra catalogo Bodega.
//
// La plantilla generada tiene 4 hojas:
// 1) Instrucciones — texto explicativo de uso (visible).
// 2) Tipologias — Tipologia | Pods (visible).
// 3) BOM — Codigo | Descripcion | Partida | Unidad | Cant. por POD | Tipologias |
//    qtyPorTipPorModulo | Notas. Validacion de datos en col Codigo contra Catalogo!A.
// 4) Catalogo — Code | Desc | Categoria | Unidad. Oculta. Es la fuente del dropdown.
//
// Carga sheetjs (XLSX) por CDN si no esta cargado. Mismo patron que materiales.

async function ensureXlsxLoaded() {
  if (typeof window === 'undefined') return null;
  if (window.XLSX) return window.XLSX;
  await new Promise((resolve, reject) => {
    if (document.getElementById('sheetjs-cdn')) { resolve(); return; }
    const s = document.createElement('script');
    s.id = 'sheetjs-cdn';
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return window.XLSX;
}

function safeProjectName(projectName) {
  return String(projectName || 'proyecto')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'proyecto';
}

function todayYMD() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

// Construye los SKU activos en formato fila para la hoja Catalogo.
function buildCatalogoRows(catalogo) {
  const activos = (catalogo || [])
    .filter(s => s && s.code && s.activo !== false)
    .sort((a, b) => String(a.code).localeCompare(String(b.code)));
  const header = ['Code', 'Desc', 'Categoria', 'Unidad', 'Presentacion', 'Cant. por presentacion'];
  const rows = activos.map(s => [
    s.code,
    s.desc || '',
    s.categoria || '',
    s.unidad || '',
    s.presentacion || '',
    Number(s.cantPorPresentacion) > 0 ? Number(s.cantPorPresentacion) : 1,
  ]);
  return { rows: [header, ...rows], total: activos.length };
}

// Aplica data validation tipo lista en una columna usando una referencia a otra
// hoja (formulas tipo `=Catalogo!$A$2:$A$XXX`). Sheetjs soporta `!dataValidation`
// pero el render real depende del cliente que abre el xlsx (Excel/LibreOffice/Sheets).
// Excel acepta range formulas referenciando otras hojas si el rango es absoluto.
function attachListValidation(ws, sqref, formula) {
  if (!ws['!dataValidation']) ws['!dataValidation'] = [];
  ws['!dataValidation'].push({
    sqref,
    type: 'list',
    operator: 'between',
    allowBlank: true,
    showDropDown: true,
    formula1: formula,
    showErrorMessage: true,
    errorTitle: 'Codigo SKU invalido',
    error: 'Solo se permiten codigos de SKU activos de Bodega. Si el material que necesitas no esta en la lista, pidele a Bodega que cree el SKU primero (Solicitar SKU desde Materiales).',
    showInputMessage: false,
  });
}

// Crea la plantilla en memoria y devuelve un Blob listo para descargar.
export async function generateBomTemplate({ catalogo, projectName, projectType }) {
  const XLSX = await ensureXlsxLoaded();
  if (!XLSX) throw new Error('No se pudo cargar XLSX');

  const wb = XLSX.utils.book_new();
  const todayStr = new Date().toLocaleDateString('es-CL');

  // ── Hoja Instrucciones ──────────────────────────────────────────────────
  const instrucciones = [
    ['BOM MAYU — Plantilla Excel'],
    [],
    [`Proyecto: ${projectName || ''}`],
    [`Tipo: ${projectType || ''}`],
    [`Plantilla generada: ${todayStr}`],
    [],
    ['REGLAS DE LLENADO'],
    [],
    ['1. La hoja "BOM" es la unica que se procesa al subir. Cada fila = un material del baño.'],
    ['2. La columna "Codigo" solo acepta codigos SKU que ya existen como SKU activo en Bodega.'],
    ['   La validacion de datos te muestra el dropdown con los codigos disponibles.'],
    ['3. Si el material que necesitas NO esta en el dropdown, pidele a Bodega/Materiales que'],
    ['   cree el SKU primero (boton "Solicitar SKU" en Materiales). Sin SKU, no se puede subir.'],
    ['4. La columna "Cant. por POD" es la cantidad consumida en 1 POD de cualquier tipologia.'],
    ['   Si el consumo varia por tipologia, deja una fila por tipologia (mismo codigo).'],
    ['5. La columna "Tipologias" indica en que tipologias aplica el material, separadas por "|".'],
    ['   Si esta vacio, se aplica a TODAS las tipologias del proyecto.'],
    ['6. La columna "qtyPorTipPorModulo" es opcional y aplica solo cuando el consumo varia por'],
    ['   modulo de fabricacion (M00..M05). Formato: tipologia:modulo:qty, separados por ";".'],
    ['   Ejemplo: T01:M01:2;T01:M02:3;T02:M01:1'],
    [],
    ['HOJAS DEL ARCHIVO'],
    [],
    ['• Instrucciones — Este texto.'],
    ['• Tipologias — Lista de tipologias del proyecto con cantidad de pods.'],
    ['• BOM — Donde va el detalle de materiales. La hoja principal a llenar.'],
    ['• Catalogo — Lista de SKU activos en Bodega al momento de descargar. Es la fuente del'],
    ['   dropdown. NO la borres ni modifiques. Esta oculta por defecto.'],
    [],
    ['QUE PASA AL SUBIR'],
    [],
    ['Al subir el Excel a Control Documental, Materiales valida cada codigo contra Bodega.'],
    ['Si encuentra codigos faltantes o SKU inactivos, rechaza la carga con la lista de fallos.'],
    ['Cuando pasa la validacion, los campos Descripcion / Partida / Unidad / Costo se hidratan'],
    ['automaticamente desde el SKU — no necesitas tipearlos, basta con tener el codigo.'],
    ['Por eso esta plantilla tiene esas columnas en gris: son solo referencia visual.'],
  ];
  const wsInstrucciones = XLSX.utils.aoa_to_sheet(instrucciones);
  wsInstrucciones['!cols'] = [{ wch: 100 }];
  XLSX.utils.book_append_sheet(wb, wsInstrucciones, 'Instrucciones');

  // ── Hoja Tipologias ─────────────────────────────────────────────────────
  // Headers que el parser de materiales/parseBomFile reconoce: la hoja se
  // llama "Tipologias" (con o sin tilde). Columnas: Tipologia | Pods.
  const tipologiasRows = [
    ['Tipologia', 'Pods'],
    ['T01', 0],
    ['T02', 0],
    ['T03', 0],
  ];
  const wsTipologias = XLSX.utils.aoa_to_sheet(tipologiasRows);
  wsTipologias['!cols'] = [{ wch: 18 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsTipologias, 'Tipologias');

  // ── Hoja Catalogo (oculta, fuente del dropdown) ─────────────────────────
  const { rows: catRows, total: catTotal } = buildCatalogoRows(catalogo);
  const wsCatalogo = XLSX.utils.aoa_to_sheet(catRows);
  wsCatalogo['!cols'] = [
    { wch: 14 }, { wch: 50 }, { wch: 24 }, { wch: 10 }, { wch: 14 }, { wch: 10 },
  ];
  // Marca la hoja como oculta (Excel: hidden=1, muy-oculta=2). Para que el
  // dropdown referencie correctamente, debe estar simplemente oculta (hidden=1)
  // — los usuarios pueden mostrarla desde Excel si quieren verificar.
  XLSX.utils.book_append_sheet(wb, wsCatalogo, 'Catalogo');
  if (wb.Workbook && wb.Workbook.Sheets) {
    const idx = wb.SheetNames.indexOf('Catalogo');
    if (idx >= 0 && wb.Workbook.Sheets[idx]) wb.Workbook.Sheets[idx].Hidden = 1;
  } else {
    wb.Workbook = { Sheets: wb.SheetNames.map(n => ({ name: n, Hidden: n === 'Catalogo' ? 1 : 0 })) };
  }

  // ── Hoja BOM (la principal a llenar) ────────────────────────────────────
  const bomHeader = [
    'Codigo',                    // Validacion contra Catalogo!A
    'Descripcion (auto)',        // Hidratado al subir desde SKU
    'Partida (auto)',            // Hidratado al subir desde SKU
    'Unidad (auto)',             // Hidratado al subir desde SKU
    'Cant. por POD',             // Numerico — qty por pod
    'Tipologias',                // Texto separado por |
    'qtyPorTipPorModulo',        // Opcional, texto especial T01:M01:qty;...
    'Notas',                     // Texto libre, no se sube a Firestore
  ];
  // Filas de ejemplo (1 vacia para que el dropdown se vea, sin codigos
  // forzados — el usuario los elige). Reservamos 200 filas con validacion.
  const bomRows = [bomHeader];
  for (let i = 0; i < 200; i++) bomRows.push(['', '', '', '', '', '', '', '']);
  const wsBom = XLSX.utils.aoa_to_sheet(bomRows);
  wsBom['!cols'] = [
    { wch: 14 },  // Codigo
    { wch: 50 },  // Descripcion (auto)
    { wch: 22 },  // Partida (auto)
    { wch: 10 },  // Unidad (auto)
    { wch: 14 },  // Cant. por POD
    { wch: 22 },  // Tipologias
    { wch: 40 },  // qtyPorTipPorModulo
    { wch: 30 },  // Notas
  ];

  // Data validation en col A (Codigo), filas 2..201 (1-indexed Excel)
  if (catTotal > 0) {
    const lastRow = catTotal + 1; // header en fila 1
    const formula = `Catalogo!$A$2:$A$${lastRow}`;
    attachListValidation(wsBom, 'A2:A201', formula);
  }

  XLSX.utils.book_append_sheet(wb, wsBom, 'BOM');

  // Reordenar para que BOM quede primero al abrir el archivo
  const order = ['BOM', 'Tipologias', 'Instrucciones', 'Catalogo'];
  wb.SheetNames = order.filter(n => wb.SheetNames.includes(n));

  // Recalcular Workbook.Sheets (Hidden) acorde al nuevo orden
  wb.Workbook = {
    Sheets: wb.SheetNames.map(n => ({ name: n, Hidden: n === 'Catalogo' ? 1 : 0 })),
  };

  const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const fileName = `BOM_${safeProjectName(projectName)}_plantilla_${todayYMD()}.xlsx`;
  return { blob, fileName, catalogoCount: catTotal };
}

// Helper para disparar la descarga desde el navegador.
export function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
}
