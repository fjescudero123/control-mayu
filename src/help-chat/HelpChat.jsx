import { useState, useRef, useEffect, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { C } from './colors.js';

// HelpChat — boton flotante + panel lateral con chat alimentado por Claude.
//
// Props:
//   appId          'materiales' | 'bodega' | 'crm' | 'cotizador'
//                  | 'fabricacion' | 'finanzas' | 'hub' | 'control'
//   user           { id, name, email, role } — usuario logueado de la app
//   currentView    string opcional — vista actual ('bom', 'ordenes', etc).
//                  Se manda al backend como contexto para mejorar respuestas.
//   appContext     objeto opcional — contexto adicional (ej. proyecto activo
//                  { projectId, projectName }). Permite que las tools del
//                  backend resuelvan consultas referidas al "proyecto actual".
//   functions      instancia de getFunctions(firebaseApp) de la app
//   anchor         'br' (default) | 'bl' — esquina donde flota el boton
//
// El backend (Cloud Functions helpChatAsk + helpChatTicket) vive en el
// proyecto Firebase compartido. Si el usuario indica que la respuesta no
// resolvio o si Claude detecta que la consulta requiere intervencion humana
// (bug / feature missing), se ofrece abrir un ticket que llega por mail a
// fjescudero@imayu.cl con la conversacion completa.

export function HelpChat({ appId, user, currentView, appContext, functions, anchor = 'br' }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);   // [{ role, content, requiereTicket? }]
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ticketStatus, setTicketStatus] = useState(null); // null | 'sending' | 'sent' | 'error'
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll al ultimo mensaje
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Focus al abrir
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || !functions) return;
    setError('');
    setTicketStatus(null);
    const userMsg = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const ask = httpsCallable(functions, 'helpChatAsk');
      const res = await ask({
        appId,
        currentView: currentView || null,
        userInfo: user ? { id: user.id, name: user.name, role: user.role } : null,
        appContext: appContext || null,
        messages: next.map(m => ({ role: m.role, content: m.content })),
      });
      const data = res.data || {};
      setMessages(curr => [...curr, {
        role: 'assistant',
        content: data.answer || '(sin respuesta)',
        requiereTicket: !!data.requiereTicket,
      }]);
    } catch (e) {
      console.error('[HelpChat] error en helpChatAsk:', e);
      setError(e?.message || 'Error al contactar el asistente');
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, appId, currentView, user, functions]);

  const openTicket = useCallback(async () => {
    if (ticketStatus === 'sending' || ticketStatus === 'sent' || !functions) return;
    setTicketStatus('sending');
    try {
      const ticket = httpsCallable(functions, 'helpChatTicket');
      await ticket({
        appId,
        currentView: currentView || null,
        userInfo: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null,
        appContext: appContext || null,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      });
      setTicketStatus('sent');
    } catch (e) {
      console.error('[HelpChat] error en helpChatTicket:', e);
      setTicketStatus('error');
    }
  }, [messages, appId, currentView, user, ticketStatus, functions]);

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const reset = () => {
    setMessages([]);
    setInput('');
    setError('');
    setTicketStatus(null);
  };

  // El backend marca requiereTicket=true cuando detecta que la consulta es bug,
  // feature missing, o no resoluble con la documentacion. Tambien mostramos el
  // boton siempre que haya >=2 mensajes (usuario puede escalar manualmente).
  const claudeSugiereTicket = messages.some(m => m.role === 'assistant' && m.requiereTicket);
  const puedeAbrirTicket = messages.length >= 2 && ticketStatus !== 'sent';

  const fabPos = anchor === 'bl' ? { left: 20 } : { right: 20 };
  const panelPos = anchor === 'bl' ? { left: 20 } : { right: 20 };

  // ─── FAB cerrado ──────────────────────────────────────────────────────────
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Pregunta al asistente MAYU"
        style={{
          position: 'fixed', bottom: 20, ...fabPos, zIndex: 9999,
          width: 56, height: 56, borderRadius: '50%',
          background: C.acc, color: C.bg, border: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, fontWeight: 700, fontFamily: 'system-ui,sans-serif',
        }}
      >?</button>
    );
  }

  // ─── Panel abierto ────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', bottom: 20, ...panelPos, zIndex: 9999,
      width: 380, maxWidth: 'calc(100vw - 40px)', height: 560, maxHeight: 'calc(100vh - 40px)',
      background: C.bgCard, border: `1px solid ${C.bdr}`, borderRadius: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: 'system-ui,sans-serif', color: C.tx,
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px', borderBottom: `1px solid ${C.bdr}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: `${C.acc}08`,
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.acc }}>Asistente MAYU</div>
          <div style={{ fontSize: 10, color: C.txM, marginTop: 1 }}>
            Pregunta como usar la app {appId} · respuestas en segundos
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {messages.length > 0 && (
            <button onClick={reset} title="Nueva conversacion" style={iconBtn}>↻</button>
          )}
          <button onClick={() => setOpen(false)} title="Cerrar" style={iconBtn}>×</button>
        </div>
      </div>

      {/* Mensajes */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', padding: '12px 14px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {messages.length === 0 && (
          <div style={{
            padding: '14px 12px', background: `${C.cyn}08`, border: `1px solid ${C.cyn}22`,
            borderRadius: 8, fontSize: 11, color: C.txM, lineHeight: 1.5,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.cyn, marginBottom: 6 }}>
              Hola{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
            </div>
            Preguntame como hacer cualquier cosa en la app:
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: C.txM }}>
              <li>"como subo un BOM nuevo"</li>
              <li>"por que el item BOM-125 no me deja emitir OC"</li>
              <li>"como recepciono materiales en bodega"</li>
            </ul>
            <div style={{ marginTop: 8, fontSize: 10, color: C.txD, fontStyle: 'italic' }}>
              Si la respuesta no resuelve, puedes abrir un ticket que le llega a Felix por mail.
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <Message key={i} role={m.role} content={m.content} requiereTicket={m.requiereTicket} />
        ))}

        {loading && (
          <div style={{
            alignSelf: 'flex-start', padding: '8px 12px', background: `${C.cyn}11`,
            border: `1px solid ${C.cyn}33`, borderRadius: 10, fontSize: 11, color: C.cyn,
          }}>Pensando<span style={{ animation: 'mayuhc-dots 1.4s infinite' }}>...</span></div>
        )}

        {claudeSugiereTicket && ticketStatus !== 'sent' && (
          <div style={{
            padding: '10px 12px', background: `${C.org}11`, border: `1px solid ${C.org}44`,
            borderRadius: 8, fontSize: 11, color: C.org, lineHeight: 1.5,
          }}>
            <strong>Sugerencia:</strong> esta consulta parece requerir intervencion humana
            (bug o funcionalidad faltante). ¿Abro un ticket para Felix?
          </div>
        )}
      </div>

      {/* Banner ticket */}
      {ticketStatus === 'sent' && (
        <div style={{
          padding: '8px 14px', background: `${C.grn}15`, borderTop: `1px solid ${C.grn}44`,
          fontSize: 11, color: C.grn, textAlign: 'center',
        }}>✓ Ticket enviado. Felix recibira un mail con la conversacion.</div>
      )}
      {ticketStatus === 'error' && (
        <div style={{
          padding: '8px 14px', background: `${C.red}15`, borderTop: `1px solid ${C.red}44`,
          fontSize: 11, color: C.red, textAlign: 'center',
        }}>No se pudo enviar el ticket. Avisa a Felix por WhatsApp.</div>
      )}

      {/* Input + acciones */}
      <div style={{
        padding: 10, borderTop: `1px solid ${C.bdr}`, background: C.bg,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {error && (
          <div style={{ fontSize: 10, color: C.red, padding: '4px 6px' }}>{error}</div>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Escribe tu pregunta..."
            disabled={loading}
            rows={2}
            style={{
              flex: 1, padding: '8px 10px', borderRadius: 6,
              border: `1px solid ${C.bdr}`, background: C.bgCard, color: C.tx,
              fontSize: 12, fontFamily: 'inherit', resize: 'none', outline: 'none',
            }}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            style={{
              padding: '0 14px', borderRadius: 6, border: 'none',
              background: loading || !input.trim() ? `${C.txM}33` : C.acc,
              color: loading || !input.trim() ? C.txM : C.bg,
              fontWeight: 700, fontSize: 12,
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            }}
          >Enviar</button>
        </div>
        {puedeAbrirTicket && (
          <button
            onClick={openTicket}
            disabled={ticketStatus === 'sending'}
            style={{
              padding: '6px 10px', borderRadius: 6,
              border: `1px solid ${claudeSugiereTicket ? C.org : C.bdr}`,
              background: claudeSugiereTicket ? `${C.org}15` : 'transparent',
              color: claudeSugiereTicket ? C.org : C.txM,
              fontSize: 10, cursor: ticketStatus === 'sending' ? 'wait' : 'pointer',
              fontWeight: 600,
            }}
          >
            {ticketStatus === 'sending'
              ? 'Enviando ticket...'
              : claudeSugiereTicket
                ? '→ Abrir ticket para Felix'
                : 'Esto no resolvio mi problema · Abrir ticket'}
          </button>
        )}
      </div>

      <style>{`@keyframes mayuhc-dots{0%,20%{opacity:0.2}50%{opacity:1}100%{opacity:0.2}}`}</style>
    </div>
  );
}

const iconBtn = {
  background: 'transparent', border: 'none', color: C.txM,
  fontSize: 18, cursor: 'pointer', padding: '2px 8px', borderRadius: 4,
  lineHeight: 1,
};

function Message({ role, content }) {
  const isUser = role === 'user';
  return (
    <div style={{
      alignSelf: isUser ? 'flex-end' : 'flex-start',
      maxWidth: '85%',
      padding: '8px 12px', borderRadius: 10,
      background: isUser ? C.acc : `${C.cyn}11`,
      border: isUser ? 'none' : `1px solid ${C.cyn}33`,
      color: isUser ? C.bg : C.tx,
      fontSize: 12, lineHeight: 1.5,
      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    }}>{content}</div>
  );
}
