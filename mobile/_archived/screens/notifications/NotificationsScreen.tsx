import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, radius, spacing } from '../../constants/theme';

const PLACEHOLDER_NOTIFS = [
  { id: '1', icon: '💬', title: 'New answer on your question', body: 'A Verified 3rd Year Student answered your question about AIIMS Delhi.', time: '5m ago', read: false },
  { id: '2', icon: '✓', title: 'Verification approved', body: 'Your identity has been verified. You can now answer questions and chat.', time: '1h ago', read: false },
  { id: '3', icon: '👍', title: 'Your answer was upvoted', body: '3 people found your answer about CMC Vellore helpful.', time: '3h ago', read: true },
];

export function NotificationsScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={PLACEHOLDER_NOTIFS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.row, !item.read && styles.rowUnread]}>
            <View style={styles.iconWrap}>
              <Text style={styles.icon}>{item.icon}</Text>
            </View>
            <View style={styles.content}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
              <Text style={styles.time}>{item.time}</Text>
            </View>
            {!item.read && <View style={styles.dot} />}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>No notifications yet</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  rowUnread: { backgroundColor: colors.primaryLight },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 18 },
  content: { flex: 1, gap: spacing.xs },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text.primary },
  body: { fontSize: fontSize.sm, color: colors.text.secondary, lineHeight: 20 },
  time: { fontSize: fontSize.xs, color: colors.text.muted },
  dot: { width: 8, height: 8, borderRadius: radius.full, backgroundColor: colors.primary, marginTop: 6 },
  empty: { padding: spacing.xxl, alignItems: 'center', gap: spacing.md },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text.secondary },
});
