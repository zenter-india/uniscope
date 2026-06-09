import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, radius, spacing } from '../../constants/theme';
import type { MessagesStackParamList } from '../../types/navigation';

type Nav = NativeStackNavigationProp<MessagesStackParamList, 'ConversationList'>;

const PLACEHOLDER_CONVERSATIONS = [
  { id: 'r1', name: 'Verified 3rd Year Student', university: 'AIIMS New Delhi', lastMessage: 'Yes, the clinical rotations start from 3rd year.', unread: 2, time: '2m' },
  { id: 'r2', name: 'Verified Alumni', university: 'CMC Vellore', lastMessage: 'Happy to help! What would you like to know?', unread: 0, time: '1h' },
];

export function ConversationListScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={PLACEHOLDER_CONVERSATIONS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptyDesc}>
              Find a verified mentor on a university page and start a conversation.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('ChatRoom', { roomId: item.id, participantName: item.name })}
            activeOpacity={0.8}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item.university === 'AIIMS New Delhi' ? '🏥' : '🎓'}
              </Text>
            </View>
            <View style={styles.info}>
              <View style={styles.infoTop}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.time}>{item.time}</Text>
              </View>
              <Text style={styles.university}>{item.university}</Text>
              <Text style={styles.lastMessage} numberOfLines={1}>{item.lastMessage}</Text>
            </View>
            {item.unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{item.unread}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 22 },
  info: { flex: 1, gap: 2 },
  infoTop: { flexDirection: 'row', justifyContent: 'space-between' },
  name: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text.primary },
  time: { fontSize: fontSize.xs, color: colors.text.muted },
  university: { fontSize: fontSize.xs, color: colors.primary },
  lastMessage: { fontSize: fontSize.sm, color: colors.text.secondary },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  unreadText: { fontSize: fontSize.xs, color: colors.text.inverse, fontWeight: fontWeight.bold },
  empty: { padding: spacing.xxl, alignItems: 'center', gap: spacing.md },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text.primary },
  emptyDesc: { fontSize: fontSize.md, color: colors.text.secondary, textAlign: 'center', lineHeight: 24 },
});
