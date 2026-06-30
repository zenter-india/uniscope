/// Canonical role values — verified against the backend Prisma `UserRole` enum
/// (`backend/prisma/schema.prisma`). NOTE: the RN store omitted `MENTOR`; the
/// backend has it, so it is included here.
enum UserRole {
  prospectiveStudent('PROSPECTIVE_STUDENT'),
  currentStudent('CURRENT_STUDENT'),
  alumni('ALUMNI'),
  mentor('MENTOR'),
  admin('ADMIN');

  const UserRole(this.wire);

  /// The exact string the backend sends/expects.
  final String wire;

  static UserRole fromWire(String value) {
    return UserRole.values.firstWhere(
      (r) => r.wire == value,
      orElse: () => UserRole.prospectiveStudent,
    );
  }
}

class AuthUser {
  const AuthUser({
    required this.id,
    required this.role,
    required this.displayName,
  });

  final String id;
  final UserRole role;
  final String displayName;

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: json['id'] as String,
      role: UserRole.fromWire(json['role'] as String? ?? 'PROSPECTIVE_STUDENT'),
      displayName: (json['displayName'] as String?) ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'role': role.wire,
        'displayName': displayName,
      };

  AuthUser copyWith({String? displayName, UserRole? role}) => AuthUser(
        id: id,
        role: role ?? this.role,
        displayName: displayName ?? this.displayName,
      );
}
