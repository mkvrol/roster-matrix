export interface TourStep {
  id: string;
  title: string;
  body: string;
  selector: string;
  placement?: "top" | "bottom" | "left" | "right";
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to Roster Matrix",
    body: "This is your command center for NHL contract analytics. Let's walk through the key features.",
    selector: '[data-tour="dashboard-header"]',
    placement: "bottom",
  },
  {
    id: "value-score",
    title: "Value Score System",
    body: "Every player gets a 0–99 Value Score measuring contract efficiency. Green = great value, red = overpaid. Scores factor in production, age curve, positional benchmarks, and cap hit.",
    selector: '[data-tour="value-leaders"]',
    placement: "left",
  },
  {
    id: "nav-contracts",
    title: "Contract Explorer",
    body: "Dive into every active NHL contract. Filter by position, team, AAV, term, and value score. The Goalie Market tab has dedicated goalie analytics.",
    selector: '[data-tour="nav-contracts"]',
    placement: "right",
  },
  {
    id: "nav-trade",
    title: "Trade Analyzer",
    body: "Model trade scenarios with instant cap impact analysis. Add players from any team, see value differentials, and get AI-powered trade suggestions.",
    selector: '[data-tour="nav-trade"]',
    placement: "right",
  },
  {
    id: "nav-watchlist",
    title: "Watch Lists & Alerts",
    body: "Track players you're interested in. Create custom lists, monitor value score changes, and get notified when deals shift.",
    selector: '[data-tour="nav-watchlist"]',
    placement: "right",
  },
];

export const TOUR_STORAGE_KEY = "ci:tour:dismissed:v1";
