import type { NavigatorScreenParams } from '@react-navigation/native';

// ─── Auth Stack ───────────────────────────────────────────────────────────────
export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  OTP: { phone: string; serviceId: string };
  RoleSelection: undefined;
  ProfileSetup: undefined;
};

// ─── University Stack (inside Universities tab) ───────────────────────────────
export type UniversityStackParamList = {
  UniversityList: undefined;
  UniversityDetail: { universityId: string; universityName: string };
  UniversityReviews: { universityId: string };
  UniversityQuestions: { universityId: string };
  UniversityStudents: { universityId: string };
  UniversityAlumni: { universityId: string };
};

// ─── Q&A Stack ────────────────────────────────────────────────────────────────
export type QAStackParamList = {
  QuestionFeed: undefined;
  QuestionDetail: { questionId: string };
  AskQuestion: { universityId?: string };
};

// ─── Reviews Stack ────────────────────────────────────────────────────────────
export type ReviewsStackParamList = {
  ReviewFeed: undefined;
  WriteReview: { universityId: string; universityName: string };
};

// ─── Messages Stack ───────────────────────────────────────────────────────────
export type MessagesStackParamList = {
  ConversationList: undefined;
  ChatRoom: { roomId: string; participantName: string };
};

// ─── Profile Stack ────────────────────────────────────────────────────────────
export type ProfileStackParamList = {
  ProfileHome: undefined;
  Verification: undefined;
  EditProfile: undefined;
  Settings: undefined;
};

// ─── Admin Stack ──────────────────────────────────────────────────────────────
export type AdminStackParamList = {
  AdminDashboard: undefined;
  AdminVerificationQueue: undefined;
  AdminVerificationDetail: { requestId: string };
  AdminModerationQueue: undefined;
  AdminUserList: undefined;
  AdminUserDetail: { userId: string };
  AdminUniversities: undefined;
};

// ─── Main Tab Navigator ───────────────────────────────────────────────────────
export type MainTabParamList = {
  Home: undefined;
  Universities: NavigatorScreenParams<UniversityStackParamList>;
  QA: NavigatorScreenParams<QAStackParamList>;
  Reviews: NavigatorScreenParams<ReviewsStackParamList>;
  Messages: NavigatorScreenParams<MessagesStackParamList>;
  Notifications: undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};

// ─── Root Navigator ───────────────────────────────────────────────────────────
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  Admin: NavigatorScreenParams<AdminStackParamList>;
};
