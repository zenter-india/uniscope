import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, radius, spacing } from '../../constants/theme';
import type { MessagesStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<MessagesStackParamList, 'ChatRoom'>;

type Message = { id: string; text: string; isMine: boolean; time: string };

const INITIAL_MESSAGES: Message[] = [
  { id: '1', text: 'Hi! I saw you\'re a 3rd year student at AIIMS Delhi. Can I ask about clinical rotations?', isMine: true, time: '10:30' },
  { id: '2', text: 'Of course! Happy to help. What would you like to know?', isMine: false, time: '10:32' },
  { id: '3', text: 'How many hours a week are spent in OPD / clinical in 3rd year?', isMine: true, time: '10:33' },
  { id: '4', text: 'Yes, the clinical rotations start from 3rd year. You spend around 4-5 hours daily in OPD across different departments.', isMine: false, time: '10:35' },
];

export function ChatRoomScreen({ route }: Props) {
  const { participantName } = route.params;
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList>(null);

  const send = () => {
    if (!input.trim()) return;
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        text: input.trim(),
        isMine: true,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setInput('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        {/* Participant info banner */}
        <View style={styles.participantBanner}>
          <View style={styles.participantDot} />
          <Text style={styles.participantLabel}>{participantName}</Text>
          <Text style={styles.participantNote}>Identity anonymous · verified</Text>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
              <Text style={[styles.bubbleText, item.isMine && styles.bubbleTextMine]}>
                {item.text}
              </Text>
              <Text style={[styles.bubbleTime, item.isMine && styles.bubbleTimeMine]}>
                {item.time}
              </Text>
            </View>
          )}
          onContentSizeChange={() => listRef.current?.scrollToEnd()}
        />

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={colors.text.muted}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendButton, !input.trim() && styles.sendDisabled]}
            onPress={send}
            disabled={!input.trim()}
          >
            <Text style={styles.sendIcon}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  participantBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  participantDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.status.success,
  },
  participantLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.primaryDark },
  participantNote: { fontSize: fontSize.xs, color: colors.primary },
  messageList: { padding: spacing.md, gap: spacing.sm },
  bubble: {
    maxWidth: '78%',
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderBottomRightRadius: radius.sm,
  },
  bubbleTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: radius.sm,
  },
  bubbleText: { fontSize: fontSize.md, color: colors.text.primary, lineHeight: 22 },
  bubbleTextMine: { color: colors.text.inverse },
  bubbleTime: { fontSize: fontSize.xs, color: colors.text.muted, alignSelf: 'flex-end' },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.7)' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text.primary,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { backgroundColor: colors.border },
  sendIcon: { color: colors.text.inverse, fontSize: 18 },
});
