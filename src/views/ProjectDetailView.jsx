import React from 'react';
import {
  CheckSquare, CheckCircle2, XCircle, UploadCloud, Eye, History,
  MessageSquare, FileText, PlayCircle, Loader, Edit2, CalendarDays,
  Send, Clock, AlertCircle, Trash2, Plus
} from 'lucide-react';
import { APPROVERS } from '../constants/approvers';
import StatusBadge from '../components/ui/StatusBadge';
import MayuLogo from '../components/ui/MayuLogo';

export default function ProjectDetailView({ ctx }) {
  const { projects } = ctx.data;
  const { currentUser, role } = ctx.active;
  const { setView, selectedProject, selectedDoc, setSelectedDoc } = ctx.nav;
  const { editingDeadline, setEditingDeadline, commentText, setCommentText, chatMessage, setChatMessage, uploadingDocs } = ctx.setters;
  const { handleSimulateAction, handleFileUpload, handleSaveDeadline, handleSendMessage, handleAddInstalacionDoc, handleActivateInstalacion } = ctx.fb;

  const p = projects.find(proj => proj.id === selectedProject.id) || selectedProject;

  return (
    <>
      <div className="max-w-5xl mx-auto animate-fade-in">
        <button onClick={() => setView('dashboard')} className="text-sm text-[#788A87] hover:text-slate-800 mb-4 flex items-center gap-1">
          &larr; Volver al Dashboard
        </button>

        <div className="bg-white rounded-xl border-t-4 border-t-[#DCA75D] border-x border-b border-slate-200 p-6 shadow-sm mb-6 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-1">{p.name}</h2>
            <p className="text-[#788A87] text-sm mb-4">{p.client} • {p.type}</p>

            <div className="flex gap-6 text-sm">
              <div><span className="text-slate-400 block text-xs">Resp. Comercial</span><span className="font-medium text-slate-700">{p.commercialLead}</span></div>
              <div><span className="text-slate-400 block text-xs">Resp. Técnico</span><span className="font-medium text-slate-700">{p.technicalLead}</span></div>
              <div><span className="text-slate-400 block text-xs">Resp. Operativo</span><span className="font-medium text-slate-700">{p.operationalLead}</span></div>
            </div>
          </div>
          <div className="text-right">
            <div className="mb-2"><StatusBadge status={p.status} /></div>
            <p className="text-xs text-slate-500 mt-2">Activado: {p.activationDate}</p>
            {p.status === 'Aprobado para ejecución' && (
              <button className="mt-3 bg-[#899264] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-[#788253] shadow-md animate-pulse">
                <PlayCircle size={18} /> Iniciar Ejecución Oficial
              </button>
            )}
          </div>
        </div>

        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><CheckSquare size={20} className="text-[#899264]"/> Checklist de Aprobación por Área</h3>

        {p.type?.toLowerCase() === 'momentum' && !p.areas?.instalacion &&
         ['Gerente General', 'Subgerente Comercial', 'Project Manager', 'Administrador del sistema'].includes(role) && (
          <div className="mb-6 bg-[#DCA75D]/10 border border-[#DCA75D]/30 rounded-lg p-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-800">Checklist de Instalación no activado</div>
              <div className="text-xs text-slate-600 mt-1">Proyecto Momentum sin área de Instalación. Si quieres incluirla (responsabilidad Jefe de Logística — Gabriel Roman), actívala aquí. Se sumarán Carta Gantt obra, Listado de subcontratos, Nómina de personas en obra y los contratos de obras civiles / terminaciones.</div>
            </div>
            <button
              onClick={() => handleActivateInstalacion(p.id)}
              className="bg-[#DCA75D] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#c49352] transition-colors shadow-sm flex items-center gap-2 whitespace-nowrap"
            >
              <Plus size={16}/> Activar
            </button>
          </div>
        )}

        <div className="flex flex-col gap-6">
          {Object.entries(p.areas || {}).map(([areaKey, area]) => (
            <div key={areaKey} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex justify-between items-center">
                <h4 className="font-semibold text-slate-800 uppercase text-sm tracking-wide">{area.name}</h4>
                <StatusBadge status={area.status} />
              </div>
              <div className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-white border-b border-slate-100 text-[#788A87] text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3 text-left font-medium">Entregable Obligatorio</th>
                      <th className="px-5 py-3 text-left font-medium">Versión</th>
                      <th className="px-5 py-3 text-left font-medium">Estado</th>
                      <th className="px-5 py-3 text-left font-medium">Fecha Límite</th>
                      <th className="px-5 py-3 text-right font-medium">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {area.docs.map(doc => {
                      const canUpload =
                        role === doc.uploaderRole ||
                        role === 'Administrador del sistema' ||
                        (areaKey === 'comercial' && (role === p.commercialLead || role === 'Project Manager' || role === 'Subgerente Comercial' || role === 'Gerente Comercial')) ||
                        (areaKey === 'ingenieria' && (role === p.technicalLead || role === 'Project Manager' || role === 'Subgerente Comercial')) ||
                        (areaKey === 'operaciones' && (role === p.operationalLead || role === 'Gerente de Operaciones' || role === 'Project Manager' || role === 'Subgerente Comercial')) ||
                        (areaKey === 'instalacion' && (role === 'Jefe de Logística' || role === 'Gerente de Operaciones' || role === 'Project Manager' || role === 'Subgerente Comercial'));

                      const isApprover = APPROVERS[areaKey.toUpperCase()]?.includes(role) || role === 'Administrador del sistema';
                      const needsMyApproval = doc.status === 'En revisión' && isApprover && doc.approvals[role] !== 'Aprobado' && doc.approvals[role] !== 'Aprobado con obs.';
                      const canEditDeadline = ['Gerente General', 'Subgerente Comercial', 'Project Manager', 'Administrador del sistema'].includes(role);

                      return (
                      <tr key={doc.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-4">
                          <div className="font-medium text-slate-800 flex items-center gap-2">
                            <FileText size={16} className="text-slate-400"/> {doc.name}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-[#788A87] font-mono text-xs">{doc.version}</td>
                        <td className="px-5 py-4">
                          <StatusBadge status={doc.status} />
                        </td>

                        <td className="px-5 py-4">
                          {editingDeadline?.docId === doc.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="date"
                                value={editingDeadline.value}
                                onChange={e => setEditingDeadline({...editingDeadline, value: e.target.value})}
                                className="text-xs p-1 border border-[#899264] rounded focus:outline-none"
                              />
                              <button onClick={() => handleSaveDeadline(p.id, areaKey, doc.id, editingDeadline.value)} className="text-green-600 hover:bg-green-50 p-1 rounded transition-colors"><CheckCircle2 size={16}/></button>
                              <button onClick={() => setEditingDeadline(null)} className="text-red-600 hover:bg-red-50 p-1 rounded transition-colors"><XCircle size={16}/></button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {doc.deadline ? (
                                <>
                                  <span className="text-sm text-slate-700 font-medium">{doc.deadline.split('-').reverse().join('-')}</span>
                                  {doc.deadlineVersion > 1 && (
                                    <span className="text-[10px] bg-[#DCA75D]/20 text-[#DCA75D] font-bold px-1.5 py-0.5 rounded">V{doc.deadlineVersion}</span>
                                  )}
                                </>
                              ) : (
                                <span className="text-xs text-slate-400 italic">Sin definir</span>
                              )}

                              {canEditDeadline && (
                                <button
                                  onClick={() => setEditingDeadline({docId: doc.id, value: doc.deadline || ''})}
                                  className="text-slate-300 hover:text-[#899264] p-1 transition-colors"
                                  title="Editar fecha límite"
                                >
                                  <Edit2 size={14} />
                                </button>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {canUpload && doc.status !== 'Aprobado' && doc.status !== 'Aprobado con observaciones' && (
                              <div className="relative">
                                {!doc.fileUrl ? (
                                  <>
                                    <input
                                      type="file"
                                      id={`file-${doc.id}`}
                                      className="hidden"
                                      onChange={(e) => {
                                        if (e.target.files[0]) {
                                          handleFileUpload(p.id, areaKey, doc.id, e.target.files[0]);
                                        }
                                        e.target.value = null;
                                      }}
                                    />
                                    <button
                                      onClick={() => document.getElementById(`file-${doc.id}`).click()}
                                      disabled={uploadingDocs[doc.id]}
                                      className={`p-1.5 text-[#899264] bg-[#899264]/10 rounded hover:bg-[#899264]/20 transition-colors ${uploadingDocs[doc.id] ? 'opacity-50 cursor-wait' : ''}`}
                                      title="Subir archivo y generar nueva versión"
                                    >
                                      {uploadingDocs[doc.id] ? <Loader className="animate-spin" size={18} /> : <UploadCloud size={18} />}
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    disabled
                                    className="p-1.5 text-slate-400 bg-slate-100 rounded cursor-not-allowed"
                                    title="Debes eliminar el archivo actual en 'Ver Detalle' para poder subir la siguiente versión"
                                  >
                                    <UploadCloud size={18} />
                                  </button>
                                )}
                              </div>
                            )}

                            {(doc.status !== 'Pendiente') && (
                              <button
                                onClick={() => setSelectedDoc({projectId: p.id, areaKey, doc})}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md border flex items-center gap-1 transition-colors
                                  ${needsMyApproval
                                    ? 'bg-[#899264] text-white border-[#899264] hover:bg-[#788253] shadow-sm animate-pulse-soft'
                                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                              >
                                {needsMyApproval ? <CheckCircle2 size={14}/> : <Eye size={14}/>}
                                {needsMyApproval ? 'Revisar' : 'Ver Detalle'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {areaKey === 'instalacion' && ['Gerente General', 'Subgerente Comercial', 'Project Manager', 'Jefe de Logística', 'Administrador del sistema'].includes(role) && (
                <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-2">
                  <button
                    onClick={() => handleAddInstalacionDoc(p.id, 'n4', 'Contrato de obras civiles')}
                    className="text-xs text-[#788A87] hover:text-[#899264] flex items-center gap-1 px-3 py-1.5 rounded-md bg-white border border-slate-300 hover:border-[#899264] transition-colors"
                  >
                    <Plus size={14}/> Agregar contrato de obras civiles
                  </button>
                  <button
                    onClick={() => handleAddInstalacionDoc(p.id, 'n5', 'Contrato de terminaciones')}
                    className="text-xs text-[#788A87] hover:text-[#899264] flex items-center gap-1 px-3 py-1.5 rounded-md bg-white border border-slate-300 hover:border-[#899264] transition-colors"
                  >
                    <Plus size={14}/> Agregar contrato de terminaciones
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* MODAL: DOCUMENT REVIEW & AUDIT (inline) */}
      {selectedDoc && (() => {
        const canApproveWithObs = ['Gerente General', 'Gerente Comercial', 'Subgerente Comercial', 'Project Manager'].includes(role);

        return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-slide-up">

            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <span className="text-xs font-bold text-[#899264] uppercase tracking-wider">{selectedDoc.areaKey}</span>
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  {selectedDoc.doc.name} <span className="text-sm font-mono bg-slate-200 text-slate-600 px-2 py-0.5 rounded">{selectedDoc.doc.version}</span>
                </h3>
              </div>
              <button onClick={() => { setSelectedDoc(null); setChatMessage(''); }} className="text-slate-400 hover:text-slate-700 bg-slate-200/50 hover:bg-slate-200 p-2 rounded-full transition-colors">
                <XCircle size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 flex flex-col md:flex-row gap-8">

              <div className="flex-1">
                <div className="mb-6 flex gap-4">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-500 mb-2">Estado Actual</h4>
                    <StatusBadge status={selectedDoc.doc.status} />
                  </div>
                  {selectedDoc.doc.deadline && (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-500 mb-2">Fecha Límite</h4>
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-red-50 text-red-600 border-red-200 flex items-center gap-1 w-max">
                        <CalendarDays size={14}/> {selectedDoc.doc.deadline.split('-').reverse().join('-')}
                        {selectedDoc.doc.deadlineVersion > 1 && ` (V${selectedDoc.doc.deadlineVersion})`}
                      </span>
                    </div>
                  )}
                </div>

                <div className="w-full bg-slate-100 rounded-lg border border-slate-200 p-6 flex flex-col items-center justify-center text-slate-400 mb-6 relative overflow-hidden">
                  <MayuLogo className="absolute opacity-5 h-48 w-auto pointer-events-none" />

                  <FileText size={48} className={`mb-3 relative z-10 ${selectedDoc.doc.fileUrl ? 'text-[#899264]' : 'opacity-50'}`} />

                  {selectedDoc.doc.fileUrl ? (
                    <>
                      <p className="text-sm font-medium relative z-10 text-center truncate w-full text-slate-600 mb-2" title={selectedDoc.doc.originalFileName}>
                        {selectedDoc.doc.originalFileName}
                      </p>
                      <div className="flex gap-2 relative z-10">
                        <a
                          href={selectedDoc.doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-white border-2 border-[#899264] text-[#899264] px-4 py-1.5 rounded-full text-xs font-bold hover:bg-[#899264] hover:text-white transition-colors shadow-sm"
                        >
                          Descargar Archivo
                        </a>
                        {['Gerente General', 'Subgerente Comercial', 'Project Manager', 'Administrador del sistema'].includes(role) && selectedDoc.doc.status !== 'Aprobado' && selectedDoc.doc.status !== 'Aprobado con observaciones' && (
                          <button
                            onClick={() => {
                              handleSimulateAction(selectedDoc.projectId, selectedDoc.areaKey, selectedDoc.doc.id, 'DELETE_FILE');
                              setSelectedDoc(null);
                            }}
                            className="bg-white border-2 border-red-500 text-red-500 px-4 py-1.5 rounded-full text-xs font-bold hover:bg-red-500 hover:text-white transition-colors shadow-sm flex items-center justify-center gap-1"
                            title="Borrar archivo de la nube para subir nueva versión"
                          >
                            <Trash2 size={16} /> Eliminar para subir nueva versión
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm font-medium relative z-10">Archivo no disponible</p>
                  )}
                </div>

                <div className="mb-8">
                  <h4 className="text-sm font-semibold text-slate-500 mb-3 border-b pb-2">Estado de Firmas Obligatorias</h4>
                  <ul className="space-y-2">
                    {APPROVERS[selectedDoc.areaKey.toUpperCase()]?.map(appr => {
                      const st = selectedDoc.doc.approvals[appr];
                      return (
                        <li key={appr} className="flex justify-between items-center text-sm p-2 rounded bg-slate-50 border border-slate-100">
                          <span className={appr === role ? 'font-bold text-[#899264]' : 'text-[#788A87]'}>{appr}</span>
                          {st === 'Aprobado' ? <span className="text-green-600 flex items-center gap-1 text-xs font-bold"><CheckCircle2 size={14}/> Aprobado</span> :
                           st === 'Aprobado con obs.' ? <span className="text-emerald-600 flex items-center gap-1 text-xs font-bold"><CheckCircle2 size={14}/> Aprobado con obs.</span> :
                           st === 'Rechazado' ? <span className="text-red-600 flex items-center gap-1 text-xs font-bold"><XCircle size={14}/> Rechazado</span> :
                           st === 'Observado' ? <span className="text-orange-600 flex items-center gap-1 text-xs font-bold"><AlertCircle size={14}/> Observado</span> :
                           <span className="text-slate-400 text-xs flex items-center gap-1"><Clock size={14}/> Pendiente</span>}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {(role === selectedDoc.doc.uploaderRole || role === 'Administrador del sistema') &&
                 selectedDoc.doc.status === 'Observado' && (
                  <div className="bg-[#DCA75D]/10 p-4 rounded-xl border border-[#DCA75D]/30 mb-4">
                    <h4 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                      <MessageSquare size={16} className="text-[#DCA75D]"/> Responder observación
                    </h4>
                    <p className="text-xs text-slate-600 mb-3">
                      Si la observación se resolvió sin necesidad de subir un archivo nuevo, escribe tu respuesta y márcala como subsanada. Los aprobadores que observaron volverán a recibir el doc para que decidan.
                    </p>
                    <textarea
                      className="w-full text-sm p-3 border border-slate-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-[#DCA75D]"
                      rows="3"
                      placeholder="Explica cómo se resolvió la observación..."
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                    ></textarea>
                    <button
                      onClick={() => handleSimulateAction(selectedDoc.projectId, selectedDoc.areaKey, selectedDoc.doc.id, 'RESPOND_OBSERVATION', commentText)}
                      disabled={!commentText.trim()}
                      className={`w-full bg-[#DCA75D] text-white py-2 rounded-lg text-sm font-medium flex justify-center items-center gap-2 ${!commentText.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#c49352]'}`}
                      title={!commentText.trim() ? 'Requiere respuesta' : ''}
                    >
                      <CheckCircle2 size={18} /> Marcar como subsanada
                    </button>
                  </div>
                )}

                {APPROVERS[selectedDoc.areaKey.toUpperCase()]?.includes(role) &&
                 ['En revisión', 'Observado'].includes(selectedDoc.doc.status) && (
                  <div className="bg-[#899264]/10 p-4 rounded-xl border border-[#899264]/20">
                    <h4 className="text-sm font-bold text-[#454a32] mb-3 flex items-center gap-2"><CheckSquare size={16}/> Tu Decisión ({currentUser.name})</h4>
                    <textarea
                      className="w-full text-sm p-3 border border-slate-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-[#899264]"
                      rows="3"
                      placeholder="Agrega comentarios u observaciones (Obligatorio si rechazas, observas o apruebas con observaciones)..."
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                    ></textarea>

                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <button onClick={() => handleSimulateAction(selectedDoc.projectId, selectedDoc.areaKey, selectedDoc.doc.id, 'APPROVE')} className="w-full bg-[#899264] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#788253] flex justify-center items-center gap-2">
                        <CheckCircle2 size={18} /> Aprobar
                      </button>
                      {canApproveWithObs && (
                        <button
                          onClick={() => handleSimulateAction(selectedDoc.projectId, selectedDoc.areaKey, selectedDoc.doc.id, 'APPROVE_WITH_OBS', commentText)}
                          disabled={!commentText.trim()}
                          className={`w-full bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium flex justify-center items-center gap-2 ${!commentText.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:bg-emerald-700'}`}
                          title={!commentText.trim() ? 'Requiere comentario para aprobar con observaciones' : ''}
                        >
                          <CheckCircle2 size={18} /> Aprobar con Obs.
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => handleSimulateAction(selectedDoc.projectId, selectedDoc.areaKey, selectedDoc.doc.id, 'OBSERVE', commentText)} className="w-full bg-[#DCA75D] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#c49352] flex justify-center items-center gap-2">
                        <MessageSquare size={18} /> Observar
                      </button>
                      <button onClick={() => handleSimulateAction(selectedDoc.projectId, selectedDoc.areaKey, selectedDoc.doc.id, 'REJECT', commentText)} className="w-full bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 flex justify-center items-center gap-2">
                        <XCircle size={18} /> Rechazar
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-8 border-t border-slate-200 pt-6">
                  <h4 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <MessageSquare size={18} className="text-[#899264]" /> Muro de Conversación
                  </h4>
                  <div className="bg-[#F8F9F7] rounded-xl p-4 border border-slate-200 flex flex-col h-72">
                    <div className="flex-1 overflow-y-auto flex flex-col gap-3 mb-4 pr-2 custom-scrollbar">
                      {(selectedDoc.doc.messages || []).length === 0 ? (
                        <p className="text-xs text-slate-400 italic text-center my-auto">No hay mensajes. ¡Escribe el primero para iniciar la conversación!</p>
                      ) : (
                        (selectedDoc.doc.messages || []).map(msg => (
                          <div key={msg.id} className={`flex flex-col max-w-[85%] ${msg.user === currentUser.name ? 'self-end items-end' : 'self-start items-start'}`}>
                            <div className={`px-3 py-2 rounded-lg text-sm shadow-sm ${msg.user === currentUser.name ? 'bg-[#899264] text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'}`}>
                              {msg.text}
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1">{msg.user} • {new Date(msg.timestamp).toLocaleString('es-CL', {dateStyle: 'short', timeStyle: 'short'})}</span>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 text-sm p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#899264]"
                        placeholder="Escribe un mensaje para el equipo..."
                        value={chatMessage}
                        onChange={e => setChatMessage(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!chatMessage.trim()}
                        className="bg-[#899264] text-white px-4 py-2 rounded-lg hover:bg-[#788253] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-sm"
                      >
                        <Send size={18} />
                      </button>
                    </div>
                  </div>
                </div>

              </div>

              <div className="w-full md:w-64 border-l border-slate-200 pl-6">
                <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <History size={18} className="text-slate-400" /> Trazabilidad
                </h4>
                <div className="relative border-l-2 border-slate-200 ml-3 space-y-6">
                  {selectedDoc.doc.history.map((hist, i) => (
                    <div key={i} className="relative pl-5">
                      <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white ${hist.action.includes('Cargó') ? 'bg-[#788A87]' : hist.action.includes('Aprobó') ? 'bg-[#899264]' : hist.action.includes('Rechazó') ? 'bg-red-500' : hist.action.includes('fecha') ? 'bg-blue-400' : 'bg-[#DCA75D]'}`}></div>
                      <p className="text-[10px] text-slate-400 font-mono mb-0.5">{hist.date}</p>
                      <p className="text-xs font-semibold text-slate-700">{hist.user}</p>
                      <p className="text-xs text-[#788A87] mt-1">{hist.action}</p>
                    </div>
                  ))}
                  {selectedDoc.doc.history.length === 0 && (
                    <p className="text-xs text-slate-400 italic pl-4">No hay historial registrado aún.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        );
      })()}
    </>
  );
}
