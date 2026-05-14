// Declarations para apps TS que importan @mayu/help-chat (o ./help-chat).
// El componente es JS plano, asi que dejamos los tipos minimos.
import { ComponentType } from 'react';

export interface HelpChatProps {
  appId: 'materiales' | 'bodega' | 'crm' | 'cotizador' | 'fabricacion' | 'finanzas' | 'hub' | 'control';
  user?: { id?: string; name?: string; email?: string | null; role?: string } | null;
  currentView?: string | null;
  appContext?: { projectId?: string; projectName?: string | null } | null;
  functions: unknown;
  anchor?: 'br' | 'bl';
}

export const HelpChat: ComponentType<HelpChatProps>;
