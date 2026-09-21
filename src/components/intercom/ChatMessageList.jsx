import {ActivityIndicator,ScrollView} from "react-native";
import {useEffect,useMemo} from "react";
import styled from "styled-components/native";

export default function ChatMessageList({
 isLoading,
 messages=[],
 realtimePartial="",
 scrollViewRef,
}){

const visibleMessages=useMemo(
 ()=>messages.filter(
  msg=>msg.type!=="system"
 ),
 [messages]
);

const scrollToBottom=()=>{
 setTimeout(()=>{
  scrollViewRef?.current?.scrollToEnd({
   animated:true
  });
 },50);
};

useEffect(()=>{
 scrollToBottom();
},[
 visibleMessages.length,
 realtimePartial
]);

return(
<ChatArea>

{isLoading?(
<LoadingContainer>
<ActivityIndicator
 size="large"
 color="#06F393"
/>
</LoadingContainer>
):(
<ScrollView
 ref={scrollViewRef}
 showsVerticalScrollIndicator={false}
 keyboardShouldPersistTaps="handled"
 contentContainerStyle={{
  paddingTop:4,
  paddingBottom:20,
  flexGrow:1,
 }}
 onContentSizeChange={scrollToBottom}
>

{visibleMessages.map((msg,index)=>{

const text=
String(msg.text||"").trim();

if(!text){
 return null;
}

if(msg.type==="receive"){

return(
<ReceiveRow
 key={
  msg.id||
  `receive-${index}`
 }
>
<ReceiveBubble>
<ReceiveBubbleText>
{text}
</ReceiveBubbleText>
</ReceiveBubble>
</ReceiveRow>
);

}

return(
<SendRow
 key={
  msg.id||
  `send-${index}`
 }
>
<SendBubble>
<SendBubbleText>
{text}
</SendBubbleText>
</SendBubble>
</SendRow>
);

})}

{String(realtimePartial||"").trim()?(
<ReceiveRow key="realtime-partial">
<ReceiveBubble>
<ReceiveBubbleText>
{String(realtimePartial).trim()}
</ReceiveBubbleText>
</ReceiveBubble>
</ReceiveRow>
):null}

</ScrollView>
)}

</ChatArea>
);
}

const ChatArea=styled.View`
flex:1;
min-height:0;
padding:10px 16px 0;
background-color:#f3f4f6;
`;

const LoadingContainer=styled.View`
flex:1;
justify-content:center;
align-items:center;
`;

const ReceiveRow=styled.View`
width:100%;
align-items:flex-start;
margin-bottom:10px;
`;

const ReceiveBubble=styled.View`
align-self:flex-start;
max-width:78%;
background-color:#ffffff;
border-radius:18px;
padding:11px 14px;
shadow-color:#000000;
shadow-opacity:0.035;
shadow-radius:4px;
shadow-offset:0px 1px;
elevation:1;
`;

const ReceiveBubbleText=styled.Text`
font-size:15px;
line-height:22px;
color:#222222;
flex-shrink:1;
`;

const SendRow=styled.View`
width:100%;
align-items:flex-end;
margin-bottom:10px;
`;

const SendBubble=styled.View`
align-self:flex-end;
max-width:78%;
background-color:#06f393;
border-radius:18px;
padding:11px 14px;
`;

const SendBubbleText=styled.Text`
font-size:15px;
line-height:22px;
color:#ffffff;
font-weight:700;
flex-shrink:1;
`;