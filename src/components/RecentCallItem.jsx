import React from "react";
import styled from "styled-components/native";
import { useNavigation } from "@react-navigation/native";

const iconMessage = require("../assets/recent_message.png");
const iconBell = require("../assets/recent_bell.png");
const iconMissed = require("../assets/recent_missed.png");
const iconRejected = require("../assets/recent_rejected.png");

const KOREA_OFFSET_MS = 9 * 60 * 60 * 1000;

const STATUS_TAGS = new Set([
  "연결 / 진행 중",
  "연결/진행 중",
  "연결/진행중",
  "진행 중",
  "진행중",
  "종료 / 완료",
  "종료/완료",
  "완료",
  "미응답 / 중단",
  "미응답/중단",
  "중단",
]);

const RecentCallItem = ({
  item = {},
  isAdmin = false,
  token = "READY",
  onPress,
}) => {
  const navigation = useNavigation();

  const parseDate = (value) => {
    if (!value) return null;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    return date;
  };

  const formatTimeGap = (dateValue) => {
    const parsedDate = parseDate(dateValue);
    if (!parsedDate) return item.time || item.displayTime || "";

    const correctedDate = new Date(parsedDate.getTime() + KOREA_OFFSET_MS);
    const diffMs = Date.now() - correctedDate.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return "방금 전";
    if (diffMins < 60) return `${diffMins}분 전`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}시간 전`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "어제";
    if (diffDays <= 7) return `${diffDays}일 전`;

    const year = correctedDate.getFullYear();
    const month = String(correctedDate.getMonth() + 1).padStart(2, "0");
    const day = String(correctedDate.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const getDisplayTime = () => {
    const dateValue =
      item.createdAt ||
      item.startedAt ||
      item.startTime ||
      item.endedAt ||
      item.endTime ||
      item.raw?.createdAt ||
      item.raw?.startedAt ||
      item.raw?.startTime ||
      item.raw?.endedAt ||
      item.raw?.endTime;

    if (dateValue) {
      return formatTimeGap(dateValue);
    }

    if (item.time === "9시간 전") {
      return "방금 전";
    }

    return item.time || item.displayTime || "";
  };

  const getIcon = (type) => {
    if (type === "rejected") return iconRejected;
    if (type === "missed") return iconMissed;
    if (type === "message") return iconMessage;
    if (type === "bell") return iconBell;

    return iconBell;
  };

  const getTags = () => {
    const baseTags = Array.isArray(item.tags)
      ? item.tags
          .filter(Boolean)
          .map((tag) => String(tag).trim())
          .filter((tag) => !STATUS_TAGS.has(tag))
      : [];

    return ["종료 / 완료", ...baseTags];
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

  const tags = getTags();

  return (
    <ItemContainer activeOpacity={0.7} onPress={handlePress} isAdmin={isAdmin}>
      <CallIcon source={getIcon(item.type)} resizeMode="contain" />

      <ContentArea>
        <TopRow>
          <CallTitle numberOfLines={1}>
            {item.title || "인터폰 호출 알림"}
          </CallTitle>

          <CallTime>{getDisplayTime()}</CallTime>
        </TopRow>

        <TagRow>
          {tags.map((tag, idx) => (
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