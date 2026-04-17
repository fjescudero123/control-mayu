// Leidos desde Netlify env vars (VITE_*). En local, si no existe .env.local,
// quedan undefined y sendWhatsAppNotification skip con warning (no rompe la app).
export const MAKE_WEBHOOK_URL = import.meta.env.VITE_MAKE_WEBHOOK_URL;
export const WHATSAPP_GROUP_ID = import.meta.env.VITE_WHATSAPP_GROUP_ID;
