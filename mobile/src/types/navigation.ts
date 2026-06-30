import type { NavigatorScreenParams } from '@react-navigation/native';

// ─── Auth Stack ───────────────────────────────────────────────────────────────
export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  OTP: { phone: string; requestId: string };
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

// ─── Mentors Stack ────────────────────────────────────────────────────────────
export type MentorsStackParamList = {
  MentorList: undefined;
  MentorProfile: { mentorId: string };
};

// ─── Main Tab Navigator ───────────────────────────────────────────────────────
export type MainTabParamList = {
  Home: undefined;
  Colleges: NavigatorScreenParams<UniversityStackParamList>;
  Mentors: NavigatorScreenParams<MentorsStackParamList>;
  Chats: NavigatorScreenParams<MessagesStackParamList>;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};

// ─── Root Navigator ───────────────────────────────────────────────────────────
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  Admin: NavigatorScreenParams<AdminStackParamList>;
};
