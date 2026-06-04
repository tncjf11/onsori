import React from "react";
import styled from "styled-components/native";

// ✅ 이미지 경로 (src/assets 폴더 기준)
const onIcon = require("../assets/on_icon.png");
const offIcon = require("../assets/off_icon.png");
const wifiOn = require("../assets/wifi_on.png");
const wifiOff = require("../assets/wifi_off.png");

const StatusCard = ({ type, isOn, mainText, subText }) => {
  // 어떤 이미지를 보여줄지 결정하는 로직
  const getIcon = () => {
    if (type === "device") {
      return isOn ? onIcon : offIcon;
    } else {
      return isOn ? wifiOn : wifiOff;
    }
  };

  return (
    <CardContainer>
      <StatusIcon source={getIcon()} resizeMode="contain" />
      <TextGroup>
        <MainText>{mainText}</MainText>
        <SubText>{subText}</SubText>
      </TextGroup>
    </CardContainer>
  );
};

export default StatusCard;

const CardContainer = styled.View`
  flex-direction: row;
  align-items: center;
  background-color: white;
  padding: 15px 20px;
  border-bottom-width: 1px;
  border-bottom-color: #f0f0f0;
`;

const StatusIcon = styled.Image`
  width: 45px;
  height: 45px;
  margin-right: 15px;
`;

const TextGroup = styled.View``;

const MainText = styled.Text`
  font-size: 16px;
  font-weight: 700;
  color: #111;
`;

const SubText = styled.Text`
  font-size: 13px;
  color: #999;
  margin-top: 2px;
`;