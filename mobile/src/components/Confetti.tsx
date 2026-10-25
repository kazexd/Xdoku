import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

/** 在棋盤內播放一次短暫彩紙，不攔截觸控，卸載時停止動畫。 */
export function Confetti() {
  const [progress] = useState(/** 為元件建立固定的動畫數值。 */ () => new Animated.Value(0));
  useEffect(/** 啟動一次過關彩紙動畫。 */ () => {
    const animation = Animated.timing(progress, { toValue: 1, duration: 950, easing: Easing.out(Easing.quad), useNativeDriver: true });
    animation.start();
    return /** 離開題目時停止動畫。 */ () => animation.stop();
  }, [progress]);
  return <View pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill}>{Array.from({ length: 18 }, /** 分散彩紙位置、顏色與旋轉方向。 */ (_, i) => <Animated.View key={i} style={{ position: 'absolute', left: `${5 + i * 5}%`, top: '8%', width: 7, height: 11, backgroundColor: ['#D99C43', '#6E9C77', '#CC6D83'][i % 3], opacity: progress.interpolate({ inputRange: [0, .7, 1], outputRange: [1, 1, 0] }), transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 160 + i % 4 * 30] }) }, { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${i % 2 ? 220 : -220}deg`] }) }] }} />)}</View>;
}
