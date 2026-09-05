export interface MentorDashboardRecentSession {
  id: string;
  aspirantDisplayName: string;
  /** CHAT | AUDIO_CALL — the requirements brief asks for session type on
   * the Recent Sessions row. */
  type: string;
  /** Always COMPLETED today (see `getDashboardStats` — the recent-sessions
   * query is scoped to completed sessions only), kept as a real field
   * rather than a hardcoded label so a future broadening of that query
   * doesn't silently start lying. */
  status: string;
  endedAt: Date | null;
  billedMinutes: number;
  earnedMinor: number;
}

export interface MentorDashboardStatsResponse {
  todaysSessionsCount: number;
  minutesConsultedToday: number;
  todaysEarningsMinor: number;
  weeklyEarningsMinor: number;
  monthlyEarningsMinor: number;
  totalSessionsCount: number;
  totalMinutesConsulted: number;
  rating: number | null;
  reviewCount: number;
  recentSessions: MentorDashboardRecentSession[];
}

export function toMentorDashboardStatsResponse(input: {
  todaysSessionsCount: number;
  minutesConsultedToday: number;
  todaysEarningsMinor: number;
  weeklyEarningsMinor: number;
  monthlyEarningsMinor: number;
  totalSessionsCount: number;
  totalMinutesConsulted: number;
  rating: { average: number | null; count: number } | undefined;
  recentSessions: MentorDashboardRecentSession[];
}): MentorDashboardStatsResponse {
  return {
    todaysSessionsCount: input.todaysSessionsCount,
    minutesConsultedToday: input.minutesConsultedToday,
    todaysEarningsMinor: input.todaysEarningsMinor,
    weeklyEarningsMinor: input.weeklyEarningsMinor,
    monthlyEarningsMinor: input.monthlyEarningsMinor,
    totalSessionsCount: input.totalSessionsCount,
    totalMinutesConsulted: input.totalMinutesConsulted,
    rating: input.rating?.average ?? null,
    reviewCount: input.rating?.count ?? 0,
    recentSessions: input.recentSessions,
  };
}
