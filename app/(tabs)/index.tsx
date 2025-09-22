import { SheetRefContext } from '@/components/bottomSheetModalRef';
import { Collapsible } from '@/components/Collapsible';
import { WifiContext } from '@/components/wifiContext';
import { db, storage } from '@/firebase/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AudioModule,
  setAudioModeAsync
} from 'expo-audio';
import Constants from "expo-constants";
import * as Notifications from 'expo-notifications';
import { get, ref, set, update } from 'firebase/database';
import { ref as sRef, uploadBytesResumable } from 'firebase/storage';
import React, { ReactElement, useContext, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Check from '../../components/ui/check.svg';
import Pencil from '../../components/ui/pencil.svg';

const defaultTrainArr = [678, 658, 857, 955, 237];
const isEnglishLetters = (s: string) => /^[A-Za-z]+$/.test(s);
const engToKor : {[key: string] : string} = {
  "Doorbell" : '현관벨',
  "Fire_Alarm" : '화재경보',
  "Glass_Break" : '유리 깨짐',
  "Baby_Cry" : '울음',
  "Scream" : '비명',
  "Siren" : '사이렌',
  "Dog_Bark": '개 짖는 소리',
  "Gunshot": '총 소리'
}

const korToEng: { [key: string]: string } = {
  "현관벨": "Doorbell",
  "화재경보": "Fire_Alarm",
  "유리 깨짐": "Glass_Break",
  "울음": "Baby_Cry",
  "비명": "Scream",
  "사이렌": "Siren",
  "개 짖는 소리": "Dog_Bark",
  "총 소리": "Gunshot",
};

export default function TabTwoScreen() {
  const context = useContext(SheetRefContext);
  const context2 = useContext(WifiContext);
  if (!context) {
  throw new Error('SheetRefContext must be used within a Provider');
  }
  if (!context2) {
  throw new Error('SheetRefContext must be used within a Provider');
  }

  const { bottomSheetModalRef, localAudioArr, setLocalAudioArr } = context;
  const { confirmedWifi, setConfirmedWifi, eventNameArr, setEventNameArr } = context2;

  const [wifiChange, setWifiChange] = useState<boolean>(false);
  const [wifiName, setWifiName] = useState<string>('');
  const wifiRef = useRef<TextInput>(null);
  const eventAddRef = useRef<TextInput>(null);
  const [sensitivity, setSensitivity] = useState<number>(1);
  const [eventArr, setEventArr] = useState<ReactElement[]>([]);
  const [specialTrainArr, setSpecialTrainArr] = useState<string[][]>([]);
  const [currentTrainNum, setCurrentTrainNum] = useState<number>(-1);
  const [eventCheckArr, setEventCheckArr] = useState<boolean[]>(Array(eventNameArr.length).fill(true));
  const [wifiNeeded, setWifiNeeded] = useState<boolean>(false);
  const [trainArr, setTrainArr] = useState<number[]>(defaultTrainArr);
  const [addEvent, setAddEvent] = useState<boolean>(false);
  const [newEvent, setNewEvent] = useState<string>('');

  useEffect(()=>{
    async function getWifi() {
      const wifi = await AsyncStorage.getItem("WIFI_BSSID");
      console.log('wifi:', wifi)
      if (wifi == null) return;

      const usersRef = ref(db, 'users');
      const snap = await get(usersRef);
      if (snap.exists()) {
        const v = snap.val();
        if (wifi in v) {
          setWifiName(wifi);
          setConfirmedWifi(wifi);
        }
      }
    }
    getWifi();
  }, [])

  useEffect(() => {
    const base = [...defaultTrainArr];
    if (eventNameArr.length > defaultTrainArr.length) {
      // 부족한 길이만큼 0 채우기
      const diff = eventNameArr.length - defaultTrainArr.length;
      const zeros = Array(diff).fill(0);
      setTrainArr([...base, ...zeros]);
    } else {
      // eventNameArr가 더 짧거나 같으면 그대로
      setTrainArr(base);
    }
  }, [eventNameArr]);

  useEffect(()=>{
    async function loadSpecialTrain() {
      const temp = [];
      const trainRef = ref(db, `users/${confirmedWifi}/trainedData`);
      const snap = await get(trainRef);
      if (!snap.exists()){
        for (let i = 0; i < eventNameArr.length; i++){
          temp.push([]);
        }
      } else{
        const res = snap.val();
        for (let i = 0; i < eventNameArr.length; i++){
          if (!res[eventNameArr[i]]) {
            temp.push([]);
            continue;
          }
          temp.push(res[eventNameArr[i]])
        }
      }
      setSpecialTrainArr(temp);
    }
    loadSpecialTrain();
  },[eventNameArr, confirmedWifi])
  const [a, seta] = useState<string>('');
  useEffect(()=>{
    async function updateData(){
      const userRef = ref(db, `users/${confirmedWifi}`);
      const snap = await get(userRef);
      const userData = snap.val();

      if ('eventCheckArr' in userData){
        setEventCheckArr(userData['eventCheckArr'])
      } else {
        set(ref(db, `users/${confirmedWifi}/eventCheckArr`), Array(eventNameArr.length).fill(true));
        setEventCheckArr(Array(eventNameArr.length).fill(true));
      }
      if ('sensitivity' in userData){
        setSensitivity(userData['sensitivity']);
      } else {
        set(ref(db, `users/${confirmedWifi}/sensitivity`), sensitivity);
      }
      if ('eventNameArr' in userData){
        setEventNameArr(userData['eventNameArr']);
      } else {
        set(ref(db, `users/${confirmedWifi}/eventNameArr`), eventNameArr);
      }

            // 2) projectId 필수 (SDK 49+)
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId;
      if (!projectId) {
        throw new Error("EAS projectId가 없습니다. app.json/app.config.ts 확인");
      }
      console.log(projectId)

      // Expo Push Token 발급
      const data: Notifications.ExpoPushToken  = await Notifications.getExpoPushTokenAsync( {projectId} ) // iOS=APNs, Android=FCM
      seta(data['data']);
      await set(ref(db, `users/${confirmedWifi}/pushTokens`), data['data']);
    }
    updateData();
  },[confirmedWifi])

  useEffect(() => {
    (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert('Permission to access microphone was denied');
      }

      setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
        
      });
    })();
  }, []);


  useEffect(()=>{
    const tempArr = [];
    for (let i = 0; i < eventNameArr.length; i++){
      tempArr.push(
        <View key={'event'+i.toString()} style={{display: 'flex', flexDirection: 'row', justifyContent: 'space-between', }}>
          <Collapsible title={eventNameArr[i]}>
            <View style={{display: 'flex', flexDirection: 'column', alignItems: 'stretch', alignSelf: 'stretch'}}>
              <View style={{display: 'flex', flexDirection: 'row', justifyContent: 'space-between', marginTop: 15}}>
                <Text style={{fontSize: 15,fontFamily: 'JejuGothic', color: '#979797'}}>모델 학습 데이터</Text>
                <Text style={{fontSize: 15,fontFamily: 'JejuGothic', color: '#979797'}}>{trainArr[i]}</Text>
              </View>
              <View style={{display: 'flex', flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, alignItems: 'center'}}>
                <View style={{display: 'flex', flexDirection: 'row', alignItems: 'center'}}>
                  <Text style={{fontSize: 15,fontFamily: 'JejuGothic', color: '#979797', marginRight: 10}}>사용자 특화 데이터</Text>
                  <TouchableOpacity onPress={()=>{
                    bottomSheetModalRef?.current?.present(); 
                    setCurrentTrainNum(i);
                    setLocalAudioArr(specialTrainArr[i]);
                    }} style={{width:25, display: 'flex', justifyContent: 'center', flexDirection: 'row'}}>
                    <Text style={{fontFamily: 'JejuGothic', fontSize: 25}}>+</Text>
                  </TouchableOpacity>
                </View>
                <Text style={{fontSize: 15,fontFamily: 'JejuGothic', color: '#979797'}}>{specialTrainArr.length <= i ? 0 : specialTrainArr[i].length}</Text>
              </View>
            </View>
          </Collapsible>
          <TouchableOpacity onPress={()=>{setEventCheckArr((prev)=>{
            const temp = [...prev]
            temp[i] = !temp[i]
            return temp
          })}} style={{borderWidth:3, width: 20, height: 20, borderRadius: 5, borderColor: '#979797', marginLeft: -50, marginTop: 15}}>
            {eventCheckArr[i] && <Check style={{position: 'absolute', right: -18, top: -20}}/>}
          </TouchableOpacity>
        </View>
      )
      setEventArr(tempArr);
    }
  },[eventCheckArr, specialTrainArr])


  useEffect(()=>{
    async function confirmWifi(wifiName: string) {
      const usersRef = ref(db, 'users');
      const snap = await get(usersRef);
      if (!snap.exists()) {
        setWifiNeeded(true); 
        setWifiName(confirmedWifi);
      } else{
        const v = snap.val();
        if (wifiName in v) {
          setWifiNeeded(false);
          setConfirmedWifi(wifiName);
          await AsyncStorage.setItem('WIFI_BSSID', confirmedWifi);
        } else{
          setWifiNeeded(true); 
          setWifiName(confirmedWifi);
        }
      }
       
    }
    if (wifiChange){
      wifiRef.current?.focus();
    } else {
      if (wifiName != '' || confirmedWifi != ''){
        confirmWifi(wifiName)
      }
    }
  }, [wifiChange])

  useEffect(()=>{
    setSpecialTrainArr((prev)=>{
      const temp = [...prev];
      temp[currentTrainNum] = localAudioArr;
      return temp
    })
  }, [localAudioArr])

  return (
    <ScrollView scrollEnabled={false} style={{marginTop: 68, marginLeft: 31,}}>
        <View>
          <Text style={{fontSize: 20,fontFamily: 'JejuGothic', color: '#979797'}}>허브 연결 와이파이</Text>
          <View style={{display: 'flex', flexDirection: 'row',  marginTop: 23, justifyContent: 'space-between', alignSelf: 'stretch'}}>
            { (wifiChange) ?
              <TextInput ref={wifiRef} placeholder='MAC주소 입력' value={wifiName} onChangeText={setWifiName} onBlur={()=>{setWifiChange(false);}} style={{backgroundColor: '#ffffff', borderRadius: 11, paddingHorizontal:10, fontSize:18, fontFamily: 'JejuGothic', width:240}}>
              </TextInput>
            :
              <View style={{display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
                <Text style={{fontSize: 18,fontFamily: 'JejuGothic'}}>{confirmedWifi}</Text>
              </View>
            }
            
            <TouchableOpacity onPress={()=>{setWifiChange(true)}}>
              <Pencil style={{marginRight: 41}}></Pencil>
            </TouchableOpacity>
          </View>
          {(wifiNeeded) && <Text style={{fontSize: 10, fontFamily: 'JejuGothic', color: '#ff0000'}}>허브와 와이파이 연결을 먼저 해주세요</Text>}
        </View>
        <View style={{ height: 1, backgroundColor: '#ccc', marginTop: 22, marginRight: 31}} />
        <View style={{marginTop: 26}}>
          <View style={{display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignContent: 'center'}}>
            <View style={{display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
              <Text style={{fontSize: 20,fontFamily: 'JejuGothic', color: '#979797'}}>이벤트 알림 여부 설정</Text>
            </View>

          </View>
          <ScrollView style={{borderRadius: 11, backgroundColor: '#ffffff', marginRight: 28, marginTop:15, paddingHorizontal: 24, paddingVertical: 20, height: 248}}>
            {eventArr}
          </ScrollView>
        </View>
        <View style={{ height: 1, backgroundColor: '#ccc', marginTop: 33, marginRight: 31, }} />
        <View style={{marginTop: 30,}}>
          <Text style={{fontSize: 20,fontFamily: 'JejuGothic', color: '#979797'}}>이벤트 감지 민감도</Text>
          <View style={{display: 'flex', flexDirection: 'row',  marginTop: 28, justifyContent: 'space-between', alignSelf: 'stretch', marginRight:30}}>
            <View style={{display: 'flex', flexDirection: 'row', justifyContent: 'center'}}>
              <Text style={[{fontSize: 20,fontFamily: 'JejuGothic', marginRight: 10}]}>둔함</Text>
              <TouchableOpacity onPress={()=>{setSensitivity(0)}} style={{borderWidth:3, width: 20, height: 20, borderRadius: 5, borderColor: '#979797'}}></TouchableOpacity>
              {(sensitivity==0) && <Check style={{position: 'absolute', left: 35, top: -20}}/>}
            </View>
            <View style={{display: 'flex', flexDirection: 'row', justifyContent: 'center'}}>
              <Text style={{fontSize: 20,fontFamily: 'JejuGothic', marginRight: 10}}>보통</Text>
              <TouchableOpacity onPress={()=>{setSensitivity(1)}} style={[{borderWidth:3, width: 20, height: 20, borderRadius: 5, borderColor: '#979797'}]}></TouchableOpacity>
              {(sensitivity==1) && <Check style={{position: 'absolute', left: 35, top: -20}}/>}
            </View>
            <View style={{display: 'flex', flexDirection: 'row', justifyContent: 'center'}}>
              <Text style={{fontSize: 20,fontFamily: 'JejuGothic', marginRight: 10}}>민감</Text>
              <TouchableOpacity onPress={()=>{setSensitivity(2)}} style={{borderWidth:3, width: 20, height: 20, borderRadius: 5, borderColor: '#979797'}}></TouchableOpacity>
              {(sensitivity==2) && <Check style={{position: 'absolute', left: 35, top: -20}}/>}
            </View>
          </View>
        </View>
        <TouchableOpacity onPress={async ()=>{
          const usersRef = ref(db, 'users');
          const snap = await get(usersRef);
          if (!snap.exists()) {
            setWifiNeeded(true);
          } else{
            const v = snap.val();
            if (confirmedWifi in v) {
              await AsyncStorage.setItem('WIFI_BSSID', confirmedWifi);
              
              setWifiNeeded(false);
              const trainToFb: { [key: string]: any } = {}
              eventNameArr.map(async (eventName, idx)=>{
                trainToFb[eventName] = specialTrainArr[idx];
                specialTrainArr[idx].forEach(async (asyncRef)=> {
                  const storageRef = sRef(storage, `${confirmedWifi}/audio_data/${korToEng[eventName]}/${asyncRef.split('/')[asyncRef.split('/').length-1]}`);
                  const res = await fetch(asyncRef)
                  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
                  const blob = await res.blob()
                  uploadBytesResumable(storageRef, blob);
                })
              })

              update(ref(db, 'users/' + confirmedWifi), {
                eventCheckArr: eventCheckArr,
                sensitivity: sensitivity,
                trainedData: trainToFb,
                eventNameArr: eventNameArr,
              });
            } else{
              setWifiNeeded(true);
            }
          }
          }}style={{backgroundColor: '#d9d9d9', width: 187, height: 51, borderRadius: 11, marginLeft: 76, marginTop: 30, display: 'flex', flexDirection: 'row', justifyContent: 'center'}}>
          <Text style={{alignSelf: 'center', fontSize: 20, fontFamily: 'JejuGothic'}}>적용하기</Text>
        </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    color: '#808080',
    bottom: -90,
    left: -35,
    position: 'absolute',
  },
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
});
