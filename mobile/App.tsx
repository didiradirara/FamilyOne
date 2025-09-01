import 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { RealtimeProvider } from './src/realtime/RealtimeContext';
import AuthScreen from './src/screens/AuthScreen';
import AppNavigator from './src/navigation/AppNavigator';

function Root() {
  const { token } = useAuth();
  return (
    <View style={{ flex: 1 }}>
      {token ? (
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      ) : (
        <AuthScreen />
      )}
      <StatusBar style="auto" />
    </View>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <RealtimeProvider>
        <Root />
      </RealtimeProvider>
    </AuthProvider>
  );
}
