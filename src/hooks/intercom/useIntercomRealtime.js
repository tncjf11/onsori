import {useRef} from "react";
import {Vibration} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {subscribeSessionTopics} from "../../services/realtimeSocket";

export default function useIntercomRealtime({
 isMountedRef,
 logUserChat,
 moveToIdleMainTab,
}){

const unsubscribeRef=useRef(null);
const partialRef=useRef("");
const utteranceSeqRef=useRef(0);
const remoteEndHandledRef=useRef(false);


const normalizeMessage=(message)=>{

const sender=
 String(
  message?.senderType||
  message?.sender||
  message?.role||
  ""
 ).toUpperCase();

return{
 id:
  String(
   message?.messageId||
   message?.id||
   `realtime-${Date.now()}`
  ),

 messageId:
  message?.messageId||
  message?.id||
  null,

 text:
  String(
   message?.content||
   message?.messageText||
   message?.text||
   message?.message||
   ""
  ),

 type:
  sender==="USER"||
  sender==="RESIDENT"||
  sender==="SEND"||
  sender==="OUTGOING"
   ?"send"
   :"receive",

 senderType:
  message?.senderType||
  sender,

 createdAt:
  message?.createdAt||
  new Date().toISOString()
};

};



const stopRealtimeSubscription=()=>{

if(unsubscribeRef.current){

try{

unsubscribeRef.current();

}catch(error){

logUserChat(
 "실시간 구독 해제 실패",
 error?.message
);

}

unsubscribeRef.current=null;

logUserChat(
 "실시간 STOMP 구독 중지"
);

}

};



const clearRealtimePartial=(setRealtimePartial)=>{

partialRef.current="";

if(setRealtimePartial){

setRealtimePartial("");

}

};



const vibrateForNewVisitorUtterance=async(sessionId)=>{

try{

const setting=
 await AsyncStorage.getItem(
  "subtitleVibrate"
 );

if(setting==="true"){

Vibration.vibrate(400);

logUserChat(
 "실시간 방문자 자막 진동",
 {
  sessionId
 }
);

}

}catch(error){

logUserChat(
 "진동 설정 확인 실패",
 error?.message
);

}

};



const commitPartial=(text,setMessages)=>{

const safeText=
 String(text||"").trim();


if(!safeText){

return;

}


setMessages(prev=>{

const exists=
 prev.some(
  item=>
   item.type==="receive"&&
   item.text===safeText
 );


if(exists){

return prev;

}


return[
 ...prev,
 {
  id:
   `realtime-${Date.now()}-${++utteranceSeqRef.current}`,
  messageId:null,
  text:safeText,
  type:"receive",
  senderType:"VISITOR",
  messageType:"REALTIME_STT",
  createdAt:
   new Date().toISOString(),
  isRealtimeCommitted:true
 }
];

});

};



const handleRealtimeTranscript=(
 sessionId,
 payload,
 setRealtimePartial,
 setMessages
)=>{

if(!payload){

return;

}


if(
 payload.sessionId&&
 String(payload.sessionId)!==
 String(sessionId)
){

return;

}



const text=
 String(
  payload.text||
  ""
 ).trim();



if(!text){

return;

}



const previous=
 String(
  partialRef.current||
  ""
 ).trim();



const newUtterance=
 previous&&
 text!==previous&&
 !text.startsWith(previous);



if(newUtterance){

commitPartial(
 previous,
 setMessages
);

vibrateForNewVisitorUtterance(
 sessionId
);

}



if(!previous){

vibrateForNewVisitorUtterance(
 sessionId
);

}



partialRef.current=text;



if(isMountedRef.current){

setRealtimePartial(text);

}

};



const handleRealtimeMessage=(
 sessionId,
 payload,
 setMessages
)=>{

if(!payload){

return;

}


if(
 payload.sessionId&&
 String(payload.sessionId)!==
 String(sessionId)
){

return;

}



const message=
 normalizeMessage(
  payload
 );



if(!message.text){

return;

}



setMessages(prev=>{


const exists=
 prev.some(
  item=>
   item.messageId&&
   message.messageId&&
   String(item.messageId)===
   String(message.messageId)
 );


if(exists){

return prev;

}


return[
 ...prev,
 message
];

});


logUserChat(
 "실시간 메시지 수신",
 {
  sessionId,
  text:message.text,
  type:message.type
 }
);

};



const handleStatus=(sessionId,payload)=>{

const status=
 String(
  payload?.status||
  ""
 )
 .toUpperCase();



if(
 ![
  "CLOSED",
  "ENDED",
  "COMPLETE",
  "COMPLETED"
 ].includes(status)
){

return;

}



if(remoteEndHandledRef.current){

return;

}



remoteEndHandledRef.current=true;


stopRealtimeSubscription();



moveToIdleMainTab({

screen:"히스토리",

endedSessionId:sessionId

});


};



const startRealtimeSubscription=(
 sessionId,
 setMessages,
 setRealtimePartial
)=>{


stopRealtimeSubscription();



if(!sessionId){

return;

}



partialRef.current="";

remoteEndHandledRef.current=false;



logUserChat(
 "실시간 STOMP 구독 시작",
 {
  sessionId
 }
);



unsubscribeRef.current=
 subscribeSessionTopics(
  sessionId,
  {

   onRealtimeTranscript:
    payload=>
     handleRealtimeTranscript(
      sessionId,
      payload,
      setRealtimePartial,
      setMessages
     ),


   onMessage:
    payload=>
     handleRealtimeMessage(
      sessionId,
      payload,
      setMessages
     ),


   onStatus:
    payload=>
     handleStatus(
      sessionId,
      payload
     )

  }
 );

};



return{

startRealtimeSubscription,

stopRealtimeSubscription,

clearRealtimePartial,

partialRef

};

}