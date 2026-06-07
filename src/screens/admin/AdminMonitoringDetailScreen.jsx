import React, { useState, useEffect, useRef } from "react";
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
const pencilIcon = require("../../assets/pencil_icon.png");

const logMonitoringDetail = (message, data) => {
  if (data !== undefined) {
    console.log(`[ADMIN_MONITORING_DETAIL] ${message}`, data);
  } else {
    console.log(`[ADMIN_MONITORING_DETAIL] ${message}`);
  }
};

export default function AdminMonitoringDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const isFocused = useIsFocused();

  const lastMessageSignatureRef = useRef(null);

  const { sessionId, item: passedItem } = route.params || {};

  const targetSessionId =
    sessionId ?? passedItem?.sessionId ?? passedItem?.id ?? null;

  const [chatMessages, setChatMessages] = useState([]);
  const [sessionInfo, setSessionInfo] = useState(passedItem || {});
  const [isLoading, setIsLoading] = useState(true);
  const [currentStt, setCurrentStt] = useState("");
  const [selectedMessageKey, setSelectedMessageKey] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toKey = (value) => String(value);

  const normalizeStatus = (value) => {
    return String(value || "").toUpperCase();
  };

  const getSessionStatus = () => {
    return normalizeStatus(
      sessionInfo?.status ||
        sessionInfo?.sessionStatus ||
        passedItem?.status ||
        passedItem?.sessionStatus ||
        ""
    );
  };

  const isEndedSession = () => {
    const status = getSessionStatus();

    return (
      status === "CLOSED" ||
      status === "ENDED" ||
      status === "COMPLETE" ||
      status === "COMPLETED" ||
      status === "FINISHED" ||
      status === "FAILED" ||
      status === "MISSED" ||
      status === "NO_ANSWER"
    );
  };

  const getSessionNoticeText = () => {
    if (isEndedSession()) {
      return "종료된 통화입니다.";
    }

    return "실시간 자막 확인 중...";
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

  const getMessageText = (msg) => {
    return (
      msg.content ||
      msg.text ||
      msg.messageText ||
      msg.message ||
      msg.rawText ||
      ""
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

  const getSelectedMessage = () => {
    if (!selectedMessageKey) return null;

    return chatMessages.find(
      (msg, idx) => toKey(getMessageId(msg, idx)) === selectedMessageKey
    );
  };

  const getDisplayTitle = () => {
    if (sessionInfo?.deviceUid && sessionInfo?.location) {
      return `${sessionInfo.deviceUid} (${sessionInfo.location})`;
    }

    if (sessionInfo?.deviceUid) {
      return `${sessionInfo.deviceUid} 통화`;
    }

    if (sessionInfo?.location) {
      return `${sessionInfo.location} 통화`;
    }

    if (sessionInfo?.userName || sessionInfo?.name) {
      return `${sessionInfo.userName || sessionInfo.name} 통화`;
    }

    return "실시간 통화 상세";
  };

  const normalizeMessages = (messages) => {
    if (!Array.isArray(messages)) return [];

    const uniqueMap = new Map();

    messages.forEach((msg, idx) => {
      const text = String(getMessageText(msg)).trim();

      if (!text) return;
      if (text === "실시간 자막 변환 중...") return;
      if (text === "실시간 자막 변환 중") return;

      const id = getMessageId(msg, idx);
      const createdAt = msg.createdAt || msg.timestamp || msg.time || "";

      const key =
        msg.messageId ??
        msg.transcriptId ??
        msg.id ??
        `${createdAt}-${text}-${idx}`;

      if (uniqueMap.has(key)) return;

      uniqueMap.set(key, {
        ...msg,
        id,
      });
    });

    return Array.from(uniqueMap.values());
  };

  const logMessageUpdateIfChanged = (messages) => {
    const signature = messages
      .map((msg, idx) => {
        const id = getMessageId(msg, idx);
        const text = getMessageText(msg);
        return `${id}:${text}`;
      })
      .join("|");

    if (lastMessageSignatureRef.current === signature) {
      return;
    }

    lastMessageSignatureRef.current = signature;

    const lastMessage = messages[messages.length - 1];

    logMonitoringDetail("메시지 갱신", {
      sessionId: targetSessionId,
      count: messages.length,
      status: getSessionStatus(),
      lastMessageId: lastMessage
        ? getMessageId(lastMessage, messages.length - 1)
        : null,
      lastText: lastMessage ? getMessageText(lastMessage) : null,
    });
  };

  const fetchLiveChatLogs = async (isSilent = false) => {
    if (!targetSessionId) {
      logMonitoringDetail("상세 조회 중단 - sessionId 없음");

      if (!isSilent) {
        Alert.alert("오류", "세션 정보를 찾을 수 없습니다.");
        setIsLoading(false);
      }

      return;
    }

    try {
      if (!isSilent) {
        setIsLoading(true);
        logMonitoringDetail("상세 초기 조회 시작", {
          sessionId: targetSessionId,
        });
      }

      if (isSilent && !isEndedSession()) {
        setIsRefreshing(true);
      }

      const token = await AsyncStorage.getItem("adminToken");

      if (!token) {
        logMonitoringDetail("adminToken 없음 - 로그인 화면 이동");

        if (!isSilent) {
          Alert.alert("오류", "관리자 로그인이 필요합니다.");
          navigation.navigate("AdminLogin");
        }

        return;
      }

      const response = await axios.get(
        `${BASE_URL}/api/admin/monitoring/${targetSessionId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data?.success && response.data?.data) {
        const data = response.data.data;

        setSessionInfo((prev) => ({
          ...prev,
          ...data,
        }));

        const rawMessages =
          data.messages ||
          data.conversationMessages ||
          data.transcripts ||
          [];

        const normalizedMessages = normalizeMessages(rawMessages);

        logMessageUpdateIfChanged(normalizedMessages);
        setChatMessages(normalizedMessages);

        const nextStatus = normalizeStatus(data.status || data.sessionStatus);

        if (
          nextStatus === "CLOSED" ||
          nextStatus === "ENDED" ||
          nextStatus === "COMPLETE" ||
          nextStatus === "COMPLETED" ||
          nextStatus === "FINISHED" ||
          nextStatus === "FAILED" ||
          nextStatus === "MISSED" ||
          nextStatus === "NO_ANSWER"
        ) {
          logMonitoringDetail("종료된 세션 감지", {
            sessionId: targetSessionId,
            status: nextStatus,
          });
        }
      } else {
        logMonitoringDetail("상세 조회 응답 확인 필요", response.data);
        setChatMessages([]);
      }
    } catch (error) {
      const serverError =
        error.response?.data?.message ||
        JSON.stringify(error.response?.data) ||
        error.message;

      logMonitoringDetail("실시간 통화 상세 조회 실패", {
        sessionId: targetSessionId,
        error: serverError,
      });

      if (!isSilent) {
        Alert.alert("오류", "실시간 통화 정보를 불러오지 못했습니다.");
      }
    } finally {
      if (!isSilent) setIsLoading(false);
      if (isSilent) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      logMonitoringDetail("화면 포커스", {
        sessionId: targetSessionId,
      });

      fetchLiveChatLogs(false);
    }
  }, [isFocused, targetSessionId]);

  useEffect(() => {
    if (!isFocused || !targetSessionId) return;

    if (isEndedSession()) {
      logMonitoringDetail("종료된 세션 - polling 시작 안 함", {
        sessionId: targetSessionId,
        status: getSessionStatus(),
      });
      return;
    }

    logMonitoringDetail("상세 polling 시작", {
      sessionId: targetSessionId,
      intervalMs: 3000,
    });

    const intervalId = setInterval(() => {
      fetchLiveChatLogs(true);
    }, 3000);

    return () => {
      clearInterval(intervalId);
      logMonitoringDetail("상세 polling 중지", {
        sessionId: targetSessionId,
      });
    };
  }, [isFocused, targetSessionId, sessionInfo?.status, sessionInfo?.sessionStatus]);

  const handleSelectMessage = (msg, idx) => {
    const messageKey = toKey(getMessageId(msg, idx));
    const text = String(getMessageText(msg)).trim();

    if (!text) return;

    setSelectedMessageKey(messageKey);
    setCurrentStt(text);

    logMonitoringDetail("메시지 선택", {
      key: messageKey,
      messageId: msg.messageId || null,
      transcriptId: msg.transcriptId || null,
      text,
    });
  };

  const handleUpdateMessage = async () => {
    if (!selectedMessageKey) {
      Alert.alert("안내", "수정할 자막을 먼저 선택하세요.");
      return;
    }

    if (!currentStt.trim()) {
      Alert.alert("안내", "수정할 내용을 입력하세요.");
      return;
    }

    if (isSubmitting) {
      logMonitoringDetail("수정 요청 무시 - 이미 처리 중");
      return;
    }

    try {
      setIsSubmitting(true);

      const token = await AsyncStorage.getItem("adminToken");

      if (!token) {
        logMonitoringDetail("수정 중단 - adminToken 없음");

        Alert.alert("오류", "관리자 로그인이 필요합니다.");
        navigation.navigate("AdminLogin");
        return;
      }

      const selectedMessage = getSelectedMessage();

      if (!selectedMessage) {
        logMonitoringDetail("수정 중단 - 선택 메시지 찾기 실패", {
          selectedMessageKey,
        });

        Alert.alert("오류", "선택한 자막 정보를 찾을 수 없습니다.");
        return;
      }

      const messageId = selectedMessage.messageId;
      const transcriptId =
        selectedMessage.transcriptId || selectedMessage.id || selectedMessageKey;

      const endpoint = messageId
        ? `${BASE_URL}/api/admin/conversation-messages/${messageId}`
        : `${BASE_URL}/api/admin/transcripts/${transcriptId}`;

      const body = messageId
        ? {
            content: currentStt.trim(),
          }
        : {
            text: currentStt.trim(),
          };

      logMonitoringDetail("메시지 수정 요청", {
        sessionId: targetSessionId,
        type: messageId ? "conversation-message" : "transcript",
        messageId: messageId || null,
        transcriptId: transcriptId || null,
        body,
      });

      const response = await axios.patch(endpoint, body, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      logMonitoringDetail("메시지 수정 응답", {
        status: response.status,
        data: response.data,
      });

      if (response.data?.success === false) {
        Alert.alert(
          "실패",
          response.data?.message || "수정 처리에 실패했습니다."
        );
        return;
      }

      Alert.alert("완료", "수정 내용이 반영되었습니다.");
      await fetchLiveChatLogs(true);
    } catch (error) {
      const serverError =
        error.response?.data?.message ||
        JSON.stringify(error.response?.data) ||
        error.message;

      logMonitoringDetail("자막 수정 실패", {
        sessionId: targetSessionId,
        error: serverError,
      });

      Alert.alert("오류", "수정에 실패했습니다. 서버 응답을 확인해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoEditInfo = () => {
    if (!selectedMessageKey) {
      Alert.alert("안내", "정보를 볼 자막을 먼저 선택하세요.");
      return;
    }

    const selectedMessage = getSelectedMessage();

    if (!selectedMessage) {
      Alert.alert("오류", "선택한 자막 정보를 찾을 수 없습니다.");
      return;
    }

    const messageId = selectedMessage.messageId;
    const transcriptId = selectedMessage.transcriptId;

    logMonitoringDetail("메시지 정보 화면 이동", {
      sessionId: targetSessionId,
      messageId: messageId || null,
      transcriptId: transcriptId || null,
    });

    navigation.navigate("AdminMessageEdit", {
      messageId,
      transcriptId,
      item: {
        ...selectedMessage,
        id: getMessageId(selectedMessage, 0),
        messageId,
        transcriptId,
        text: getMessageText(selectedMessage),
        content: getMessageText(selectedMessage),
        originalContent: getOriginalText(selectedMessage),
        originalText: getOriginalText(selectedMessage),
        sessionId: targetSessionId,
      },
    });
  };

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

  const formatMessageTime = (isoString) => {
    const date = parseServerDate(isoString);

    if (!date || Number.isNaN(date.getTime())) {
      return "";
    }

    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");

    return `${hh}:${mm}`;
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

  return (
    <Container>
      <Header>
        <TouchableOpacity
          onPress={() => {
            logMonitoringDetail("뒤로가기 클릭");
            navigation.goBack();
          }}
        >
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
        <ContentWrapper>
          <ChatContainer>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 20 }}
            >
              {chatMessages.length > 0 ? (
                chatMessages.map((msg, idx) => {
                  const currentKey = toKey(getMessageId(msg, idx));
                  const isSelected = selectedMessageKey === currentKey;
                  const isVisitor = isVisitorMessage(msg);
                  const msgTime = formatMessageTime(
                    msg.createdAt || msg.timestamp || msg.time
                  );
                  const text = String(getMessageText(msg)).trim();

                  if (!text) return null;

                  return (
                    <TouchableOpacity
                      key={currentKey}
                      activeOpacity={0.85}
                      onPress={() => handleSelectMessage(msg, idx)}
                    >
                      <BubbleWrapper isVisitor={isVisitor}>
                        {!isVisitor && <TimeTextRight>{msgTime}</TimeTextRight>}

                        <BubbleBox
                          isVisitor={isVisitor}
                          isSelected={isSelected}
                        >
                          <BubbleText isVisitor={isVisitor}>{text}</BubbleText>
                        </BubbleBox>

                        {isVisitor && <TimeTextLeft>{msgTime}</TimeTextLeft>}
                      </BubbleWrapper>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <EmptyWrapper>
                  <EmptyText>아직 수신된 자막이 없습니다.</EmptyText>
                </EmptyWrapper>
              )}

              {(isRefreshing || isEndedSession()) && (
                <RefreshingText isEnded={isEndedSession()}>
                  {getSessionNoticeText()}
                </RefreshingText>
              )}
            </ScrollView>
          </ChatContainer>
        </ContentWrapper>
      )}

      <QuickEditCard>
        <EditHeader>
          <EditTitle>바로 수정</EditTitle>

          <TouchableOpacity onPress={handleGoEditInfo}>
            <DetailLinkText>정보</DetailLinkText>
          </TouchableOpacity>
        </EditHeader>

        <Divider />

        <EditInputRow>
          <EditInput
            value={currentStt}
            onChangeText={setCurrentStt}
            placeholder={
              isEndedSession()
                ? "종료된 통화입니다"
                : "수정할 자막을 선택하세요"
            }
            placeholderTextColor="#BBB"
          />

          <TouchableOpacity
            onPress={handleUpdateMessage}
            disabled={isSubmitting || !selectedMessageKey}
          >
            <EditIcon
              source={pencilIcon}
              resizeMode="contain"
              style={{
                tintColor:
                  selectedMessageKey && !isSubmitting ? "#444" : "#BBB",
              }}
            />
          </TouchableOpacity>
        </EditInputRow>
      </QuickEditCard>
    </Container>
  );
}

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

const ContentWrapper = styled.View`
  flex: 1;
  padding: 0 15px;
  margin-top: 10px;
`;

const ChatContainer = styled.View`
  flex: 1;
  background-color: #F1F2F4;
  border-radius: 20px;
  overflow: hidden;
`;

const BubbleWrapper = styled.View`
  flex-direction: row;
  justify-content: ${(props) => (props.isVisitor ? "flex-start" : "flex-end")};
  align-items: flex-end;
  margin-bottom: 15px;
`;

const BubbleBox = styled.View`
  background-color: ${(props) => (props.isVisitor ? "#fff" : "#1EC949")};
  border-color: ${(props) =>
    props.isSelected ? "#1EC949" : props.isVisitor ? "#EAEAEA" : "transparent"};
  border-width: ${(props) =>
    props.isSelected ? "2px" : props.isVisitor ? "1px" : "0px"};
  border-radius: 20px;
  padding: 12px 18px;
  max-width: 75%;
  elevation: ${(props) => (props.isVisitor ? "1" : "0")};
  shadow-color: #000;
  shadow-opacity: 0.05;
  shadow-radius: 3px;
`;

const BubbleText = styled.Text`
  color: ${(props) => (props.isVisitor ? "#333" : "#fff")};
  font-size: 15px;
  font-weight: 500;
`;

const TimeTextLeft = styled.Text`
  font-size: 12px;
  color: #999;
  margin-left: 8px;
  margin-bottom: 5px;
`;

const TimeTextRight = styled.Text`
  font-size: 12px;
  color: #999;
  margin-right: 8px;
  margin-bottom: 5px;
`;

const EmptyWrapper = styled.View`
  padding: 80px 20px;
  align-items: center;
  justify-content: center;
`;

const EmptyText = styled.Text`
  font-size: 14px;
  color: #999;
  font-weight: 600;
`;

const RefreshingText = styled.Text`
  align-self: flex-start;
  background-color: ${(props) => (props.isEnded ? "#E5E7EB" : "#fff")};
  color: ${(props) => (props.isEnded ? "#666" : "#aaa")};
  font-size: 13px;
  font-weight: 500;
  padding: 10px 16px;
  border-radius: 18px;
  overflow: hidden;
`;

const QuickEditCard = styled.View`
  background-color: #fff;
  margin: 15px;
  padding: 16px 20px;
  border-radius: 16px;
  elevation: 3;
  shadow-color: #000;
  shadow-opacity: 0.05;
  shadow-radius: 5px;
`;

const EditHeader = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`;

const EditTitle = styled.Text`
  font-size: 15px;
  font-weight: 800;
  color: #333;
`;

const DetailLinkText = styled.Text`
  font-size: 13px;
  color: #999;
  font-weight: 500;
`;

const Divider = styled.View`
  height: 1px;
  background-color: #F0F0F0;
  margin-bottom: 12px;
`;

const EditInputRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
`;

const EditInput = styled.TextInput`
  flex: 1;
  font-size: 15px;
  color: #333;
  padding: 0;
  font-weight: 500;
`;

const EditIcon = styled.Image`
  width: 22px;
  height: 22px;
  margin-left: 10px;
`;

const LoadingWrapper = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
`;