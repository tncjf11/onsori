import {useEffect,useRef,useState} from "react";
import {KeyboardAvoidingView,Platform} from "react-native";
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
 console.log(`[USER_CHAT] ${message}`,data||"");
};

const moveToIdleMainTab=({screen="홈",endedSessionId=null}={})=>{
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

const normalizeMessages=(list=[])=>{

if(!Array.isArray(list)){
 return [];
}

return list.map((item,index)=>{

const sender=
 String(item.senderType||"").toUpperCase();

return{
 id:
  item.messageId||
  item.id||
  `msg-${index}`,

 messageId:
  item.messageId||
  null,

 text:
  item.content||
  item.text||
  item.message||
  "",

 type:
  sender==="USER"
  ?"send"
  :"receive",

 senderType:
  sender,

 messageType:
  item.messageType||
  null,

 createdAt:
  item.createdAt||
  new Date().toISOString()
};

});

};


const {
 currentSessionId,
 token,
 inputText,
 setInputText,
 sendMessage,
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

 navigation,
 isMountedRef,
 logUserChat,
 moveToIdleMainTab,
 normalizeMessages,
 setMessages
});


const {
 startRealtimeSubscription,
 stopRealtimeSubscription
}=useIntercomRealtime({
 isMountedRef,
 logUserChat,
 moveToIdleMainTab
});


const {
 recommendations,
 requestAutocomplete,
 clearAutocomplete
}=useMessageAutocomplete({
 sessionId:currentSessionId,
 token
});


useEffect(()=>{

initializeSession();

return()=>{

isMountedRef.current=false;

stopRealtimeSubscription();

};

},[]);



useEffect(()=>{

if(currentSessionId){

startRealtimeSubscription(
 currentSessionId,
 setMessages,
 setRealtimePartial
);

}

},[currentSessionId]);



const handleFocus=()=>{

setTimeout(()=>{

scrollViewRef.current?.scrollToEnd({
 animated:true
});

},200);

};



const handleSend=()=>{

const text=
 String(inputText||"").trim();

if(!text){
 return;
}

sendMessage();

clearAutocomplete();

setTimeout(()=>{

scrollViewRef.current?.scrollToEnd({
 animated:true
});

},200);

};



return(
<KeyboardAvoidingView
style={{flex:1}}
behavior={
 Platform.OS==="ios"
 ?"padding"
 :undefined
}
keyboardVerticalOffset={80}
>

<IntercomHeader
onOpenEndModal={()=>{
 setIsEndModalVisible(true);
}}
isEnding={isEnding}
/>

<IntercomTimer
seconds={seconds}
/>

<ChatMessageList
isLoading={isLoading}
messages={messages}
realtimePartial={realtimePartial}
scrollViewRef={scrollViewRef}
/>

<MessageAutocomplete
items={recommendations}
onSelect={(text)=>{
 setInputText(text);
}}
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

<EndCallModal
visible={isEndModalVisible}
isEnding={isEnding}
onConfirmEnd={()=>{
 setIsEndModalVisible(false);
 endCall();
}}
onCancel={()=>{
 setIsEndModalVisible(false);
}}
onRequestClose={()=>{
 setIsEndModalVisible(false);
}}
/>

</KeyboardAvoidingView>
);

}