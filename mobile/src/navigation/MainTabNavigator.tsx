import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Image, View, Text } from 'react-native';
import { HomeScreen } from '../screens/home/HomeScreen';
import { MessagesNavigator } from './MessagesNavigator';
import { ProfileNavigator } from './ProfileNavigator';
import { MentorsNavigator } from './MentorsNavigator';
import { UniversityNavigator } from './UniversityNavigator';
import { colors, fontSize } from '../constants/theme';
import type { MainTabParamList } from '../types/navigation';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS = {
  Home: require('../assets/icons/home.png'),
  Colleges: require('../assets/icons/hospital-alt.png'),
  Mentors: require('../assets/icons/man.png'),
  Chats: require('../assets/icons/chat.png'),
  Profile: require('../assets/icons/profile.png'),
};

export function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => (
          <View style={{ opacity: focused ? 1 : 0.6 }}>
            <Image
              source={ICONS[route.name as keyof typeof ICONS]}
              style={{
                width: 24,
                height: 24,
                tintColor: focused ? colors.primary : colors.text.muted,
              }}
            />
          </View>
        ),
        tabBarLabel: ({ focused }) => (
          <Text
            style={{
              fontSize: fontSize.xs,
              color: focused ? colors.primary : colors.text.muted,
              fontWeight: focused ? '600' : '400',
              marginTop: 4,
            }}
          >
            {route.name}
          </Text>
        ),
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 70,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text.muted,
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Colleges" component={UniversityNavigator} />
      <Tab.Screen name="Mentors" component={MentorsNavigator} />
      <Tab.Screen name="Chats" component={MessagesNavigator} />
      <Tab.Screen name="Profile" component={ProfileNavigator} />
    </Tab.Navigator>
  );
}
