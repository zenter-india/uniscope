export interface MentorDashboardRecentSession {
  id: string;
  aspirantDisplayName: string;
  endedAt: Date | null;
  billedMinutes: number;
  earnedMinor: number;
}

export interface MentorDashboardStatsResponse {
  todaysSessionsCount: number;
  minutesConsultedToday: number;
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
    weeklyEarningsMinor: input.weeklyEarningsMinor,
    monthlyEarningsMinor: input.monthlyEarningsMinor,
    totalSessionsCount: input.totalSessionsCount,
    totalMinutesConsulted: input.totalMinutesConsulted,
    rating: input.rating?.average ?? null,
    reviewCount: input.rating?.count ?? 0,
    recentSessions: input.recentSessions,
  };
}
