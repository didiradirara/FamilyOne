import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/HomeScreen';
import AnnouncementsScreen from '../screens/AnnouncementsScreen';
import RequestsScreen from '../screens/RequestsScreen';
import MoreStack from './MoreStack';
import { Ionicons } from '@expo/vector-icons';
import { useRealtime } from '../realtime/RealtimeContext';

const Tab = createBottomTabNavigator();

export default function AppNavigator() {
  const { counters } = useRealtime();
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: true,
      tabBarIcon: ({ color, size }) => {
        const map: Record<string, any> = {
          Home: 'home',
          Requests: 'cube',
          Announcements: 'megaphone',
          More: 'ellipsis-horizontal',
        };
        return <Ionicons name={map[route.name] || 'ellipse'} size={size} color={color} />;
      },
    })}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: '홈' }} />
      <Tab.Screen name="Requests" component={RequestsScreen} options={{ title: '요청', tabBarBadge: counters.requests ? counters.requests : undefined }} />
      <Tab.Screen name="Announcements" component={AnnouncementsScreen} options={{ title: '공지', tabBarBadge: counters.announcements ? counters.announcements : undefined }} />
      <Tab.Screen name="More" component={MoreStack} options={{ headerShown: false, title: '더보기' }} />
    </Tab.Navigator>
  );
}
