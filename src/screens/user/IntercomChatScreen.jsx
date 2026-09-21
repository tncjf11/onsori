import {useEffect,useRef,useState} from "react";
import {
 Keyboard,
 KeyboardAvoidingView,
 Platform,
 View
} from "react-native";
import {useRoute,useNavigation} from "@react-navigation/native";

import IntercomHeader from "../../components/intercom/IntercomHeader";
import IntercomTimer from "../../components/intercom/IntercomTimer";
import ChatMessageList from "../../components/intercom/ChatMessageList";
import ChatInput from "../../components/intercom/ChatInput";
import MessageAutocomplete from "../../components/intercom/MessageAutocomplete";
import EndCallModal from "../../components/intercom/EndCallModal";

import useIntercomSession from "../../hooks/intercom/useIntercomSession";
import useIntercomRealtime from "../../hooks/intercom/useIntercomRealtime";
import useMessageAutocomplete from "../../hooks/intercom/useMessageAutocomplete";


export default function IntercomChatScreen(){

const navigation=useNavigation();
const route=useRoute();

const scrollViewRef=useRef(null);
const isMountedRef=useRef(true);

const [messages,setMessages]=useState([]);
const [realtimePartial,setRealtimePartial]=useState("");
const [isEndModalVisible,setIsEndModalVisible]=useState(false);


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

 /*
  * 일반 텍스트 메시지
  */
 sendMessage,

 /*
  * 추천문구 빠른 응답
  */
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
 * 키보드가 올라오거나 내려갈 때
 * 최신 메시지가 보이도록 스크롤
 *
 * 입력창 자체의 위치는
 * KeyboardAvoidingView가 담당한다.
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
   ()=>{

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

    setTimeout(()=>{

     scrollViewRef.current?.scrollToEnd({
      animated:true
     });

    },100);

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
 *
 * 입력한 문장을 그대로
 * sendMessage()로 전송한다.
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


 /*
  * 추천문구가 떠 있다면 닫는다.
  */
 clearAutocomplete();


 logUserChat(
  "일반 텍스트 전송 요청",
  {
   sessionId:currentSessionId,
   text
  }
 );


 const success=
  await sendMessage();


 if(success){

  scrollToBottom();

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


 /*
  * 추천문구에는 replyCode가 필요하다.
  */
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


 /*
  * 추천 목록 닫기
  */
 clearAutocomplete();


 /*
  * 추천문구 전송
  */
 const success=
  await sendQuickReply({
   replyCode,
   text
  });


 if(success){

  setInputText("");

  scrollToBottom();

 }

};


/*
 * 종료 모달 열기
 */
const handleOpenEndModal=()=>{

 if(isEnding){
  return;
 }

 setIsEndModalVisible(true);

};


/*
 * 통화 종료 확인
 */
const handleConfirmEnd=()=>{

 if(isEnding){
  return;
 }

 setIsEndModalVisible(false);

 endCall();

};


/*
 * 종료 취소
 */
const handleCancelEnd=()=>{

 if(isEnding){
  return;
 }

 setIsEndModalVisible(false);

};


return(

<KeyboardAvoidingView
 style={{
  flex:1,
  backgroundColor:"#f3f4f6"
 }}
 behavior={
  Platform.OS==="ios"
   ?"padding"
   :"height"
 }
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


{/*
 * 채팅 영역
 *
 * 입력창이 absolute가 아니므로
 * 입력창과 채팅 영역 사이에
 * 이상한 빈 공간이 생기지 않는다.
 */}
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

</View>


{/*
 * 하단 입력 영역
 *
 * 일반 메시지 + 추천문구 모두 여기에서 처리한다.
 *
 * 화면 하단에 자연스럽게 붙고,
 * 키보드가 올라오면 KeyboardAvoidingView가
 * 전체 영역을 함께 올린다.
 */}
<View
 style={{
  width:"100%",
  flexShrink:0,
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