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
  // old: '1UuiM_4JQaaDDtBm8md-ChigUktjvP2O9',
  driveLogoFolderId: '1i0DL8ne3QksUIT_nvout9PD7-kwKOnpO',
  // old: '1UuiM_4JQaaDDtBm8md-ChigUktjvP2O9',  
  driveSponsorFolderId: '14GouS8CnAK-zWyS-pyh0tIrW2WEUDTkY',
  // old: '19iyXGU2Ek7CQWIIFfYdhHSvRnbWU96Ij',

  // Fallback-loggor visas om Drive-anropet misslyckas.
  // Ladda upp loggor i Drive-mappen (driveSponsorFolderId) för produktion.
  // Filnamn spelar ingen roll — alla bildfiler i mappen visas.
  sponsorer: [
    { namn: 'Rya GK',        logoUrl: 'https://rya.nu/wp-content/uploads/2022/11/Rya_golf_Logo.svg',          webbUrl: 'https://rya.nu' },
    { namn: 'Brewski',       logoUrl: 'https://lh3.googleusercontent.com/oFIpz8SHaKiSjXa6XYbAi3hCAny_-J9Sji6Dmb0rWBVuK3Ct7G4yNMGlBYBe5D21DTAdpF-JPlXdSLbhoUowsrYuaWORbc4=s750', webbUrl: 'https://www.brewski.se' },
    { namn: 'HAEGERSTRANDS', logoUrl: 'https://usercontent.one/wp/haegerstrands.se/wp-content/uploads/2023/11/logga2.png', webbUrl: 'https://haegerstrands.se/eng/' },
    { namn: 'Kemira',        logoUrl: 'https://www.kemira.com/wp-content/themes/kemira/images/kemira-logo.svg', webbUrl: 'https://www.kemira.com/sv/' },
    { namn: 'Leman',         logoUrl: '', webbUrl: 'https://leman.com' },
    { namn: 'Celeber',       logoUrl: '', webbUrl: 'https://celeber.se' },
    { namn: 'mickaeltannus', logoUrl: '', webbUrl: 'https://www.mickaeltannus.com' }
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
