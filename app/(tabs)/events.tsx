import { WifiContext } from '@/components/wifiContext';
import { db, storage } from '@/firebase/firebase';
import { Picker } from '@react-native-picker/picker';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { get, ref, remove, update } from 'firebase/database';
import { getDownloadURL, getMetadata, ref as sRef, StorageReference } from 'firebase/storage';
import { ReactElement, useContext, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Play from '../../components/ui/play.svg';
import Stop from '../../components/ui/stop.svg';
const engToKor : {[key: string] : string} = {
  "Doorbell" : '현관벨',
  "Fire Alarm" : '화재경보',
  "Glass Break" : '유리 깨짐',
  "Baby Cry" : '울음',
  "Scream" : '비명',
  "Siren" : '사이렌',
  "Dog Bark": '개 짖는 소리',
  "Gunshot": '총 소리'
}

export default function HomeScreen() {
  const context = useContext(WifiContext);

  if (!context) {
  throw new Error('SheetRefContext must be used within a Provider');
  }

  const { confirmedWifi, setConfirmedWifi, eventNameArr, setEventNameArr } = context;

  const [selected, setSelected] = useState<number>(-1);
  const [audioPlay, setAudioPlay] = useState<boolean>(false);
  const player = useAudioPlayer();  
  const status = useAudioPlayerStatus(player);
  const [idToHub, setIdToHub] = useState<{ [key: string] : number }>({});
  const [eventArr, setEventArr] = useState<{ [key: string] : any }[]>([]);
  const [buttonArr, setButtonArr] = useState<ReactElement[]>([]);
  const [isAudioExist, setIsAudioExist] = useState<boolean>(false);
  const [selectedEvent, setSelectedEvent] = useState<string>("");


  const prepareAudioPlay = async () => {
        try {
          player.volume = 1;
        } catch (e) {
          console.warn('audio mode 설정 실패:', e);
        }
      };

  useEffect(()=>{
    async function loadAudio(){
      const userRef = ref(db, `users/${confirmedWifi}`)
      const snap = await get(userRef);
      if (snap.exists()){
        const userData = snap.val();
        const eventData = userData['events']
        const hubData = userData['hubs']
        

        const temp : { [key: string]: any } = {}
        for (let hub in hubData){
          temp[hub] = hubData[hub]['name'];
        }
        setIdToHub(temp);

        
        const eventArrTemp = [];
        for (let event in eventData){
          const tempDict : { [key: string]: any } = {};
          tempDict['hub'] = temp[eventData[event]['hub_mac']]
          tempDict['label'] = (eventData[event]['label'] in engToKor) ? engToKor[eventData[event]['label']] : eventData[event]['label'];
          tempDict['timestamp'] = eventData[event]['timestamp'];
          tempDict['event'] = event;
          eventArrTemp.push(tempDict);
        }
        const eventArrTemp2: any[] = [];

        setEventArr(eventArrTemp.reverse());
      }
    }
    loadAudio()
  }, [])

  useEffect(() => {
    if (status?.didJustFinish) {
      // 재생이 막 끝났을 때 한 번 true가 됨
      setAudioPlay(false);
      player.seekTo(0); // 필요하면 위치 초기화 (expo-audio는 자동 리셋 안 함)
    }
  }, [status?.didJustFinish]);

  useEffect(()=>{
    const temp = []
    for (let i = 0; i < eventArr?.length; i++){
      temp.push(
      <TouchableOpacity key={'button'+i.toString()} onPress={()=>{setSelected(i)}} style={{display: 'flex', marginTop:15, flexDirection: 'row', justifyContent: 'space-between', backgroundColor: (selected == i) ? '#D9D9D9': '#ffffff'}}>
        <Text style={{fontSize: 20,fontFamily: 'JejuGothic', marginLeft: 20, marginVertical: 5}}>{eventArr[i]['label']}</Text>
        <Text style={{fontSize: 20,fontFamily: 'JejuGothic', color: '#979797', marginRight: 20, marginVertical: 5}}>{eventArr[i]['hub']}</Text>
      </TouchableOpacity>
      )
    }
    setButtonArr(temp);
  }, [eventArr, selected])

  async function fileExists(fileRef: StorageReference): Promise<boolean> {
  return getMetadata(fileRef)
    .then(() => true)
    .catch((err) => {
      if (err.code === "storage/object-not-found") return false;
      throw err;
    });
}

  useEffect(()=>{
    async function audioPrepare(){
      player.seekTo(0);

      const storagePath = `${confirmedWifi}/event_data/${eventArr[selected]['event']}.wav`; // 업로드 때 쓴 경로와 동일
      const fileRef = sRef(storage, storagePath);
      console.log(fileRef, getDownloadURL(fileRef));
      if (await fileExists(fileRef)) {
        const url = await getDownloadURL(fileRef); 
        await player.replace({ uri: url });
        setIsAudioExist(true);
      } else {
        setIsAudioExist(false);
      }
    }
    audioPrepare();
  }, [selected])


  return (
    <View style={{marginTop: 88, marginLeft: 31,}}>
      <View>
        <Text style={{fontSize: 20,fontFamily: 'JejuGothic', color: '#979797'}}>이벤트 리스트</Text>
        <View style={{borderRadius: 11, backgroundColor: '#ffffff', marginRight: 28, marginTop:35, paddingHorizontal: 24, paddingVertical: 20, height: 248}}>
          <View style={{flexDirection: 'row'}}>
            <Text style={{fontFamily: 'JejuGothic', fontSize: 21, marginLeft:5, marginBottom: 10}}>이벤트 종류</Text>
            <Text style={{fontFamily: 'JejuGothic', fontSize: 21, marginLeft: 90}}>발생 장소</Text>
          </View>
          <ScrollView>
            {buttonArr}
          </ScrollView>
        </View>
      </View>
      {selected != -1 && 
        <View style={{marginTop: 38,}}>
          <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
            <Text style={{fontSize: 25,fontFamily: 'JejuGothic', marginLeft: 24}}>{eventArr[selected]['label']}</Text>
            <Text style={{fontSize: 20,fontFamily: 'JejuGothic', marginRight: 54}}>{eventArr[selected]['hub']}</Text>
          </View>
          { (isAudioExist) &&
          <View style={{display: 'flex', flexDirection: 'row',  justifyContent: 'space-between', marginTop: 35, marginBottom: 10}}>
            <View style={{display: 'flex', flexDirection: 'row', marginLeft: 0}}>
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
                // 재생 전에 현재 선택된 오디오로 교체
                prepareAudioPlay();
                await setAudioModeAsync({
                  playsInSilentMode: true,   // 무음 스위치여도 재생
                  allowsRecording: false,    // 재생 시에는 녹음 비활성
                });
                await player.play();
              }}>
              {audioPlay ? 
              <Stop/>:
              <Play/>}
            </TouchableOpacity>
          </View>
          }
          <View style={{display: 'flex', flexDirection: 'row', marginLeft: 24, marginTop: 46, justifyContent: 'space-between'}}>
            <Text style={{fontSize: 20,fontFamily: 'JejuGothic', color: '#979797'}}>{eventArr[selected]['timestamp'].split(' ')[0]}</Text>
            <Text style={{fontSize: 20,fontFamily: 'JejuGothic', color: '#979797', marginRight: 70}}>{eventArr[selected]['timestamp'].split(' ')[1]}</Text>
          </View>
          <View style={{display: 'flex', flexDirection: 'row', marginLeft: 24, marginTop: 46, justifyContent: 'space-between'}}>
            <Picker
              selectedValue={selectedEvent}
              style={{ height: 50, width: 200, marginLeft:-40, marginTop: -40}}
              onValueChange={(itemValue) => setSelectedEvent(itemValue)}
            >
              {eventNameArr.map((name, idx) => (
                <Picker.Item label={name} value={name} key={idx} />
              ))}
            </Picker>

            <TouchableOpacity style={{alignSelf:'center', flexDirection: 'column', justifyContent: 'center', width: 150, height: 70, borderRadius: 20, backgroundColor: '#66ACF7', marginTop: 35, marginRight: 20, }} onPress={async ()=>{
              await remove(ref(db, `users/${confirmedWifi}/events/${eventArr[selected].event}`));
              
              const feedbackRef = ref(db, `users/${confirmedWifi}/feedback`);
              update(feedbackRef, {[eventArr[selected].event]: {correctLabel: selectedEvent}});
              
              setEventArr((prev)=>{
                const temp = [...prev];
                temp.splice(selected, 1);
                return temp;
              })
              setSelected(-1);
            }}>
              <Text style={{color: '#ffffff', fontFamily: 'JejuGothic', fontSize: 20, alignSelf: 'center'}}>
              이벤트 종류</Text>
              <Text style={{color: '#ffffff', fontFamily: 'JejuGothic', fontSize: 20, alignSelf: 'center', marginTop: 5}}>
              불일치</Text>
            </TouchableOpacity>
          </View>
        </View>
      }
    </View>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
});
