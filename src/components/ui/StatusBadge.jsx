import React from 'react';

const StatusBadge = ({ status }) => {
  const styles = {
    'Aprobado': 'bg-green-100 text-green-800 border-green-200',
    'Aprobada': 'bg-green-100 text-green-800 border-green-200',
    'Aprobado con observaciones': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'Aprobado para ejecución': 'bg-[#899264] text-white shadow-sm',
    'Pendiente': 'bg-gray-100 text-gray-600 border-gray-200',
    'No iniciada': 'bg-gray-100 text-gray-600 border-gray-200',
    'En revisión': 'bg-[#788A87]/20 text-[#788A87] border-[#788A87]/30',
    'En proceso': 'bg-[#788A87]/20 text-[#788A87] border-[#788A87]/30',
    'En preparación para ejecución': 'bg-[#788A87] text-white shadow-sm',
    'Observado': 'bg-[#DCA75D]/20 text-[#b5833e] border-[#DCA75D]/40',
    'Con observaciones': 'bg-[#DCA75D]/20 text-[#b5833e] border-[#DCA75D]/40',
    'Rechazado': 'bg-red-100 text-red-800 border-red-200',
    'Bloqueado para inicio': 'bg-red-600 text-white shadow-sm'
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
};

export default StatusBadge;
