import React from 'react';
import { CheckSquare, CheckCircle2, FileText, Clock, CalendarDays } from 'lucide-react';
import { APPROVERS } from '../constants/approvers';

export default function ApprovalsView({ ctx }) {
  const { projects, kpis } = ctx.data;
  const { currentUser, role } = ctx.active;
  const { setSelectedProject, setSelectedDoc } = ctx.nav;

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-slate-800">
        <CheckSquare className="text-[#DCA75D]"/> Bandeja de Aprobaciones
      </h2>
      <p className="text-[#788A87] mb-6">Hola <strong>{currentUser.name}</strong>, estos son los documentos que requieren tu revisión para permitir el inicio de los proyectos.</p>

      <div className="flex flex-col gap-4">
        {projects.flatMap(p =>
          Object.entries(p.areas || {}).flatMap(([areaKey, area]) =>
            area.docs
              .filter(d => d.status === 'En revisión' && APPROVERS[areaKey.toUpperCase()]?.includes(role) && d.approvals[role] !== 'Aprobado' && d.approvals[role] !== 'Aprobado con obs.')
              .map(doc => (
                <div key={`${p.id}-${doc.id}`} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between hover:border-[#DCA75D] transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="bg-[#DCA75D]/10 p-3 rounded-lg text-[#DCA75D] mt-1">
                      <FileText size={24} />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[#899264] mb-1 uppercase tracking-wide">{p.name} • {area.name}</div>
                      <h4 className="text-lg font-bold text-slate-800">{doc.name}</h4>
                      <p className="text-sm text-[#788A87] mt-1 flex items-center gap-1">
                        <Clock size={14}/> Asignado a: {doc.uploaderRole} • Versión {doc.version}
                        {doc.deadline && <span className="ml-2 bg-red-100 text-red-600 px-1.5 rounded text-xs flex items-center gap-1"><CalendarDays size={12}/> {doc.deadline.split('-').reverse().join('-')}</span>}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setSelectedProject(p); setSelectedDoc({projectId: p.id, areaKey, doc}) }}
                    className="bg-slate-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 shadow-sm"
                  >
                    Revisar Documento
                  </button>
                </div>
              ))
          )
        )}
        {kpis.myPendingApprovals === 0 && (
          <div className="text-center py-16 bg-white rounded-xl border border-slate-200 border-dashed">
            <CheckCircle2 size={48} className="mx-auto text-slate-300 mb-3" />
            <h3 className="text-lg font-medium text-slate-500">Todo al día</h3>
            <p className="text-sm text-slate-400">No tienes documentos pendientes de revisión.</p>
          </div>
        )}
      </div>
    </div>
  );
}
