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
     activeOpacity={0.7}
    >
     <IconBtn
      source={backIcon}
      resizeMode="contain"
     />
    </TouchableOpacity>
   </HeaderSide>

   <HeaderCenterSide>
    <HeaderCenter>
     <Logo
      source={bellIcon}
      resizeMode="contain"
     />
     <HeaderTitle>
      인터폰 실시간
     </HeaderTitle>
    </HeaderCenter>
   </HeaderCenterSide>

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
     activeOpacity={0.7}
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

const HeaderCenterSide=styled.View`
 width:120px;
 align-items:center;
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