import {useState,useEffect} from "react";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BASE_URL from "../../api/config";

export default function useIntercomSession({
 initialSessionId,
 routeToken,
 isMountedRef,
 logUserChat,
 handleAuthExpired,
 moveToIdleMainTab,
 setMessages,
}){

const [currentSessionId,setCurrentSessionId]=useState(initialSessionId);
const [token,setToken]=useState(null);
const [isLoading,setIsLoading]=useState(true);
const [inputText,setInputText]=useState("");
const [seconds,setSeconds]=useState(0);
const [isEnding,setIsEnding]=useState(false);


const getSessionId=(session)=>{
 return session?.sessionId??session?.id??null;
};


const normalizeMessage=(message,index=0)=>{

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
   `message-${Date.now()}-${index}`
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
  new Date().toISOString(),
};

};


const normalizeMessages=(list=[])=>{

if(!Array.isArray(list)){
 return[];
}

return list
.map((item,index)=>
 normalizeMessage(item,index)
)
.filter(item=>
 item.text.trim()
);

};



const fetchCurrentSession=async(
 activeToken,
 deviceUid
)=>{

try{

const response=await axios.get(
 `${BASE_URL}/api/sessions/current`,
 {
  headers:{
   Authorization:`Bearer ${activeToken}`
  },
  params:{
   deviceUid
  }
 }
);

return response.data?.data||null;

}catch(error){

logUserChat(
 "현재 세션 조회 실패",
 error?.message
);

return null;

}

};



const connectCurrentSession=async(
 sessionId,
 activeToken
)=>{

try{

const response=await axios.post(
 `${BASE_URL}/api/sessions/${sessionId}/connect`,
 {},
 {
  headers:{
   Authorization:`Bearer ${activeToken}`
  }
 }
);

return response.data?.success!==false;

}catch(error){

logUserChat(
 "세션 연결 실패",
 error?.message
);

return false;

}

};



const fetchSessionMessages=async({
 targetSessionId,
 activeToken
})=>{

try{

const response=await axios.get(
 `${BASE_URL}/api/sessions/${targetSessionId}/messages`,
 {
  headers:{
   Authorization:`Bearer ${activeToken}`
  }
 }
);


if(
 response.data?.success&&
 Array.isArray(response.data.data)
){

setMessages(
 normalizeMessages(
  response.data.data
 )
);

}


}catch(error){

logUserChat(
 "메시지 조회 실패",
 error?.message
);

}

};



const sendMessage=async()=>{

const text=
 String(inputText||"").trim();


if(
 !text||
 !currentSessionId
){
 return;
}


const activeToken=
 token||
 await AsyncStorage.getItem(
  "accessToken"
);


if(!activeToken){
 return;
}


try{

await axios.post(
 `${BASE_URL}/api/sessions/${currentSessionId}/messages`,
 {
  message:text
 },
 {
  headers:{
   Authorization:`Bearer ${activeToken}`
  }
 }
);


setMessages(prev=>{

const exists=
 prev.some(item=>
  item.type==="send"&&
  item.text===text
 );


if(exists){
 return prev;
}


return[
 ...prev,
 {
  id:
   `local-send-${Date.now()}`,
  messageId:null,
  text,
  type:"send",
  senderType:"USER",
  createdAt:
   new Date().toISOString()
 }
];

});


setInputText("");


}catch(error){

logUserChat(
 "메시지 전송 실패",
 error?.message
);

}

};



const initializeSession=async()=>{

try{

setIsLoading(true);


const savedToken=
 await AsyncStorage.getItem(
  "accessToken"
 );


const activeToken=
 savedToken||
 routeToken;


setToken(activeToken);


if(!activeToken){

await handleAuthExpired();

return;

}


if(!initialSessionId){

moveToIdleMainTab({
 screen:"홈"
});

return;

}



const deviceUid=
 await AsyncStorage.getItem(
  "deviceUid"
);



const session=
 await fetchCurrentSession(
  activeToken,
  deviceUid
);



if(
 !session||
 String(
  getSessionId(session)
 )!==
 String(initialSessionId)
){

moveToIdleMainTab({
 screen:"히스토리",
 endedSessionId:
  initialSessionId
});

return;

}



setCurrentSessionId(
 initialSessionId
);



const connected=
 await connectCurrentSession(
  initialSessionId,
  activeToken
);



if(!connected){
 return;
}



await fetchSessionMessages({
 targetSessionId:
  initialSessionId,

 activeToken

});


}catch(error){

logUserChat(
 "세션 초기화 실패",
 error?.message
);


}finally{


if(isMountedRef.current){

setIsLoading(false);

}


}

};



const endCall=async()=>{

if(
 isEnding||
 !currentSessionId
){
 return;
}


setIsEnding(true);


const activeToken=
 token||
 await AsyncStorage.getItem(
  "accessToken"
);


try{


await axios.post(
 `${BASE_URL}/api/sessions/end`,
 {
  sessionId:
   currentSessionId
 },
 {
  headers:{
   Authorization:
    `Bearer ${activeToken}`
  }
 }
);



moveToIdleMainTab({
 screen:"히스토리",
 endedSessionId:
  currentSessionId
});



}catch(error){

logUserChat(
 "통화 종료 실패",
 error?.message
);


}finally{

setIsEnding(false);

}

};



useEffect(()=>{

const timer=
 setInterval(()=>{

  setSeconds(prev=>
   prev+1
  );

 },1000);


return()=>{

clearInterval(timer);

};

},[]);



return{

currentSessionId,
setCurrentSessionId,

token,
setToken,

isLoading,
setIsLoading,

inputText,
setInputText,

seconds,

isEnding,

sendMessage,

endCall,

fetchCurrentSession,

connectCurrentSession,

fetchSessionMessages,

initializeSession,

normalizeMessage,
normalizeMessages

};

}