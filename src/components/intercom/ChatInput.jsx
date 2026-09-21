import {TouchableOpacity} from "react-native";
import styled from "styled-components/native";

const sendInactive=require("../../assets/send_inactive.png");
const sendActive=require("../../assets/send_active.png");

export default function ChatInput({
 inputText,
 onChangeText,
 onSend,
 onFocus,
 disabled=false,
}){

const canSend=
 String(inputText||"").trim().length>0;

const handleSubmit=()=>{
 if(
  !disabled&&
  canSend
 ){
  onSend?.();
 }
};

return(
<InputSection>

<InputBar>

<InputField
 value={inputText}
 onChangeText={onChangeText}
 onFocus={onFocus}
 editable={!disabled}
 multiline={false}
 returnKeyType="send"
 blurOnSubmit={false}
 placeholder="방문자에게 전달할 내용을 입력하세요"
 placeholderTextColor="#999999"
 onSubmitEditing={handleSubmit}
/>

<SendButton
 onPress={handleSubmit}
 disabled={
  disabled||
  !canSend
 }
 activeOpacity={0.7}
 hitSlop={{
  top:6,
  bottom:6,
  left:6,
  right:6
 }}
>

<SendBtnIcon
 source={
  canSend
   ?sendActive
   :sendInactive
 }
/>

</SendButton>

</InputBar>

</InputSection>
);
}

const InputSection=styled.View`
width:100%;
background-color:#ffffff;
padding:10px 16px 12px;
border-top-left-radius:28px;
border-top-right-radius:28px;
z-index:20;
elevation:10;
flex-shrink:0;
`;

const InputBar=styled.View`
width:100%;
min-height:54px;
flex-direction:row;
align-items:center;
background-color:#f5f6f8;
border-radius:27px;
padding:6px 10px 6px 12px;
`;

const InputField=styled.TextInput`
flex:1;
font-size:15px;
color:#222222;
padding:8px 12px;
min-height:40px;
`;

const SendButton=styled.TouchableOpacity`
width:42px;
height:42px;
align-items:center;
justify-content:center;
flex-shrink:0;
`;

const SendBtnIcon=styled.Image`
width:38px;
height:38px;
`;