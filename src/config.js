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
  swishBetNr: '070-XXX XX XX',

  swishLankGolf: '',
  swishLankFest: '',
  swishLankBet: '',

  maxGolf: 32,
  maxFest: 70,
  maxGolfReserv: 6,  // eller valfritt antal

  appsScriptUrl: import.meta.env.VITE_APPS_SCRIPT_URL || '',

  drivePhotoFolderId: '1i0DL8ne3QksUIT_nvout9PD7-kwKOnpO',
  driveLogoFolderId: '',
  driveSponsorFolderId: '',

  // Fallback-loggor visas om Drive-anropet misslyckas.
  // Ladda upp loggor i Drive-mappen (driveSponsorFolderId) för produktion.
  // Filnamn spelar ingen roll — alla bildfiler i mappen visas.
  sponsorer: [
    { namn: 'Rya GK',        logoUrl: '/images/sponsors/rya-gk.svg',          webbUrl: 'https://rya.nu' },
    { namn: 'Brewski',       logoUrl: '/images/sponsors/brewski.png', webbUrl: 'https://www.brewski.se' },
    { namn: 'HAEGERSTRANDS', logoUrl: '/images/sponsors/haegerstrands.png', webbUrl: 'https://haegerstrands.se/eng/' },
    { namn: 'Kemira',        logoUrl: '/images/sponsors/kemira.svg', webbUrl: 'https://www.kemira.com/sv/' },
    { namn: 'Leman',         logoUrl: '/images/sponsors/leman.png', webbUrl: 'https://leman.com' },
    { namn: 'Celeber',       logoUrl: '/images/sponsors/celeber.png', webbUrl: 'https://celeber.se' },
    { namn: 'mickaeltannus', logoUrl: '/images/sponsors/mickaeltannus.png ', webbUrl: 'https://www.mickaeltannus.com' }
    { namn: 'Optimera',      logoUrl: '/images/sponsors/optimera.png', webbUrl: 'https://www.optimera.se' }
  ],

  omHistoria: '',
  visaStartlista: false,

  // -- Teaser-läge --
  // Sätt till false för att dölja sidan helt (nav, bottom nav, knappar försvinner).
  // När false visas i stället ett popup-meddelande (teaserMeddelande) vid klick på knappar.
  visaAnmalan: true,
  visaDeltagare: true,
  visaBetting: false,

  // Meddelandet som visas i popup när en dold sida klickas
  teaserMeddelande: 'Vi öppnar snart för anmälan — håll utkik! 🏌️',

  startlista: [
    { grupp: 'Grupp 1', teeStart: '10:00', teeHal: '1', spelare: ['Spelare A', 'Spelare B', 'Spelare C', 'Spelare D'] },
  ],

  infoInnehall: '',

  /* Admin password hash (SHA-256 of the password) */
  /* To change: echo -n 'yourpassword' | shasum -a 256 */
  /* 'golf2026' */
  adminLosenordHash: 'c3d202d707368179b25dd25eead59c9dd6f45f55e65347c0e23485dfba34e403',
};

// Navigation constants
export const PAGE_IDX = {home:0,om:1,info:2,sponsring:3,reg:4,list:5,bet:6,'bet-confirm':6,confirm:4,'admin-login':null,admin:null};
export const BN_IDS = ['bn-home','bn-om','bn-info','bn-sponsring','bn-reg','bn-list','bn-bet'];
