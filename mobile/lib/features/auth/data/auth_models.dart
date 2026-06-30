import '../domain/auth_user.dart';

/// `POST /auth/otp/request` → `{ serviceId }`.
/// (The RN client called this `requestId`; the backend field is `serviceId`.)
class OtpRequestResponse {
  const OtpRequestResponse({required this.serviceId});

  final String serviceId;

  factory OtpRequestResponse.fromJson(Map<String, dynamic> json) =>
      OtpRequestResponse(serviceId: json['serviceId'] as String);
}

/// `POST /auth/otp/verify` →
/// `{ accessToken, refreshToken, user: { id, role, displayName, isNewUser } }`.
class VerifyOtpResponse {
  const VerifyOtpResponse({
    required this.accessToken,
    required this.refreshToken,
    required this.user,
    required this.isNewUser,
  });

  final String accessToken;
  final String refreshToken;
  final AuthUser user;
  final bool isNewUser;

  factory VerifyOtpResponse.fromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>;
    return VerifyOtpResponse(
      accessToken: json['accessToken'] as String,
      refreshToken: json['refreshToken'] as String,
      isNewUser: (user['isNewUser'] as bool?) ?? false,
      user: AuthUser.fromJson(user),
    );
  }
}
