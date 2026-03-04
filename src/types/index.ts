export type HealthCheckResponse = {
  status: "ok" | "degraded" | "error";
  version: string;
  timestamp: string;
  uptime: number;
  checks: {
    database: {
      status: "ok" | "error";
      latencyMs: number;
    };
  };
  responseTimeMs: number;
};
