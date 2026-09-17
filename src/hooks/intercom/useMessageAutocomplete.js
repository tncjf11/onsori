import {useState} from "react";
import axios from "axios";
import BASE_URL from "../../api/config";

export default function useMessageAutocomplete({sessionId,token}){

const [recommendations,setRecommendations]=useState([]);


const requestAutocomplete=async(text)=>{

const inputText=
 String(text||"").trim();


if(!inputText||!sessionId||!token){

setRecommendations([]);

return;

}


try{

const response=
 await axios.post(
  `${BASE_URL}/api/recommend`,
  {
   sessionId,
   message:inputText
  },
  {
   headers:{
    Authorization:`Bearer ${token}`
   },
   timeout:10000
  }
 );


const data=response.data;


const result=
 Array.isArray(data)
 ? data
 : Array.isArray(data?.data)
 ? data.data
 : Array.isArray(data?.recommendations)
 ? data.recommendations
 : Array.isArray(data?.result)
 ? data.result
 : [];


setRecommendations(result);


}catch(error){

console.log(
 "[AUTOCOMPLETE] 추천 실패",
 error?.response?.data||error?.message
);

setRecommendations([]);

}

};


const clearAutocomplete=()=>{

setRecommendations([]);

};


return{

recommendations,

requestAutocomplete,

clearAutocomplete

};

}