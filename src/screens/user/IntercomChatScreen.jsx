import {useNavigation,useRoute} from "@react-navigation/native";
import {useEffect,useRef,useState} from "react";
import {
 Keyboard,
 KeyboardAvoidingView,
 Platform,
 View
} from "react-native";

import ChatInput from "../../components/intercom/ChatInput";
import ChatMessageList from "../../components/intercom/ChatMessageList";
import EndCallModal from "../../components/intercom/EndCallModal";
import IntercomHeader from "../../components/intercom/IntercomHeader";
import IntercomTimer from "../../components/intercom/IntercomTimer";
import MessageAutocomplete from "../../components/intercom/MessageAutocomplete";

import useIntercomRealtime from "../../hooks/intercom/useIntercomRealtime";
import useIntercomSession from "../../hooks/intercom/useIntercomSession";
import useMessageAutocomplete from "../../hooks/intercom/useMessageAutocomplete";


const BOTTOM_NAV_HEIGHT=80;

/*
 * 키보드 상단 툴바와 겹치지 않도록
 * 입력창을 조금 더 위로 올리는 여유값
 */
const KEYBOARD_EXTRA_OFFSET=50;


export default function IntercomChatScreen(){

const navigation=useNavigation();
const route=useRoute();

const scrollViewRef=useRef(null);
const isMountedRef=useRef(true);

const [messages,setMessages]=useState([]);
const [realtimePartial,setRealtimePartial]=useState("");
const [isEndModalVisible,setIsEndModalVisible]=useState(false);

/*
 * 키보드 실제 높이
 */
const [keyboardHeight,setKeyboardHeight]=useState(0);

const isKeyboardVisible=
 keyboardHeight>0;


const logUserChat=(message,data)=>{
 console.log(
  `[USER_CHAT] ${message}`,
  data||""
 );
};


const moveToIdleMainTab=({
 screen="홈",
 endedSessionId=null
}={})=>{

 navigation.reset({
  index:0,
  routes:[
   {
    name:"MainTab",
    params:{
     screen,
     endedSessionId
    }
   }
  ]
 });

};


const handleAuthExpired=async()=>{

 navigation.reset({
  index:0,
  routes:[
   {
    name:"ResidentLogin"
   }
  ]
 });

};


const {
 startRealtimeSubscription,
 stopRealtimeSubscription
}=useIntercomRealtime({
 isMountedRef,
 logUserChat,
 moveToIdleMainTab
});


const {
 currentSessionId,
 token,
 inputText,
 setInputText,
 sendMessage,
 sendQuickReply,
 endCall,
 isLoading,
 seconds,
 isEnding,
 initializeSession
}=useIntercomSession({

 initialSessionId:
  route.params?.sessionId||
  route.params?.activeSessionId,

 routeToken:
  route.params?.token,

 isMountedRef,
 logUserChat,
 handleAuthExpired,
 moveToIdleMainTab,
 setMessages,
 stopRealtimeSubscription

});


const {
 recommendations,
 requestAutocomplete,
 clearAutocomplete
}=useMessageAutocomplete({
 sessionId:currentSessionId,
 token
});


/*
 * 화면 초기화
 */
useEffect(()=>{

 isMountedRef.current=true;

 initializeSession();

 return()=>{

  isMountedRef.current=false;

  stopRealtimeSubscription();

 };

},[]);


/*
 * 실시간 STOMP 구독
 */
useEffect(()=>{

 if(!currentSessionId){
  return;
 }

 startRealtimeSubscription(
  currentSessionId,
  setMessages,
  setRealtimePartial
 );

 return()=>{

  stopRealtimeSubscription();

 };

},[currentSessionId]);


/*
 * 키보드 높이 감지
 */
useEffect(()=>{

 const showEvent=
  Platform.OS==="ios"
   ?"keyboardWillShow"
   :"keyboardDidShow";

 const hideEvent=
  Platform.OS==="ios"
   ?"keyboardWillHide"
   :"keyboardDidHide";


 const showSubscription=
  Keyboard.addListener(
   showEvent,
   event=>{

    const height=
     event?.endCoordinates?.height||0;

    setKeyboardHeight(height);

    setTimeout(()=>{

     scrollViewRef.current?.scrollToEnd({
      animated:true
     });

    },150);

   }
  );


 const hideSubscription=
  Keyboard.addListener(
   hideEvent,
   ()=>{

    setKeyboardHeight(0);

    setTimeout(()=>{

     scrollViewRef.current?.scrollToEnd({
      animated:true
     });

    },150);

   }
  );


 return()=>{

  showSubscription.remove();
  hideSubscription.remove();

 };

},[]);


/*
 * 채팅 최하단 이동
 */
const scrollToBottom=()=>{

 setTimeout(()=>{

  scrollViewRef.current?.scrollToEnd({
   animated:true
  });

 },100);

};


/*
 * 입력창 포커스
 */
const handleFocus=()=>{

 setTimeout(()=>{

  scrollViewRef.current?.scrollToEnd({
   animated:true
  });

 },200);

};


/*
 * 일반 메시지 전송
 */
const handleSend=async()=>{

 const text=
  String(inputText||"").trim();

 if(
  !text||
  isEnding
 ){
  return;
 }


 clearAutocomplete();


 logUserChat(
  "일반 텍스트 전송 요청",
  {
   sessionId:currentSessionId,
   text
  }
 );


 try{

  const success=
   await sendMessage();


  if(success){

   scrollToBottom();

  }

 }catch(error){

  logUserChat(
   "일반 텍스트 전송 처리 실패",
   {
    error:error?.message
   }
  );

 }

};


/*
 * 추천문구 선택
 */
const handleAutocompleteSelect=async(item)=>{

 if(
  !item||
  isEnding
 ){
  return;
 }


 const replyCode=
  item?.replyCode;


 const text=
  String(
   item?.text||
   item?.message||
   item?.content||
   ""
  ).trim();


 if(
  replyCode===undefined||
  replyCode===null||
  replyCode===""
 ){

  logUserChat(
   "추천문구 선택 실패",
   {
    text,
    error:"replyCode가 없습니다.",
    item
   }
  );

  return;

 }


 clearAutocomplete();


 try{

  const success=
   await sendQuickReply({
    replyCode,
    text
   });


  if(success){

   setInputText("");

   scrollToBottom();

  }

 }catch(error){

  logUserChat(
   "추천문구 전송 처리 실패",
   {
    replyCode,
    text,
    error:error?.message
   }
  );

 }

};


/*
 * 통화 종료 모달
 */
const handleOpenEndModal=()=>{

 if(isEnding){
  return;
 }

 setIsEndModalVisible(true);

};


const handleConfirmEnd=()=>{

 if(isEnding){
  return;
 }

 setIsEndModalVisible(false);

 endCall();

};


const handleCancelEnd=()=>{

 if(isEnding){
  return;
 }

 setIsEndModalVisible(false);

};


/*
 * 입력창 위치
 *
 * 키보드 없음:
 * → 하단 네비 바로 위
 *
 * 키보드 있음:
 * → 키보드 위 + 추가 여백 40px
 */
const inputBottom=
 isKeyboardVisible
  ?keyboardHeight+KEYBOARD_EXTRA_OFFSET
  :BOTTOM_NAV_HEIGHT;


/*
 * Android에서는 직접 keyboardHeight로
 * 입력창 위치를 조절한다.
 *
 * iOS에서는 KeyboardAvoidingView의
 * padding을 사용한다.
 */
const keyboardBehavior=
 Platform.OS==="ios"
  ?"padding"
  :undefined;


return(

<KeyboardAvoidingView
 style={{
  flex:1,
  backgroundColor:"#f3f4f6"
 }}
 behavior={keyboardBehavior}
 keyboardVerticalOffset={0}
>


<IntercomHeader
 isEnding={isEnding}
 onOpenEndModal={
  handleOpenEndModal
 }
/>


<IntercomTimer
 seconds={seconds}
/>


<View
 style={{
  flex:1,
  minHeight:0
 }}
>


<ChatMessageList
 isLoading={isLoading}
 messages={messages}
 realtimePartial={
  realtimePartial
 }
 scrollViewRef={
  scrollViewRef
}
/>


{/*
 * 입력창 + 추천문구
 *
 * 키보드가 없으면:
 * bottom = 80
 *
 * 키보드가 올라오면:
 * bottom = 키보드 높이 + 40
 */}
<View
 pointerEvents="box-none"
 style={{
  position:"absolute",
  left:0,
  right:0,
  bottom:inputBottom,
  zIndex:100,
  elevation:100
 }}
>


<View
 style={{
  width:"100%",
  backgroundColor:"#ffffff",

  borderTopLeftRadius:28,
  borderTopRightRadius:28,

  shadowColor:"#000000",
  shadowOpacity:0.08,
  shadowRadius:8,

  shadowOffset:{
   width:0,
   height:-2
  },

  elevation:12
 }}
>


<MessageAutocomplete
 items={recommendations}
 onSelect={
  handleAutocompleteSelect
}
/>


<ChatInput
 inputText={inputText}

 onChangeText={(text)=>{

  setInputText(text);

  requestAutocomplete(text);

 }}

 onFocus={handleFocus}

 onSend={handleSend}

 disabled={isEnding}
/>


</View>


</View>


</View>


<EndCallModal
 visible={isEndModalVisible}
 isEnding={isEnding}

 onConfirm={
  handleConfirmEnd
 }

 onCancel={
  handleCancelEnd
 }

 onRequestClose={
  handleCancelEnd
 }
/>


</KeyboardAvoidingView>

);

}