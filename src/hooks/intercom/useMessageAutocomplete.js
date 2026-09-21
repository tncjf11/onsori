import {useEffect,useRef,useState} from "react";
import axios from "axios";
import BASE_URL from "../../api/config";

export default function useMessageAutocomplete({
 sessionId,
 token,
}){

const [recommendations,setRecommendations]=useState([]);
const requestSeqRef=useRef(0);
const debounceRef=useRef(null);

const requestAutocomplete=async(text)=>{

const inputText=
 String(text||"").trim();

const requestSeq=
 ++requestSeqRef.current;

if(debounceRef.current){
 clearTimeout(debounceRef.current);
 debounceRef.current=null;
}

if(
 !inputText||
 !sessionId||
 !token
){
 setRecommendations([]);
 return;
}

debounceRef.current=setTimeout(async()=>{

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

  if(
   typeof item==="string"
  ){
   return{
    replyCode:null,
    text:item,
    score:0
   };
  }

  return{
   ...item,
   replyCode:
    item?.replyCode??null,
   text:String(
    item?.text||
    ""
   ).trim(),
   score:
    Number(item?.score)||0
  };

 })
 .filter(item=>
  item.text.length>0
 );

setRecommendations(normalized);

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

setRecommendations([]);

}

},300);

};

const clearAutocomplete=()=>{

requestSeqRef.current++;

if(debounceRef.current){
 clearTimeout(debounceRef.current);
 debounceRef.current=null;
}

setRecommendations([]);

};

useEffect(()=>{

return()=>{

requestSeqRef.current++;

if(debounceRef.current){
 clearTimeout(debounceRef.current);
 debounceRef.current=null;
}

};

},[]);

return{
 recommendations,
 requestAutocomplete,
 clearAutocomplete
};

}