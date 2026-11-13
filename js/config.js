// Configuración PÚBLICA. Acá solo van la URL del proyecto y la "publishable key".
// NUNCA pegar acá la "secret key" ni la "service_role": esas son privadas.
export const CONFIG = {
  SUPABASE_URL: 'PEGAR_AQUI_LA_URL_DEL_PROYECTO',
  SUPABASE_PUBLISHABLE_KEY: 'PEGAR_AQUI_LA_PUBLISHABLE_KEY'
};

export const APP_VERSION = '0.2.0';

export const configLista = () =>
  CONFIG.SUPABASE_URL.startsWith('https://') &&
  !CONFIG.SUPABASE_PUBLISHABLE_KEY.startsWith('PEGAR') &&
  CONFIG.SUPABASE_PUBLISHABLE_KEY.length > 20;
