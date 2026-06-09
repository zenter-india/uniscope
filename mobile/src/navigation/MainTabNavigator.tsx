import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { ReviewFeedScreen } from '../screens/reviews/ReviewFeedScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { MessagesNavigator } from './MessagesNavigator';
import { ProfileNavigator } from './ProfileNavigator';
import { QANavigator } from './QANavigator';
import { UniversityNavigator } from './UniversityNavigator';
import { colors, fontSize } from '../constants/theme';
import type { MainTabParamList } from '../types/navigation';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<keyof MainTabParamList, string> = {
  Home: '🏠',
  Universities: '🏥',
  QA: '❓',
  Reviews: '⭐',
  Messages: '💬',
  Notifications: '🔔',
  Profile: '👤',
};

export function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>
            {TAB_ICONS[route.name]}
          </Text>
        ),
        tabBarLabel: ({ focused, children }) => (
          <Text
            style={{
              fontSize: fontSize.xs,
              color: focused ? colors.primary : colors.text.muted,
              fontWeight: focused ? '600' : '400',
            }}
          >
            {children}
          </Text>
        ),
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 60,
          paddingBottom: 6,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text.muted,
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Universities" component={UniversityNavigator} />
      <Tab.Screen name="QA" component={QANavigator} options={{ title: 'Q&A' }} />
      <Tab.Screen name="Reviews" component={ReviewFeedScreen} />
      <Tab.Screen name="Messages" component={MessagesNavigator} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Profile" component={ProfileNavigator} />
    </Tab.Navigator>
  );
}
