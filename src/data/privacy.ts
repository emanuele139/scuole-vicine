/** Public deployment facts. Empty values deliberately keep analytics disabled. */
const env = import.meta.env;
export const privacy = {
  updated: '17 novembre 2026',
  controller: 'Emanuele Cardinali',
  email: env.PUBLIC_PRIVACY_EMAIL || 'emanuele@cardinali.studio',
  contactAddress: env.PUBLIC_PRIVACY_ADDRESS || '',
  hostingRegion: env.PUBLIC_HOSTING_REGION || 'Database D1 con giurisdizione UE (regione EEUR); distribuzione delle pagine sulla rete globale Cloudflare',
  logRetention: env.PUBLIC_HOSTING_LOG_RETENTION || 'Workers Logs e Logpush non attivati per il progetto. I log tecnici gestiti autonomamente da Cloudflare seguono la sua informativa e gli accordi applicabili; non fissiamo per essi un termine applicativo',
  umamiScript: env.PUBLIC_UMAMI_SCRIPT_URL || 'https://cloud.umami.is/script.js',
  umamiId: env.PUBLIC_UMAMI_WEBSITE_ID || 'b2ef9376-6eab-4ace-a55f-0db284e48135',
  umamiProvider: env.PUBLIC_UMAMI_PROVIDER || 'Umami Software, Inc. · Umami Cloud',
  umamiRegion: env.PUBLIC_UMAMI_REGION || 'Unione europea (EU)',
  umamiRetention: env.PUBLIC_UMAMI_RETENTION || '6 mesi · piano Hobby',
  reviewed: env.PRIVACY_REVIEWED !== 'false',
};
export const analyticsEnabled = privacy.reviewed && !!privacy.email && !!privacy.umamiScript && !!privacy.umamiId && !!privacy.umamiProvider && !!privacy.umamiRegion && !!privacy.umamiRetention;
if (analyticsEnabled && (!/^https:\/\//.test(privacy.umamiScript) || !/^[a-f0-9-]{36}$/i.test(privacy.umamiId))) throw new Error('Configurazione Umami non valida');
