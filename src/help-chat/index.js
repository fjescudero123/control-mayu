// --- @mayu/help-chat — shared help chat widget for MAYU ERP apps ---
//
// Uso en cada app (ver README para integracion completa):
//
//   import { HelpChat } from '@mayu/help-chat';
//
//   <HelpChat appId="materiales" user={currentUser} />
//
// Requiere Firebase Functions configurado en la app (httpsCallable
// resuelve 'helpChatAsk' y 'helpChatTicket'). Ver README.

export { HelpChat } from './HelpChat.jsx';
