import React from 'react';
import { CalendarDays } from 'lucide-react';

export default function GanttView({ ctx }) {
  const { ganttData } = ctx.data;
  const { setView, setSelectedProject } = ctx.nav;

  return (
    <div className="max-w-6xl mx-auto animate-fade-in flex flex-col h-full min-h-[calc(100vh-120px)]">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Carta Gantt de Proyectos</h2>
          <p className="text-sm text-slate-500">Tiempos calculados automáticamente según las fechas límite del checklist.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-1">
        {!ganttData ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 p-16 text-center my-auto">
            <CalendarDays size={64} className="mb-4 opacity-20" />
            <p className="font-bold text-xl text-slate-600 mb-2">No hay suficientes datos</p>
            <p className="text-sm max-w-md">Para generar la Carta Gantt visual, debes asignar "Fechas Límite" a los documentos de los proyectos.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto bg-white custom-scrollbar pb-8">
            <div className="min-w-max">
              <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-30">
                <div className="w-72 shrink-0 border-r border-slate-200 p-4 font-bold text-slate-700 bg-slate-50 sticky left-0 z-40 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Proyecto y Cliente</div>
                <div className="relative flex" style={{ width: ganttData.months.length * 150 }}>
                  {ganttData.months.map((m) => (
                    <div key={m.getTime()} style={{ width: 150 }} className="border-r border-slate-200 p-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {m.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex pointer-events-none z-0 ml-72" style={{ width: ganttData.months.length * 150 }}>
                  {ganttData.months.map((m) => (<div key={m.getTime()} style={{ width: 150 }} className="border-r border-slate-100 h-full" />))}
                </div>

                {ganttData.projectTimelines.map((project) => {
                  const leftPx = ((project.startMs - ganttData.startTimeline.getTime()) / ganttData.totalMs) * (ganttData.months.length * 150);
                  let widthPx = ((project.endMs - project.startMs) / ganttData.totalMs) * (ganttData.months.length * 150);
                  if (widthPx < 28) widthPx = 28;

                  return (
                    <div key={project.id} className="flex border-b border-slate-100 hover:bg-slate-50 group relative z-10 transition-colors h-16">
                      <div className="w-72 shrink-0 border-r border-slate-200 px-4 py-2 bg-white group-hover:bg-slate-50 sticky left-0 z-20 flex flex-col justify-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.02)] transition-colors">
                        <span className="font-bold text-sm text-slate-800 truncate cursor-pointer hover:text-[#929965]" onClick={() => { setSelectedProject(project); setView('project_detail'); }}>{project.name}</span>
                        <span className="text-xs text-slate-400 truncate mt-0.5">{project.client}</span>
                      </div>
                      <div className="relative" style={{ width: ganttData.months.length * 150 }}>
                        <div
                          className={`absolute h-8 rounded-lg shadow-sm flex items-center px-3 text-xs font-medium text-white overflow-hidden cursor-pointer transition-transform hover:scale-[1.01] hover:brightness-110 ${project.status === 'Aprobado para ejecución' ? 'bg-[#899264]' : 'bg-[#DCA75D]'}`}
                          style={{ left: leftPx, width: widthPx, top: '50%', transform: 'translateY(-50%)' }}
                          onClick={() => { setSelectedProject(project); setView('project_detail'); }}
                          title={`Proyecto: ${project.name}\nInicio Checklist: ${new Date(project.startMs).toLocaleDateString('es-CL')}\nFin Checklist: ${new Date(project.endMs).toLocaleDateString('es-CL')}`}
                        >
                          <span className="truncate w-full text-center drop-shadow-sm font-semibold">{project.status}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
