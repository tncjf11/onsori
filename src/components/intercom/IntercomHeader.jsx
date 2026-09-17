import {TouchableOpacity} from "react-native";
import styled from "styled-components/native";

const backIcon=require("../../assets/back_icon.png");
const bellIcon=require("../../assets/bell.png");
const callEndIcon=require("../../assets/call_end.png");

export default function IntercomHeader({
 isEnding=false,
 onOpenEndModal,
}){

return(
<Header>

<HeaderSide>

<TouchableOpacity
 onPress={onOpenEndModal}
 disabled={isEnding}
>
<IconBtn
 source={backIcon}
 resizeMode="contain"
/>
</TouchableOpacity>

</HeaderSide>


<HeaderSide
 style={{
  width:120,
 }}
>

<HeaderCenter>

<Logo
 source={bellIcon}
 resizeMode="contain"
/>

<HeaderTitle>
인터폰 실시간
</HeaderTitle>

</HeaderCenter>

</HeaderSide>


<HeaderSide
 style={{
  flexDirection:"row",
  justifyContent:"flex-end",
  alignItems:"center",
 }}
>

<TouchableOpacity
 onPress={onOpenEndModal}
 disabled={isEnding}
 style={{
  marginLeft:10,
 }}
>

<EndIcon
 source={callEndIcon}
 resizeMode="contain"
/>

</TouchableOpacity>

</HeaderSide>


</Header>
);

}


const Header=styled.View`
height:64px;
flex-direction:row;
justify-content:space-between;
align-items:center;
padding:0 18px;
background-color:#ffffff;
border-bottom-width:1px;
border-bottom-color:#eeeeee;
`;

const HeaderSide=styled.View`
width:90px;
`;

const HeaderCenter=styled.View`
flex-direction:row;
align-items:center;
justify-content:center;
`;

const IconBtn=styled.Image`
width:26px;
height:26px;
`;

const EndIcon=styled.Image`
width:30px;
height:30px;
`;

const Logo=styled.Image`
width:30px;
height:30px;
margin-right:8px;
`;

const HeaderTitle=styled.Text`
font-size:17px;
font-weight:800;
color:#111827;
`;