import React, { useState, useEffect } from "react";
import {
  ScrollView,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
} from "react-native";
import styled from "styled-components/native";
import { SafeAreaView as SafeAreaContainer } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  useIsFocused,
} from "@react-navigation/native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

import BASE_URL from "../../api/config";

const backIcon = require("../../assets/back_icon.png");
const iconWrench = require("../../assets/icon_wrench.png");

export default function AdminHistoryDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const isFocused = useIsFocused();

  const item = route.params?.item || {};
  const targetLogId =
    route.params?.logId ?? item.logId ?? item.id ?? null;
  const routeSessionId =
    route.params?.sessionId ?? item.sessionId ?? null;

  const [logInfo, setLogInfo] = useState(item);
  const [messages, setMessages] = useState([]);
  const [editHistory, setEditHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const getMessageText = (msg) => {
    return (
      msg.content ||
      msg.text ||
      msg.messageText ||
      msg.message ||
      msg.visitorText ||
      "자막 내용 없음"
    );
  };

  const getOriginalText = (msg) => {
    return (
      msg.originalContent ||
      msg.originalText ||
      msg.beforeContent ||
      msg.beforeText ||
      ""
    );
  };

  const getMessageId = (msg, idx) => {
    return (
      msg.messageId ??
      msg.transcriptId ??
      msg.id ??
      msg.chunkOrder ??
      `msg-${idx}`
    );
  };

  const isEditedMessage = (msg) => {
    const originalText = getOriginalText(msg).trim();
    const currentText = getMessageText(msg).trim();

    return originalText && currentText && originalText !== currentText;
  };

  const buildFallbackMessages = (logData) => {
    if (!logData) return [];

    const fallback = [];

    if (logData.visitorText && logData.visitorText.trim() !== "") {
      fallback.push({
        id: "visitor-text",
        content: logData.visitorText.trim(),
        senderType: "VISITOR",
        createdAt: logData.createdAt,
      });
    }

    if (logData.residentReply && logData.residentReply.trim() !== "") {
      fallback.push({
        id: "resident-reply",
        content: logData.residentReply.trim(),
        senderType: "USER",
        createdAt: logData.updatedAt || logData.createdAt,
      });
    }

    if (
      fallback.length === 0 &&
      logData.summary &&
      logData.summary.trim() !== "" &&
      logData.summary.trim() !== "내용 없음"
    ) {
      fallback.push({
        id: "summary-fallback",
        content: `요약: ${logData.summary.trim()}`,
        senderType: "SYSTEM",
        createdAt: logData.createdAt,
      });
    }

    return fallback;
  };

  const fetchSessionMessages = async (sessionId, token) => {
    if (!sessionId) return [];

    const response = await axios.get(
      `${BASE_URL}/api/admin/monitoring/${sessionId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = response.data?.data || {};

    return data.messages || data.conversationMessages || data.transcripts || [];
  };

  const fetchHistoryDetail = async () => {
    try {
      setIsLoading(true);

      const token = await AsyncStorage.getItem("adminToken");

      if (!token) {
        Alert.alert("오류", "관리자 로그인이 필요합니다.");
        navigation.navigate("AdminLogin");
        return;
      }

      let mergedLogInfo = { ...item };

      if (targetLogId) {
        try {
          const logResponse = await axios.get(
            `${BASE_URL}/api/admin/intercom-logs/${targetLogId}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          if (logResponse.data?.success && logResponse.data?.data) {
            mergedLogInfo = {
              ...mergedLogInfo,
              ...logResponse.data.data,
            };
          }
        } catch (error) {
          console.log("호출 기록 상세 조회 실패:", error?.message);
        }
      }

      const sessionId = mergedLogInfo.sessionId || routeSessionId;

      setLogInfo(mergedLogInfo);

      let fetchedMessages = [];

      if (sessionId) {
        try {
          fetchedMessages = await fetchSessionMessages(sessionId, token);
        } catch (error) {
          console.log("세션 대화 조회 실패:", error?.message);
        }
      }

      if (!Array.isArray(fetchedMessages) || fetchedMessages.length === 0) {
        fetchedMessages =
          mergedLogInfo.messages ||
          mergedLogInfo.conversationMessages ||
          mergedLogInfo.transcripts ||
          buildFallbackMessages(mergedLogInfo);
      }

      setMessages(Array.isArray(fetchedMessages) ? fetchedMessages : []);
      setEditHistory(
        Array.isArray(fetchedMessages)
          ? fetchedMessages.filter(isEditedMessage)
          : []
      );
    } catch (error) {
      const serverError =
        error.response?.data?.message ||
        JSON.stringify(error.response?.data) ||
        error.message;

      console.error("통화 기록 상세 조회 실패:", serverError);
      setMessages([]);
      setEditHistory([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      fetchHistoryDetail();
    }
  }, [isFocused, targetLogId, routeSessionId]);

  const parseServerDate = (isoString) => {
    if (!isoString) return null;

    try {
      const hasExplicitTimezone =
        isoString.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(isoString);

      if (hasExplicitTimezone) {
        const date = new Date(isoString);
        return Number.isNaN(date.getTime()) ? null : date;
      }

      const normalized = isoString.replace("T", " ");
      const [datePart, timePart = "00:00:00"] = normalized.split(" ");
      const [year, month, day] = datePart.split("-").map(Number);
      const [hour = 0, minute = 0, second = 0] = timePart
        .split(":")
        .map((value) => Number(String(value).split(".")[0]));

      if (!year || !month || !day) return null;

      return new Date(year, month - 1, day, hour, minute, second);
    } catch {
      return null;
    }
  };

  const formatTime = (isoString) => {
    const date = parseServerDate(isoString);

    if (!date || Number.isNaN(date.getTime())) return "";

    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");

    return `${hh}:${mm}`;
  };

  const formatDateTime = (isoString) => {
    const date = parseServerDate(isoString);

    if (!date || Number.isNaN(date.getTime())) return "";

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");

    return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
  };

  const isSystemMessage = (msg) => {
    const sender = String(
      msg.senderType || msg.sender || msg.role || msg.type || ""
    ).toUpperCase();

    return sender === "SYSTEM";
  };

  const isVisitorMessage = (msg) => {
    const sender = String(
      msg.senderType || msg.sender || msg.role || msg.type || ""
    ).toUpperCase();

    if (
      sender === "RESIDENT" ||
      sender === "ADMIN" ||
      sender === "USER" ||
      sender === "SEND" ||
      sender === "OUTGOING"
    ) {
      return false;
    }

    return true;
  };

  const getDisplayTitle = () => {
    if (logInfo.deviceUid) {
      return `${logInfo.deviceUid} 통화 기록`;
    }

    if (logInfo.userName || logInfo.name) {
      return `${logInfo.userName || logInfo.name} 통화 기록`;
    }

    if (logInfo.location) {
      return `${logInfo.location} 통화 기록`;
    }

    return "통화 기록 상세";
  };

  return (
    <Container>
      <Header>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <BackIcon source={backIcon} resizeMode="contain" />
        </TouchableOpacity>

        <HeaderTitle numberOfLines={1}>{getDisplayTitle()}</HeaderTitle>

        <View style={{ width: 24 }} />
      </Header>

      {isLoading ? (
        <LoadingWrapper>
          <ActivityIndicator size="large" color="#1EC949" />
        </LoadingWrapper>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <ChatCard>
            {messages.length > 0 ? (
              messages.map((msg, idx) => {
                const isSystem = isSystemMessage(msg);
                const isVisitor = isVisitorMessage(msg);
                const msgTime = formatTime(
                  msg.createdAt || msg.timestamp || msg.time
                );
                const messageText = getMessageText(msg);

                if (isSystem) {
                  return (
                    <SystemMessageBox key={getMessageId(msg, idx)}>
                      <SystemMessageText>{messageText}</SystemMessageText>
                    </SystemMessageBox>
                  );
                }

                return (
                  <BubbleWrapper
                    key={getMessageId(msg, idx)}
                    isVisitor={isVisitor}
                  >
                    {!isVisitor && <BubbleTimeRight>{msgTime}</BubbleTimeRight>}

                    <BubbleBox isVisitor={isVisitor}>
                      <BubbleText isVisitor={isVisitor}>
                        {messageText}
                      </BubbleText>
                    </BubbleBox>

                    {isVisitor && <BubbleTimeLeft>{msgTime}</BubbleTimeLeft>}
                  </BubbleWrapper>
                );
              })
            ) : (
              <EmptyText>대화 기록이 없습니다.</EmptyText>
            )}
          </ChatCard>

          <HistoryCard>
            <SectionHeader>
              <WrenchIcon source={iconWrench} resizeMode="contain" />
              <SectionTitle>수정 이력</SectionTitle>
            </SectionHeader>

            {editHistory.length > 0 ? (
              editHistory.map((hist, idx) => {
                const isLast = idx === editHistory.length - 1;

                return (
                  <HistoryItem
                    key={getMessageId(hist, idx)}
                    style={
                      isLast
                        ? {
                            borderBottomWidth: 0,
                            paddingBottom: 0,
                            marginBottom: 0,
                          }
                        : {}
                    }
                  >
                    <HistoryHeader>
                      <HistoryIcon>↪</HistoryIcon>

                      <HistoryMainText numberOfLines={1}>
                        {getMessageText(hist)}
                      </HistoryMainText>

                      <HistoryTime>
                        {formatDateTime(hist.updatedAt || hist.createdAt)}
                      </HistoryTime>
                    </HistoryHeader>

                    <HistorySubText>
                      수정 전: {getOriginalText(hist) || "원본 내용 없음"}
                    </HistorySubText>
                  </HistoryItem>
                );
              })
            ) : (
              <EmptyText>수정된 이력이 없습니다.</EmptyText>
            )}
          </HistoryCard>
        </ScrollView>
      )}
    </Container>
  );
}

/* ================= 스타일 정의 ================= */

const Container = styled(SafeAreaContainer)`
  flex: 1;
  background-color: #F4F5F7;
`;

const Header = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background-color: #F4F5F7;
`;

const BackIcon = styled.Image`
  width: 24px;
  height: 24px;
  tint-color: #333;
`;

const HeaderTitle = styled.Text`
  flex: 1;
  margin-horizontal: 12px;
  font-size: 20px;
  font-weight: 800;
  color: #333;
  text-align: center;
`;

const ChatCard = styled.View`
  background-color: #EFEFEF;
  margin: 15px 20px;
  padding: 25px 20px;
  border-radius: 20px;
`;

const BubbleWrapper = styled.View`
  flex-direction: row;
  justify-content: ${(props) => (props.isVisitor ? "flex-start" : "flex-end")};
  align-items: flex-end;
  margin-bottom: 15px;
`;

const BubbleBox = styled.View`
  background-color: ${(props) => (props.isVisitor ? "#FFFFFF" : "#1EC949")};
  padding: 12px 18px;
  border-radius: 20px;
  max-width: 75%;
`;

const BubbleText = styled.Text`
  font-size: 15px;
  font-weight: 500;
  color: ${(props) => (props.isVisitor ? "#333" : "#FFF")};
`;

const BubbleTimeLeft = styled.Text`
  font-size: 12px;
  color: #888;
  margin-left: 8px;
  margin-bottom: 5px;
`;

const BubbleTimeRight = styled.Text`
  font-size: 12px;
  color: #888;
  margin-right: 8px;
  margin-bottom: 5px;
`;

const SystemMessageBox = styled.View`
  align-self: center;
  background-color: #DDDDDD;
  padding: 8px 14px;
  border-radius: 18px;
  margin-bottom: 15px;
`;

const SystemMessageText = styled.Text`
  font-size: 12px;
  color: #666;
  font-weight: 600;
`;

const HistoryCard = styled.View`
  background-color: #FFFFFF;
  margin: 10px 20px;
  padding: 20px;
  border-radius: 20px;
  elevation: 2;
  shadow-color: #000;
  shadow-opacity: 0.05;
  shadow-radius: 5px;
`;

const SectionHeader = styled.View`
  flex-direction: row;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom-width: 1px;
  border-bottom-color: #F0F0F0;
`;

const WrenchIcon = styled.Image`
  width: 22px;
  height: 22px;
  margin-right: 10px;
  tint-color: #555;
`;

const SectionTitle = styled.Text`
  font-size: 16px;
  font-weight: 700;
  color: #333;
`;

const HistoryItem = styled.View`
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom-width: 1px;
  border-bottom-color: #F4F5F7;
  border-style: dashed;
`;

const HistoryHeader = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 5px;
`;

const HistoryIcon = styled.Text`
  font-size: 16px;
  color: #666;
  margin-right: 8px;
`;

const HistoryMainText = styled.Text`
  flex: 1;
  font-size: 14px;
  color: #333;
  font-weight: 600;
`;

const HistoryTime = styled.Text`
  font-size: 12px;
  color: #999;
  margin-left: 10px;
`;

const HistorySubText = styled.Text`
  font-size: 13px;
  color: #777;
  margin-left: 24px;
  line-height: 20px;
`;

const LoadingWrapper = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
`;

const EmptyText = styled.Text`
  text-align: center;
  font-size: 14px;
  color: #999;
  padding: 20px 0;
`;