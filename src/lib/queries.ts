import { queryOptions } from "@tanstack/react-query";
import { getDashboard, getHistory, getMe, getStats } from "./league.functions";

export const dashboardQuery = queryOptions({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
export const meQuery = queryOptions({ queryKey: ["me"], queryFn: () => getMe() });
export const statsQuery = queryOptions({ queryKey: ["stats"], queryFn: () => getStats() });
export const historyQuery = queryOptions({ queryKey: ["history"], queryFn: () => getHistory() });
