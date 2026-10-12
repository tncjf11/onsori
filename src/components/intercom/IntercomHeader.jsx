import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity } from "react-native";
import styled from "styled-components/native";

const backIcon = require("../../assets/back_icon.png");
const bellIcon = require("../../assets/bell.png");

export default function IntercomHeader({
  isEnding = false,
  onBackPress,
  onOpenEndModal,
}) {
  return (
    <Header>
      <TouchableOpacity
        onPress={onBackPress}
        activeOpacity={0.7}
        disabled={isEnding}
      >
        <BackIcon
          source={backIcon}
          resizeMode="contain"
        />
      </TouchableOpacity>

      <HeaderTitleContainer>
        <Logo
          source={bellIcon}
          resizeMode="contain"
        />

        <HeaderTitle>
          인터폰 실시간
        </HeaderTitle>
      </HeaderTitleContainer>

      <TouchableOpacity
        onPress={onOpenEndModal}
        disabled={isEnding}
        activeOpacity={0.7}
        style={{
          padding: 4,
          opacity: isEnding ? 0.5 : 1,
        }}
      >
        <Ionicons
          name="trash-outline"
          size={24}
          color="#FF4D4D"
        />
      </TouchableOpacity>
    </Header>
  );
}

const Header = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background-color: #ffffff;
  border-bottom-width: 1px;
  border-bottom-color: #eeeeee;
`;

const BackIcon = styled.Image`
  width: 24px;
  height: 24px;
`;

const HeaderTitleContainer = styled.View`
  flex-direction: row;
  align-items: center;
  margin-left: 10px;
`;

const Logo = styled.Image`
  width: 28px;
  height: 28px;
  margin-right: 6px;
`;

const HeaderTitle = styled.Text`
  font-size: 18px;
  font-weight: 800;
  color: #111827;
`;