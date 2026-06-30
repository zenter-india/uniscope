import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'storage/secure_token_storage.dart';

/// Core, app-wide singletons shared across features.
final secureTokenStorageProvider = Provider<SecureTokenStorage>((ref) {
  return SecureTokenStorage();
});
