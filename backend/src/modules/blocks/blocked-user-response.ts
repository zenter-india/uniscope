export interface BlockedUserResponse {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  blockedAt: Date;
}
