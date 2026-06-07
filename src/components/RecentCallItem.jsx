import React from "react";
import styled from "styled-components/native";
import { useNavigation } from "@react-navigation/native";

const iconMessage = require("../assets/recent_message.png");
const iconBell = require("../assets/recent_bell.png");
const iconMissed = require("../assets/recent_missed.png");
const iconRejected = require("../assets/recent_rejected.png");

const RecentCallItem = ({ item = {}, isAdmin = false, token = "READY", onPress }) => {
  const navigation = useNavigation();

  const getIcon = (type) => {
    switch (type) {
      case "message":
        return iconMessage;
      case "bell":
        return iconBell;
      case "missed":
        return iconMissed;
      case "rejected":
        return iconRejected;
      default:
        return iconBell;
    }
  };

  const handlePress = () => {
    const verifiedToken = token || "READY";

    if (onPress) {
      onPress(verifiedToken);
      return;
    }

    const targetScreen = isAdmin ? "AdminHistoryDetail" : "End";

    navigation.navigate(targetScreen, {
      item,
      logId: item.logId || item.id,
      sessionId: item.sessionId,
      token: verifiedToken,
    });
  };

  return (
    <ItemContainer activeOpacity={0.7} onPress={handlePress} isAdmin={isAdmin}>
      <CallIcon source={getIcon(item.type)} resizeMode="contain" />

      <ContentArea>
        <TopRow>
          <CallTitle numberOfLines={1}>
            {item.title || "인터폰 호출 알림"}
          </CallTitle>

          <CallTime>{item.time || item.displayTime || ""}</CallTime>
        </TopRow>

        <TagRow>
          {Array.isArray(item.tags) &&
            item.tags.map((tag, idx) => (
              <TagBox key={`${tag}-${idx}`}>
                <TagText>{tag}</TagText>
              </TagBox>
            ))}
        </TagRow>
      </ContentArea>
    </ItemContainer>
  );
};

export default RecentCallItem;

/* ================= 스타일 ================= */

const ItemContainer = styled.TouchableOpacity`
  flex-direction: row;
  padding: 15px 20px;
  background-color: #fff;
  border-bottom-width: ${(props) => (props.isAdmin ? "0px" : "1px")};
  border-bottom-color: #f9f9f9;
  align-items: center;
`;

const CallIcon = styled.Image`
  width: 42px;
  height: 42px;
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

const CallTitle = styled.Text`
  font-size: 16px;
  font-weight: 700;
  color: #222;
  flex: 1;
  margin-right: 10px;
`;

const CallTime = styled.Text`
  font-size: 12px;
  color: #bbb;
`;

const TagRow = styled.View`
  flex-direction: row;
  margin-top: 6px;
  flex-wrap: wrap;
`;

const TagBox = styled.View`
  background-color: #F2F4F7;
  padding: 3px 8px;
  border-radius: 4px;
  margin-right: 6px;
  margin-bottom: 2px;
`;

const TagText = styled.Text`
  font-size: 11px;
  color: #888;
  font-weight: 600;
`;