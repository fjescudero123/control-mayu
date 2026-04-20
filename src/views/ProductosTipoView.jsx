import React from 'react';
import {
  Package, FileText, UploadCloud, Eye, Loader, Trash2,
  XCircle, History, MessageSquare, Send,
} from 'lucide-react';
import { PT_EDIT_ROLES } from '../constants/productosTipo';
import MayuLogo from '../components/ui/MayuLogo';

export default function ProductosTipoView({ ctx }) {
  const { productosTipo } = ctx.data;
  const { currentUser, role } = ctx.active;
  const { selectedProductoTipo, setSelectedProductoTipo, selectedPTDoc, setSelectedPTDoc } = ctx.nav;
  const { ptChatMessage, setPtChatMessage, uploadingDocs } = ctx.setters;
  const { handlePTFileUpload, handlePTDeleteFile, handlePTSendMessage } = ctx.fb;

  const canEdit = PT_EDIT_ROLES.includes(role);

  // ─── LIST VIEW ─────────────────────────────────────────────────────────────
  if (!selectedProductoTipo) {
    return (
      <div className="max-w-5xl mx-auto animate-fade-in">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-1 flex items-center gap-2">
            <Package className="text-[#DCA75D]" size={24} /> Productos Tipo
          </h2>
          <p className="text-sm text-[#788A87]">
            Biblioteca de productos recurrentes. Documentos reutilizables (planos, BOM, lista de precios) que se actualizan cuando sale una versión mejorada del producto.
          </p>
        </div>

        {productosTipo.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-sm">
            Cargando productos tipo…
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {productosTipo.map(pt => {
              const totalDocs = Object.values(pt.areas || {}).reduce((acc, a) => acc + a.docs.length, 0);
              const loadedDocs = Object.values(pt.areas || {}).reduce(
                (acc, a) => acc + a.docs.filter(d => d.fileUrl).length, 0
              );
              return (
                <button
                  key={pt.id}
                  onClick={() => setSelectedProductoTipo(pt)}
                  className="bg-white border-t-4 border-t-[#DCA75D] border-x border-b border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow text-left"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-slate-900 text-lg">{pt.name}</h3>
                    <span className="text-[10px] font-mono text-slate-400">{pt.id}</span>
                  </div>
                  <p className="text-sm text-[#788A87] mb-4">{pt.description}</p>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-slate-600">
                      <span className="font-bold text-[#899264]">{loadedDocs}</span>
                      <span className="text-slate-400"> / {totalDocs} documentos cargados</span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── DETAIL VIEW ───────────────────────────────────────────────────────────
  const pt = productosTipo.find(p => p.id === selectedProductoTipo.id) || selectedProductoTipo;

  return (
    <>
      <div className="max-w-5xl mx-auto animate-fade-in">
        <button
          onClick={() => setSelectedProductoTipo(null)}
          className="text-sm text-[#788A87] hover:text-slate-800 mb-4 flex items-center gap-1"
        >
          &larr; Volver a Productos Tipo
        </button>

        <div className="bg-white rounded-xl border-t-4 border-t-[#DCA75D] border-x border-b border-slate-200 p-6 shadow-sm mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-1 flex items-center gap-2">
            <Package className="text-[#DCA75D]" size={22} /> {pt.name}
          </h2>
          <p className="text-[#788A87] text-sm">{pt.description}</p>
          {!canEdit && (
            <p className="text-xs text-slate-400 mt-3 italic">Modo consulta — tu rol no puede subir ni modificar archivos.</p>
          )}
        </div>

        <div className="flex flex-col gap-6">
          {['comercial', 'ingenieria']
            .filter(k => pt.areas?.[k])
            .map(areaKey => [areaKey, pt.areas[areaKey]])
            .map(([areaKey, area]) => (
            <div key={areaKey} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-slate-50 px-5 py-4 border-b border-slate-200">
                <h4 className="font-semibold text-slate-800 uppercase text-sm tracking-wide">{area.name}</h4>
              </div>
              <div className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-white border-b border-slate-100 text-[#788A87] text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3 text-left font-medium">Documento</th>
                      <th className="px-5 py-3 text-left font-medium">Versión</th>
                      <th className="px-5 py-3 text-left font-medium">Archivo</th>
                      <th className="px-5 py-3 text-right font-medium">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {area.docs.map(doc => (
                      <tr key={doc.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-4">
                          <div className="font-medium text-slate-800 flex items-center gap-2">
                            <FileText size={16} className="text-slate-400" /> {doc.name}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-[#788A87] font-mono text-xs">{doc.version}</td>
                        <td className="px-5 py-4 text-xs text-slate-500 truncate max-w-xs">
                          {doc.originalFileName || <span className="italic text-slate-400">—</span>}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {canEdit && (
                              <div className="relative">
                                <input
                                  type="file"
                                  id={`pt-file-${pt.id}-${doc.id}`}
                                  className="hidden"
                                  onChange={(e) => {
                                    if (e.target.files[0]) {
                                      handlePTFileUpload(pt.id, areaKey, doc.id, e.target.files[0]);
                                    }
                                    e.target.value = null;
                                  }}
                                />
                                <button
                                  onClick={() => document.getElementById(`pt-file-${pt.id}-${doc.id}`).click()}
                                  disabled={uploadingDocs[`pt-${doc.id}`]}
                                  className={`p-1.5 text-[#899264] bg-[#899264]/10 rounded hover:bg-[#899264]/20 transition-colors ${uploadingDocs[`pt-${doc.id}`] ? 'opacity-50 cursor-wait' : ''}`}
                                  title={doc.fileUrl ? 'Subir nueva versión (reemplaza la actual)' : 'Subir archivo'}
                                >
                                  {uploadingDocs[`pt-${doc.id}`] ? <Loader className="animate-spin" size={18} /> : <UploadCloud size={18} />}
                                </button>
                              </div>
                            )}
                            {(doc.fileUrl || (doc.history && doc.history.length > 0) || (doc.messages && doc.messages.length > 0)) && (
                              <button
                                onClick={() => setSelectedPTDoc({ productoTipoId: pt.id, areaKey, doc })}
                                className="px-3 py-1.5 text-xs font-medium rounded-md border bg-white text-slate-700 border-slate-300 hover:bg-slate-50 flex items-center gap-1 transition-colors"
                              >
                                <Eye size={14} /> Ver Detalle
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL: PT DOC DETAIL */}
      {selectedPTDoc && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-slide-up">

            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <span className="text-xs font-bold text-[#899264] uppercase tracking-wider">{selectedPTDoc.areaKey}</span>
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  {selectedPTDoc.doc.name}
                  <span className="text-sm font-mono bg-slate-200 text-slate-600 px-2 py-0.5 rounded">{selectedPTDoc.doc.version}</span>
                </h3>
              </div>
              <button
                onClick={() => { setSelectedPTDoc(null); setPtChatMessage(''); }}
                className="text-slate-400 hover:text-slate-700 bg-slate-200/50 hover:bg-slate-200 p-2 rounded-full transition-colors"
              >
                <XCircle size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 flex flex-col md:flex-row gap-8">

              <div className="flex-1">
                <div className="w-full bg-slate-100 rounded-lg border border-slate-200 p-6 flex flex-col items-center justify-center text-slate-400 mb-6 relative overflow-hidden">
                  <MayuLogo className="absolute opacity-5 h-48 w-auto pointer-events-none" />
                  <FileText size={48} className={`mb-3 relative z-10 ${selectedPTDoc.doc.fileUrl ? 'text-[#899264]' : 'opacity-50'}`} />

                  {selectedPTDoc.doc.fileUrl ? (
                    <>
                      <p className="text-sm font-medium relative z-10 text-center truncate w-full text-slate-600 mb-2" title={selectedPTDoc.doc.originalFileName}>
                        {selectedPTDoc.doc.originalFileName}
                      </p>
                      <div className="flex gap-2 relative z-10">
                        <a
                          href={selectedPTDoc.doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-white border-2 border-[#899264] text-[#899264] px-4 py-1.5 rounded-full text-xs font-bold hover:bg-[#899264] hover:text-white transition-colors shadow-sm"
                        >
                          Descargar Archivo
                        </a>
                        {canEdit && (
                          <button
                            onClick={() => {
                              handlePTDeleteFile(selectedPTDoc.productoTipoId, selectedPTDoc.areaKey, selectedPTDoc.doc.id);
                              setSelectedPTDoc(null);
                            }}
                            className="bg-white border-2 border-red-500 text-red-500 px-4 py-1.5 rounded-full text-xs font-bold hover:bg-red-500 hover:text-white transition-colors shadow-sm flex items-center justify-center gap-1"
                            title="Eliminar archivo actual"
                          >
                            <Trash2 size={16} /> Eliminar archivo
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm font-medium relative z-10">Archivo no disponible</p>
                  )}
                </div>

                <div className="mt-4 border-t border-slate-200 pt-6">
                  <h4 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <MessageSquare size={18} className="text-[#899264]" /> Muro de Conversación
                  </h4>
                  <div className="bg-[#F8F9F7] rounded-xl p-4 border border-slate-200 flex flex-col h-72">
                    <div className="flex-1 overflow-y-auto flex flex-col gap-3 mb-4 pr-2 custom-scrollbar">
                      {(selectedPTDoc.doc.messages || []).length === 0 ? (
                        <p className="text-xs text-slate-400 italic text-center my-auto">No hay mensajes. ¡Escribe el primero para iniciar la conversación!</p>
                      ) : (
                        (selectedPTDoc.doc.messages || []).map(msg => (
                          <div key={msg.id} className={`flex flex-col max-w-[85%] ${msg.user === currentUser.name ? 'self-end items-end' : 'self-start items-start'}`}>
                            <div className={`px-3 py-2 rounded-lg text-sm shadow-sm ${msg.user === currentUser.name ? 'bg-[#899264] text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'}`}>
                              {msg.text}
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1">{msg.user} • {new Date(msg.timestamp).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}</span>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 text-sm p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#899264]"
                        placeholder="Escribe un mensaje para el equipo..."
                        value={ptChatMessage}
                        onChange={e => setPtChatMessage(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handlePTSendMessage()}
                      />
                      <button
                        onClick={handlePTSendMessage}
                        disabled={!ptChatMessage.trim()}
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
                  {(selectedPTDoc.doc.history || []).map((hist, i) => (
                    <div key={i} className="relative pl-5">
                      <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white ${hist.action.includes('Cargó') ? 'bg-[#788A87]' : hist.action.includes('Eliminó') ? 'bg-red-500' : 'bg-[#DCA75D]'}`}></div>
                      <p className="text-[10px] text-slate-400 font-mono mb-0.5">{hist.date}</p>
                      <p className="text-xs font-semibold text-slate-700">{hist.user}</p>
                      <p className="text-xs text-[#788A87] mt-1">{hist.action}</p>
                    </div>
                  ))}
                  {(!selectedPTDoc.doc.history || selectedPTDoc.doc.history.length === 0) && (
                    <p className="text-xs text-slate-400 italic pl-4">No hay historial registrado aún.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
