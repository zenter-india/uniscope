import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AskQuestionScreen } from '../screens/qa/AskQuestionScreen';
import { QuestionDetailScreen } from '../screens/qa/QuestionDetailScreen';
import { QuestionFeedScreen } from '../screens/qa/QuestionFeedScreen';
import { colors } from '../constants/theme';
import type { QAStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<QAStackParamList>();

export function QANavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.primary,
        headerShadowVisible: false,
        
      }}
    >
      <Stack.Screen name="QuestionFeed" component={QuestionFeedScreen} options={{ title: 'Community Q&A' }} />
      <Stack.Screen name="QuestionDetail" component={QuestionDetailScreen} options={{ title: 'Question' }} />
      <Stack.Screen name="AskQuestion" component={AskQuestionScreen} options={{ title: 'Ask a Question' }} />
    </Stack.Navigator>
  );
}
