import React, { useState, useEffect, useRef } from "react";
import {
  ScrollView,
  TouchableOpacity,
  View,
  Modal,
  Dimensions,
  Alert,
  ActivityIndicator,
  Vibration,
  BackHandler,
} from "react-native";
import styled from "styled-components/native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView as SafeAreaContainer } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

import BASE_URL from "../../api/config";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const backIcon = require("../../assets/back_icon.png");
const bellIcon = require("../../assets/bell.png");
const sendInactive = require("../../assets/send_inactive.png");
const sendActive = require("../../assets/send_active.png");
const callEndIcon = require("../../assets/call_end.png");
const callEndOverlayImg = require("../../assets/call_end_overlay.png");

const logUserChat = (message, data) => {
  if (data !== undefined) {
    console.log(`[USER_CHAT] ${message}`, data);
  } else {
    console.log(`[USER_CHAT] ${message}`);
  }
};

export default function IntercomChatScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const scrollViewRef = useRef(null);
  const pollingRef = useRef(null);
  const lastVisitorMessageKeyRef = useRef(null);
  const lastMessageSignatureRef = useRef(null);
  const isEndingRef = useRef(false);

  const { sessionId = null, token: routeToken = null } = route.params || {};

  const [selectedTags, setSelectedTags] = useState([]);
  const [isOverlayVisible, setIsOverlayVisible] = useState(false);
  const [activeTab, setActiveTab] = useState("인사");
  const [isLoading, setIsLoading] = useState(true);
  const [isEnding, setIsEnding] = useState(false);

  const [currentSessionId, setCurrentSessionId] = useState(sessionId);
  const [messages, setMessages] = useState([]);
  const [seconds, setSeconds] = useState(0);
  const [token, setToken] = useState(null);
  const [backendQuickReplies, setBackendQuickReplies] = useState([]);

  const tabs = ["인사", "질문", "대답", "요청", "행동"];

  const getTimeString = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");

    return `${hh}:${mm}`;
  };

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;

    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
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

  const formatBubbleTime = (isoString) => {
    const date = parseServerDate(isoString);

    if (!date || Number.isNaN(date.getTime())) {
      return getTimeString();
    }

    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");

    return `${hh}:${mm}`;
  };

  const getFilteredReplies = (tabName) => {
    const defaultData = {
      인사: [
        { replyCode: 101, text: "안녕하세요" },
        { replyCode: 102, text: "어서오세요." },
        { replyCode: 103, text: "안녕히가세요." },
      ],
      질문: [
        { replyCode: 201, text: "누구세요?" },
        { replyCode: 202, text: "무슨 일이세요?" },
        { replyCode: 203, text: "이유가 무엇인가요?" },
        { replyCode: 204, text: "방문 목적이 무엇인가요?" },
        { replyCode: 205, text: "필요한 것이 있나요?" },
        { replyCode: 206, text: "어느 업체에서 오셨나요?" },
      ],
      대답: [
        { replyCode: 301, text: "네." },
        { replyCode: 302, text: "아니요." },
        { replyCode: 303, text: "맞습니다." },
        { replyCode: 304, text: "아닙니다." },
        { replyCode: 305, text: "알겠습니다." },
        { replyCode: 306, text: "대화 어려워요." },
        { replyCode: 307, text: "잘못 오셨습니다." },
        { replyCode: 308, text: "무슨 말씀인지 안 들렸어요." },
      ],
      요청: [
        { replyCode: 401, text: "용건을 말씀해주세요." },
        { replyCode: 402, text: "자세히 말씀해주세요." },
        { replyCode: 403, text: "다시 말씀해주세요." },
        { replyCode: 404, text: "문 앞에 두고 가세요." },
        { replyCode: 405, text: "다시 호출해주세요." },
        { replyCode: 406, text: "통화 끊어주세요." },
        { replyCode: 407, text: "다음에 방문해주세요." },
      ],
      행동: [
        { replyCode: 501, text: "지금 나갈게요." },
        { replyCode: 502, text: "통화 끊겠습니다." },
        { replyCode: 503, text: "문 열어드릴게요." },
        { replyCode: 504, text: "나중에 갈게요." },
      ],
    };

    const defaultTabReplies = defaultData[tabName] || [];

    if (!backendQuickReplies || backendQuickReplies.length === 0) {
      return defaultTabReplies;
    }

    const normalizeText = (value) =>
      String(value || "")
        .replace(/\s+/g, "")
        .trim();

    return defaultTabReplies.map((defaultItem) => {
      const matchedBackendItem = backendQuickReplies.find((backendItem) => {
        const backendText = normalizeText(
          backendItem.text || backendItem.content || backendItem.message
        );

        return backendText === normalizeText(defaultItem.text);
      });

      return {
        ...defaultItem,
        replyCode: matchedBackendItem
          ? matchedBackendItem.replyCode || matchedBackendItem.id
          : defaultItem.replyCode,
      };
    });
  };

  const getMessageText = (message) => {
    return (
      message.content ||
      message.messageText ||
      message.text ||
      message.message ||
      message.rawText ||
      ""
    );
  };

  const getMessageType = (message) => {
    const senderValue = String(
      message.senderType || message.sender || message.role || message.type || ""
    ).toUpperCase();

    if (
      senderValue === "VISITOR" ||
      senderValue === "INCOMING" ||
      senderValue === "RECEIVE"
    ) {
      return "receive";
    }

    if (
      senderValue === "RESIDENT" ||
      senderValue === "USER" ||
      senderValue === "SEND" ||
      senderValue === "OUTGOING"
    ) {
      return "send";
    }

    if (senderValue === "SYSTEM") {
      return "system";
    }

    return "receive";
  };

  const normalizeMessages = (rawMessages = []) => {
    if (!Array.isArray(rawMessages)) return [];

    const uniqueMap = new Map();

    rawMessages.forEach((message, index) => {
      const text = String(getMessageText(message)).trim();

      if (!text) return;

      const createdAt = message.createdAt || message.time || "";
      const type = getMessageType(message);

      const id =
        message.messageId ??
        message.id ??
        message.transcriptId ??
        message.chunkOrder ??
        `${type}-${createdAt}-${text}-${index}`;

      const dedupeKey =
        message.messageId ?? message.id ?? `${type}-${createdAt}-${text}`;

      if (uniqueMap.has(dedupeKey)) {
        return;
      }

      uniqueMap.set(dedupeKey, {
        id: String(id),
        text,
        type,
        time: formatBubbleTime(createdAt),
        createdAt,
      });
    });

    return Array.from(uniqueMap.values());
  };

  const logMessageUpdateIfChanged = (targetSessionId, nextMessages) => {
    const signature = nextMessages
      .map((item) => `${item.id}:${item.type}:${item.text}`)
      .join("|");

    if (lastMessageSignatureRef.current === signature) {
      return;
    }

    lastMessageSignatureRef.current = signature;

    const lastMessage = nextMessages[nextMessages.length - 1];

    logUserChat("메시지 갱신", {
      sessionId: targetSessionId,
      count: nextMessages.length,
      lastType: lastMessage?.type || null,
      lastText: lastMessage?.text || null,
    });
  };

  const fetchSessionMessages = async ({
    targetSessionId,
    activeToken,
    shouldVibrate = false,
  }) => {
    if (!targetSessionId || !activeToken) {
      logUserChat("메시지 조회 생략", {
        hasSessionId: Boolean(targetSessionId),
        hasToken: Boolean(activeToken),
      });
      return;
    }

    if (isEndingRef.current) {
      return;
    }

    try {
      const response = await axios.get(
        `${BASE_URL}/api/sessions/${targetSessionId}/messages`,
        {
          headers: {
            Authorization: `Bearer ${activeToken}`,
          },
        }
      );

      if (response.data?.success && Array.isArray(response.data?.data)) {
        const nextMessages = normalizeMessages(response.data.data);

        const lastVisitorMessage = [...nextMessages]
          .reverse()
          .find((item) => item.type === "receive");

        const nextVisitorKey = lastVisitorMessage
          ? `${lastVisitorMessage.createdAt}-${lastVisitorMessage.text}`
          : null;

        if (
          shouldVibrate &&
          nextVisitorKey &&
          lastVisitorMessageKeyRef.current !== nextVisitorKey
        ) {
          const subtitleVibSetting = await AsyncStorage.getItem(
            "subtitleVibrate"
          );

          if (subtitleVibSetting === "true") {
            Vibration.vibrate(400);

            logUserChat("방문자 새 메시지 진동 실행", {
              sessionId: targetSessionId,
            });
          }
        }

        if (nextVisitorKey) {
          lastVisitorMessageKeyRef.current = nextVisitorKey;
        }

        logMessageUpdateIfChanged(targetSessionId, nextMessages);
        setMessages(nextMessages);
      } else {
        logUserChat("메시지 조회 응답 확인 필요", response.data);
      }
    } catch (error) {
      const serverError =
        error.response?.data?.message ||
        JSON.stringify(error.response?.data) ||
        error.message;

      logUserChat("세션 메시지 조회 실패", {
        sessionId: targetSessionId,
        error: serverError,
      });
    }
  };

  const startMessagePolling = (targetSessionId, activeToken) => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    lastMessageSignatureRef.current = null;
    lastVisitorMessageKeyRef.current = null;

    logUserChat("메시지 polling 시작", {
      sessionId: targetSessionId,
      intervalMs: 1500,
    });

    fetchSessionMessages({
      targetSessionId,
      activeToken,
      shouldVibrate: false,
    });

    pollingRef.current = setInterval(() => {
      fetchSessionMessages({
        targetSessionId,
        activeToken,
        shouldVibrate: true,
      });
    }, 1500);
  };

  const stopMessagePolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
      logUserChat("메시지 polling 중지");
    }
  };

  useEffect(() => {
    logUserChat("화면 진입", {
      routeSessionId: sessionId,
      hasRouteToken: Boolean(routeToken),
    });

    const restoreTimer = async () => {
      try {
        const startTime = await AsyncStorage.getItem("callStartTime");

        if (startTime) {
          const elapsed = Math.floor((Date.now() - Number(startTime)) / 1000);
          setSeconds(elapsed >= 0 ? elapsed : 0);

          logUserChat("타이머 복구", {
            elapsedSeconds: elapsed >= 0 ? elapsed : 0,
          });
        } else {
          await AsyncStorage.setItem("callStartTime", Date.now().toString());
          logUserChat("타이머 새로 시작");
        }
      } catch (error) {
        logUserChat("타이머 복구 실패", error?.message);
      }
    };

    restoreTimer();

    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (isEndingRef.current) return true;

        logUserChat("Android 뒤로가기 감지 - 종료 모달 표시");
        setIsOverlayVisible(true);

        return true;
      }
    );

    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initializeChatRoom = async () => {
      try {
        setIsLoading(true);
        stopMessagePolling();

        const savedToken = await AsyncStorage.getItem("accessToken");
        const activeToken = savedToken || routeToken || null;

        logUserChat("초기화 시작", {
          hasSavedToken: Boolean(savedToken),
          hasRouteToken: Boolean(routeToken),
          activeSessionId: sessionId,
        });

        if (isMounted) {
          setToken(activeToken);
        }

        try {
          const repliesRes = await axios.get(`${BASE_URL}/api/quick-replies`);

          if (repliesRes.data?.success && repliesRes.data?.data && isMounted) {
            setBackendQuickReplies(repliesRes.data.data);

            logUserChat("빠른 응답 목록 조회 완료", {
              count: repliesRes.data.data.length,
            });
          }
        } catch (error) {
          logUserChat("빠른 응답 목록 조회 실패", error?.message);
        }

        if (!activeToken) {
          logUserChat("초기화 중단 - accessToken 없음");
          Alert.alert("오류", "로그인이 필요합니다.");
          return;
        }

        if (sessionId) {
          if (isMounted) {
            setCurrentSessionId(sessionId);
            setMessages([]);
          }

          logUserChat("기존 세션 사용", {
            sessionId,
          });

          startMessagePolling(sessionId, activeToken);
          return;
        }

        logUserChat("새 세션 시작 요청", {
          deviceUid: "DEVICE-001",
        });

        const response = await axios.post(
          `${BASE_URL}/api/sessions/start`,
          {
            deviceUid: "DEVICE-001",
          },
          {
            headers: {
              Authorization: `Bearer ${activeToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (response.data?.success && response.data?.data) {
          const serverSessionId = response.data.data.sessionId;

          logUserChat("새 세션 생성 완료", {
            sessionId: serverSessionId,
            response: response.data.data,
          });

          if (isMounted) {
            setCurrentSessionId(serverSessionId);
            setMessages([]);
          }

          try {
            await axios.post(
              `${BASE_URL}/api/sessions/${serverSessionId}/connect`,
              {},
              {
                headers: {
                  Authorization: `Bearer ${activeToken}`,
                  "Content-Type": "application/json",
                },
              }
            );

            logUserChat("세션 connect 완료", {
              sessionId: serverSessionId,
            });
          } catch (error) {
            const serverError =
              error.response?.data?.message ||
              JSON.stringify(error.response?.data) ||
              error.message;

            logUserChat("세션 connect 실패", {
              sessionId: serverSessionId,
              error: serverError,
            });
          }

          startMessagePolling(serverSessionId, activeToken);
        } else {
          logUserChat("세션 시작 실패 응답", response.data);
          Alert.alert("오류", "인터폰 세션을 시작하지 못했습니다.");
        }
      } catch (error) {
        const serverError =
          error.response?.data?.message ||
          JSON.stringify(error.response?.data) ||
          error.message;

        logUserChat("채팅방 초기화 실패", serverError);
        Alert.alert("오류", "인터폰 세션 정보를 불러오지 못했습니다.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initializeChatRoom();

    return () => {
      isMounted = false;
      stopMessagePolling();
      logUserChat("화면 이탈 - polling 정리");
    };
  }, [sessionId]);

  const moveToHistoryAfterEnd = async (endedSessionId) => {
    await AsyncStorage.removeItem("callStartTime");

    setCurrentSessionId(null);
    setSelectedTags([]);
    setIsOverlayVisible(false);

    const parentNav = navigation.getParent() || navigation;

    parentNav.setParams?.({
      intercomStatus: "idle",
      activeSessionId: null,
    });

    logUserChat("통화 종료 후 히스토리 이동", {
      sessionId: endedSessionId,
    });

    navigation.reset({
      index: 0,
      routes: [
        {
          name: "MainTab",
          params: {
            screen: "히스토리",
            refresh: Date.now(),
            intercomStatus: "idle",
            activeSessionId: null,
          },
        },
      ],
    });
  };

  const confirmEndCall = async () => {
    if (isEndingRef.current) {
      logUserChat("종료 요청 무시 - 이미 처리 중");
      return;
    }

    isEndingRef.current = true;
    setIsEnding(true);
    setIsOverlayVisible(false);
    stopMessagePolling();

    const activeSessionId = currentSessionId || sessionId;
    const activeToken = token || (await AsyncStorage.getItem("accessToken"));

    if (!activeSessionId) {
      logUserChat("종료 실패 - sessionId 없음");

      Alert.alert("오류", "종료할 세션 정보를 찾을 수 없습니다.", [
        {
          text: "확인",
          onPress: async () => {
            await moveToHistoryAfterEnd(null);
          },
        },
      ]);

      isEndingRef.current = false;
      setIsEnding(false);
      return;
    }

    try {
      logUserChat("세션 종료 요청", {
        sessionId: activeSessionId,
        hasToken: Boolean(activeToken),
      });

      const response = await axios.post(
        `${BASE_URL}/api/sessions/end`,
        {
          sessionId: activeSessionId,
        },
        {
          headers: {
            ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
            "Content-Type": "application/json",
          },
        }
      );

      logUserChat("세션 종료 응답", {
        sessionId: activeSessionId,
        status: response.status,
        data: response.data,
      });
    } catch (error) {
      const serverError =
        error.response?.data?.message ||
        JSON.stringify(error.response?.data) ||
        error.message;

      logUserChat("세션 종료 실패", {
        sessionId: activeSessionId,
        error: serverError,
      });
    } finally {
      await moveToHistoryAfterEnd(activeSessionId);
    }
  };

  const handleSelectTag = (item) => {
    if (isEndingRef.current) return;

    if (!selectedTags.some((tag) => tag.replyCode === item.replyCode)) {
      setSelectedTags((prev) => [...prev, item]);

      logUserChat("빠른 응답 선택", {
        replyCode: item.replyCode,
        text: item.text,
      });
    }
  };

  const removeTag = (index) => {
    if (isEndingRef.current) return;

    setSelectedTags((prev) => prev.filter((_, i) => i !== index));
  };

  const appendLocalSendMessage = (text) => {
    const safeText = String(text || "").trim();

    if (!safeText) return;

    setMessages((prev) => [
      ...prev,
      {
        id: `local-send-${Date.now()}`,
        text: safeText,
        type: "send",
        time: getTimeString(),
        createdAt: "",
      },
    ]);
  };

  const handleSendResponse = async () => {
    if (isEndingRef.current) return;
    if (selectedTags.length === 0) return;

    const targetSessionId = currentSessionId;
    const activeToken = token || (await AsyncStorage.getItem("accessToken"));
    const tagsToSend = [...selectedTags];
    const firstReply = tagsToSend[0];

    if (!targetSessionId) {
      Alert.alert("오류", "현재 연결된 세션이 없습니다.");
      return;
    }

    if (!activeToken) {
      Alert.alert("오류", "로그인이 필요합니다.");
      return;
    }

    const newMessageText = tagsToSend.map((tag) => tag.text).join(" ");

    appendLocalSendMessage(newMessageText);
    setSelectedTags([]);

    try {
      logUserChat("빠른 응답 전송 요청", {
        sessionId: targetSessionId,
        replyCode: firstReply.replyCode,
        text: newMessageText,
      });

      const response = await axios.post(
        `${BASE_URL}/api/sessions/${targetSessionId}/reply`,
        {
          replyCode: firstReply.replyCode,
        },
        {
          headers: {
            Authorization: `Bearer ${activeToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      logUserChat("빠른 응답 전송 완료", {
        sessionId: targetSessionId,
        status: response.status,
      });

      fetchSessionMessages({
        targetSessionId,
        activeToken,
        shouldVibrate: false,
      });
    } catch (error) {
      const serverError =
        error.response?.data?.message ||
        JSON.stringify(error.response?.data) ||
        error.message;

      logUserChat("빠른 응답 전송 실패", {
        sessionId: targetSessionId,
        error: serverError,
      });

      Alert.alert("전송 실패", "빠른 응답을 전송하지 못했습니다.");
    }
  };

  const visibleMessages = messages.filter((msg) => msg.type !== "system");

  return (
    <Container>
      <Header>
        <HeaderSide>
          <TouchableOpacity
            onPress={() => {
              if (isEndingRef.current) return;

              logUserChat("상단 뒤로가기 클릭 - 종료 모달 표시");
              setIsOverlayVisible(true);
            }}
            disabled={isEnding}
          >
            <IconBtn source={backIcon} resizeMode="contain" />
          </TouchableOpacity>
        </HeaderSide>

        <HeaderSide style={{ width: 120 }}>
          <HeaderCenter>
            <Logo source={bellIcon} resizeMode="contain" />
            <HeaderTitle>인터폰 실시간</HeaderTitle>
          </HeaderCenter>
        </HeaderSide>

        <HeaderSide
          style={{
            flexDirection: "row",
            justifyContent: "flex-end",
            alignItems: "center",
          }}
        >
          <TimerText>{formatTimer(seconds)}</TimerText>

          <TouchableOpacity
            onPress={() => {
              if (isEndingRef.current) return;

              logUserChat("통화 종료 버튼 클릭 - 종료 모달 표시");
              setIsOverlayVisible(true);
            }}
            disabled={isEnding}
            style={{ marginLeft: 10 }}
          >
            <EndIcon source={callEndIcon} resizeMode="contain" />
          </TouchableOpacity>
        </HeaderSide>
      </Header>

      <ChatArea>
        {isLoading ? (
          <View
            style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
          >
            <ActivityIndicator size="large" color="#06F393" />
          </View>
        ) : (
          <ScrollView
            ref={scrollViewRef}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              scrollViewRef.current?.scrollToEnd({ animated: true })
            }
          >
            {visibleMessages.map((msg) =>
              msg.type === "receive" ? (
                <ReceiveBubble key={msg.id}>
                  <BubbleTextContainer>
                    <ReceiveBubbleText>{msg.text}</ReceiveBubbleText>
                  </BubbleTextContainer>
                </ReceiveBubble>
              ) : (
                <SendBubble key={msg.id}>
                  <SendBubbleText>{msg.text}</SendBubbleText>
                </SendBubble>
              )
            )}
          </ScrollView>
        )}
      </ChatArea>

      <InputSection>
        <InputBar>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ alignItems: "center" }}
          >
            {selectedTags.map((item, index) => (
              <SelectedTag key={`${item.replyCode}-${index}`}>
                <TagText>{item.text}</TagText>

                <TouchableOpacity onPress={() => removeTag(index)}>
                  <Ionicons name="close-circle" size={16} color="#FF4D4D" />
                </TouchableOpacity>
              </SelectedTag>
            ))}
          </ScrollView>

          <TouchableOpacity
            onPress={handleSendResponse}
            disabled={isEnding || selectedTags.length === 0}
          >
            <SendBtnIcon
              source={selectedTags.length > 0 ? sendActive : sendInactive}
            />
          </TouchableOpacity>
        </InputBar>

        <TabContainer>
          {tabs.map((tab) => (
            <TabButton
              key={tab}
              isActive={activeTab === tab}
              onPress={() => {
                if (isEndingRef.current) return;
                setActiveTab(tab);
              }}
            >
              <TabText isActive={activeTab === tab}>{tab}</TabText>
            </TabButton>
          ))}
        </TabContainer>

        <QuickGrid>
          {getFilteredReplies(activeTab).map((item) => (
            <QuickBtn
              key={`${activeTab}-${item.replyCode}`}
              onPress={() => handleSelectTag(item)}
              disabled={isEnding}
            >
              <QuickBtnText>{item.text}</QuickBtnText>
            </QuickBtn>
          ))}
        </QuickGrid>
      </InputSection>

      <Modal
        transparent
        visible={isOverlayVisible}
        animationType="fade"
        onRequestClose={() => {
          if (isEndingRef.current) return;
          setIsOverlayVisible(false);
        }}
      >
        <OverlayBackground>
          <OverlayImageCard source={callEndOverlayImg} resizeMode="contain">
            <TransparentButtonRow>
              <TransparentTouchArea
                onPress={() => {
                  if (isEndingRef.current) return;
                  confirmEndCall();
                }}
              />

              <TransparentTouchArea
                onPress={() => {
                  if (isEndingRef.current) return;

                  logUserChat("종료 모달 취소");
                  setIsOverlayVisible(false);
                }}
              />
            </TransparentButtonRow>
          </OverlayImageCard>
        </OverlayBackground>
      </Modal>
    </Container>
  );
}

const Container = styled(SafeAreaContainer)`
  flex: 1;
  background-color: #F5F5F5;
`;

const Header = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background-color: #fff;
  border-bottom-width: 1px;
  border-bottom-color: #EEE;
`;

const HeaderSide = styled.View`
  width: 85px;
`;

const HeaderCenter = styled.View`
  flex-direction: row;
  align-items: center;
`;

const IconBtn = styled.Image`
  width: 24px;
  height: 24px;
`;

const EndIcon = styled.Image`
  width: 28px;
  height: 28px;
`;

const Logo = styled.Image`
  width: 28px;
  height: 28px;
  margin-right: 6px;
`;

const HeaderTitle = styled.Text`
  font-size: 16px;
  font-weight: 800;
`;

const TimerText = styled.Text`
  font-size: 14px;
  color: #FF5C00;
  font-weight: 700;
  letter-spacing: -0.2px;
`;

const ChatArea = styled.View`
  flex: 1;
  padding: 20px 15px;
`;

const ReceiveBubble = styled.View`
  flex-direction: row;
  align-items: flex-end;
  margin-bottom: 20px;
  width: 100%;
`;

const BubbleTextContainer = styled.View`
  max-width: 72%;
  background-color: #fff;
  border-radius: 18px;
  padding: 14px 18px;
  elevation: 1;
  shadow-color: #000;
  shadow-opacity: 0.03;
  shadow-radius: 3px;
`;

const ReceiveBubbleText = styled.Text`
  font-size: 15px;
  color: #222;
  font-weight: 500;
`;

const SendBubble = styled.View`
  flex-direction: row-reverse;
  align-items: flex-end;
  margin-bottom: 20px;
  width: 100%;
`;

const SendBubbleText = styled.Text`
  max-width: 72%;
  background-color: #06F393;
  color: white;
  padding: 14px 18px;
  border-radius: 18px;
  font-size: 16px;
  font-weight: 600;
  elevation: 1;
  shadow-color: #000;
  shadow-opacity: 0.03;
  shadow-radius: 3px;
`;

const InputSection = styled.View`
  background-color: #fff;
  padding: 15px 15px 30px 15px;
  border-top-left-radius: 30px;
  border-top-right-radius: 30px;
  elevation: 20;
  shadow-color: #000;
  shadow-opacity: 0.1;
  shadow-radius: 10px;
`;

const InputBar = styled.View`
  flex-direction: row;
  align-items: center;
  background-color: #F8F9FA;
  border-radius: 30px;
  padding: 6px 12px;
  margin-bottom: 12px;
  border-width: 1px;
  border-color: #EAEAEA;
`;

const SelectedTag = styled.View`
  flex-direction: row;
  align-items: center;
  background-color: #FFFFFF;
  border-width: 1px;
  border-color: #E2E8F0;
  padding: 6px 12px;
  border-radius: 16px;
  margin-right: 8px;
  elevation: 1;
`;

const TagText = styled.Text`
  font-size: 13px;
  color: #333333;
  font-weight: 600;
`;

const SendBtnIcon = styled.Image`
  width: 38px;
  height: 38px;
  margin-left: 5px;
`;

const TabContainer = styled.View`
  flex-direction: row;
  margin-bottom: 15px;
  padding-left: 5px;
`;

const TabButton = styled.TouchableOpacity`
  margin-right: 18px;
  padding-bottom: 4px;
  border-bottom-width: ${(props) => (props.isActive ? "2px" : "0px")};
  border-bottom-color: #333;
`;

const TabText = styled.Text`
  font-size: 15px;
  font-weight: ${(props) => (props.isActive ? "800" : "500")};
  color: ${(props) => (props.isActive ? "#333" : "#AAA")};
`;

const QuickGrid = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: space-between;
  margin-bottom: 5px;
`;

const QuickBtn = styled.TouchableOpacity`
  width: 48.5%;
  background-color: #F8F9FA;
  padding: 14px 10px;
  border-radius: 15px;
  align-items: center;
  margin-bottom: 10px;
  border-width: 1px;
  border-color: #F0F1F2;
`;

const QuickBtnText = styled.Text`
  font-size: 15px;
  color: #444;
  font-weight: 600;
`;

const OverlayBackground = styled.View`
  flex: 1;
  background-color: rgba(0, 0, 0, 0.4);
  justify-content: center;
  align-items: center;
`;

const OverlayImageCard = styled.ImageBackground`
  width: ${SCREEN_WIDTH * 0.8}px;
  height: ${(SCREEN_WIDTH * 0.8) * 0.52}px;
  justify-content: flex-end;
  padding-bottom: 15px;
`;

const TransparentButtonRow = styled.View`
  flex-direction: row;
  width: 100%;
  height: 50px;
  padding-horizontal: 15px;
  justify-content: space-between;
`;

const TransparentTouchArea = styled.TouchableOpacity`
  width: 47%;
  height: 100%;
  background-color: transparent;
`;