import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persists the JWT access/refresh tokens in the platform secure store
/// (Keychain on iOS, EncryptedSharedPreferences on Android).
///
/// Replaces the RN AsyncStorage-backed Zustand `persist` for tokens —
/// tokens are sensitive and must NOT live in plain SharedPreferences.
class SecureTokenStorage {
  SecureTokenStorage([FlutterSecureStorage? storage])
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
            );

  final FlutterSecureStorage _storage;

  static const _kAccessToken = 'access_token';
  static const _kRefreshToken = 'refresh_token';
  static const _kUser = 'auth_user';

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await _storage.write(key: _kAccessToken, value: accessToken);
    await _storage.write(key: _kRefreshToken, value: refreshToken);
  }

  Future<String?> readAccessToken() => _storage.read(key: _kAccessToken);

  Future<String?> readRefreshToken() => _storage.read(key: _kRefreshToken);

  /// Stores the serialized [AuthUser] JSON (the RN store persisted the user too).
  Future<void> saveUser(String userJson) =>
      _storage.write(key: _kUser, value: userJson);

  Future<String?> readUser() => _storage.read(key: _kUser);

  Future<void> clear() async {
    await _storage.delete(key: _kAccessToken);
    await _storage.delete(key: _kRefreshToken);
    await _storage.delete(key: _kUser);
  }
}
