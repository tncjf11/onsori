import {Modal,Dimensions} from "react-native";
import styled from "styled-components/native";

const {width:SCREEN_WIDTH}=Dimensions.get("window");
const callEndOverlayImg=require("../../assets/call_end_overlay.png");

export default function EndCallModal({
 visible,
 isEnding=false,
 onConfirm,
 onCancel,
 onRequestClose,
}){

 const handleRequestClose=()=>{
  if(isEnding)return;
  if(onRequestClose){
   onRequestClose();
   return;
  }
  onCancel?.();
 };

 return(
  <Modal
   transparent
   visible={Boolean(visible)}
   animationType="fade"
   onRequestClose={handleRequestClose}
   statusBarTranslucent
  >
   <OverlayBackground>
    <OverlayImageCard
     source={callEndOverlayImg}
     resizeMode="contain"
    >
     <TransparentButtonRow>
      <TransparentTouchArea
       onPress={onConfirm}
       disabled={isEnding}
       activeOpacity={0.7}
      />
      <TransparentTouchArea
       onPress={onCancel}
       disabled={isEnding}
       activeOpacity={0.7}
      />
     </TransparentButtonRow>
    </OverlayImageCard>
   </OverlayBackground>
  </Modal>
 );
}

const OverlayBackground=styled.View`
 flex:1;
 background-color:rgba(0,0,0,0.45);
 justify-content:center;
 align-items:center;
`;

const OverlayImageCard=styled.ImageBackground`
 width:${SCREEN_WIDTH*0.8}px;
 height:${SCREEN_WIDTH*0.8*0.52}px;
`;

const TransparentButtonRow=styled.View`
 flex-direction:row;
 position:absolute;
 bottom:15px;
 width:100%;
 height:50px;
 padding:0 15px;
 justify-content:space-between;
`;

const TransparentTouchArea=styled.TouchableOpacity`
 width:47%;
 height:100%;
`;