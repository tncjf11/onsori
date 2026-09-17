import {TouchableOpacity,TextInput} from "react-native";
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


return(
<InputSection>

<InputBar>

<TextInput
 value={inputText}
 onChangeText={onChangeText}
 onFocus={onFocus}
 editable={!disabled}
 placeholder="방문자에게 전달할 내용을 입력하세요"
 placeholderTextColor="#999"
 style={{
  flex:1,
  fontSize:15,
  paddingHorizontal:12,
 }}
/>

<TouchableOpacity
 onPress={onSend}
 disabled={
  disabled||
  !canSend
 }
>

<SendBtnIcon
 source={
  canSend
   ? sendActive
   : sendInactive
 }
/>

</TouchableOpacity>

</InputBar>

</InputSection>
);

}


const InputSection=styled.View`
background-color:#ffffff;
padding:14px 16px 28px;
border-top-left-radius:28px;
border-top-right-radius:28px;
`;

const InputBar=styled.View`
min-height:54px;
flex-direction:row;
align-items:center;
background-color:#f5f6f8;
border-radius:27px;
padding:6px 12px;
`;

const SendBtnIcon=styled.Image`
width:38px;
height:38px;
`;