import React, { useState, useEffect } from "react";
import {
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import styled from "styled-components/native";
import { SafeAreaView as SafeAreaContainer } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

import BASE_URL from "../../api/config";

const backIcon = require("../../assets/back_icon.png");
const bellIcon = require("../../assets/bell.png");

export default function EndScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const incomingItem = route.params?.item || {};

  const logId =
    route.params?.logId ??
    route.params?.id ??
    incomingItem.id ??
    incomingItem.logId ??
    null;

  const routeSessionId =
    route.params?.sessionId ?? incomingItem.sessionId ?? null;

  const [detailData, setDetailData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLogDetail = async () => {
      try {
        setIsLoading(true);

        const savedToken = await AsyncStorage.getItem("accessToken");

        if (!savedToken) {
          console.log("저장된 accessToken이 없습니다.");
          setDetailData(null);
          return;
        }

        let logDetail =
          Object.keys(incomingItem).length > 0 ? incomingItem : null;

        if (logId) {
          try {
            const logResponse = await axios.get(
              `${BASE_URL}/api/intercom-logs/${logId}`,
              {
                headers: {
                  Authorization: `Bearer ${savedToken}`,
                },
              }
            );

            if (logResponse.data?.success && logResponse.data?.data) {
              logDetail = logResponse.data.data;
            }
          } catch (error) {
            console.error("인터폰 로그 상세 조회 실패:", error?.message);
          }
        }

        const sessionId = logDetail?.sessionId ?? routeSessionId;

        let sessionMessages = [];

        if (sessionId) {
          try {
            const messageResponse = await axios.get(
              `${BASE_URL}/api/sessions/${sessionId}/messages`,
              {
                headers: {
                  Authorization: `Bearer ${savedToken}`,
                },
              }
            );

            if (
              messageResponse.data?.success &&
              Array.isArray(messageResponse.data?.data)
            ) {
              sessionMessages = messageResponse.data.data;
            }
          } catch (error) {
            console.error("세션 메시지 조회 실패:", error?.message);
          }
        }

        const parsedMessages =
          sessionMessages.length > 0
            ? parseSessionMessages(sessionMessages, logDetail)
            : parseMessagesFromLog(logDetail);

        const baseTime =
          logDetail?.createdAt ||
          sessionMessages[0]?.createdAt ||
          incomingItem.createdAt;

        setDetailData({
          time: formatFormattedTime(baseTime),
          tags: logDetail?.intent ? [logDetail.intent] : ["일반"],
          messages: parsedMessages,
        });
      } catch (error) {
        console.error("EndScreen 데이터 조회 실패:", error?.message);
        setDetailData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogDetail();
  }, [logId, routeSessionId]);

  const parseSessionMessages = (messages, logDetail) => {
    const parsedMessages = messages.map((msg, idx) => {
      const senderValue = String(
        msg.senderType || msg.sender || msg.role || msg.type || ""
      ).toUpperCase();

      const isSystem = senderValue === "SYSTEM";

      const isVisitor =
        senderValue === "VISITOR" ||
        senderValue === "INCOMING" ||
        senderValue === "RECEIVE";

      const createdAt = msg.createdAt || msg.time || logDetail?.createdAt;

      return {
        id:
          msg.messageId ??
          msg.id ??
          msg.transcriptId ??
          msg.chunkOrder ??
          `session-msg-${idx}`,
        text:
          msg.content ||
          msg.messageText ||
          msg.text ||
          msg.message ||
          "호출 신호 감지",
        type: isSystem ? "system" : isVisitor ? "receive" : "send",
        time: formatBubbleTime(createdAt),
        createdAt,
      };
    });

    return appendCallEndedMessage(parsedMessages, logDetail);
  };

  const parseMessagesFromLog = (sData) => {
    if (!sData) {
      return appendCallEndedMessage([], {});
    }

    const parsedMessages = [];
    const rawMessages =
      sData.chatList || sData.transcripts || sData.messages || [];

    if (Array.isArray(rawMessages) && rawMessages.length > 0) {
      rawMessages.forEach((msg, idx) => {
        const senderValue = String(
          msg.senderType || msg.sender || msg.role || msg.type || ""
        ).toUpperCase();

        const isSystem = senderValue === "SYSTEM";

        const isVisitor =
          senderValue === "VISITOR" ||
          senderValue === "INCOMING" ||
          senderValue === "RECEIVE";

        const createdAt = msg.createdAt || msg.time || sData.createdAt;

        parsedMessages.push({
          id:
            msg.messageId ??
            msg.id ??
            msg.transcriptId ??
            msg.chunkOrder ??
            `log-msg-${idx}`,
          text:
            msg.content ||
            msg.messageText ||
            msg.text ||
            msg.message ||
            "호출 신호 감지",
          type: isSystem ? "system" : isVisitor ? "receive" : "send",
          time: formatBubbleTime(createdAt),
          createdAt,
        });
      });

      return appendCallEndedMessage(parsedMessages, sData);
    }

    if (sData.visitorText && sData.visitorText.trim() !== "") {
      parsedMessages.push({
        id: "visitor-fallback",
        text: sData.visitorText.trim(),
        type: "receive",
        time: formatBubbleTime(sData.createdAt),
        createdAt: sData.createdAt,
      });
    }

    if (sData.residentReply && sData.residentReply.trim() !== "") {
      parsedMessages.push({
        id: "resident-fallback",
        text: sData.residentReply.trim(),
        type: "send",
        time: formatBubbleTime(sData.createdAt),
        createdAt: sData.createdAt,
      });
    }

    return appendCallEndedMessage(parsedMessages, sData);
  };

  const appendCallEndedMessage = (messages, sData = {}) => {
    const alreadyHasEndMessage = messages.some(
      (msg) => msg.type === "system" && msg.text === "통화가 종료되었습니다."
    );

    if (alreadyHasEndMessage) {
      return messages;
    }

    const lastMessage = messages[messages.length - 1];

    const endTime =
      sData.endedAt ||
      sData.closedAt ||
      sData.updatedAt ||
      lastMessage?.createdAt ||
      sData.createdAt;

    return [
      ...messages,
      {
        id: "call-ended-system",
        text: "통화가 종료되었습니다.",
        type: "system",
        time: formatBubbleTime(endTime),
      },
    ];
  };

  const handleDeleteLog = () => {
    if (!logId) {
      Alert.alert("오류", "삭제할 기록 정보를 찾을 수 없습니다.");
      return;
    }

    Alert.alert("기록 삭제", "정말로 이 인터폰 통화 기록을 삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            const savedToken = await AsyncStorage.getItem("accessToken");

            if (!savedToken) {
              Alert.alert("오류", "로그인이 필요합니다.");
              return;
            }

            const response = await axios.delete(
              `${BASE_URL}/api/intercom-logs/${logId}`,
              {
                headers: {
                  Authorization: `Bearer ${savedToken}`,
                },
              }
            );

            if (response.data?.success) {
              Alert.alert("완료", "기록이 정상적으로 삭제되었습니다.", [
                {
                  text: "확인",
                  onPress: () =>
                    navigation.navigate("MainTab", { screen: "히스토리" }),
                },
              ]);
            } else {
              Alert.alert(
                "실패",
                response.data?.message || "삭제 처리에 실패했습니다."
              );
            }
          } catch (error) {
            console.error("인터폰 로그 삭제 실패:", error?.message);
            Alert.alert("오류", "서버 통신 중 문제가 발생했습니다.");
          }
        },
      },
    ]);
  };

  const parseKstDate = (isoString) => {
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

  const formatFormattedTime = (isoString) => {
    const date = parseKstDate(isoString);

    if (!date || Number.isNaN(date.getTime())) {
      return isoString || "시간 정보 없음";
    }

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");

    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  };

  const formatBubbleTime = (isoString) => {
    const date = parseKstDate(isoString);

    if (!date || Number.isNaN(date.getTime())) {
      return "00:00";
    }

    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");

    return `${hh}:${min}`;
  };

  const hasMessages = detailData?.messages?.length > 0;

  return (
    <Container>
      <Header>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <BackIcon source={backIcon} resizeMode="contain" />
        </TouchableOpacity>

        <HeaderTitleContainer>
          <Logo source={bellIcon} resizeMode="contain" />
          <HeaderTitle>인터폰 기록 상세</HeaderTitle>
        </HeaderTitleContainer>

        <TouchableOpacity onPress={handleDeleteLog} style={{ padding: 4 }}>
          <Ionicons name="trash-outline" size={24} color="#FF4D4D" />
        </TouchableOpacity>
      </Header>

      {isLoading ? (
        <LoadingWrapper>
          <ActivityIndicator size="large" color="#06F393" />
          <LoadingText>상세 통화 기록을 불러오는 중...</LoadingText>
        </LoadingWrapper>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <SummarySection>
            <InfoRow>
              <InfoLabel>방문 일시</InfoLabel>
              <InfoValue>{detailData?.time || "시간 정보 없음"}</InfoValue>
            </InfoRow>

            <TagRow>
              {detailData?.tags?.map((tag, idx) => (
                <TagBox key={`${tag}-${idx}`}>
                  <TagText>#{tag}</TagText>
                </TagBox>
              ))}
            </TagRow>
          </SummarySection>

          <ChatLogArea style={{ flex: !hasMessages ? 1 : undefined }}>
            {hasMessages ? (
              detailData.messages.map((msg) => {
                if (msg.type === "system") {
                  return (
                    <SystemMessageContainer key={msg.id}>
                      <SystemMessageText>{msg.text}</SystemMessageText>
                    </SystemMessageContainer>
                  );
                }

                return msg.type === "receive" ? (
                  <ReceiveContainer key={msg.id}>
                    <ReceiveBubble>
                      <BubbleText>{msg.text}</BubbleText>
                    </ReceiveBubble>
                    <BubbleTime>{msg.time || "00:00"}</BubbleTime>
                  </ReceiveContainer>
                ) : (
                  <SendContainer key={msg.id}>
                    <SendBubble>
                      <SendBubbleText>{msg.text}</SendBubbleText>
                    </SendBubble>
                    <SendTime>{msg.time || "00:00"}</SendTime>
                  </SendContainer>
                );
              })
            ) : (
              <EmptyChatLogWrapper>
                <Ionicons name="document-text-outline" size={36} color="#CCC" />
                <EmptyChatLogText>
                  기록된 대화 내역이 없습니다.
                </EmptyChatLogText>
              </EmptyChatLogWrapper>
            )}
          </ChatLogArea>

          <HomeBtn
            activeOpacity={0.8}
            onPress={() => navigation.navigate("MainTab")}
          >
            <HomeBtnText>메인 화면으로 이동</HomeBtnText>
          </HomeBtn>
        </ScrollView>
      )}
    </Container>
  );
}

/* ================= 스타일 정의 ================= */

const Container = styled(SafeAreaContainer)`
  flex: 1;
  background-color: #F5F5F5;
`;

const Header = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background-color: #fff;
  border-bottom-width: 1px;
  border-bottom-color: #EEE;
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
`;

const SummarySection = styled.View`
  background-color: #fff;
  padding: 22px 20px;
  border-bottom-left-radius: 30px;
  border-bottom-right-radius: 30px;
  elevation: 2;
  shadow-color: #000;
  shadow-opacity: 0.03;
  shadow-radius: 5px;
`;

const InfoRow = styled.View`
  flex-direction: row;
  align-items: center;
  margin-bottom: 12px;
`;

const InfoLabel = styled.Text`
  font-size: 14px;
  color: #999;
  width: 75px;
  font-weight: 600;
`;

const InfoValue = styled.Text`
  font-size: 14px;
  color: #333;
  font-weight: 800;
`;

const TagRow = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
`;

const TagBox = styled.View`
  background-color: #EBF1FA;
  padding: 6px 14px;
  border-radius: 20px;
  margin-right: 8px;
  margin-bottom: 8px;
`;

const TagText = styled.Text`
  font-size: 12px;
  color: #4A72B2;
  font-weight: 800;
`;

const ChatLogArea = styled.View`
  padding: 20px 15px;
  justify-content: center;
`;

const ReceiveContainer = styled.View`
  flex-direction: row;
  align-items: flex-end;
  margin-bottom: 16px;
  width: 100%;
`;

const ReceiveBubble = styled.View`
  max-width: 75%;
  background-color: #4A4A4A;
  padding: 12px 18px;
  border-radius: 20px;
  border-top-left-radius: 4px;
`;

const BubbleText = styled.Text`
  font-size: 15px;
  color: #FFFFFF;
  line-height: 22px;
  font-weight: 500;
`;

const BubbleTime = styled.Text`
  font-size: 11px;
  color: #999;
  margin-left: 8px;
`;

const SendContainer = styled.View`
  flex-direction: row-reverse;
  align-items: flex-end;
  margin-bottom: 16px;
  width: 100%;
`;

const SendBubble = styled.View`
  max-width: 75%;
  background-color: #6D5D55;
  padding: 12px 18px;
  border-radius: 20px;
  border-top-right-radius: 4px;
`;

const SendBubbleText = styled.Text`
  font-size: 15px;
  color: #FFFFFF;
  line-height: 22px;
  font-weight: 500;
`;

const SendTime = styled.Text`
  font-size: 11px;
  color: #999;
  margin-right: 8px;
`;

const SystemMessageContainer = styled.View`
  align-self: center;
  background-color: #E0E0E0;
  padding: 7px 14px;
  border-radius: 18px;
  margin-bottom: 16px;
`;

const SystemMessageText = styled.Text`
  font-size: 12px;
  color: #666;
  font-weight: 600;
`;

const HomeBtn = styled.TouchableOpacity`
  background-color: #222;
  margin: 10px 15px 30px;
  padding: 16px;
  border-radius: 16px;
  align-items: center;
`;

const HomeBtnText = styled.Text`
  color: #fff;
  font-size: 16px;
  font-weight: 800;
`;

const LoadingWrapper = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
  padding-top: 100px;
`;

const LoadingText = styled.Text`
  font-size: 13px;
  color: #999;
  font-weight: 600;
  margin-top: 10px;
`;

const EmptyChatLogWrapper = styled.View`
  width: 100%;
  justify-content: center;
  align-items: center;
  padding: 40px 20px;
`;

const EmptyChatLogText = styled.Text`
  font-size: 14px;
  color: #BBB;
  font-weight: 600;
  margin-top: 10px;
  text-align: center;
`;