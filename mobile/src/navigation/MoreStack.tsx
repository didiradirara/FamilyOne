import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MoreHomeScreen from '../screens/MoreHomeScreen';
import ReportScreen from '../screens/ReportScreen';
import ChecklistScreen from '../screens/ChecklistScreen';
import SuggestionsScreen from '../screens/SuggestionsScreen';
import LeaveScreen from '../screens/LeaveScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import OrgAdminScreen from '../screens/OrgAdminScreen';

export type MoreParamList = {
  MoreHome: undefined;
  Report: undefined;
  Checklist: undefined;
  Suggestions: undefined;
  Leave: undefined;
  Schedule: undefined;
  OrgAdmin: undefined;
};

const Stack = createNativeStackNavigator<MoreParamList>();

export default function MoreStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="MoreHome" component={MoreHomeScreen} options={{ title: '더보기' }} />
      <Stack.Screen name="Report" component={ReportScreen} options={{ title: '보고' }} />
      <Stack.Screen name="Checklist" component={ChecklistScreen} options={{ title: '체크리스트' }} />
      <Stack.Screen name="Suggestions" component={SuggestionsScreen} options={{ title: '제안함' }} />
      <Stack.Screen name="Leave" component={LeaveScreen} options={{ title: '휴가' }} />
      <Stack.Screen name="Schedule" component={ScheduleScreen} options={{ title: '일정' }} />
      <Stack.Screen name="OrgAdmin" component={OrgAdminScreen} options={{ title: '조직 관리' }} />
    </Stack.Navigator>
  );
}

