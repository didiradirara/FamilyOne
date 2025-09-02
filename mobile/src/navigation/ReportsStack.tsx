import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ReportsListScreen from '../screens/ReportsListScreen';
import ReportDetailScreen from '../screens/ReportDetailScreen';

export type ReportsParamList = {
  ReportsList: undefined;
  ReportDetail: { id: string };
};

const Stack = createNativeStackNavigator<ReportsParamList>();

export default function ReportsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ReportsList" component={ReportsListScreen} options={{ title: '보고 목록' }} />
      <Stack.Screen name="ReportDetail" component={ReportDetailScreen} options={{ title: '보고 상세' }} />
    </Stack.Navigator>
  );
}

