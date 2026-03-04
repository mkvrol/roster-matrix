// ──────────────────────────────────────────────
// Localized string (most NHL API text fields use this)
// ──────────────────────────────────────────────

export interface NHLLocalizedString {
  default: string;
  fr?: string;
  cs?: string;
  de?: string;
  es?: string;
  fi?: string;
  sk?: string;
  sv?: string;
}

// ──────────────────────────────────────────────
// Standings
// ──────────────────────────────────────────────

export interface NHLStandingsResponse {
  standings: NHLStandingsTeam[];
}

export interface NHLStandingsTeam {
  teamAbbrev: NHLLocalizedString;
  teamName: NHLLocalizedString;
  teamCommonName: NHLLocalizedString;
  placeName: NHLLocalizedString;
  teamLogo: string;
  conferenceName: string;
  conferenceAbbrev: string;
  divisionName: string;
  divisionAbbrev: string;
  seasonId: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  otLosses: number;
  points: number;
  pointPctg: number;
  regulationWins: number;
  goalFor: number;
  goalAgainst: number;
  goalDifferential: number;
  streakCode: string;
  streakCount: number;
  waiversSequence: number;
  leagueSequence: number;
  wildcardSequence: number;
}

// ──────────────────────────────────────────────
// Roster
// ──────────────────────────────────────────────

export interface NHLRosterResponse {
  forwards: NHLRosterPlayer[];
  defensemen: NHLRosterPlayer[];
  goalies: NHLRosterPlayer[];
}

export interface NHLRosterPlayer {
  id: number;
  headshot: string;
  firstName: NHLLocalizedString;
  lastName: NHLLocalizedString;
  sweaterNumber: number;
  positionCode: string;
  shootsCatches: string;
  heightInInches: number;
  weightInPounds: number;
  heightInCentimeters: number;
  weightInKilograms: number;
  birthDate: string;
  birthCity: NHLLocalizedString;
  birthCountry: string;
  birthStateProvince?: NHLLocalizedString;
}

// ──────────────────────────────────────────────
// Player Landing
// ──────────────────────────────────────────────

export interface NHLPlayerLanding {
  playerId: number;
  isActive: boolean;
  currentTeamId?: number;
  currentTeamAbbrev?: string;
  fullTeamName?: NHLLocalizedString;
  firstName: NHLLocalizedString;
  lastName: NHLLocalizedString;
  teamLogo?: string;
  sweaterNumber?: number;
  position: string;
  headshot: string;
  heroImage?: string;
  heightInInches: number;
  weightInPounds: number;
  birthDate: string;
  birthCity: NHLLocalizedString;
  birthCountry: string;
  birthStateProvince?: NHLLocalizedString;
  shootsCatches: string;
  draftDetails?: NHLDraftDetails;
  playerSlug: string;
  featuredStats?: NHLFeaturedStats;
  careerTotals?: NHLCareerTotals;
  seasonTotals: NHLSeasonTotal[];
  last5Games?: NHLGameLog[];
}

export interface NHLDraftDetails {
  year: number;
  teamAbbrev: string;
  round: number;
  pickInRound: number;
  overallPick: number;
}

export interface NHLFeaturedStats {
  season: number;
  regularSeason: {
    subSeason: Record<string, unknown>;
    career: Record<string, unknown>;
  };
}

export interface NHLCareerTotals {
  regularSeason: Record<string, unknown>;
  playoffs?: Record<string, unknown>;
}

// Season totals — unified shape for both skaters and goalies
export interface NHLSeasonTotal {
  season: number;
  gameTypeId: number;
  leagueAbbrev: string;
  sequence: number;
  teamName: NHLLocalizedString;
  teamCommonName?: NHLLocalizedString;
  teamPlaceNameWithPreposition?: NHLLocalizedString;
  gamesPlayed: number;
  // Skater fields
  goals?: number;
  assists?: number;
  points?: number;
  plusMinus?: number;
  pim?: number;
  avgToi?: string;
  faceoffWinningPctg?: number;
  gameWinningGoals?: number;
  otGoals?: number;
  powerPlayGoals?: number;
  powerPlayPoints?: number;
  shootingPctg?: number;
  shorthandedGoals?: number;
  shorthandedPoints?: number;
  shots?: number;
  // Goalie fields
  goalsAgainst?: number;
  goalsAgainstAvg?: number;
  savePctg?: number;
  shotsAgainst?: number;
  shutouts?: number;
  wins?: number;
  losses?: number;
  otLosses?: number;
  gamesStarted?: number;
  timeOnIce?: string;
}

export interface NHLGameLog {
  gameDate: string;
  gameId: number;
  gameTypeId: number;
  teamAbbrev: string;
  opponentAbbrev: string;
  homeRoadFlag: string;
  goals?: number;
  assists?: number;
  points?: number;
  plusMinus?: number;
  shots?: number;
  pim?: number;
  powerPlayGoals?: number;
  shorthandedGoals?: number;
  toi?: string;
  shifts?: number;
  // Goalie fields
  decision?: string;
  goalsAgainst?: number;
  savePctg?: number;
  shotsAgainst?: number;
  gamesStarted?: number;
  penaltyMins?: number;
}

// ──────────────────────────────────────────────
// Team abbreviation → NHL numeric ID mapping
// ──────────────────────────────────────────────

export const NHL_TEAM_ID_MAP: Record<string, number> = {
  ANA: 24, BOS: 6, BUF: 7, CGY: 20, CAR: 12, CHI: 16, COL: 21, CBJ: 29,
  DAL: 25, DET: 17, EDM: 22, FLA: 13, LAK: 26, MIN: 30, MTL: 8, NSH: 18,
  NJD: 1, NYI: 2, NYR: 3, OTT: 9, PHI: 4, PIT: 5, SJS: 28, SEA: 55,
  STL: 19, TBL: 14, TOR: 10, UTA: 53, VAN: 23, VGK: 54, WPG: 52, WSH: 15,
};
