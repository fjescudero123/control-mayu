// Paleta MAYU — espejo de cada app (C.* en colors.js). El componente vive
// dentro del bundle de cada app, asi que tecnicamente podriamos importar
// la paleta de la app. La replicamos aqui para que el package sea autocontenido
// y no requiera que cada app exponga su paleta como prop.
export const C = {
  bg: '#0a0e14',
  bgCard: '#11161e',
  tx: '#e6edf3',
  txM: '#9ba3ae',
  txD: '#6e7681',
  bdr: '#1f2a37',
  acc: '#fbb13c',     // naranjo MAYU
  cyn: '#5bc0eb',
  grn: '#7bc950',
  red: '#ff5c5c',
  org: '#fb8500',
};
