import { Stack } from 'expo-router';
/** 建立應用程式的根 Stack 導覽，隱藏預設頁首以使用遊戲自己的標題區。 */
export default function Layout() { return <Stack screenOptions={{ headerShown: false }} />; }
