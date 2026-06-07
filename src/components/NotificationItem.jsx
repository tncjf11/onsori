import React from "react";
import styled from "styled-components/native";
import { Ionicons } from "@expo/vector-icons";

const NotificationItem = ({
  icon = "notifications-outline",
  title = "알림",
  msg = "",
  time = "",
  isBlack = false,
}) => {
  return (
    <NotiRow>
      <IconBg style={{ backgroundColor: isBlack ? "#333333" : "#06F393" }}>
        <Ionicons name={icon} size={20} color="white" />
      </IconBg>

      <ContentArea>
        <TopRow>
          <NotiTitle numberOfLines={1}>{title}</NotiTitle>
          <NotiTime>{time}</NotiTime>
        </TopRow>

        <NotiMsg numberOfLines={1}>{msg}</NotiMsg>
      </ContentArea>
    </NotiRow>
  );
};

export default NotificationItem;

const NotiRow = styled.View`
  flex-direction: row;
  padding: 15px 20px;
  border-bottom-width: 1px;
  border-bottom-color: #f9f9f9;
`;

const IconBg = styled.View`
  width: 42px;
  height: 42px;
  border-radius: 21px;
  justify-content: center;
  align-items: center;
  margin-right: 15px;
`;

const ContentArea = styled.View`
  flex: 1;
`;

const TopRow = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;

const NotiTitle = styled.Text`
  flex: 1;
  font-size: 15px;
  font-weight: 700;
  color: #222;
  margin-right: 8px;
`;

const NotiTime = styled.Text`
  font-size: 12px;
  color: #AAAAAA;
`;

const NotiMsg = styled.Text`
  font-size: 13px;
  color: #777777;
  margin-top: 4px;
`;