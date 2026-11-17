/** Public deployment facts. Empty values deliberately keep analytics disabled. */
const env = import.meta.env;
export const privacy = {
  updated: '17 novembre 2026',
  controller: 'Emanuele Cardinali',
  email: env.PUBLIC_PRIVACY_EMAIL || 'emanuele@cardinali.studio',
  contactAddress: env.PUBLIC_PRIVACY_ADDRESS || '',
  hostingRegion: env.PUBLIC_HOSTING_REGION || '',
  logRetention: env.PUBLIC_HOSTING_LOG_RETENTION || '',
  umamiScript: env.PUBLIC_UMAMI_SCRIPT_URL || 'https://cloud.umami.is/script.js',
  umamiId: env.PUBLIC_UMAMI_WEBSITE_ID || 'b2ef9376-6eab-4ace-a55f-0db284e48135',
  umamiProvider: env.PUBLIC_UMAMI_PROVIDER || 'Umami Software, Inc. · Umami Cloud',
  umamiRegion: env.PUBLIC_UMAMI_REGION || 'Unione europea (EU)',
  umamiRetention: env.PUBLIC_UMAMI_RETENTION || '6 mesi · piano Hobby',
  reviewed: env.PRIVACY_REVIEWED !== 'false',
};
export const analyticsEnabled = privacy.reviewed && !!privacy.email && !!privacy.umamiScript && !!privacy.umamiId && !!privacy.umamiProvider && !!privacy.umamiRegion && !!privacy.umamiRetention;
if (analyticsEnabled && (!/^https:\/\//.test(privacy.umamiScript) || !/^[a-f0-9-]{36}$/i.test(privacy.umamiId))) throw new Error('Configurazione Umami non valida');
