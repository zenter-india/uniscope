/// Single source of truth for backend paths.
/// Verified against the NestJS source on branch `feature/cloud-infra-migration`
/// (no global prefix; base URL has no `/api/v1`).
class ApiEndpoints {
  ApiEndpoints._();

  // Auth
  static const otpRequest = '/auth/otp/request';
  static const otpVerify = '/auth/otp/verify';
  static const tokenRefresh = '/auth/token/refresh';
  static const logout = '/auth/logout';

  // Users
  static const me = '/users/me';
  static const meRole = '/users/me/role';
  static const mePushToken = '/users/me/push-token';

  // Universities — NOT implemented on the backend yet (controller deleted on this
  // branch → 404). Kept here so wiring is one-line once Hari re-implements it.
  static const universities = '/universities';
  static String universityDetail(String slug) => '/universities/$slug';
}
