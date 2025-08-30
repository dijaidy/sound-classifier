import { Tabs } from 'expo-router';
import React, { createContext, useEffect, useRef, useState } from 'react';

import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import * as FileSystem from 'expo-file-system';

import { SheetRefContext } from '@/components/bottomSheetModalRef';
import { WifiContext } from '@/components/wifiContext';
import { BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import * as Notifications from "expo-notifications";
import { get, getDatabase, ref, update } from 'firebase/database';
import { Text, TouchableOpacity, View } from 'react-native';
import BackArrow from '../../components/ui/backArrow.svg';
import ForwardArrow from '../../components/ui/forwardArrow.svg';
import Play from '../../components/ui/play.svg';
import SettingIcon from '../../components/ui/settingIcon.svg';
import SettingIconSelected from '../../components/ui/settingIconSelected.svg';
import SoundIcon from '../../components/ui/soundIcon.svg';
import SoundIconSelected from '../../components/ui/soundIconSelected.svg';
import Stop from '../../components/ui/stop.svg';
import WifiIcon from '../../components/ui/wifiIcon.svg';
import WifiIconSelected from '../../components/ui/wifiIconSelected.svg';

export async function clearEventFromAlarmSystem(wifi: string, eventId: string): Promise<void> {
  const db = getDatabase();
  const base = `users/${wifi}/alarm_system`;
  const queueRef = ref(db, `${base}/alarm_queue`);
  const curRef = ref(db, `${base}/current_alarm`);

  // 현재 상태 읽기
  const [qSnap, curSnap] = await Promise.all([get(queueRef), get(curRef)]);

  const updates: Record<string, unknown> = {};
  let removedFromQueue = false;
  let removedCurrent = false;

  // alarm_queue에서 eventId 키 제거
  if (qSnap.exists()) {
    const qVal = qSnap.val() as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(qVal, eventId)) {
      updates[`${base}/alarm_queue/${eventId}`] = null;
      removedFromQueue = true;
    }
  }

  // current_alarm이 해당 eventId라면 제거
  if (curSnap.exists()) {
    const curVal = curSnap.val() as { event_id?: string };
    if (String(curVal?.event_id ?? "") === eventId) {
      updates[`${base}/current_alarm`] = null;
      removedCurrent = true;
    }
  }

  if (Object.keys(updates).length === 0) {
    console.log(`[alarm] no matching eventId=${eventId} in queue/current_alarm`);
    return;
  }

  // current_alarm을 지우고, 큐도 비게 될 경우 is_alarming=false
  if (removedCurrent) {
    const qCount = qSnap.exists() ? Object.keys(qSnap.val() as object).length : 0;
    const qRemaining = removedFromQueue ? qCount - 1 : qCount;
    if (qRemaining <= 0) {
      updates[`${base}/is_alarming`] = false;
    }
  }

  await update(ref(db), updates);
  console.log(`[alarm] removed eventId=${eventId} from alarm_queue/current_alarm`);
}

/**
 * 알림 응답(탭/버튼) 리스너 부착
 * 서버에서 push 보낼 때 data에 { wifi, eventId } 포함되어 있어야 함
 */
export function attachNotificationResponseHandler(): void {
  // (선택) 버튼 카테고리
  Notifications.setNotificationCategoryAsync("EVENT_ACTIONS", [
    { identifier: "approve", buttonTitle: "확인" },
    { identifier: "dismiss", buttonTitle: "무시", options: { isDestructive: true } },
  ]);

  // 탭/버튼 응답 리스너
  Notifications.addNotificationResponseReceivedListener(async (res) => {
    const data = res.notification.request.content.data as { wifi?: string; eventId?: string; event_id?: string };
    const wifi = data?.wifi;
    // eventId 혹은 event_id 둘 다 대응
    const eventId = data?.eventId ?? data?.event_id;
    if (!wifi || !eventId) return;
    await clearEventFromAlarmSystem(wifi, eventId);
  });

  // 냉시작 처리
  (async () => {
    const last = await Notifications.getLastNotificationResponseAsync();
    if (last) {
      const data = last.notification.request.content.data as { wifi?: string; eventId?: string; event_id?: string };
      const wifi = data?.wifi;
      const eventId = data?.eventId ?? data?.event_id;
      if (wifi && eventId) await clearEventFromAlarmSystem(wifi, eventId);
    }
  })();
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const snapPoints = ['28%'];
  const [audioPlay, setAudioPlay] = useState<Boolean>(false);
  const [audioOrder, setAudioOrder] = useState<number>(0);
  const [localAudioArr, setLocalAudioArr] = useState<string[]>([]);
  const [confirmedWifi, setConfirmedWifi] = useState<string>('');
  const [eventNameArr, setEventNameArr] = useState<string[]>(['현관벨', '화재경보', '유리 깨짐', '울음', '비명', '사이렌', '개 짖는 소리', '총 소리']);
  

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const player = useAudioPlayer();  
  const status = useAudioPlayerStatus(player);

  const prepareAudioPlay = async () => {
      try {
        
        player.volume = 1;
      } catch (e) {
        console.warn('audio mode 설정 실패:', e);
      }
    };

  const record = async () => {
    await setAudioModeAsync({
      playsInSilentMode: true,   // 무음 스위치여도 재생
      allowsRecording: true,    // 재생 시에는 녹음 비활성
    });
    await audioRecorder.prepareToRecordAsync();
    audioRecorder.record();
  };

  const stopRecording = async () => {
    // The recording will be available on `audioRecorder.uri`.
    await audioRecorder.stop();
    const tempUri = audioRecorder.uri; // expo-audio가 제공
    if (!tempUri) throw new Error('녹음 파일 경로를 찾을 수 없습니다.');
    const temp = tempUri.split('/')
    temp.pop();
    const uri = temp.join('/')+`/${Date.now()}.wav`;

    await FileSystem.copyAsync({ from: tempUri, to: uri });
    setAudioOrder(localAudioArr.length)
    setLocalAudioArr((prev)=>{
      const temp = [...prev]
      temp.push(uri);
      return temp
    })
    /*
    const res = await fetch(uri);
    const blob = await res.blob();
    const fileRef = sRef(storage, 'storagePath');

    const snapshot = await uploadBytes(fileRef, blob, { contentType: 'audio/m4a' });
    const downloadURL = await getDownloadURL(snapshot.ref);*/
  };

    useEffect(()=>{
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        console.warn("알림 권한이 필요합니다.");
      }
      attachNotificationResponseHandler();
    })();
  }, [])

  useEffect(() => {
    async function replacePlayer(){
      const uri = localAudioArr[audioOrder];
      if (uri) {
        await player.pause();
        await player.replace({ uri }); // 동적 파일은 { uri: string }
      }
    }
    replacePlayer();
  }, [audioOrder, localAudioArr]);

  useEffect(() => {
    if (status?.didJustFinish) {
      // 재생이 막 끝났을 때 한 번 true가 됨
      setAudioPlay(false);
      player.seekTo(0); // 필요하면 위치 초기화 (expo-audio는 자동 리셋 안 함)
    }
  }, [status?.didJustFinish]);


  return (
    <SheetRefContext.Provider value={{bottomSheetModalRef, localAudioArr, setLocalAudioArr}}>
      <BottomSheetModalProvider>
        <WifiContext.Provider value={{confirmedWifi, setConfirmedWifi, eventNameArr, setEventNameArr}}>
          <Tabs
            screenOptions={{
              tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
              headerShown: false,
              tabBarButton: HapticTab,
              tabBarBackground: TabBarBackground,
              tabBarStyle: {height: 104},
              tabBarLabelStyle: {
                fontSize: 15,
                fontFamily: 'JejuGothic',
                marginTop: 15
              },
              tabBarIconStyle: {
                marginTop: 15
              }
            }}>
            <Tabs.Screen
              name="events"
              options={{
                title: '이벤트 확인',
                tabBarIcon: ({ color, focused }) => (focused) ? <SoundIconSelected/>: <SoundIcon/>,
              }}
            />
            <Tabs.Screen
              name="index"
              options={{
                title: '설정',
                tabBarIcon: ({ color, focused }) => (focused) ? <SettingIconSelected/>: <SettingIcon/>,
              }}
            />
            <Tabs.Screen
              name="hubSetting"
              options={{
                title: '허브 설정',
                tabBarIcon: ({ color, focused }) => (focused) ? <WifiIconSelected/>: <WifiIcon/>,
              }}
            />
          </Tabs>
          <BottomSheetModal
            onDismiss={() => {
              console.log('dismissed')
            }}
            ref={bottomSheetModalRef}
            index={0}                 // 초기에는 닫힘
            snapPoints={snapPoints}
            enablePanDownToClose       // 아래로 끌면 닫힘
            onChange={(i) => console.log('index:', i)}
          >
            <View style={{display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', flex:1}}>
              <View>
                <Text style={{fontSize: 20,fontFamily: 'JejuGothic', color: '#979797', marginLeft: 34, }}>녹음본 재생</Text>
                <View style={{flexDirection: 'row', marginTop: 25, alignItems: 'center', marginLeft: 54}}>
                  <TouchableOpacity onPress= {()=>{setAudioOrder((prev)=>(prev == 0)? localAudioArr.length-1 : prev-1)}} style={{ width:20, height:27, flexDirection: 'column', justifyContent: 'center', paddingLeft: 5, }}>
                    <BackArrow/>
                  </TouchableOpacity>
                  <Text style={{fontSize: 15,fontFamily: 'JejuGothic',}}>{(localAudioArr.length == 0) ? '-' : `${audioOrder+1}/${localAudioArr.length}`}</Text>
                  <TouchableOpacity onPress= {()=>{setAudioOrder((prev)=>(prev == localAudioArr.length-1) ? 0 : prev+1)}} style={{ width:20, height:27, flexDirection: 'column', justifyContent: 'center', paddingLeft: 5, }}>
                    <ForwardArrow/>
                  </TouchableOpacity>
                </View>
                <View style={{display: 'flex', flexDirection: 'row',  justifyContent: 'space-between', marginTop: 5, marginBottom: 10}}>
                  <View style={{display: 'flex', flexDirection: 'row', marginLeft: 27}}>
                    <View style={{ height: 2, width: 260, backgroundColor: '#ccc', marginLeft: 24}} />
                    <View style={{ height: 2, width: 260*(status.currentTime/status.duration), backgroundColor: '#000000', marginLeft: -260}} />
                    <View style={{borderRadius: 10, width:8, height: 8, backgroundColor: '#000000', marginTop: -3}}/>
                  </View>
                  <TouchableOpacity style={{marginRight: 35, marginTop: -19, width: 40, height: 40, display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center'}} onPress={audioPlay ? 
                  async ()=>{
                    setAudioPlay(!audioPlay);
                    await player.pause();
                  }
                  : async ()=>{
                    setAudioPlay(!audioPlay);
                    const uri = localAudioArr[audioOrder];
                    if (uri) {
                      // 재생 전에 현재 선택된 오디오로 교체
                      prepareAudioPlay();
                      await setAudioModeAsync({
                        playsInSilentMode: true,   // 무음 스위치여도 재생
                        allowsRecording: false,    // 재생 시에는 녹음 비활성
                      });
                      await player.play();
                    }
                    }}>
                    {audioPlay ? 
                    <Stop/>:
                    <Play/>}
                  </TouchableOpacity>
                </View>
              </View>
              <View style={{backgroundColor: '#f4f5f7', height: 97, display: 'flex', flexDirection: 'row', justifyContent: 'center'}}>
                <TouchableOpacity onPress={(recorderState.isRecording)? stopRecording: record} style={{ display:'flex', flexDirection: 'column', justifyContent: 'center', borderWidth: 3, borderRadius: 30, width: 49, height:49, borderColor: '#a6a6a6', marginTop: 12}}>
                  { (recorderState.isRecording) ?
                  <View style={{ width: 25, height: 25, borderRadius:4, backgroundColor: '#ff0000', alignSelf: 'center'}}/>
                  :
                  <View style={{ width: 38.11, height: 38.11, backgroundColor: '#ff0000', borderRadius: 20, alignSelf: 'center'}}/>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </BottomSheetModal>
        </WifiContext.Provider>
      </BottomSheetModalProvider>

    </SheetRefContext.Provider>
  );
}

type SheetController = {
  records: Blob[],
  recordsUri: string
}

export const BottomSheetContext = createContext<SheetController | null>(null);