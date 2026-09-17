import styled from "styled-components/native";

export default function MessageAutocomplete({
 items=[],
 onSelect,
}){

const getText=(item)=>{
 return String(
  item?.text||
  item?.message||
  item?.content||
  item||
  ""
 ).trim();
};

const suggestions=
 items
 .map(getText)
 .filter(Boolean)
 .slice(0,5);

if(!suggestions.length){
 return null;
}

return(
<Container>
{
 suggestions.map((text,index)=>(
  <Suggestion
   key={`auto-${index}`}
   onPress={()=>{
    onSelect?.(text);
   }}
   activeOpacity={0.7}
  >
   <SuggestionText>
    {text}
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