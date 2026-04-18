export const CFG = {
  eventNamn: 'Midsommardagsgolfen',
  eventDatum: 'Lördag 20 Juni 2026',
  eventPlats: 'Rya Golfklubb, Helsingborg',
  slagstart: '10:00',
  middagStart: '19:30',

  prisGolf: 500,
  prisFest: 400,
  prisFull: 900,
  prisBetPerSpel: 20,

  swishGolf: '070-111 22 33',
  swishFest: '070-444 55 66',
  swishBetNr: '070-XXX XX XX',

  swishLankGolf: '',
  swishLankFest: '',
  swishLankBet: '',

  maxGolf: 32,
  maxFest: 60,

  appsScriptUrl: import.meta.env.VITE_APPS_SCRIPT_URL || '',

  drivePhotoFolderId: '1UuiM_4JQaaDDtBm8md-ChigUktjvP2O9',
  driveSponsorFolderId: '',

  sponsorer: [
    { namn: 'Rya GK', logoUrl: 'https://rya.nu/wp-content/uploads/2022/11/Rya_golf_Logo.svg', webbUrl: 'https://rya.nu' },
    { namn: 'Brewski', logoUrl: 'https://lh3.googleusercontent.com/oFIpz8SHaKiSjXa6XYbAi3hCAny_-J9Sji6Dmb0rWBVuK3Ct7G4yNMGlBYBe5D21DTAdpF-JPlXdSLbhoUowsrYuaWORbc4=s750', webbUrl: 'https://www.brewski.se' },
    { namn: 'HAEGERSTRANDS', logoUrl: 'https://usercontent.one/wp/haegerstrands.se/wp-content/uploads/2023/11/logga2.png', webbUrl: 'https://haegerstrands.se/eng/' },
  ],

  omHistoria: '',
  visaStartlista: false,

  // -- Teaser-läge --
  // Sätt till false för att dölja sidan helt (nav, bottom nav, knappar försvinner).
  // När false visas i stället ett popup-meddelande (teaserMeddelande) vid klick på knappar.
  visaAnmalan: true,
  visaDeltagare: true,
  visaBetting: true,

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
