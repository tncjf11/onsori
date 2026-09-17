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
 realtimePartial,
]);


return(
<ChatArea>

{
isLoading?

<LoadingContainer>
<ActivityIndicator
 size="large"
 color="#06F393"
/>
</LoadingContainer>

:

<ScrollView
 ref={scrollViewRef}
 showsVerticalScrollIndicator={false}
 keyboardShouldPersistTaps="handled"
 onContentSizeChange={scrollToBottom}
>

{
visibleMessages.map((msg,index)=>{

if(!String(msg.text||"").trim()){
 return null;
}

return msg.type==="receive"

?

<ReceiveBubble
 key={
  msg.id||
  `receive-${index}`
 }
>
<BubbleTextContainer>
<ReceiveBubbleText>
{msg.text}
</ReceiveBubbleText>
</BubbleTextContainer>
</ReceiveBubble>

:

<SendBubble
 key={
  msg.id||
  `send-${index}`
 }
>
<SendBubbleText>
{msg.text}
</SendBubbleText>
</SendBubble>

})
}


{
String(realtimePartial||"").trim()&&

<ReceiveBubble key="realtime-partial">

<BubbleTextContainer>

<ReceiveBubbleText>
{realtimePartial}
</ReceiveBubbleText>

</BubbleTextContainer>

</ReceiveBubble>
}


</ScrollView>

}

</ChatArea>
);

}


const ChatArea=styled.View`
flex:1;
padding:18px 16px;
`;

const LoadingContainer=styled.View`
flex:1;
justify-content:center;
align-items:center;
`;

const ReceiveBubble=styled.View`
width:100%;
margin-bottom:14px;
`;

const BubbleTextContainer=styled.View`
max-width:78%;
background-color:#ffffff;
border-radius:20px;
padding:14px 16px;
shadow-color:#000;
shadow-opacity:0.04;
shadow-radius:5px;
elevation:2;
`;

const ReceiveBubbleText=styled.Text`
font-size:15px;
line-height:22px;
color:#222222;
`;

const SendBubble=styled.View`
width:100%;
align-items:flex-end;
margin-bottom:14px;
`;

const SendBubbleText=styled.Text`
max-width:78%;
background-color:#06f393;
color:#ffffff;
padding:14px 16px;
border-radius:20px;
font-size:15px;
line-height:22px;
font-weight:700;
`;