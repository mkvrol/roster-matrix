// ──────────────────────────────────────────────
// Roster Matrix — Seed Data
// All 32 NHL teams + 67 named players (baseline 2024-25 stats)
// ──────────────────────────────────────────────

export interface TeamData {
  abbrev: string;
  nhlApiId: number;
  name: string;
  city: string;
  division: string;
  conference: string;
  primaryColor: string;
  secondaryColor: string;
}

export interface SkaterBaseline {
  gp: number; g: number; a: number; pm: number; pim: number;
  toi: number; shots: number; hits: number; blocks: number;
  takeaways: number; giveaways: number; faceoffPct?: number;
  gwg: number; otg: number; ppg: number; ppa: number;
  shg: number; sha: number;
}

export interface GoalieBaseline {
  gp: number; gs: number; w: number; l: number; otl: number;
  svPct: number; gaa: number; shotsAgainst: number; saves: number;
  shutouts: number;
}

export interface ContractInfo {
  startYear: number; endYear: number; aav: number;
  structure: "FRONT_LOADED" | "BACK_LOADED" | "EVEN" | "FLAT";
  signingType: "RFA" | "UFA" | "ELC" | "EXTENSION";
  hasNTC: boolean; hasNMC: boolean;
  tradeProtection?: string; signingAge: number;
}

export interface SkaterSeed {
  nhlApiId: number; firstName: string; lastName: string;
  position: "C" | "LW" | "RW" | "D";
  shootsCatches: string; birthDate: string;
  birthCity: string; birthCountry: string;
  heightInches: number; weightLbs: number;
  teamAbbrev: string;
  baseline: SkaterBaseline;
  contract: ContractInfo;
}

export interface GoalieSeed {
  nhlApiId: number; firstName: string; lastName: string;
  shootsCatches: string; birthDate: string;
  birthCity: string; birthCountry: string;
  heightInches: number; weightLbs: number;
  teamAbbrev: string;
  baseline: GoalieBaseline;
  contract: ContractInfo;
}

// ──────────────────────────────────────────────
// All 32 NHL Teams
// ──────────────────────────────────────────────

export const TEAMS: TeamData[] = [
  { abbrev: "ANA", nhlApiId: 24, name: "Anaheim Ducks", city: "Anaheim", division: "Pacific", conference: "Western", primaryColor: "#F47A38", secondaryColor: "#B9975B" },
  { abbrev: "BOS", nhlApiId: 6, name: "Boston Bruins", city: "Boston", division: "Atlantic", conference: "Eastern", primaryColor: "#FFB81C", secondaryColor: "#000000" },
  { abbrev: "BUF", nhlApiId: 7, name: "Buffalo Sabres", city: "Buffalo", division: "Atlantic", conference: "Eastern", primaryColor: "#003087", secondaryColor: "#FFB81C" },
  { abbrev: "CGY", nhlApiId: 20, name: "Calgary Flames", city: "Calgary", division: "Pacific", conference: "Western", primaryColor: "#D2001C", secondaryColor: "#FAAF19" },
  { abbrev: "CAR", nhlApiId: 12, name: "Carolina Hurricanes", city: "Raleigh", division: "Metropolitan", conference: "Eastern", primaryColor: "#CC0000", secondaryColor: "#000000" },
  { abbrev: "CHI", nhlApiId: 16, name: "Chicago Blackhawks", city: "Chicago", division: "Central", conference: "Western", primaryColor: "#CF0A2C", secondaryColor: "#000000" },
  { abbrev: "COL", nhlApiId: 21, name: "Colorado Avalanche", city: "Denver", division: "Central", conference: "Western", primaryColor: "#6F263D", secondaryColor: "#236192" },
  { abbrev: "CBJ", nhlApiId: 29, name: "Columbus Blue Jackets", city: "Columbus", division: "Metropolitan", conference: "Eastern", primaryColor: "#002654", secondaryColor: "#CE1126" },
  { abbrev: "DAL", nhlApiId: 25, name: "Dallas Stars", city: "Dallas", division: "Central", conference: "Western", primaryColor: "#006847", secondaryColor: "#8F8F8C" },
  { abbrev: "DET", nhlApiId: 17, name: "Detroit Red Wings", city: "Detroit", division: "Atlantic", conference: "Eastern", primaryColor: "#CE1126", secondaryColor: "#FFFFFF" },
  { abbrev: "EDM", nhlApiId: 22, name: "Edmonton Oilers", city: "Edmonton", division: "Pacific", conference: "Western", primaryColor: "#041E42", secondaryColor: "#FF4C00" },
  { abbrev: "FLA", nhlApiId: 13, name: "Florida Panthers", city: "Sunrise", division: "Atlantic", conference: "Eastern", primaryColor: "#041E42", secondaryColor: "#C8102E" },
  { abbrev: "LAK", nhlApiId: 26, name: "Los Angeles Kings", city: "Los Angeles", division: "Pacific", conference: "Western", primaryColor: "#111111", secondaryColor: "#A2AAAD" },
  { abbrev: "MIN", nhlApiId: 30, name: "Minnesota Wild", city: "Saint Paul", division: "Central", conference: "Western", primaryColor: "#154734", secondaryColor: "#A6192E" },
  { abbrev: "MTL", nhlApiId: 8, name: "Montreal Canadiens", city: "Montreal", division: "Atlantic", conference: "Eastern", primaryColor: "#AF1E2D", secondaryColor: "#192168" },
  { abbrev: "NSH", nhlApiId: 18, name: "Nashville Predators", city: "Nashville", division: "Central", conference: "Western", primaryColor: "#FFB81C", secondaryColor: "#041E42" },
  { abbrev: "NJD", nhlApiId: 1, name: "New Jersey Devils", city: "Newark", division: "Metropolitan", conference: "Eastern", primaryColor: "#CE1126", secondaryColor: "#000000" },
  { abbrev: "NYI", nhlApiId: 2, name: "New York Islanders", city: "Elmont", division: "Metropolitan", conference: "Eastern", primaryColor: "#00539B", secondaryColor: "#F47D30" },
  { abbrev: "NYR", nhlApiId: 3, name: "New York Rangers", city: "New York", division: "Metropolitan", conference: "Eastern", primaryColor: "#0038A8", secondaryColor: "#CE1126" },
  { abbrev: "OTT", nhlApiId: 9, name: "Ottawa Senators", city: "Ottawa", division: "Atlantic", conference: "Eastern", primaryColor: "#C52032", secondaryColor: "#C2912C" },
  { abbrev: "PHI", nhlApiId: 4, name: "Philadelphia Flyers", city: "Philadelphia", division: "Metropolitan", conference: "Eastern", primaryColor: "#F74902", secondaryColor: "#000000" },
  { abbrev: "PIT", nhlApiId: 5, name: "Pittsburgh Penguins", city: "Pittsburgh", division: "Metropolitan", conference: "Eastern", primaryColor: "#FCB514", secondaryColor: "#000000" },
  { abbrev: "SJS", nhlApiId: 28, name: "San Jose Sharks", city: "San Jose", division: "Pacific", conference: "Western", primaryColor: "#006D75", secondaryColor: "#000000" },
  { abbrev: "SEA", nhlApiId: 55, name: "Seattle Kraken", city: "Seattle", division: "Pacific", conference: "Western", primaryColor: "#001628", secondaryColor: "#99D9D9" },
  { abbrev: "STL", nhlApiId: 19, name: "St. Louis Blues", city: "St. Louis", division: "Central", conference: "Western", primaryColor: "#002F87", secondaryColor: "#FCB514" },
  { abbrev: "TBL", nhlApiId: 14, name: "Tampa Bay Lightning", city: "Tampa", division: "Atlantic", conference: "Eastern", primaryColor: "#002868", secondaryColor: "#FFFFFF" },
  { abbrev: "TOR", nhlApiId: 10, name: "Toronto Maple Leafs", city: "Toronto", division: "Atlantic", conference: "Eastern", primaryColor: "#00205B", secondaryColor: "#FFFFFF" },
  { abbrev: "UTA", nhlApiId: 53, name: "Utah Mammoth", city: "Salt Lake City", division: "Central", conference: "Western", primaryColor: "#69B3E7", secondaryColor: "#000000" },
  { abbrev: "VAN", nhlApiId: 23, name: "Vancouver Canucks", city: "Vancouver", division: "Pacific", conference: "Western", primaryColor: "#00205B", secondaryColor: "#00843D" },
  { abbrev: "VGK", nhlApiId: 54, name: "Vegas Golden Knights", city: "Las Vegas", division: "Pacific", conference: "Western", primaryColor: "#B4975A", secondaryColor: "#333F42" },
  { abbrev: "WPG", nhlApiId: 52, name: "Winnipeg Jets", city: "Winnipeg", division: "Central", conference: "Western", primaryColor: "#041E42", secondaryColor: "#004C97" },
  { abbrev: "WSH", nhlApiId: 15, name: "Washington Capitals", city: "Washington", division: "Metropolitan", conference: "Eastern", primaryColor: "#041E42", secondaryColor: "#C8102E" },
];

// ──────────────────────────────────────────────
// Named Skaters (62 players)
// ──────────────────────────────────────────────

export const SKATERS: SkaterSeed[] = [
  // ── Detroit Red Wings ──
  { nhlApiId: 8477946, firstName: "Dylan", lastName: "Larkin", position: "C", shootsCatches: "L", birthDate: "1996-07-30", birthCity: "Waterford", birthCountry: "USA", heightInches: 73, weightLbs: 198, teamAbbrev: "DET",
    baseline: { gp: 82, g: 31, a: 40, pm: 12, pim: 58, toi: 20.1, shots: 248, hits: 85, blocks: 38, takeaways: 52, giveaways: 38, faceoffPct: 55.0, gwg: 6, otg: 2, ppg: 8, ppa: 14, shg: 2, sha: 1 },
    contract: { startYear: 2023, endYear: 2031, aav: 8.7, structure: "EVEN", signingType: "EXTENSION", hasNTC: true, hasNMC: true, tradeProtection: "Full NMC", signingAge: 26 } },
  { nhlApiId: 8482078, firstName: "Lucas", lastName: "Raymond", position: "LW", shootsCatches: "L", birthDate: "2002-03-28", birthCity: "Gothenburg", birthCountry: "SWE", heightInches: 71, weightLbs: 183, teamAbbrev: "DET",
    baseline: { gp: 82, g: 31, a: 50, pm: 15, pim: 22, toi: 18.8, shots: 228, hits: 38, blocks: 22, takeaways: 58, giveaways: 42, gwg: 5, otg: 2, ppg: 9, ppa: 18, shg: 0, sha: 1 },
    contract: { startYear: 2024, endYear: 2032, aav: 8.075, structure: "EVEN", signingType: "RFA", hasNTC: true, hasNMC: false, tradeProtection: "Modified NTC", signingAge: 22 } },
  { nhlApiId: 8479337, firstName: "Alex", lastName: "DeBrincat", position: "RW", shootsCatches: "R", birthDate: "1997-12-18", birthCity: "Farmington Hills", birthCountry: "USA", heightInches: 68, weightLbs: 165, teamAbbrev: "DET",
    baseline: { gp: 82, g: 35, a: 30, pm: 8, pim: 26, toi: 17.8, shots: 255, hits: 30, blocks: 16, takeaways: 35, giveaways: 30, gwg: 7, otg: 2, ppg: 12, ppa: 10, shg: 0, sha: 0 },
    contract: { startYear: 2024, endYear: 2030, aav: 7.875, structure: "EVEN", signingType: "UFA", hasNTC: true, hasNMC: false, tradeProtection: "Modified NTC", signingAge: 26 } },
  { nhlApiId: 8481542, firstName: "Moritz", lastName: "Seider", position: "D", shootsCatches: "R", birthDate: "2001-06-06", birthCity: "Zell an der Pram", birthCountry: "DEU", heightInches: 74, weightLbs: 207, teamAbbrev: "DET",
    baseline: { gp: 82, g: 9, a: 40, pm: 18, pim: 62, toi: 24.0, shots: 155, hits: 140, blocks: 110, takeaways: 42, giveaways: 30, gwg: 2, otg: 0, ppg: 3, ppa: 15, shg: 0, sha: 2 },
    contract: { startYear: 2024, endYear: 2031, aav: 8.55, structure: "EVEN", signingType: "RFA", hasNTC: true, hasNMC: false, tradeProtection: "Modified NTC", signingAge: 23 } },
  { nhlApiId: 8474141, firstName: "Patrick", lastName: "Kane", position: "RW", shootsCatches: "L", birthDate: "1988-11-19", birthCity: "Buffalo", birthCountry: "USA", heightInches: 71, weightLbs: 177, teamAbbrev: "DET",
    baseline: { gp: 78, g: 18, a: 38, pm: 5, pim: 18, toi: 16.5, shots: 150, hits: 18, blocks: 12, takeaways: 30, giveaways: 32, gwg: 3, otg: 1, ppg: 6, ppa: 14, shg: 0, sha: 0 },
    contract: { startYear: 2025, endYear: 2026, aav: 3.0, structure: "FLAT", signingType: "UFA", hasNTC: false, hasNMC: false, signingAge: 37 } },
  { nhlApiId: 8477456, firstName: "J.T.", lastName: "Compher", position: "C", shootsCatches: "R", birthDate: "1995-04-08", birthCity: "Northbrook", birthCountry: "USA", heightInches: 72, weightLbs: 190, teamAbbrev: "DET",
    baseline: { gp: 76, g: 16, a: 22, pm: 5, pim: 32, toi: 16.5, shots: 140, hits: 80, blocks: 38, takeaways: 25, giveaways: 20, faceoffPct: 50.5, gwg: 3, otg: 1, ppg: 4, ppa: 6, shg: 1, sha: 1 },
    contract: { startYear: 2023, endYear: 2028, aav: 5.1, structure: "EVEN", signingType: "UFA", hasNTC: true, hasNMC: false, tradeProtection: "Modified NTC (10-team list)", signingAge: 28 } },
  { nhlApiId: 8477429, firstName: "Andrew", lastName: "Copp", position: "C", shootsCatches: "L", birthDate: "1994-07-08", birthCity: "Ann Arbor", birthCountry: "USA", heightInches: 73, weightLbs: 206, teamAbbrev: "DET",
    baseline: { gp: 72, g: 12, a: 20, pm: 4, pim: 30, toi: 17.0, shots: 125, hits: 72, blocks: 35, takeaways: 22, giveaways: 25, faceoffPct: 49.0, gwg: 2, otg: 0, ppg: 3, ppa: 6, shg: 0, sha: 1 },
    contract: { startYear: 2022, endYear: 2027, aav: 5.625, structure: "EVEN", signingType: "UFA", hasNTC: true, hasNMC: false, tradeProtection: "Modified NTC (12-team list)", signingAge: 28 } },
  { nhlApiId: 8479992, firstName: "Michael", lastName: "Rasmussen", position: "C", shootsCatches: "L", birthDate: "1999-04-17", birthCity: "Surrey", birthCountry: "CAN", heightInches: 78, weightLbs: 229, teamAbbrev: "DET",
    baseline: { gp: 78, g: 10, a: 14, pm: 1, pim: 62, toi: 14.0, shots: 105, hits: 95, blocks: 30, takeaways: 14, giveaways: 16, faceoffPct: 47.0, gwg: 2, otg: 0, ppg: 2, ppa: 3, shg: 0, sha: 0 },
    contract: { startYear: 2025, endYear: 2028, aav: 3.2, structure: "FLAT", signingType: "RFA", hasNTC: false, hasNMC: false, signingAge: 26 } },

  { nhlApiId: 8482762, firstName: "Simon", lastName: "Edvinsson", position: "D", shootsCatches: "L", birthDate: "2003-02-05", birthCity: "Lidkoping", birthCountry: "SWE", heightInches: 77, weightLbs: 209, teamAbbrev: "DET",
    baseline: { gp: 78, g: 6, a: 22, pm: 8, pim: 38, toi: 21.0, shots: 98, hits: 78, blocks: 82, takeaways: 25, giveaways: 20, gwg: 1, otg: 0, ppg: 2, ppa: 8, shg: 0, sha: 0 },
    contract: { startYear: 2023, endYear: 2026, aav: 0.894167, structure: "FLAT", signingType: "ELC", hasNTC: false, hasNMC: false, signingAge: 20 } },
  { nhlApiId: 8475279, firstName: "Ben", lastName: "Chiarot", position: "D", shootsCatches: "L", birthDate: "1991-05-09", birthCity: "Hamilton", birthCountry: "CAN", heightInches: 75, weightLbs: 234, teamAbbrev: "DET",
    baseline: { gp: 72, g: 3, a: 10, pm: -1, pim: 78, toi: 19.5, shots: 75, hits: 140, blocks: 105, takeaways: 12, giveaways: 16, gwg: 1, otg: 0, ppg: 0, ppa: 2, shg: 0, sha: 0 },
    contract: { startYear: 2022, endYear: 2026, aav: 4.75, structure: "EVEN", signingType: "UFA", hasNTC: true, hasNMC: false, tradeProtection: "Modified NTC (10-team list)", signingAge: 31 } },


  // ── Edmonton Oilers ──
  { nhlApiId: 8478402, firstName: "Connor", lastName: "McDavid", position: "C", shootsCatches: "L", birthDate: "1997-01-13", birthCity: "Richmond Hill", birthCountry: "CAN", heightInches: 73, weightLbs: 194, teamAbbrev: "EDM",
    baseline: { gp: 82, g: 50, a: 84, pm: 30, pim: 24, toi: 22.5, shots: 320, hits: 28, blocks: 15, takeaways: 72, giveaways: 48, faceoffPct: 51.5, gwg: 10, otg: 3, ppg: 15, ppa: 28, shg: 1, sha: 2 },
    contract: { startYear: 2026, endYear: 2028, aav: 12.5, structure: "FRONT_LOADED", signingType: "EXTENSION", hasNTC: true, hasNMC: true, tradeProtection: "Full NMC", signingAge: 28 } },
  { nhlApiId: 8477934, firstName: "Leon", lastName: "Draisaitl", position: "C", shootsCatches: "L", birthDate: "1995-10-27", birthCity: "Cologne", birthCountry: "DEU", heightInches: 74, weightLbs: 211, teamAbbrev: "EDM",
    baseline: { gp: 82, g: 42, a: 60, pm: 22, pim: 28, toi: 21.5, shots: 290, hits: 35, blocks: 18, takeaways: 45, giveaways: 35, faceoffPct: 52.0, gwg: 8, otg: 2, ppg: 14, ppa: 20, shg: 0, sha: 1 },
    contract: { startYear: 2025, endYear: 2033, aav: 14.0, structure: "FRONT_LOADED", signingType: "UFA", hasNTC: true, hasNMC: true, tradeProtection: "Full NMC", signingAge: 28 } },
  { nhlApiId: 8480803, firstName: "Evan", lastName: "Bouchard", position: "D", shootsCatches: "R", birthDate: "1999-10-20", birthCity: "Oakville", birthCountry: "CAN", heightInches: 74, weightLbs: 194, teamAbbrev: "EDM",
    baseline: { gp: 82, g: 15, a: 50, pm: 20, pim: 16, toi: 24.0, shots: 185, hits: 28, blocks: 52, takeaways: 30, giveaways: 24, gwg: 3, otg: 1, ppg: 6, ppa: 18, shg: 0, sha: 1 },
    contract: { startYear: 2025, endYear: 2029, aav: 10.5, structure: "EVEN", signingType: "RFA", hasNTC: false, hasNMC: true, tradeProtection: "NMC years 3-4", signingAge: 25 } },

  // ── Colorado Avalanche ──
  { nhlApiId: 8477492, firstName: "Nathan", lastName: "MacKinnon", position: "C", shootsCatches: "R", birthDate: "1995-09-01", birthCity: "Cole Harbour", birthCountry: "CAN", heightInches: 72, weightLbs: 200, teamAbbrev: "COL",
    baseline: { gp: 82, g: 42, a: 75, pm: 28, pim: 30, toi: 22.0, shots: 285, hits: 42, blocks: 20, takeaways: 58, giveaways: 38, faceoffPct: 48.5, gwg: 8, otg: 2, ppg: 12, ppa: 24, shg: 1, sha: 2 },
    contract: { startYear: 2023, endYear: 2031, aav: 12.6, structure: "EVEN", signingType: "EXTENSION", hasNTC: true, hasNMC: true, tradeProtection: "Full NMC", signingAge: 27 } },
  { nhlApiId: 8480069, firstName: "Cale", lastName: "Makar", position: "D", shootsCatches: "R", birthDate: "1998-10-30", birthCity: "Calgary", birthCountry: "CAN", heightInches: 71, weightLbs: 187, teamAbbrev: "COL",
    baseline: { gp: 82, g: 20, a: 55, pm: 28, pim: 16, toi: 25.5, shots: 235, hits: 38, blocks: 58, takeaways: 52, giveaways: 30, gwg: 4, otg: 2, ppg: 7, ppa: 20, shg: 0, sha: 1 },
    contract: { startYear: 2021, endYear: 2027, aav: 9.0, structure: "EVEN", signingType: "RFA", hasNTC: false, hasNMC: false, signingAge: 22 } },

  // ── Toronto Maple Leafs ──
  { nhlApiId: 8479318, firstName: "Auston", lastName: "Matthews", position: "C", shootsCatches: "L", birthDate: "1997-09-17", birthCity: "San Ramon", birthCountry: "USA", heightInches: 75, weightLbs: 208, teamAbbrev: "TOR",
    baseline: { gp: 82, g: 48, a: 38, pm: 22, pim: 20, toi: 21.5, shots: 330, hits: 30, blocks: 16, takeaways: 42, giveaways: 24, faceoffPct: 55.5, gwg: 10, otg: 3, ppg: 14, ppa: 12, shg: 0, sha: 0 },
    contract: { startYear: 2024, endYear: 2028, aav: 13.25, structure: "EVEN", signingType: "UFA", hasNTC: true, hasNMC: true, tradeProtection: "Full NMC", signingAge: 25 } },
  { nhlApiId: 8478483, firstName: "Mitch", lastName: "Marner", position: "RW", shootsCatches: "R", birthDate: "1997-05-16", birthCity: "Markham", birthCountry: "CAN", heightInches: 72, weightLbs: 175, teamAbbrev: "VGK",
    baseline: { gp: 82, g: 22, a: 58, pm: 15, pim: 14, toi: 20.0, shots: 195, hits: 22, blocks: 12, takeaways: 55, giveaways: 30, gwg: 4, otg: 1, ppg: 6, ppa: 20, shg: 0, sha: 1 },
    contract: { startYear: 2025, endYear: 2033, aav: 12.0, structure: "FRONT_LOADED", signingType: "UFA", hasNTC: true, hasNMC: true, tradeProtection: "Full NMC", signingAge: 28 } },

  // ── Carolina Hurricanes ──
  { nhlApiId: 8478420, firstName: "Mikko", lastName: "Rantanen", position: "RW", shootsCatches: "L", birthDate: "1996-10-29", birthCity: "Nousiainen", birthCountry: "FIN", heightInches: 76, weightLbs: 215, teamAbbrev: "DAL",
    baseline: { gp: 82, g: 38, a: 55, pm: 22, pim: 24, toi: 20.5, shots: 265, hits: 45, blocks: 24, takeaways: 40, giveaways: 28, gwg: 7, otg: 2, ppg: 12, ppa: 18, shg: 0, sha: 1 },
    contract: { startYear: 2025, endYear: 2033, aav: 12.0, structure: "EVEN", signingType: "UFA", hasNTC: true, hasNMC: true, tradeProtection: "Full NMC", signingAge: 28 } },
  { nhlApiId: 8480039, firstName: "Martin", lastName: "Necas", position: "C", shootsCatches: "R", birthDate: "1999-01-15", birthCity: "Nove Mesto na Morave", birthCountry: "CZE", heightInches: 73, weightLbs: 190, teamAbbrev: "COL",
    baseline: { gp: 82, g: 28, a: 48, pm: 16, pim: 20, toi: 19.0, shots: 212, hits: 25, blocks: 14, takeaways: 35, giveaways: 24, faceoffPct: 43.0, gwg: 5, otg: 2, ppg: 9, ppa: 16, shg: 0, sha: 0 },
    contract: { startYear: 2026, endYear: 2034, aav: 11.5, structure: "FRONT_LOADED", signingType: "EXTENSION", hasNTC: true, hasNMC: true, tradeProtection: "Full NMC (Yrs 1-7); 15-team NTC (Yr 8)", signingAge: 26 } },

  // ── Boston Bruins ──
  { nhlApiId: 8477956, firstName: "David", lastName: "Pastrnak", position: "RW", shootsCatches: "R", birthDate: "1996-05-25", birthCity: "Havirov", birthCountry: "CZE", heightInches: 72, weightLbs: 194, teamAbbrev: "BOS",
    baseline: { gp: 82, g: 42, a: 48, pm: 18, pim: 28, toi: 20.0, shots: 290, hits: 25, blocks: 12, takeaways: 30, giveaways: 24, gwg: 8, otg: 3, ppg: 14, ppa: 16, shg: 0, sha: 0 },
    contract: { startYear: 2023, endYear: 2031, aav: 11.25, structure: "EVEN", signingType: "EXTENSION", hasNTC: true, hasNMC: true, tradeProtection: "Full NMC", signingAge: 26 } },
  { nhlApiId: 8477496, firstName: "Elias", lastName: "Lindholm", position: "C", shootsCatches: "R", birthDate: "1994-12-02", birthCity: "Boden", birthCountry: "SWE", heightInches: 73, weightLbs: 197, teamAbbrev: "BOS",
    baseline: { gp: 82, g: 20, a: 28, pm: 12, pim: 16, toi: 19.0, shots: 180, hits: 38, blocks: 25, takeaways: 30, giveaways: 20, faceoffPct: 56.0, gwg: 4, otg: 1, ppg: 6, ppa: 8, shg: 0, sha: 1 },
    contract: { startYear: 2024, endYear: 2031, aav: 7.75, structure: "EVEN", signingType: "UFA", hasNTC: true, hasNMC: false, tradeProtection: "Modified NTC", signingAge: 29 } },
  { nhlApiId: 8479325, firstName: "Charlie", lastName: "McAvoy", position: "D", shootsCatches: "R", birthDate: "1997-12-21", birthCity: "Long Beach", birthCountry: "USA", heightInches: 73, weightLbs: 208, teamAbbrev: "BOS",
    baseline: { gp: 80, g: 10, a: 35, pm: 18, pim: 38, toi: 24.5, shots: 140, hits: 90, blocks: 98, takeaways: 30, giveaways: 24, gwg: 2, otg: 0, ppg: 4, ppa: 12, shg: 0, sha: 1 },
    contract: { startYear: 2022, endYear: 2030, aav: 9.5, structure: "EVEN", signingType: "EXTENSION", hasNTC: true, hasNMC: true, tradeProtection: "Full NMC", signingAge: 23 } },

  // ── New York Rangers ──
  { nhlApiId: 8476459, firstName: "Mika", lastName: "Zibanejad", position: "C", shootsCatches: "R", birthDate: "1993-04-18", birthCity: "Huddinge", birthCountry: "SWE", heightInches: 74, weightLbs: 223, teamAbbrev: "NYR",
    baseline: { gp: 78, g: 22, a: 30, pm: 8, pim: 28, toi: 19.5, shots: 210, hits: 35, blocks: 16, takeaways: 28, giveaways: 22, faceoffPct: 49.5, gwg: 4, otg: 1, ppg: 8, ppa: 10, shg: 0, sha: 0 },
    contract: { startYear: 2022, endYear: 2030, aav: 8.5, structure: "EVEN", signingType: "UFA", hasNTC: true, hasNMC: false, tradeProtection: "Modified NTC", signingAge: 29 } },

  // ── Vegas Golden Knights ──
  { nhlApiId: 8478403, firstName: "Jack", lastName: "Eichel", position: "C", shootsCatches: "R", birthDate: "1996-10-28", birthCity: "North Chelmsford", birthCountry: "USA", heightInches: 74, weightLbs: 207, teamAbbrev: "VGK",
    baseline: { gp: 82, g: 35, a: 55, pm: 22, pim: 22, toi: 21.5, shots: 270, hits: 30, blocks: 14, takeaways: 42, giveaways: 30, faceoffPct: 51.5, gwg: 7, otg: 2, ppg: 12, ppa: 20, shg: 0, sha: 1 },
    contract: { startYear: 2026, endYear: 2034, aav: 13.5, structure: "FRONT_LOADED", signingType: "EXTENSION", hasNTC: true, hasNMC: true, tradeProtection: "Full NMC", signingAge: 28 } },

  // ── Carolina Hurricanes (Ehlers signed as UFA Jul 2025) ──
  { nhlApiId: 8477940, firstName: "Nikolaj", lastName: "Ehlers", position: "LW", shootsCatches: "L", birthDate: "1996-02-14", birthCity: "Aalborg", birthCountry: "DNK", heightInches: 72, weightLbs: 172, teamAbbrev: "CAR",
    baseline: { gp: 78, g: 28, a: 33, pm: 10, pim: 14, toi: 18.0, shots: 215, hits: 20, blocks: 14, takeaways: 30, giveaways: 20, gwg: 5, otg: 2, ppg: 8, ppa: 10, shg: 0, sha: 0 },
    contract: { startYear: 2025, endYear: 2031, aav: 8.5, structure: "FRONT_LOADED", signingType: "UFA", hasNTC: true, hasNMC: true, tradeProtection: "NMC Yrs 1-2; NTC Yrs 3-4; 10-team no trade Yrs 5-6", signingAge: 29 } },

  // ── Ottawa Senators ──
  { nhlApiId: 8480801, firstName: "Brady", lastName: "Tkachuk", position: "LW", shootsCatches: "L", birthDate: "1999-09-16", birthCity: "Scottsdale", birthCountry: "USA", heightInches: 74, weightLbs: 215, teamAbbrev: "OTT",
    baseline: { gp: 82, g: 32, a: 28, pm: 8, pim: 110, toi: 19.5, shots: 248, hits: 125, blocks: 24, takeaways: 25, giveaways: 28, gwg: 6, otg: 2, ppg: 10, ppa: 8, shg: 0, sha: 0 },
    contract: { startYear: 2022, endYear: 2029, aav: 8.214, structure: "EVEN", signingType: "RFA", hasNTC: true, hasNMC: false, tradeProtection: "Modified NTC", signingAge: 22 } },
  { nhlApiId: 8482116, firstName: "Tim", lastName: "Stutzle", position: "C", shootsCatches: "L", birthDate: "2002-01-15", birthCity: "Viersen", birthCountry: "DEU", heightInches: 73, weightLbs: 192, teamAbbrev: "OTT",
    baseline: { gp: 82, g: 33, a: 48, pm: 15, pim: 24, toi: 19.5, shots: 235, hits: 30, blocks: 14, takeaways: 42, giveaways: 32, faceoffPct: 46.0, gwg: 6, otg: 2, ppg: 10, ppa: 16, shg: 0, sha: 0 },
    contract: { startYear: 2023, endYear: 2031, aav: 8.35, structure: "EVEN", signingType: "RFA", hasNTC: true, hasNMC: false, tradeProtection: "Modified NTC", signingAge: 21 } },

  // ── Anaheim Ducks ──
  { nhlApiId: 8481533, firstName: "Trevor", lastName: "Zegras", position: "C", shootsCatches: "L", birthDate: "2001-03-20", birthCity: "Bedford", birthCountry: "USA", heightInches: 72, weightLbs: 185, teamAbbrev: "ANA",
    baseline: { gp: 78, g: 20, a: 35, pm: 5, pim: 30, toi: 18.0, shots: 168, hits: 24, blocks: 10, takeaways: 30, giveaways: 28, faceoffPct: 43.0, gwg: 3, otg: 1, ppg: 6, ppa: 12, shg: 0, sha: 0 },
    contract: { startYear: 2024, endYear: 2027, aav: 5.75, structure: "FLAT", signingType: "RFA", hasNTC: false, hasNMC: false, signingAge: 23 } },

  // ── Vancouver Canucks ──
  { nhlApiId: 8478444, firstName: "Brock", lastName: "Boeser", position: "RW", shootsCatches: "R", birthDate: "1997-02-25", birthCity: "Burnsville", birthCountry: "USA", heightInches: 73, weightLbs: 208, teamAbbrev: "VAN",
    baseline: { gp: 78, g: 24, a: 28, pm: 10, pim: 16, toi: 17.5, shots: 200, hits: 24, blocks: 12, takeaways: 18, giveaways: 14, gwg: 4, otg: 1, ppg: 8, ppa: 10, shg: 0, sha: 0 },
    contract: { startYear: 2023, endYear: 2026, aav: 6.65, structure: "FLAT", signingType: "UFA", hasNTC: false, hasNMC: false, signingAge: 26 } },
  { nhlApiId: 8480800, firstName: "Quinn", lastName: "Hughes", position: "D", shootsCatches: "L", birthDate: "1999-10-14", birthCity: "Orlando", birthCountry: "USA", heightInches: 70, weightLbs: 170, teamAbbrev: "VAN",
    baseline: { gp: 82, g: 15, a: 55, pm: 22, pim: 18, toi: 25.0, shots: 168, hits: 28, blocks: 58, takeaways: 48, giveaways: 30, gwg: 3, otg: 1, ppg: 6, ppa: 22, shg: 0, sha: 0 },
    contract: { startYear: 2024, endYear: 2030, aav: 7.85, structure: "EVEN", signingType: "RFA", hasNTC: true, hasNMC: false, tradeProtection: "Modified NTC", signingAge: 24 } },

  // ── Buffalo Sabres ──
  { nhlApiId: 8479420, firstName: "Tage", lastName: "Thompson", position: "C", shootsCatches: "R", birthDate: "1997-10-30", birthCity: "Phoenix", birthCountry: "USA", heightInches: 79, weightLbs: 225, teamAbbrev: "BUF",
    baseline: { gp: 82, g: 35, a: 38, pm: 10, pim: 38, toi: 20.0, shots: 280, hits: 38, blocks: 16, takeaways: 25, giveaways: 20, faceoffPct: 49.0, gwg: 7, otg: 2, ppg: 12, ppa: 12, shg: 0, sha: 0 },
    contract: { startYear: 2023, endYear: 2030, aav: 7.142, structure: "EVEN", signingType: "EXTENSION", hasNTC: true, hasNMC: false, tradeProtection: "Modified NTC", signingAge: 25 } },
  { nhlApiId: 8480839, firstName: "Rasmus", lastName: "Dahlin", position: "D", shootsCatches: "L", birthDate: "2000-04-13", birthCity: "Lidkoping", birthCountry: "SWE", heightInches: 75, weightLbs: 207, teamAbbrev: "BUF",
    baseline: { gp: 82, g: 15, a: 48, pm: 18, pim: 24, toi: 25.0, shots: 190, hits: 42, blocks: 78, takeaways: 38, giveaways: 30, gwg: 3, otg: 1, ppg: 6, ppa: 18, shg: 0, sha: 1 },
    contract: { startYear: 2023, endYear: 2031, aav: 11.0, structure: "EVEN", signingType: "EXTENSION", hasNTC: true, hasNMC: true, tradeProtection: "Full NMC", signingAge: 23 } },

  // ── Chicago Blackhawks ──
  { nhlApiId: 8484144, firstName: "Connor", lastName: "Bedard", position: "C", shootsCatches: "R", birthDate: "2005-07-17", birthCity: "North Vancouver", birthCountry: "CAN", heightInches: 70, weightLbs: 185, teamAbbrev: "CHI",
    baseline: { gp: 82, g: 25, a: 40, pm: -5, pim: 18, toi: 19.0, shots: 210, hits: 15, blocks: 8, takeaways: 38, giveaways: 30, faceoffPct: 45.0, gwg: 5, otg: 1, ppg: 8, ppa: 14, shg: 0, sha: 0 },
    contract: { startYear: 2023, endYear: 2026, aav: 0.95, structure: "FLAT", signingType: "ELC", hasNTC: false, hasNMC: false, signingAge: 18 } },
  { nhlApiId: 8477495, firstName: "Seth", lastName: "Jones", position: "D", shootsCatches: "R", birthDate: "1994-10-03", birthCity: "Arlington", birthCountry: "USA", heightInches: 76, weightLbs: 210, teamAbbrev: "CHI",
    baseline: { gp: 78, g: 8, a: 25, pm: -3, pim: 30, toi: 24.5, shots: 135, hits: 78, blocks: 100, takeaways: 25, giveaways: 28, gwg: 2, otg: 0, ppg: 3, ppa: 10, shg: 0, sha: 0 },
    contract: { startYear: 2022, endYear: 2030, aav: 9.5, structure: "EVEN", signingType: "UFA", hasNTC: true, hasNMC: true, tradeProtection: "Full NMC", signingAge: 27 } },

  // ── Dallas Stars ──
  { nhlApiId: 8480027, firstName: "Jason", lastName: "Robertson", position: "LW", shootsCatches: "L", birthDate: "1999-07-22", birthCity: "Arcadia", birthCountry: "USA", heightInches: 75, weightLbs: 201, teamAbbrev: "DAL",
    baseline: { gp: 80, g: 32, a: 42, pm: 18, pim: 14, toi: 18.5, shots: 225, hits: 16, blocks: 10, takeaways: 30, giveaways: 16, gwg: 6, otg: 2, ppg: 10, ppa: 14, shg: 0, sha: 0 },
    contract: { startYear: 2023, endYear: 2027, aav: 7.75, structure: "FLAT", signingType: "RFA", hasNTC: true, hasNMC: false, tradeProtection: "Modified NTC", signingAge: 24 } },
  { nhlApiId: 8480036, firstName: "Miro", lastName: "Heiskanen", position: "D", shootsCatches: "L", birthDate: "1999-07-18", birthCity: "Espoo", birthCountry: "FIN", heightInches: 72, weightLbs: 190, teamAbbrev: "DAL",
    baseline: { gp: 82, g: 12, a: 42, pm: 20, pim: 14, toi: 24.5, shots: 155, hits: 35, blocks: 82, takeaways: 42, giveaways: 24, gwg: 2, otg: 0, ppg: 4, ppa: 15, shg: 0, sha: 1 },
    contract: { startYear: 2022, endYear: 2030, aav: 8.45, structure: "EVEN", signingType: "RFA", hasNTC: true, hasNMC: false, tradeProtection: "Modified NTC", signingAge: 22 } },

  // ── Washington Capitals ──
  { nhlApiId: 8471214, firstName: "Alex", lastName: "Ovechkin", position: "LW", shootsCatches: "R", birthDate: "1985-09-17", birthCity: "Moscow", birthCountry: "RUS", heightInches: 75, weightLbs: 236, teamAbbrev: "WSH",
    baseline: { gp: 72, g: 25, a: 18, pm: -2, pim: 42, toi: 17.5, shots: 230, hits: 55, blocks: 10, takeaways: 12, giveaways: 15, gwg: 5, otg: 1, ppg: 10, ppa: 6, shg: 0, sha: 0 },
    contract: { startYear: 2021, endYear: 2026, aav: 9.5, structure: "FRONT_LOADED", signingType: "UFA", hasNTC: true, hasNMC: true, tradeProtection: "NMC + Modified NTC (10-team list)", signingAge: 35 } },
  { nhlApiId: 8479345, firstName: "Jakob", lastName: "Chychrun", position: "D", shootsCatches: "L", birthDate: "1998-03-31", birthCity: "Boca Raton", birthCountry: "USA", heightInches: 74, weightLbs: 210, teamAbbrev: "WSH",
    baseline: { gp: 78, g: 12, a: 28, pm: 8, pim: 30, toi: 22.5, shots: 150, hits: 65, blocks: 78, takeaways: 22, giveaways: 20, gwg: 2, otg: 0, ppg: 4, ppa: 10, shg: 0, sha: 0 },
    contract: { startYear: 2023, endYear: 2027, aav: 4.6, structure: "FLAT", signingType: "RFA", hasNTC: false, hasNMC: false, signingAge: 25 } },

  // ── Nashville Predators ──
  { nhlApiId: 8476887, firstName: "Filip", lastName: "Forsberg", position: "LW", shootsCatches: "R", birthDate: "1994-08-13", birthCity: "Ostervala", birthCountry: "SWE", heightInches: 73, weightLbs: 205, teamAbbrev: "NSH",
    baseline: { gp: 78, g: 30, a: 32, pm: 10, pim: 32, toi: 18.5, shots: 232, hits: 30, blocks: 14, takeaways: 25, giveaways: 20, gwg: 6, otg: 2, ppg: 10, ppa: 10, shg: 0, sha: 0 },
    contract: { startYear: 2022, endYear: 2030, aav: 8.5, structure: "EVEN", signingType: "UFA", hasNTC: true, hasNMC: true, tradeProtection: "Full NMC", signingAge: 27 } },

  // ── Tampa Bay Lightning ──
  { nhlApiId: 8477404, firstName: "Jake", lastName: "Guentzel", position: "LW", shootsCatches: "L", birthDate: "1994-10-06", birthCity: "Woodbury", birthCountry: "USA", heightInches: 71, weightLbs: 178, teamAbbrev: "TBL",
    baseline: { gp: 82, g: 33, a: 42, pm: 18, pim: 16, toi: 19.0, shots: 245, hits: 25, blocks: 14, takeaways: 28, giveaways: 16, gwg: 6, otg: 2, ppg: 10, ppa: 14, shg: 0, sha: 0 },
    contract: { startYear: 2024, endYear: 2031, aav: 9.0, structure: "EVEN", signingType: "UFA", hasNTC: true, hasNMC: true, tradeProtection: "Full NMC", signingAge: 29 } },
  { nhlApiId: 8476453, firstName: "Nikita", lastName: "Kucherov", position: "RW", shootsCatches: "L", birthDate: "1993-06-17", birthCity: "Maykop", birthCountry: "RUS", heightInches: 71, weightLbs: 178, teamAbbrev: "TBL",
    baseline: { gp: 82, g: 38, a: 65, pm: 20, pim: 18, toi: 20.5, shots: 258, hits: 18, blocks: 10, takeaways: 35, giveaways: 25, gwg: 7, otg: 2, ppg: 14, ppa: 22, shg: 0, sha: 0 },
    contract: { startYear: 2022, endYear: 2030, aav: 9.5, structure: "EVEN", signingType: "EXTENSION", hasNTC: true, hasNMC: true, tradeProtection: "Full NMC", signingAge: 29 } },

  // ── Florida Panthers ──
  { nhlApiId: 8477933, firstName: "Sam", lastName: "Reinhart", position: "C", shootsCatches: "R", birthDate: "1995-11-06", birthCity: "West Vancouver", birthCountry: "CAN", heightInches: 73, weightLbs: 192, teamAbbrev: "FLA",
    baseline: { gp: 82, g: 38, a: 38, pm: 20, pim: 18, toi: 20.0, shots: 260, hits: 28, blocks: 14, takeaways: 25, giveaways: 16, faceoffPct: 53.0, gwg: 7, otg: 2, ppg: 12, ppa: 12, shg: 0, sha: 0 },
    contract: { startYear: 2024, endYear: 2032, aav: 8.68, structure: "EVEN", signingType: "UFA", hasNTC: true, hasNMC: true, tradeProtection: "Full NMC", signingAge: 28 } },
  { nhlApiId: 8479314, firstName: "Matthew", lastName: "Tkachuk", position: "LW", shootsCatches: "L", birthDate: "1997-12-11", birthCity: "Scottsdale", birthCountry: "USA", heightInches: 74, weightLbs: 210, teamAbbrev: "FLA",
    baseline: { gp: 82, g: 30, a: 45, pm: 18, pim: 85, toi: 20.0, shots: 218, hits: 68, blocks: 20, takeaways: 30, giveaways: 28, gwg: 6, otg: 2, ppg: 9, ppa: 14, shg: 0, sha: 0 },
    contract: { startYear: 2022, endYear: 2030, aav: 9.5, structure: "EVEN", signingType: "UFA", hasNTC: true, hasNMC: true, tradeProtection: "Full NMC", signingAge: 24 } },
  { nhlApiId: 8477493, firstName: "Aleksander", lastName: "Barkov", position: "C", shootsCatches: "L", birthDate: "1995-09-02", birthCity: "Tampere", birthCountry: "FIN", heightInches: 75, weightLbs: 213, teamAbbrev: "FLA",
    baseline: { gp: 78, g: 28, a: 42, pm: 22, pim: 14, toi: 20.5, shots: 195, hits: 32, blocks: 18, takeaways: 55, giveaways: 18, faceoffPct: 55.5, gwg: 5, otg: 1, ppg: 8, ppa: 14, shg: 1, sha: 1 },
    contract: { startYear: 2023, endYear: 2031, aav: 10.0, structure: "EVEN", signingType: "EXTENSION", hasNTC: true, hasNMC: true, tradeProtection: "Full NMC", signingAge: 27 } },

  // ── Minnesota Wild ──
  { nhlApiId: 8478864, firstName: "Kirill", lastName: "Kaprizov", position: "LW", shootsCatches: "L", birthDate: "1997-04-26", birthCity: "Novokuznetsk", birthCountry: "RUS", heightInches: 71, weightLbs: 201, teamAbbrev: "MIN",
    baseline: { gp: 82, g: 42, a: 55, pm: 22, pim: 22, toi: 20.5, shots: 288, hits: 30, blocks: 12, takeaways: 38, giveaways: 25, gwg: 8, otg: 3, ppg: 14, ppa: 18, shg: 0, sha: 0 },
    contract: { startYear: 2026, endYear: 2034, aav: 17.0, structure: "FRONT_LOADED", signingType: "EXTENSION", hasNTC: true, hasNMC: true, tradeProtection: "Full NMC", signingAge: 28 } },

  // ── New Jersey Devils ──
  { nhlApiId: 8479407, firstName: "Jesper", lastName: "Bratt", position: "LW", shootsCatches: "L", birthDate: "1998-07-30", birthCity: "Stockholm", birthCountry: "SWE", heightInches: 70, weightLbs: 177, teamAbbrev: "NJD",
    baseline: { gp: 82, g: 26, a: 48, pm: 15, pim: 16, toi: 18.5, shots: 200, hits: 20, blocks: 10, takeaways: 38, giveaways: 24, gwg: 5, otg: 2, ppg: 8, ppa: 16, shg: 0, sha: 0 },
    contract: { startYear: 2024, endYear: 2031, aav: 7.35, structure: "EVEN", signingType: "RFA", hasNTC: true, hasNMC: false, tradeProtection: "Modified NTC", signingAge: 25 } },
  { nhlApiId: 8481559, firstName: "Jack", lastName: "Hughes", position: "C", shootsCatches: "L", birthDate: "2001-05-14", birthCity: "Orlando", birthCountry: "USA", heightInches: 71, weightLbs: 170, teamAbbrev: "NJD",
    baseline: { gp: 82, g: 33, a: 52, pm: 18, pim: 24, toi: 20.0, shots: 238, hits: 20, blocks: 10, takeaways: 45, giveaways: 30, faceoffPct: 43.0, gwg: 6, otg: 2, ppg: 10, ppa: 18, shg: 0, sha: 0 },
    contract: { startYear: 2022, endYear: 2030, aav: 8.0, structure: "EVEN", signingType: "RFA", hasNTC: true, hasNMC: false, tradeProtection: "Modified NTC", signingAge: 20 } },
  { nhlApiId: 8480002, firstName: "Nico", lastName: "Hischier", position: "C", shootsCatches: "L", birthDate: "1999-01-04", birthCity: "Naters", birthCountry: "CHE", heightInches: 73, weightLbs: 176, teamAbbrev: "NJD",
    baseline: { gp: 80, g: 24, a: 34, pm: 12, pim: 18, toi: 19.0, shots: 185, hits: 35, blocks: 20, takeaways: 30, giveaways: 18, faceoffPct: 53.0, gwg: 4, otg: 1, ppg: 7, ppa: 10, shg: 0, sha: 1 },
    contract: { startYear: 2020, endYear: 2027, aav: 7.25, structure: "EVEN", signingType: "RFA", hasNTC: true, hasNMC: false, tradeProtection: "Modified NTC", signingAge: 21 } },

  // ── Pittsburgh Penguins ──
  { nhlApiId: 8471675, firstName: "Sidney", lastName: "Crosby", position: "C", shootsCatches: "L", birthDate: "1987-08-07", birthCity: "Cole Harbour", birthCountry: "CAN", heightInches: 71, weightLbs: 200, teamAbbrev: "PIT",
    baseline: { gp: 78, g: 28, a: 48, pm: 8, pim: 24, toi: 19.5, shots: 210, hits: 32, blocks: 15, takeaways: 42, giveaways: 22, faceoffPct: 54.5, gwg: 5, otg: 1, ppg: 8, ppa: 16, shg: 1, sha: 1 },
    contract: { startYear: 2025, endYear: 2027, aav: 8.7, structure: "FLAT", signingType: "EXTENSION", hasNTC: true, hasNMC: true, tradeProtection: "Full NMC", signingAge: 37 } },

  // ── St. Louis Blues ──
  { nhlApiId: 8480023, firstName: "Robert", lastName: "Thomas", position: "C", shootsCatches: "L", birthDate: "1999-07-02", birthCity: "Aurora", birthCountry: "CAN", heightInches: 72, weightLbs: 188, teamAbbrev: "STL",
    baseline: { gp: 82, g: 22, a: 50, pm: 8, pim: 16, toi: 18.5, shots: 168, hits: 18, blocks: 10, takeaways: 38, giveaways: 28, faceoffPct: 48.0, gwg: 4, otg: 1, ppg: 6, ppa: 18, shg: 0, sha: 0 },
    contract: { startYear: 2023, endYear: 2031, aav: 8.125, structure: "EVEN", signingType: "EXTENSION", hasNTC: true, hasNMC: false, tradeProtection: "Modified NTC", signingAge: 24 } },

  // ── San Jose Sharks ──
  { nhlApiId: 8484801, firstName: "Macklin", lastName: "Celebrini", position: "C", shootsCatches: "L", birthDate: "2005-06-13", birthCity: "Vancouver", birthCountry: "CAN", heightInches: 72, weightLbs: 190, teamAbbrev: "SJS",
    baseline: { gp: 78, g: 22, a: 30, pm: -8, pim: 18, toi: 18.0, shots: 190, hits: 20, blocks: 8, takeaways: 25, giveaways: 22, faceoffPct: 45.0, gwg: 4, otg: 1, ppg: 6, ppa: 10, shg: 0, sha: 0 },
    contract: { startYear: 2024, endYear: 2027, aav: 0.95, structure: "FLAT", signingType: "ELC", hasNTC: false, hasNMC: false, signingAge: 18 } },

  // ── Calgary Flames ──
  { nhlApiId: 8476456, firstName: "Jonathan", lastName: "Huberdeau", position: "LW", shootsCatches: "L", birthDate: "1993-06-04", birthCity: "Saint-Jerome", birthCountry: "CAN", heightInches: 73, weightLbs: 208, teamAbbrev: "CGY",
    baseline: { gp: 80, g: 18, a: 42, pm: -5, pim: 16, toi: 18.0, shots: 155, hits: 18, blocks: 8, takeaways: 22, giveaways: 25, gwg: 3, otg: 0, ppg: 5, ppa: 14, shg: 0, sha: 0 },
    contract: { startYear: 2022, endYear: 2030, aav: 10.5, structure: "EVEN", signingType: "UFA", hasNTC: true, hasNMC: true, tradeProtection: "Full NMC", signingAge: 29 } },

  // ── Columbus Blue Jackets ──
  { nhlApiId: 8484166, firstName: "Adam", lastName: "Fantilli", position: "C", shootsCatches: "L", birthDate: "2004-10-12", birthCity: "Nobleton", birthCountry: "CAN", heightInches: 74, weightLbs: 195, teamAbbrev: "CBJ",
    baseline: { gp: 78, g: 18, a: 25, pm: -5, pim: 24, toi: 16.5, shots: 155, hits: 35, blocks: 12, takeaways: 18, giveaways: 20, faceoffPct: 44.0, gwg: 3, otg: 1, ppg: 5, ppa: 8, shg: 0, sha: 0 },
    contract: { startYear: 2023, endYear: 2026, aav: 0.95, structure: "FLAT", signingType: "ELC", hasNTC: false, hasNMC: false, signingAge: 18 } },

  // ── Los Angeles Kings ──
  { nhlApiId: 8471685, firstName: "Anze", lastName: "Kopitar", position: "C", shootsCatches: "L", birthDate: "1987-08-24", birthCity: "Jesenice", birthCountry: "SVN", heightInches: 75, weightLbs: 225, teamAbbrev: "LAK",
    baseline: { gp: 80, g: 20, a: 45, pm: 12, pim: 14, toi: 19.5, shots: 158, hits: 20, blocks: 18, takeaways: 38, giveaways: 18, faceoffPct: 54.0, gwg: 4, otg: 1, ppg: 6, ppa: 14, shg: 0, sha: 1 },
    contract: { startYear: 2024, endYear: 2026, aav: 10.0, structure: "FLAT", signingType: "EXTENSION", hasNTC: true, hasNMC: true, tradeProtection: "Full NMC", signingAge: 36 } },

  // ── Montreal Canadiens ──
  { nhlApiId: 8481540, firstName: "Cole", lastName: "Caufield", position: "RW", shootsCatches: "L", birthDate: "2001-01-02", birthCity: "Stevens Point", birthCountry: "USA", heightInches: 68, weightLbs: 162, teamAbbrev: "MTL",
    baseline: { gp: 82, g: 30, a: 28, pm: -2, pim: 14, toi: 17.5, shots: 230, hits: 15, blocks: 8, takeaways: 18, giveaways: 15, gwg: 6, otg: 2, ppg: 10, ppa: 8, shg: 0, sha: 0 },
    contract: { startYear: 2023, endYear: 2031, aav: 7.85, structure: "EVEN", signingType: "RFA", hasNTC: true, hasNMC: false, tradeProtection: "Modified NTC", signingAge: 22 } },

  // ── New York Islanders ──
  { nhlApiId: 8478445, firstName: "Mathew", lastName: "Barzal", position: "C", shootsCatches: "L", birthDate: "1997-05-26", birthCity: "Coquitlam", birthCountry: "CAN", heightInches: 72, weightLbs: 187, teamAbbrev: "NYI",
    baseline: { gp: 78, g: 20, a: 45, pm: 5, pim: 20, toi: 20.0, shots: 175, hits: 22, blocks: 12, takeaways: 42, giveaways: 28, faceoffPct: 47.0, gwg: 4, otg: 1, ppg: 5, ppa: 14, shg: 0, sha: 0 },
    contract: { startYear: 2024, endYear: 2032, aav: 9.15, structure: "EVEN", signingType: "UFA", hasNTC: true, hasNMC: true, tradeProtection: "Full NMC", signingAge: 27 } },

  // ── Philadelphia Flyers ──
  { nhlApiId: 8484387, firstName: "Matvei", lastName: "Michkov", position: "RW", shootsCatches: "L", birthDate: "2005-12-09", birthCity: "Perm", birthCountry: "RUS", heightInches: 70, weightLbs: 172, teamAbbrev: "PHI",
    baseline: { gp: 78, g: 22, a: 28, pm: -5, pim: 20, toi: 17.0, shots: 185, hits: 12, blocks: 6, takeaways: 28, giveaways: 25, gwg: 4, otg: 1, ppg: 8, ppa: 10, shg: 0, sha: 0 },
    contract: { startYear: 2024, endYear: 2027, aav: 0.95, structure: "FLAT", signingType: "ELC", hasNTC: false, hasNMC: false, signingAge: 18 } },

  // ── Seattle Kraken ──
  { nhlApiId: 8482665, firstName: "Matty", lastName: "Beniers", position: "C", shootsCatches: "L", birthDate: "2002-11-05", birthCity: "Hingham", birthCountry: "USA", heightInches: 73, weightLbs: 185, teamAbbrev: "SEA",
    baseline: { gp: 80, g: 18, a: 28, pm: 2, pim: 14, toi: 17.5, shots: 155, hits: 22, blocks: 12, takeaways: 25, giveaways: 18, faceoffPct: 48.0, gwg: 3, otg: 1, ppg: 5, ppa: 8, shg: 0, sha: 0 },
    contract: { startYear: 2025, endYear: 2027, aav: 4.0, structure: "FLAT", signingType: "RFA", hasNTC: false, hasNMC: false, signingAge: 22 } },

  // ── Utah Hockey Club ──
  { nhlApiId: 8483431, firstName: "Logan", lastName: "Cooley", position: "C", shootsCatches: "L", birthDate: "2004-05-04", birthCity: "Pittsburgh", birthCountry: "USA", heightInches: 70, weightLbs: 174, teamAbbrev: "UTA",
    baseline: { gp: 80, g: 20, a: 30, pm: -2, pim: 16, toi: 17.0, shots: 168, hits: 18, blocks: 8, takeaways: 22, giveaways: 20, faceoffPct: 46.0, gwg: 4, otg: 1, ppg: 6, ppa: 10, shg: 0, sha: 0 },
    contract: { startYear: 2023, endYear: 2026, aav: 0.95, structure: "FLAT", signingType: "ELC", hasNTC: false, hasNMC: false, signingAge: 19 } },
];

// ──────────────────────────────────────────────
// Named Goalies (11 players)
// ──────────────────────────────────────────────

export const GOALIES: GoalieSeed[] = [
  // ── Detroit Red Wings ──
  { nhlApiId: 8476434, firstName: "John", lastName: "Gibson", shootsCatches: "L", birthDate: "1993-07-14", birthCity: "Pittsburgh", birthCountry: "USA", heightInches: 75, weightLbs: 220, teamAbbrev: "DET",
    baseline: { gp: 48, gs: 46, w: 22, l: 16, otl: 6, svPct: 0.910, gaa: 2.82, shotsAgainst: 1380, saves: 1256, shutouts: 2 },
    contract: { startYear: 2019, endYear: 2027, aav: 6.4, structure: "EVEN", signingType: "UFA", hasNTC: true, hasNMC: false, tradeProtection: "Modified NTC", signingAge: 25 } },
  { nhlApiId: 8475660, firstName: "Cam", lastName: "Talbot", shootsCatches: "L", birthDate: "1987-07-05", birthCity: "Caledonia", birthCountry: "CAN", heightInches: 76, weightLbs: 195, teamAbbrev: "DET",
    baseline: { gp: 35, gs: 33, w: 15, l: 13, otl: 4, svPct: 0.908, gaa: 2.95, shotsAgainst: 960, saves: 872, shutouts: 1 },
    contract: { startYear: 2025, endYear: 2026, aav: 2.5, structure: "FLAT", signingType: "UFA", hasNTC: false, hasNMC: false, signingAge: 38 } },

  // ── Winnipeg Jets ──
  { nhlApiId: 8476945, firstName: "Connor", lastName: "Hellebuyck", shootsCatches: "L", birthDate: "1993-05-19", birthCity: "Commerce", birthCountry: "USA", heightInches: 76, weightLbs: 207, teamAbbrev: "WPG",
    baseline: { gp: 62, gs: 60, w: 37, l: 16, otl: 6, svPct: 0.925, gaa: 2.25, shotsAgainst: 1810, saves: 1674, shutouts: 5 },
    contract: { startYear: 2024, endYear: 2032, aav: 8.5, structure: "EVEN", signingType: "UFA", hasNTC: true, hasNMC: true, tradeProtection: "Full NMC", signingAge: 30 } },

  // ── New York Rangers ──
  { nhlApiId: 8478048, firstName: "Igor", lastName: "Shesterkin", shootsCatches: "L", birthDate: "1995-12-30", birthCity: "Moscow", birthCountry: "RUS", heightInches: 73, weightLbs: 182, teamAbbrev: "NYR",
    baseline: { gp: 58, gs: 55, w: 33, l: 15, otl: 5, svPct: 0.920, gaa: 2.45, shotsAgainst: 1650, saves: 1518, shutouts: 3 },
    contract: { startYear: 2025, endYear: 2033, aav: 11.5, structure: "FRONT_LOADED", signingType: "UFA", hasNTC: true, hasNMC: true, tradeProtection: "Full NMC", signingAge: 29 } },

  // ── Boston Bruins ──
  { nhlApiId: 8480280, firstName: "Jeremy", lastName: "Swayman", shootsCatches: "L", birthDate: "1998-11-24", birthCity: "Anchorage", birthCountry: "USA", heightInches: 74, weightLbs: 197, teamAbbrev: "BOS",
    baseline: { gp: 55, gs: 52, w: 32, l: 15, otl: 5, svPct: 0.916, gaa: 2.55, shotsAgainst: 1530, saves: 1401, shutouts: 2 },
    contract: { startYear: 2024, endYear: 2032, aav: 8.25, structure: "EVEN", signingType: "RFA", hasNTC: true, hasNMC: false, tradeProtection: "Modified NTC", signingAge: 25 } },

  // ── Nashville Predators ──
  { nhlApiId: 8477424, firstName: "Juuse", lastName: "Saros", shootsCatches: "L", birthDate: "1995-04-19", birthCity: "Forssa", birthCountry: "FIN", heightInches: 71, weightLbs: 180, teamAbbrev: "NSH",
    baseline: { gp: 58, gs: 55, w: 28, l: 18, otl: 6, svPct: 0.918, gaa: 2.58, shotsAgainst: 1650, saves: 1515, shutouts: 3 },
    contract: { startYear: 2023, endYear: 2031, aav: 7.74, structure: "EVEN", signingType: "UFA", hasNTC: true, hasNMC: true, tradeProtection: "Full NMC", signingAge: 28 } },

  // ── New York Islanders ──
  { nhlApiId: 8478009, firstName: "Ilya", lastName: "Sorokin", shootsCatches: "L", birthDate: "1995-08-04", birthCity: "Mezhdurechensk", birthCountry: "RUS", heightInches: 75, weightLbs: 187, teamAbbrev: "NYI",
    baseline: { gp: 52, gs: 50, w: 25, l: 18, otl: 5, svPct: 0.915, gaa: 2.65, shotsAgainst: 1480, saves: 1354, shutouts: 2 },
    contract: { startYear: 2023, endYear: 2031, aav: 8.25, structure: "EVEN", signingType: "UFA", hasNTC: true, hasNMC: true, tradeProtection: "Full NMC", signingAge: 27 } },

  // ── Dallas Stars ──
  { nhlApiId: 8479979, firstName: "Jake", lastName: "Oettinger", shootsCatches: "L", birthDate: "1998-12-18", birthCity: "Lakeville", birthCountry: "USA", heightInches: 77, weightLbs: 220, teamAbbrev: "DAL",
    baseline: { gp: 55, gs: 53, w: 30, l: 15, otl: 6, svPct: 0.917, gaa: 2.48, shotsAgainst: 1550, saves: 1421, shutouts: 4 },
    contract: { startYear: 2024, endYear: 2032, aav: 8.0, structure: "EVEN", signingType: "RFA", hasNTC: true, hasNMC: false, tradeProtection: "Modified NTC", signingAge: 25 } },

  // ── Vancouver Canucks ──
  { nhlApiId: 8477967, firstName: "Thatcher", lastName: "Demko", shootsCatches: "L", birthDate: "1995-12-08", birthCity: "San Diego", birthCountry: "USA", heightInches: 76, weightLbs: 192, teamAbbrev: "VAN",
    baseline: { gp: 42, gs: 40, w: 22, l: 12, otl: 4, svPct: 0.914, gaa: 2.70, shotsAgainst: 1180, saves: 1079, shutouts: 2 },
    contract: { startYear: 2022, endYear: 2027, aav: 5.0, structure: "EVEN", signingType: "RFA", hasNTC: false, hasNMC: false, signingAge: 26 } },

  // ── Tampa Bay Lightning ──
  { nhlApiId: 8476883, firstName: "Andrei", lastName: "Vasilevskiy", shootsCatches: "L", birthDate: "1994-07-25", birthCity: "Tyumen", birthCountry: "RUS", heightInches: 75, weightLbs: 225, teamAbbrev: "TBL",
    baseline: { gp: 58, gs: 56, w: 30, l: 18, otl: 6, svPct: 0.912, gaa: 2.72, shotsAgainst: 1680, saves: 1532, shutouts: 3 },
    contract: { startYear: 2020, endYear: 2028, aav: 9.5, structure: "EVEN", signingType: "UFA", hasNTC: true, hasNMC: true, tradeProtection: "Full NMC", signingAge: 25 } },

  // ── Ottawa Senators ──
  { nhlApiId: 8476999, firstName: "Linus", lastName: "Ullmark", shootsCatches: "L", birthDate: "1993-07-27", birthCity: "Lugnvik", birthCountry: "SWE", heightInches: 76, weightLbs: 221, teamAbbrev: "OTT",
    baseline: { gp: 48, gs: 45, w: 23, l: 16, otl: 4, svPct: 0.911, gaa: 2.78, shotsAgainst: 1280, saves: 1166, shutouts: 2 },
    contract: { startYear: 2024, endYear: 2027, aav: 5.0, structure: "FLAT", signingType: "UFA", hasNTC: false, hasNMC: false, signingAge: 31 } },
];
