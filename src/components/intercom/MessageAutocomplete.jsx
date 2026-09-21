import styled from "styled-components/native";

export default function MessageAutocomplete({
 items=[],
 onSelect,
}){

const suggestions=
 items
 .map(item=>{

  if(typeof item==="string"){
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
 )
 .slice(0,5);

if(!suggestions.length){
 return null;
}

return(
<Container>

{
suggestions.map((item,index)=>(
<Suggestion
 key={
  item.replyCode!=null
   ?`auto-${item.replyCode}`
   :`auto-${index}`
 }
 onPress={()=>{
  onSelect?.(item);
 }}
 activeOpacity={0.7}
>

<SuggestionText>
{item.text}
</SuggestionText>

</Suggestion>
))
}

</Container>
);
}

const Container=styled.View`
padding:8px 16px;
background-color:#fff;
`;

const Suggestion=styled.TouchableOpacity`
background-color:#eafff4;
padding:12px 14px;
border-radius:16px;
margin-bottom:6px;
border-width:1px;
border-color:#06f393;
`;

const SuggestionText=styled.Text`
font-size:14px;
color:#00a968;
font-weight:700;
`;