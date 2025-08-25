import { WifiContext } from '@/components/wifiContext';
import { db } from '@/firebase/firebase';
import { get, ref, update } from 'firebase/database';
import { ReactElement, useContext, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { TextInput } from 'react-native-gesture-handler';
import Pencil from '../../components/ui/pencil.svg';


export default function HomeScreen() {
  const context = useContext(WifiContext);
  if (!context) {
  throw new Error('SheetRefContext must be used within a Provider');
  }

  const { confirmedWifi, setConfirmedWifi } = context;

  const [selected, setSelected] = useState<number>(-1);
  const [hubNameArr, setHubNameArr] = useState<string[]>([]);
  const [connectTimeArr, setConnectTimeArr] = useState<string[]>([]);
  const [buttonArr, setButtonArr] = useState<ReactElement[]>([]);
  const [hubIdArr, setHubIdArr] = useState<string[]>([]);
  const [hubNameChange, setHubNameChange] = useState<boolean>(false);
  const [hubName, setHubName] = useState<string>('');
  const hubRef = useRef<TextInput>(null);

  useEffect(()=>{
    async function getHub(){
      const usersRef = ref(db, 'users');
            const snap = await get(usersRef);
            if (snap.exists()) {
              const v = snap.val();
              if (confirmedWifi in v) {
                const userRef = ref(db, `users/${confirmedWifi}/hubs`)
                const snap = await get(userRef);
                const hubs = snap.val();
                for (let hub in hubs) {
                  const temp = [];
                  const temp2 = [];
                  const temp3 = [];
                  temp.push(hubs[hub]['name']);
                  temp2.push(hubs[hub]['last_boot_time'])
                  temp3.push(hub);
                  setHubNameArr(temp);
                  setConnectTimeArr(temp2);
                  setHubIdArr(temp3);
                }
              }
            }
    }
    getHub();
  }, [])

  useEffect(()=>{
    const temp = []
    for (let i = 0; i< hubNameArr.length; i++){
      temp.push(
        <TouchableOpacity key={'button'+i.toString()} onPress={()=>{setSelected(i); setHubName(hubNameArr[i])}} style={{display: 'flex', flexDirection: 'row', justifyContent: 'space-between', backgroundColor: (selected == i) ? '#D9D9D9': '#ffffff'}}>
          <Text style={{fontSize: 20,fontFamily: 'JejuGothic', color: '#979797', marginLeft: 20, marginVertical: 5}}>{i+1}</Text>
          <Text style={{fontSize: 20,fontFamily: 'JejuGothic', marginRight: 20, marginVertical: 5}}>{hubNameArr[i]}</Text>
        </TouchableOpacity>
      )
    }
    setButtonArr(temp);
    console.log(temp)
  }, [hubNameArr, connectTimeArr, selected])

  return (
    <ScrollView scrollEnabled={false} style={{marginTop: 88, marginLeft: 31,}}>
      <View>
        <Text style={{fontSize: 20,fontFamily: 'JejuGothic', color: '#979797'}}>WI-FI에 연결된 허브</Text>
        <View style={{borderRadius: 11, backgroundColor: '#ffffff', marginRight: 28, marginTop:35, paddingHorizontal: 24, paddingVertical: 20, height: 248}}>
          <View style={{flexDirection: 'row'}}>
            <Text style={{fontFamily: 'JejuGothic', fontSize: 21, marginLeft:5, marginBottom: 15}}>번호</Text>
            <Text style={{fontFamily: 'JejuGothic', fontSize: 21, marginLeft: 150}}>허브 이름</Text>
          </View>
          <ScrollView>
            {buttonArr}
          </ScrollView>
        </View>
      </View>
      {selected != -1 && 
        <View style={{marginTop: 38,}}>
          <View style={{display: 'flex', flexDirection: 'row',  justifyContent: 'space-between', alignItems: 'center',}}>
            {(hubNameChange)?
            <TextInput ref={hubRef} value={hubName} onChangeText={setHubName} onBlur={async ()=>{
              setHubNameChange(false);
              if (hubNameArr[selected] != hubName) {
                setHubNameArr((prev)=>{
                  const temp = [...prev]
                  temp[selected] = hubName;
                  return temp
                })

                const userRef = ref(db, `users/${confirmedWifi}/hubs/${hubIdArr[selected]}`)
                
                update(userRef,{
                  name: hubName
                })
                
              }
            }} style={{backgroundColor: '#ffffff', borderRadius: 11, paddingHorizontal:10, fontSize:18, fontFamily: 'JejuGothic', width:240, height:40}}></TextInput>
                        :
            <Text style={{fontSize: 24,fontFamily: 'JejuGothic', marginLeft: 24}}>{hubName}</Text>
            }
            <TouchableOpacity onPress={()=>{setHubNameChange(!hubNameChange); }}>
              <Pencil style={{marginRight: 40}}/>
            </TouchableOpacity>
          </View>
          <View style={{display: 'flex', flexDirection: 'row',  justifyContent: 'flex-start', alignItems: 'center', marginTop: 40}}>
            <Text style={{fontFamily: 'JejuGothic', fontSize: 21, marginLeft: 0}}>최근 연결 시간</Text>
            <Text style={{fontFamily: 'JejuGothic', fontSize: 18, marginLeft:20, color: '#979797'}}>{connectTimeArr[selected].split(' ')[0]}</Text>
            <Text  style={{fontFamily: 'JejuGothic', fontSize: 18, marginLeft:10, color: '#979797'}}>{connectTimeArr[selected].split(' ')[1]}</Text>
          </View>
        </View>
      }
    </ScrollView>
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
