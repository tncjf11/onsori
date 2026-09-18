import React,{useState,useEffect,useRef,useCallback} from "react";
import {ScrollView,TouchableOpacity,ActivityIndicator,Alert} from "react-native";
import styled from "styled-components/native";
import {SafeAreaView as SafeAreaContainer} from "react-native-safe-area-context";
import {useNavigation,useIsFocused} from "@react-navigation/native";
import {Ionicons} from "@expo/vector-icons";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BASE_URL from "../../api/config";
import MonitoringItem from "../../components/MonitoringItem";
import {subscribeTopic} from "../../services/realtimeSocket";

const bellIcon=require("../../assets/bell.png");

const CLOSED_SESSION_STATUSES=new Set([
"CLOSED",
"ENDED",
"COMPLETE",
"COMPLETED",
"FINISHED",
"SUCCESS",
"FAILED",
"MISSED",
"NO_ANSWER",
"CANCELED",
"CANCELLED"
]);

const ACTIVE_SESSION_STATUSES=new Set([
"OPEN",
"CALLING",
"TALKING",
"ONGOING",
"ACTIVE",
"CONNECTED",
"INCOMING"
]);

const logAdminMonitoring=(message,data)=>{
if(data!==undefined){
console.log(`[ADMIN_MONITORING] ${message}`,data);
}else{
console.log(`[ADMIN_MONITORING] ${message}`);
}
};

export default function AdminMonitoringScreen(){
const navigation=useNavigation();
const isFocused=useIsFocused();
const [monitoringList,setMonitoringList]=useState([]);
const [isLoading,setIsLoading]=useState(true);
const activeCount=monitoringList.length;
const isMountedRef=useRef(true);
const adminMonitoringUnsubscribeRef=useRef(null);
const pollingTimerRef=useRef(null);
const fetchingRef=useRef(false);

const parseServerDate=useCallback((isoString)=>{
if(!isoString)return null;
try{
const stringValue=String(isoString).trim();
const hasExplicitTimezone=stringValue.endsWith("Z")||/[+-]\d{2}:\d{2}$/.test(stringValue);
if(hasExplicitTimezone){
const date=new Date(stringValue);
return Number.isNaN(date.getTime())?null:date;
}
const normalized=stringValue.replace("T"," ");
const [datePart,timePart="00:00:00"]=normalized.split(" ");
const [year,month,day]=datePart.split("-").map(Number);
const [hour=0,minute=0,second=0]=timePart.split(":").map(value=>Number(String(value).split(".")[0]));
if(!year||!month||!day)return null;
return new Date(year,month-1,day,hour,minute,second);
}catch{
return null;
}
},[]);

const formatStartedTime=useCallback((isoString)=>{
const date=parseServerDate(isoString);
if(!date||Number.isNaN(date.getTime()))return "시간 정보 없음";
const hh=String(date.getHours()).padStart(2,"0");
const mm=String(date.getMinutes()).padStart(2,"0");
return `${hh}:${mm}`;
},[parseServerDate]);

const normalizeStatus=useCallback((statusValue)=>{
return String(statusValue||"").trim().toUpperCase();
},[]);

const getSessionId=useCallback((session={})=>{
return session.sessionId??session.id??session.callSessionId??session.intercomSessionId??session.session?.id??null;
},[]);

const getSessionStatus=useCallback((session={})=>{
return normalizeStatus(
session.status||
session.sessionStatus||
session.callStatus||
session.state||
session.connectionState||
""
);
},[normalizeStatus]);

const hasEndedTime=useCallback((session={})=>{
return Boolean(
session.endedAt||
session.endTime||
session.closedAt||
session.completedAt||
session.finishedAt
);
},[]);

const isEndedSession=useCallback((session={})=>{
const status=getSessionStatus(session);
if(hasEndedTime(session))return true;
if(CLOSED_SESSION_STATUSES.has(status))return true;
return false;
},[getSessionStatus,hasEndedTime]);

const isActiveSession=useCallback((session={})=>{
const sessionId=getSessionId(session);
const status=getSessionStatus(session);
if(!sessionId)return false;
if(isEndedSession(session))return false;
if(!status)return true;
return ACTIVE_SESSION_STATUSES.has(status);
},[getSessionId,getSessionStatus,isEndedSession]);

const getStatusLabel=useCallback((session={})=>{
const status=getSessionStatus(session);
if(isEndedSession(session)){
if(
status==="FAILED"||
status==="MISSED"||
status==="NO_ANSWER"||
status==="CANCELED"||
status==="CANCELLED"
){
return "미응답";
}
return "종료";
}
if(
status==="OPEN"||
status==="CALLING"||
status==="INCOMING"
){
return "호출 중";
}
if(
status==="TALKING"||
status==="ONGOING"||
status==="ACTIVE"||
status==="CONNECTED"
){
return "통화 중";
}
if(!status)return "통화 중";
return "확인 필요";
},[getSessionStatus,isEndedSession]);

const getStartedAt=useCallback((session={})=>{
return(
session.startedAt||
session.startTime||
session.createdAt||
session.requestedAt||
session.timestamp||
""
);
},[]);

const getDeviceUid=useCallback((session={})=>{
return(
session.deviceUid||
session.deviceId||
session.device?.deviceUid||
session.device?.id||
"장치 정보 없음"
);
},[]);

const getLocation=useCallback((session={})=>{
return session.location||session.deviceLocation||session.device?.location||"";
},[]);

const mapMonitoringItem=useCallback((session={})=>{
const sessionId=getSessionId(session);
const startedAt=getStartedAt(session);
const deviceUid=getDeviceUid(session);
const location=getLocation(session);
const title=location?`${deviceUid} (${location})`:`${deviceUid}`;
return{
...session,
id:sessionId,
sessionId,
title,
time:formatStartedTime(startedAt),
status:getSessionStatus(session),
statusLabel:getStatusLabel(session),
startedAt,
deviceUid,
location
};
},[getSessionId,getStartedAt,getDeviceUid,getLocation,formatStartedTime,getSessionStatus,getStatusLabel]);

const extractMonitoringSessions=useCallback((responseData)=>{
if(Array.isArray(responseData?.data))return responseData.data;
if(Array.isArray(responseData))return responseData;
if(Array.isArray(responseData?.content))return responseData.content;
if(Array.isArray(responseData?.sessions))return responseData.sessions;
if(Array.isArray(responseData?.monitoringList))return responseData.monitoringList;
if(Array.isArray(responseData?.data?.content))return responseData.data.content;
if(Array.isArray(responseData?.data?.sessions))return responseData.data.sessions;
if(Array.isArray(responseData?.data?.monitoringList))return responseData.data.monitoringList;
if(Array.isArray(responseData?.result))return responseData.result;
if(Array.isArray(responseData?.data?.result))return responseData.data.result;
return [];
},[]);

const makeStatusSummary=useCallback((sessions=[])=>{
return sessions.reduce((acc,item)=>{
const status=getSessionStatus(item)||"UNKNOWN";
acc[status]=(acc[status]||0)+1;
return acc;
},{});
},[getSessionStatus]);

const fetchActiveSessions=useCallback(async(isSilent=false)=>{
if(fetchingRef.current)return;
fetchingRef.current=true;
try{
if(!isSilent&&isMountedRef.current){
setIsLoading(true);
logAdminMonitoring("초기 조회 시작");
}
const token=await AsyncStorage.getItem("adminToken");
if(!token){
logAdminMonitoring("adminToken 없음 - 로그인 화면 이동");
if(isMountedRef.current)setMonitoringList([]);
if(isMountedRef.current)navigation.navigate("AdminLogin");
return;
}
const response=await axios.get(
`${BASE_URL}/api/admin/monitoring`,
{
headers:{
Authorization:`Bearer ${token}`
}
}
);
const rawSessions=extractMonitoringSessions(response.data);
const activeSessions=rawSessions.filter(isActiveSession);
const mappedList=activeSessions
.map(mapMonitoringItem)
.filter(item=>item.sessionId)
.sort((a,b)=>{
const bTime=parseServerDate(b.startedAt)?.getTime()||0;
const aTime=parseServerDate(a.startedAt)?.getTime()||0;
return bTime-aTime;
});
const statusSummary=makeStatusSummary(rawSessions);
logAdminMonitoring("세션 조회",{
success:response.data?.success,
total:rawSessions.length,
active:mappedList.length,
filtered:rawSessions.length-mappedList.length,
statusSummary
});
if(isMountedRef.current)setMonitoringList(mappedList);
}catch(error){
const serverError=
error.response?.data?.message||
JSON.stringify(error.response?.data)||
error.message;
logAdminMonitoring("실시간 모니터링 조회 실패",serverError);
if(isMountedRef.current&&!isSilent)setMonitoringList([]);
}finally{
fetchingRef.current=false;
if(!isSilent&&isMountedRef.current)setIsLoading(false);
}
},[
navigation,
extractMonitoringSessions,
isActiveSession,
mapMonitoringItem,
parseServerDate,
makeStatusSummary
]);

const stopAdminMonitoringSubscription=useCallback(()=>{
if(adminMonitoringUnsubscribeRef.current){
try{
adminMonitoringUnsubscribeRef.current();
}catch(error){
logAdminMonitoring(
"관리자 모니터링 구독 해제 실패",
error?.message
);
}
adminMonitoringUnsubscribeRef.current=null;
logAdminMonitoring("관리자 모니터링 WebSocket 구독 중지");
}
},[]);

const removeSessionFromMonitoringList=useCallback((sessionId)=>{
if(sessionId===null||sessionId===undefined)return;
setMonitoringList(prev=>prev.filter(
item=>String(item.sessionId)!==String(sessionId)
));
},[]);

const handleAdminMonitoringMessage=useCallback((payload)=>{
if(!payload||typeof payload!=="object"){
logAdminMonitoring("관리자 모니터링 이벤트 형식 확인 필요",payload);
return;
}
const sessionId=payload.sessionId??payload.id??null;
const status=normalizeStatus(payload.status);
logAdminMonitoring(
"관리자 모니터링 WebSocket 수신",
{
sessionId,
status,
message:payload.message||null
}
);
if(!sessionId)return;
if(CLOSED_SESSION_STATUSES.has(status)){
removeSessionFromMonitoringList(sessionId);
return;
}
if(ACTIVE_SESSION_STATUSES.has(status)){
fetchActiveSessions(true);
}
},[normalizeStatus,removeSessionFromMonitoringList,fetchActiveSessions]);

const startAdminMonitoringSubscription=useCallback(()=>{
stopAdminMonitoringSubscription();
logAdminMonitoring(
"관리자 모니터링 WebSocket 구독 시작",
{
destination:"/topic/admin/monitoring"
}
);
adminMonitoringUnsubscribeRef.current=subscribeTopic(
"/topic/admin/monitoring",
handleAdminMonitoringMessage
);
},[stopAdminMonitoringSubscription,handleAdminMonitoringMessage]);

const stopPolling=useCallback(()=>{
if(pollingTimerRef.current){
clearInterval(pollingTimerRef.current);
pollingTimerRef.current=null;
logAdminMonitoring("신규 세션 polling 중지");
}
},[]);

useEffect(()=>{
isMountedRef.current=true;
return()=>{
isMountedRef.current=false;
stopPolling();
stopAdminMonitoringSubscription();
};
},[stopPolling,stopAdminMonitoringSubscription]);

useEffect(()=>{
if(!isFocused){
stopPolling();
stopAdminMonitoringSubscription();
return;
}
logAdminMonitoring(
"화면 포커스 - 초기 조회 + WebSocket 구독 + 신규 세션 polling 시작"
);
fetchActiveSessions(false);
startAdminMonitoringSubscription();
stopPolling();
pollingTimerRef.current=setInterval(()=>{
fetchActiveSessions(true);
},3000);
return()=>{
stopPolling();
stopAdminMonitoringSubscription();
};
},[
isFocused,
fetchActiveSessions,
startAdminMonitoringSubscription,
stopAdminMonitoringSubscription,
stopPolling
]);

const handlePressSession=useCallback((item)=>{
if(!item.sessionId)return;
if(!isActiveSession(item)){
logAdminMonitoring(
"세션 상세 이동 차단 - 종료 또는 비활성 세션",
{
sessionId:item.sessionId,
status:item.status,
deviceUid:item.deviceUid
}
);
Alert.alert(
"종료된 통화",
"이미 종료된 통화입니다.\n호출 로그 또는 기록 화면에서 확인해 주세요."
);
fetchActiveSessions(true);
return;
}
logAdminMonitoring(
"세션 상세 이동",
{
sessionId:item.sessionId,
status:item.status,
deviceUid:item.deviceUid
}
);
navigation.navigate(
"AdminMonitoringDetail",
{
sessionId:item.sessionId,
item
}
);
},[isActiveSession,fetchActiveSessions,navigation]);

return(
<Container>
<Header>
<Logo source={bellIcon} resizeMode="contain"/>
<HeaderTitle>인터폰 실시간 모니터링</HeaderTitle>
</Header>
{isLoading?(
<LoadingWrapper>
<ActivityIndicator size="large" color="#1EC949"/>
<LoadingText>실시간 통화 정보를 불러오는 중...</LoadingText>
</LoadingWrapper>
):(
<ScrollView
showsVerticalScrollIndicator={false}
contentContainerStyle={{paddingBottom:30}}
>
<SummarySection>
<SummaryText>
진행 중인 통화 <BoldText color="#1EC949">{activeCount}</BoldText>건
</SummaryText>
</SummarySection>
<ListArea>
{monitoringList.length>0?(
monitoringList.map(item=>(
<TouchableOpacity
key={String(item.sessionId)}
activeOpacity={0.7}
onPress={()=>handlePressSession(item)}
>
<MonitoringItem item={item}/>
</TouchableOpacity>
))
):(
<EmptyWrapper>
<Ionicons name="radio-outline" size={44} color="#DDD"/>
<EmptyText>현재 진행 중인 통화가 없습니다.</EmptyText>
</EmptyWrapper>
)}
</ListArea>
</ScrollView>
)}
</Container>
);
}

const Container=styled(SafeAreaContainer)`
flex:1;
background-color:#F4F5F7;
`;

const Header=styled.View`
flex-direction:row;
align-items:center;
padding:15px 20px;
background-color:#fff;
border-bottom-width:1px;
border-bottom-color:#F0F0F0;
`;

const Logo=styled.Image`
width:28px;
height:28px;
margin-right:10px;
`;

const HeaderTitle=styled.Text`
font-size:20px;
font-weight:800;
color:#333;
`;

const SummarySection=styled.View`
padding:20px 20px 10px;
`;

const SummaryText=styled.Text`
font-size:15px;
color:#555;
font-weight:600;
`;

const BoldText=styled.Text`
font-weight:900;
color:${props=>props.color};
font-size:17px;
`;

const ListArea=styled.View`
width:100%;
padding:0 15px;
`;

const LoadingWrapper=styled.View`
flex:1;
justify-content:center;
align-items:center;
padding-top:100px;
`;

const LoadingText=styled.Text`
font-size:13px;
color:#718096;
margin-top:12px;
font-weight:600;
`;

const EmptyWrapper=styled.View`
padding:80px 20px;
align-items:center;
`;

const EmptyText=styled.Text`
font-size:14px;
color:#BBB;
font-weight:600;
margin-top:15px;
text-align:center;
`;