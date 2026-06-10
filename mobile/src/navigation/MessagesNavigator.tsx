import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ChatRoomScreen } from '../screens/messages/ChatRoomScreen';
import { ConversationListScreen } from '../screens/messages/ConversationListScreen';
import { colors } from '../constants/theme';
import type { MessagesStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<MessagesStackParamList>();

export function MessagesNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.primary,
        headerShadowVisible: false,
        
      }}
    >
      <Stack.Screen name="ConversationList" component={ConversationListScreen} options={{ title: 'Messages' }} />
      <Stack.Screen
        name="ChatRoom"
        component={ChatRoomScreen}
        options={({ route }) => ({ title: route.params.participantName })}
      />
    </Stack.Navigator>
  );
}
