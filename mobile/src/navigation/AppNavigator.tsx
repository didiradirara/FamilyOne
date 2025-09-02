import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/HomeScreen';
import AnnouncementsScreen from '../screens/AnnouncementsScreen';
import RequestsScreen from '../screens/RequestsScreen';
import ApprovalsScreen from '../screens/ApprovalsScreen';
import ReportsStack from './ReportsStack';
import MoreStack from './MoreStack';
import { Ionicons } from '@expo/vector-icons';
import { useRealtime } from '../realtime/RealtimeContext';
import { useAuth } from '../auth/AuthContext';

const Tab = createBottomTabNavigator();

export default function AppNavigator() {
  const { counters } = useRealtime();
  const { user } = useAuth();
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: true,
      tabBarIcon: ({ color, size }) => {
        const map: Record<string, any> = {
          Home: 'home',
          Requests: 'cube',
          Announcements: 'megaphone',
          Approvals: 'checkmark-done',
          Reports: 'document-text',
          More: 'ellipsis-horizontal',
        };
        return <Ionicons name={map[route.name] || 'ellipse'} size={size} color={color} />;
      },
    })}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: '홈' }} />
      <Tab.Screen name="Requests" component={RequestsScreen} options={{ title: '요청', tabBarBadge: counters.requests ? counters.requests : undefined }} />
      <Tab.Screen name="Announcements" component={AnnouncementsScreen} options={{ title: '공지', tabBarBadge: counters.announcements ? counters.announcements : undefined }} />
      {(user?.role === 'manager' || user?.role === 'admin') && (
        <Tab.Screen name="Approvals" component={ApprovalsScreen} options={{ title: '승인' }} />
      )}
      <Tab.Screen name="Reports" component={ReportsStack} options={{ headerShown: false, title: '보고', tabBarBadge: counters.reports ? counters.reports : undefined }} />
      <Tab.Screen
        name="More"
        component={MoreStack}
        options={{ headerShown: false, title: '더보기' }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            // Always reset nested stack to its root when pressing the More tab
            navigation.navigate('More', { screen: 'MoreHome' });
          },
        })}
      />
    </Tab.Navigator>
  );
}
