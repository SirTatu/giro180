// Configuración PÚBLICA. Acá solo van la URL del proyecto y la "publishable key".
// NUNCA pegar acá la "secret key" ni la "service_role": esas son privadas.
export const CONFIG = {
  SUPABASE_URL: 'https://diuabbzvmzkfnszntykw.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_ACxXUgG9KskGT4glUpND0g_CkLy_EOI'
};

export const APP_VERSION = '0.2.0';

export const configLista = () =>
  CONFIG.SUPABASE_URL.startsWith('https://') &&
  !CONFIG.SUPABASE_PUBLISHABLE_KEY.startsWith('PEGAR') &&
  CONFIG.SUPABASE_PUBLISHABLE_KEY.length > 20;
