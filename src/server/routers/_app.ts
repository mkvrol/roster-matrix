import { router } from "../trpc";
import { healthRouter } from "./health";
import { valueRouter } from "./value";
import { dashboardRouter } from "./dashboard";
import { playerRouter } from "./player";
import { tradeRouter } from "./trade";
import { leagueRouter } from "./league";
import { settingsRouter } from "./settings";
import { compareRouter } from "./compare";
import { watchlistRouter } from "./watchlist";
import { reportRouter } from "./report";
import { notificationRouter } from "./notification";
import { aiRouter } from "./ai";
import { teamRouter } from "./team";

export const appRouter = router({
  health: healthRouter,
  value: valueRouter,
  dashboard: dashboardRouter,
  player: playerRouter,
  trade: tradeRouter,
  league: leagueRouter,
  settings: settingsRouter,
  compare: compareRouter,
  watchlist: watchlistRouter,
  report: reportRouter,
  notification: notificationRouter,
  ai: aiRouter,
  team: teamRouter,
});

export type AppRouter = typeof appRouter;
