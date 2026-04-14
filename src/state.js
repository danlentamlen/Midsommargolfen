// Shared mutable state — all modules import this singleton
export const state = {
  allParts: [],
  betPlayers: [],
  selectedPlayers: new Set(),
  adminData: { anm: [], bet: [] },
  adminAuthed: false,
  golfCnt: 0,
  festCnt: 0,
};

export const SAMPLE = [
  {name:'Anders Lindqvist',spelarid:'S001',hcp:8.2,golfid:'731021-001',bets:4,pkg:'full'},
  {name:'Sara Bergström',spelarid:'S002',hcp:11.4,golfid:'720405-002',bets:6,pkg:'golf'},
  {name:'Mikael Holmgren',spelarid:'S003',hcp:5.1,golfid:'650918-003',bets:8,pkg:'full'},
  {name:'Karin Sjögren',spelarid:'S004',hcp:14.0,golfid:'780301-004',bets:2,pkg:'golf'},
  {name:'Johan Petersson',spelarid:'S005',hcp:18.6,golfid:'820612-005',bets:1,pkg:'full'},
  {name:'Maria Ek',spelarid:'S006',hcp:9.3,golfid:'750830-006',bets:5,pkg:'golf'},
  {name:'Erik Strand',spelarid:'S007',hcp:12.7,golfid:'690215-007',bets:3,pkg:'full'},
  {name:'Lisa Karlsson',spelarid:null,hcp:null,golfid:null,bets:0,pkg:'party'},
];
