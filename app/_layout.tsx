import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
// notifications.ts (예: 앱 최상단에서 import해 한 번만 호출)


configureReanimatedLogger({
  level: ReanimatedLogLevel.error, // 경고는 숨기고 에러만
  strict: false,                   // 엄격 모드 OFF -> 해당 경고 사라짐
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    JejuGothic: require('../assets/fonts/JejuGothic.ttf')
  });

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }



  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}
