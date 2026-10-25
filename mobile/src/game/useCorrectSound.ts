import { useEffect } from 'react';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { replayCorrectSound } from './sound';

/** 預載離線短音效，尊重靜音模式，並由 Expo hook 自動釋放播放器。 */
export function useCorrectSound() {
  const player = useAudioPlayer(require('../../assets/sounds/correct-cat.wav'));
  useEffect(/** 使用柔和音量並與其他 App 聲音混合，不開啟錄音或背景播放。 */ () => {
    // Expo AudioPlayer 是原生播放器控制物件，官方 API 以 volume setter 設定音量。
    // eslint-disable-next-line react-hooks/immutability
    player.volume = .55;
    void setAudioModeAsync({ playsInSilentMode: false, shouldPlayInBackground: false, interruptionMode: 'mixWithOthers' }).catch(/** 音訊設定失敗不影響解題。 */ () => {});
  }, [player]);
  return /** 僅由成功放貓的操作呼叫，不在載入進度時播放。 */ () => { void replayCorrectSound(player); };
}
