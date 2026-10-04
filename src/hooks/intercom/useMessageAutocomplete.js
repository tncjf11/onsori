import {useEffect,useRef,useState} from "react";
import axios from "axios";
import BASE_URL from "../../api/config";

const RECOMMEND_INTERVAL=2000;

export default function useMessageAutocomplete({
 sessionId,
 token,
}){

const [recommendations,setRecommendations]=useState([]);

const intervalRef=useRef(null);
const requestSeqRef=useRef(0);
const latestTextRef=useRef("");


const fetchRecommendations=async(text)=>{

const inputText=
 String(text||"").trim();

if(
 !inputText||
 !sessionId||
 !token
){
 setRecommendations([]);
 return;
}


const requestSeq=
 ++requestSeqRef.current;


try{

const response=
 await axios.get(
  `${BASE_URL}/api/quick-replies/suggest`,
  {
   params:{
    q:inputText
   },

   headers:{
    Authorization:
     `Bearer ${token}`
   },

   timeout:10000
  }
 );


/*
 * 이전 요청의 응답이 늦게 도착한 경우
 * 최신 추천 결과를 덮어쓰지 않도록 한다.
 */
if(
 requestSeq!==
 requestSeqRef.current
){
 return;
}


const data=
 response?.data;


const result=
 Array.isArray(data)
 ?data
 :Array.isArray(data?.data)
 ?data.data
 :Array.isArray(data?.result)
 ?data.result
 :Array.isArray(data?.recommendations)
 ?data.recommendations
 :[];


const normalized=
 result
 .map(item=>{

  /*
   * 백엔드가 문자열 배열로 보내는 경우
   */
  if(
   typeof item==="string"
  ){
   return{
    replyCode:null,
    text:item.trim(),
    score:0
   };
  }


  /*
   * 백엔드가 객체로 보내는 경우
   */
  return{
   ...item,

   replyCode:
    item?.replyCode??
    null,

   text:String(
    item?.text||
    item?.message||
    item?.content||
    ""
   ).trim(),

   score:
    Number(item?.score)||0
  };

 })
 .filter(item=>
  item.text.length>0
 );


setRecommendations(
 normalized.slice(0,5)
 );


}catch(error){

if(
 requestSeq!==
 requestSeqRef.current
){
 return;
}


console.log(
 "[AUTOCOMPLETE] 추천 실패",
 {
  status:
   error?.response?.status,

  data:
   error?.response?.data,

  message:
   error?.message
 }
);


/*
 * 추천 API가 일시적으로 실패해도
 * 기존 채팅 기능에는 영향을 주지 않는다.
 */
setRecommendations([]);

}

};


const startRecommendationPolling=(text)=>{

const inputText=
 String(text||"").trim();


/*
 * 기존 polling이 있으면 먼저 제거
 */
if(intervalRef.current){

 clearInterval(
  intervalRef.current
 );

 intervalRef.current=null;

}


latestTextRef.current=
 inputText;


if(
 !inputText||
 !sessionId||
 !token
){

requestSeqRef.current++;

setRecommendations([]);

return;

}


/*
 * 입력 직후 한 번 바로 요청
 */
fetchRecommendations(
 inputText
);


/*
 * 이후 일정한 간격으로
 * 현재 입력값을 다시 요청
 */
intervalRef.current=
 setInterval(()=>{

  const latestText=
   String(
    latestTextRef.current||""
   ).trim();


  if(
   !latestText||
   !sessionId||
   !token
  ){
   return;
  }


  fetchRecommendations(
   latestText
  );

 },RECOMMEND_INTERVAL);

};


const requestAutocomplete=(text)=>{

const inputText=
 String(text||"").trim();


latestTextRef.current=
 inputText;


startRecommendationPolling(
 inputText
 );

};


const clearAutocomplete=()=>{

requestSeqRef.current++;

latestTextRef.current="";


if(intervalRef.current){

 clearInterval(
  intervalRef.current
 );

 intervalRef.current=null;

}


setRecommendations([]);

};


useEffect(()=>{

return()=>{

requestSeqRef.current++;

latestTextRef.current="";


if(intervalRef.current){

 clearInterval(
  intervalRef.current
 );

 intervalRef.current=null;

}

};

},[]);


return{
 recommendations,
 requestAutocomplete,
 clearAutocomplete
};

}