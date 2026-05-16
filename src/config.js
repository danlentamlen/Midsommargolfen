export const CFG = {
  eventNamn: 'Midsommardagsgolfen',
  eventDatum: 'Lördag 20 Juni 2026',
  eventPlats: 'Rya Golfklubb, Helsingborg',
  slagstart: '10:00',
  middagStart: '17:30',

  prisGolf: 500,
  prisFest: 400,
  prisFull: 900,
  prisBetPerSpel: 20,

  swishGolf: '073-401 99 32',
  swishFest: '073-401 99 32',
  swishBetNr: '073-427 48 41',

  swishLankGolf: '',
  swishLankFest: '',
  swishLankBet: '',

  maxGolf: 32,
  maxFest: 70,
  maxGolfReserv: 6,

  appsScriptUrl: import.meta.env.VITE_APPS_SCRIPT_URL || '',

  drivePhotoFolderId: '1i0DL8ne3QksUIT_nvout9PD7-kwKOnpO',
  driveLogoFolderId: '',
  driveSponsorFolderId: '',

  // Fallback-loggor visas om Drive-anropet misslyckas.
  sponsorer: [
    { namn: 'Rya GK',        logoUrl: '/images/sponsors/ryagk.png',          webbUrl: 'https://rya.nu' },
    { namn: 'Brewski',       logoUrl: '/images/sponsors/brewski.png',        webbUrl: 'https://www.brewski.se' },
    { namn: 'HAEGERSTRANDS', logoUrl: '/images/sponsors/haegerstrands.png',  webbUrl: 'https://haegerstrands.se/eng/' },
    { namn: 'Kemira',        logoUrl: '/images/sponsors/kemira.png',         webbUrl: 'https://www.kemira.com/sv/' },
    { namn: 'Leman',         logoUrl: '/images/sponsors/leman.png',          webbUrl: 'https://leman.com' },
    { namn: 'Celeber',       logoUrl: '/images/sponsors/celeber.png',        webbUrl: 'https://celeber.se' },
    { namn: 'mickaeltannus', logoUrl: '/images/sponsors/mickaeltannus.png',  webbUrl: 'https://www.mickaeltannus.com' },
    { namn: 'Optimera',      logoUrl: '/images/sponsors/optimera.png',       webbUrl: 'https://www.optimera.se' },
    { namn: 'Job Meal',      logoUrl: '/images/sponsors/jobmeal.png',        webbUrl: 'https://www.jobmeal.se' },
    { namn: 'Glasklart',     logoUrl: '/images/sponsors/glasklart.png',      webbUrl: 'https://glasklart.eu' }
  ],

  omHistoria: '',
  visaStartlista: false,

  visaAnmalan: true,
  visaDeltagare: true,

  // Styrs via Netlify Environment Variable: VITE_VISA_BETTING
  // Site configuration → Environment variables → VITE_VISA_BETTING = true
  // OBS: kräver ny deploy efter ändring (Vite läser env-variabler vid build-tid).
  visaBetting: import.meta.env.VITE_VISA_BETTING === 'true',

  teaserMeddelande: 'Vi öppnar snart för anmälan — håll utkik! 🏌️',

  startlista: [
    { grupp: 'Grupp 1', teeStart: '10:00', teeHal: '1', spelare: ['Spelare A', 'Spelare B', 'Spelare C', 'Spelare D'] },
  ],

  infoInnehall: '',

  /* Admin password hash (SHA-256) — 'golf2026' */
  adminLosenordHash: 'c3d202d707368179b25dd25eead59c9dd6f45f55e65347c0e23485dfba34e403',
};

export const PAGE_IDX = { home:0, om:1, info:2, sponsring:3, reg:4, list:5, bet:6, 'bet-confirm':6, confirm:4, 'admin-login':null, admin:null };
export const BN_IDS = ['bn-home','bn-om','bn-info','bn-sponsring','bn-reg','bn-list','bn-bet'];