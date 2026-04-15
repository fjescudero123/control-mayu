import React from 'react';
import {
  Plus, CheckCircle2, ChevronRight, Trash2, AlertCircle,
  Eye, BarChart3, XCircle, User, CalendarDays
} from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';

export default function DashboardProjectsView({ ctx }) {
  const { projects, kpis, areaStats } = ctx.data;
  const { role } = ctx.active;
  const { view, setView, setSelectedProject } = ctx.nav;
  const { showOverdueModal, setShowOverdueModal, setShowNewProjectModal, setProjectToDelete } = ctx.setters;

  const isDashboard = view === 'dashboard';

  return (
    <>
      <div className="max-w-5xl mx-auto animate-fade-in">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800">{isDashboard ? 'Resumen General' : 'Directorio de Proyectos'}</h2>
          {['Administrador del sistema', 'Gerente Comercial', 'Subgerente Comercial', 'Project Manager'].includes(role) && (
            <div className="flex gap-3 items-center">
              <button onClick={() => setShowNewProjectModal(true)} className="bg-[#899264] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#788253] transition-colors shadow-sm flex items-center gap-2">
                <Plus size={18} /> {isDashboard ? 'Activar Nuevo Proyecto' : 'Nuevo Proyecto'}
              </button>
            </div>
          )}
        </div>

        {/* KPIs + Rendimiento por Área — solo dashboard */}
        {isDashboard && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-slate-500 text-sm font-medium mb-1">Avance Global Checklist</p>
                <div className="flex items-end gap-2">
                  <h3 className="text-3xl font-bold text-[#899264]">{kpis.progress}%</h3>
                </div>
                <div className="w-full bg-slate-100 h-2 mt-3 rounded-full overflow-hidden">
                  <div className="bg-[#899264] h-full" style={{width: `${kpis.progress}%`}}></div>
                </div>
              </div>
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-slate-500 text-sm font-medium mb-1">Proyectos Activos</p>
                <h3 className="text-3xl font-bold text-slate-800">{projects.length}</h3>
              </div>
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-slate-500 text-sm font-medium mb-1">Mis Tareas Pendientes</p>
                <div className="flex items-center gap-2">
                  <h3 className="text-3xl font-bold text-[#DCA75D]">{kpis.myPendingApprovals}</h3>
                  {kpis.myPendingApprovals > 0 && <AlertCircle size={20} className="text-[#DCA75D]" />}
                </div>
              </div>
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-slate-500 text-sm font-medium mb-1">Observaciones Activas</p>
                <h3 className="text-3xl font-bold text-orange-500">{kpis.observations}</h3>
              </div>
            </div>

            <h3 className="text-lg font-bold mb-4 text-slate-800 flex items-center gap-2">
              <BarChart3 size={20} className="text-[#DCA75D]"/> Rendimiento y Tiempos por Área
            </h3>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mb-8">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-[#788A87]">
                  <tr>
                    <th className="p-4 font-medium">Área</th>
                    <th className="p-4 font-medium text-center">Tpo. Promedio 1ra Carga</th>
                    <th className="p-4 font-medium text-center">Repactaciones (Fechas Lím.)</th>
                    <th className="p-4 font-medium text-center">Nuevas Versiones Subidas</th>
                    <th className="p-4 font-medium text-center">Docs. Atrasados</th>
                  </tr>
                </thead>
                <tbody>
                  {areaStats.map((stat, idx) => (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-semibold text-slate-700">{stat.name}</td>
                      <td className="p-4 text-center">
                        {stat.uploadTimes.length > 0 ? (
                          <span className="text-[#899264] font-bold bg-[#899264]/10 px-2.5 py-1 rounded-full">{stat.avgUpload} días</span>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Sin datos</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`font-medium ${stat.deadlineChanges > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
                          {stat.deadlineChanges}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`font-medium ${stat.versions > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                          {stat.versions}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {stat.overdueDocs > 0 ? (
                          <button
                            onClick={() => setShowOverdueModal({ areaName: stat.name, docs: stat.overdueDocsList })}
                            className="font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-full transition-colors flex items-center justify-center gap-1 mx-auto shadow-sm border border-red-200"
                            title="Ver detalle de documentos atrasados"
                          >
                            {stat.overdueDocs} <Eye size={14} />
                          </button>
                        ) : (
                          <span className="font-medium text-slate-400">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Tabla de proyectos — siempre visible (dashboard y projects) */}
        {isDashboard && <h3 className="text-lg font-bold mb-4 text-slate-800">Proyectos en Preparación</h3>}

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-[#788A87]">
              <tr>
                <th className="p-4 font-medium">ID / Proyecto</th>
                <th className="p-4 font-medium">Cliente</th>
                <th className="p-4 font-medium">Estado General</th>
                <th className="p-4 font-medium">Progreso Checklist</th>
                <th className="p-4 font-medium text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(p => {
                let tDocs = 0, aDocs = 0;
                const approverNames = new Set();

                Object.values(p.areas || {}).forEach(a => {
                  a.docs.forEach(d => {
                    tDocs++;
                    if(d.status === 'Aprobado' || d.status === 'Aprobado con observaciones') aDocs++;
                    d.history.forEach(h => {
                      if (h.action.includes('Aprobó')) approverNames.add(h.user);
                    });
                  });
                });
                const pct = tDocs===0 ? 0 : Math.round((aDocs/tDocs)*100);
                const approversArr = Array.from(approverNames).slice(0, 4);
                const extraApprovers = approverNames.size - approversArr.length;

                return (
                  <tr key={p.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${p.status === 'Aprobado para ejecución' ? 'bg-green-50/30' : ''}`}>
                    <td className="p-4">
                      <div className="font-semibold text-slate-800">{p.name}</div>
                      <div className="text-xs text-slate-500">{p.id}</div>
                    </td>
                    <td className="p-4 text-slate-600">{p.client}</td>
                    <td className="p-4">
                      <StatusBadge status={p.status} />
                      {p.status === 'Aprobado para ejecución' && (
                        <div className="mt-2 text-xs font-bold text-[#899264] flex items-center gap-1">
                          <CheckCircle2 size={14} /> ¡Proyecto 100% Aprobado!
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-medium w-8">{pct}%</span>
                        <div className="w-24 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div className={`h-full ${pct === 100 ? 'bg-[#899264]' : 'bg-[#DCA75D]'}`} style={{width: `${pct}%`}}></div>
                        </div>
                      </div>
                      {approverNames.size > 0 && (
                        <div className="flex items-center mt-1 -space-x-1.5" title={`Aprobado por: ${Array.from(approverNames).join(', ')}`}>
                          {approversArr.map((name, i) => (
                            <div key={i} className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-sm">
                              {name.charAt(0)}
                            </div>
                          ))}
                          {extraApprovers > 0 && (
                            <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-sm">
                              +{extraApprovers}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2 w-full">
                        {['Administrador del sistema', 'Gerente General', 'Subgerente Comercial'].includes(role) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setProjectToDelete(p); }}
                            className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors"
                            title="Eliminar proyecto"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => { setSelectedProject(p); setView('project_detail'); }}
                          className="text-[#899264] hover:text-[#788253] font-medium text-sm flex items-center gap-1 bg-white border border-[#899264] px-3 py-1.5 rounded-md"
                        >
                          Ver Ficha <ChevronRight size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {projects.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-500">No hay proyectos activos en este momento.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: DOCUMENT OVERDUE DETAILS (inline) */}
      {showOverdueModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-slide-up border-t-4 border-t-red-500">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <AlertCircle className="text-red-500"/> Detalle de Atrasos: {showOverdueModal.areaName}
              </h3>
              <button onClick={() => setShowOverdueModal(null)} className="text-slate-400 hover:text-slate-700 bg-slate-200/50 hover:bg-slate-200 p-2 rounded-full transition-colors">
                <XCircle size={24} />
              </button>
            </div>

            <div className="p-0 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white border-b border-slate-100 text-[#788A87] text-xs uppercase tracking-wider sticky top-0">
                  <tr>
                    <th className="px-5 py-3 font-medium">Proyecto</th>
                    <th className="px-5 py-3 font-medium">Documento</th>
                    <th className="px-5 py-3 font-medium">Responsable de Carga</th>
                    <th className="px-5 py-3 font-medium">Fecha Límite</th>
                    <th className="px-5 py-3 font-medium">Estado Actual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {showOverdueModal.docs.map((doc, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 font-semibold text-slate-800">{doc.projectName}</td>
                      <td className="px-5 py-4 text-slate-600">
                        {doc.docName} <span className="text-xs bg-slate-200 px-1.5 py-0.5 rounded ml-1 font-mono text-slate-500">{doc.version}</span>
                      </td>
                      <td className="px-5 py-4 text-slate-600 flex items-center gap-1 mt-1">
                        <User size={14} className="text-slate-400"/> {doc.uploaderRole}
                      </td>
                      <td className="px-5 py-4 font-medium text-red-600 flex items-center gap-1">
                        <CalendarDays size={14}/> {doc.deadline.split('-').reverse().join('-')}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={doc.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button onClick={() => setShowOverdueModal(null)} className="bg-slate-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm">
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
