import{Client}from"@stomp/stompjs";
import SockJS from"sockjs-client";
import BASE_URL from"../api/config";

const SOCKJS_URL=`${String(BASE_URL).replace(/\/$/,"")}/ws`;
export const REALTIME_SOCKET_URL=SOCKJS_URL;
let client=null;
let subscriptionSeq=0;
const subscriptions=new Map();

const log=(message,data)=>{
 if(typeof __DEV__!=="undefined"&&!__DEV__)return;
 if(data!==undefined){
  console.log(`[REALTIME_SOCKET] ${message}`,data);
 }else{
  console.log(`[REALTIME_SOCKET] ${message}`);
 }
};

const logError=(message,data)=>{
 console.error(`[REALTIME_SOCKET] ${message}`,data);
};

const parsePayload=(frame)=>{
 if(!frame?.body)return null;
 try{
  return JSON.parse(frame.body);
 }catch{
  return frame.body;
 }
};

const clearSubscriptionHandles=()=>{
 subscriptions.forEach((item,key)=>{
  subscriptions.set(key,{...item,stompSubscription:null});
 });
};

const attachSubscription=(key)=>{
 if(!client?.connected)return;
 const item=subscriptions.get(key);
 if(!item||item.stompSubscription)return;
 const stompSubscription=client.subscribe(item.destination,frame=>{
  const payload=parsePayload(frame);
  log("메시지 수신",{destination:item.destination,payload});
  try{
   item.callback(payload,frame);
  }catch(error){
   logError("callback 처리 실패",error);
  }
 });
 subscriptions.set(key,{...item,stompSubscription});
 log("구독 완료",item.destination);
};

const attachAllSubscriptions=()=>{
 subscriptions.forEach((_,key)=>{
  attachSubscription(key);
 });
};

const createClient=()=>{
 if(client)return client;
 client=new Client({
  webSocketFactory:()=>new SockJS(SOCKJS_URL),
  reconnectDelay:3000,
  connectionTimeout:20000,
  heartbeatIncoming:0,
  heartbeatOutgoing:0,
  debug:message=>{
   log(`STOMP ${message}`);
  }
 });
 client.onConnect=frame=>{
  log("연결 성공",{
   url:SOCKJS_URL,
   version:frame?.headers?.version
  });
  attachAllSubscriptions();
 };
 client.onDisconnect=()=>{
  log("연결 해제");
  clearSubscriptionHandles();
 };
 client.onWebSocketClose=event=>{
  log("WebSocket 종료",{
   code:event?.code,
   reason:event?.reason
  });
  clearSubscriptionHandles();
 };
 client.onWebSocketError=error=>{
  logError("WebSocket 오류",error);
 };
 client.onStompError=frame=>{
  logError("STOMP 오류",frame);
 };
 return client;
};

export const connectRealtimeSocket=()=>{
 const stompClient=createClient();
 if(!stompClient.active&&!stompClient.connected){
  log("연결 시작",SOCKJS_URL);
  stompClient.activate();
 }
 return stompClient;
};

export const subscribeTopic=(destination,callback)=>{
 if(!destination){
  throw new Error("destination이 필요합니다.");
 }
 if(typeof callback!=="function"){
  throw new Error("callback 함수가 필요합니다.");
 }
 const key=`sub-${++subscriptionSeq}`;
 subscriptions.set(key,{
  destination,
  callback,
  stompSubscription:null
 });
 connectRealtimeSocket();
 attachSubscription(key);
 return()=>{
  const item=subscriptions.get(key);
  if(!item)return;
  try{
   item.stompSubscription?.unsubscribe();
  }catch(error){
   logError("구독 해제 실패",error);
  }
  subscriptions.delete(key);
  log("구독 해제",item.destination);
 };
};

const sessionTopic=(sessionId,suffix)=>{
 if(sessionId===null||sessionId===undefined||sessionId===""){
  throw new Error("sessionId가 필요합니다.");
 }
 return`/topic/sessions/${sessionId}/${suffix}`;
};

export const subscribeSessionTopics=(sessionId,{
 onRealtimeTranscript,
 onMessage,
 onMessageUpdate,
 onStatus,
 onTranscript
}={})=>{
 const cleanupList=[];
 if(typeof onRealtimeTranscript==="function"){
  cleanupList.push(
   subscribeTopic(
    sessionTopic(sessionId,"realtime-transcripts"),
    onRealtimeTranscript
   )
  );
 }
 if(typeof onTranscript==="function"){
  cleanupList.push(
   subscribeTopic(
    sessionTopic(sessionId,"transcripts"),
    onTranscript
   )
  );
 }
 if(typeof onMessage==="function"){
  cleanupList.push(
   subscribeTopic(
    sessionTopic(sessionId,"messages"),
    onMessage
   )
  );
 }
 if(typeof onMessageUpdate==="function"){
  cleanupList.push(
   subscribeTopic(
    sessionTopic(sessionId,"messages/update"),
    onMessageUpdate
   )
  );
 }
 if(typeof onStatus==="function"){
  cleanupList.push(
   subscribeTopic(
    sessionTopic(sessionId,"status"),
    onStatus
   )
  );
 }
 return()=>{
  cleanupList.forEach(cleanup=>{
   cleanup();
  });
 };
};

export const disconnectRealtimeSocket=async()=>{
 subscriptions.forEach(item=>{
  try{
   item.stompSubscription?.unsubscribe();
  }catch(error){
   logError("unsubscribe 실패",error);
  }
 });
 subscriptions.clear();
 if(!client)return;
 const currentClient=client;
 client=null;
 try{
  await currentClient.deactivate();
  log("WebSocket 완전 종료");
 }catch(error){
  logError("WebSocket 종료 실패",error);
 }
};

export const isRealtimeSocketConnected=()=>{
 return Boolean(client?.connected);
};