import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  useIsFocused,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import axios from "axios";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView as SafeAreaContainer } from "react-native-safe-area-context";
import styled from "styled-components/native";

import BASE_URL from "../../api/config";
import { subscribeSessionTopics } from "../../services/realtimeSocket";

const backIcon = require("../../assets/back_icon.png");
const pencilIcon = require("../../assets/pencil_icon.png");

const CLOSED_SESSION_STATUSES = new Set([
  "CLOSED",
  "ENDED",
  "COMPLETE",
  "COMPLETED",
  "FINISHED",
  "SUCCESS",
  "FAILED",
  "MISSED",
  "NO_ANSWER",
  "CANCELED",
  "CANCELLED",
]);

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

  const chatScrollRef = useRef(null);
  const lastMessageSignatureRef = useRef(null);
  const isMountedRef = useRef(true);
  const endedSessionRef = useRef(false);

  // 현재 관리자 상세 화면의 STOMP 구독 해제 함수
  const realtimeUnsubscribeRef = useRef(null);

  // Python partial STT의 현재 누적 문장
  const realtimePartialRef = useRef("");

  // final 이벤트가 별도로 오지 않는 현재 백엔드 구조에서
  // 이전 partial을 화면에 남길 때 사용할 로컬 ID 순번
  const realtimeUtteranceSeqRef = useRef(0);

  const { sessionId, item: passedItem } = route.params || {};

  const targetSessionId =
    sessionId ?? passedItem?.sessionId ?? passedItem?.id ?? null;

  const [chatMessages, setChatMessages] = useState([]);
  const [realtimePartial, setRealtimePartial] = useState("");
  const [sessionInfo, setSessionInfo] = useState(passedItem || {});
  const [isLoading, setIsLoading] = useState(true);
  const [currentStt, setCurrentStt] = useState("");
  const [selectedMessageKey, setSelectedMessageKey] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toKey = (value) => String(value);

  const normalizeStatus = (value) => {
    return String(value || "")
      .trim()
      .toUpperCase();
  };

  const getSessionStatus = (source = sessionInfo) => {
    const safeSource = source || {};
    const safePassedItem = passedItem || {};

    return normalizeStatus(
      safeSource.status ||
        safeSource.sessionStatus ||
        safeSource.callStatus ||
        safeSource.state ||
        safePassedItem.status ||
        safePassedItem.sessionStatus ||
        safePassedItem.callStatus ||
        safePassedItem.state ||
        ""
    );
  };

  const hasEndedTime = (source = sessionInfo) => {
    const safeSource = source || {};
    const safePassedItem = passedItem || {};

    return Boolean(
      safeSource.endedAt ||
        safeSource.endTime ||
        safeSource.closedAt ||
        safeSource.completedAt ||
        safeSource.finishedAt ||
        safePassedItem.endedAt ||
        safePassedItem.endTime ||
        safePassedItem.closedAt ||
        safePassedItem.completedAt ||
        safePassedItem.finishedAt
    );
  };

  const isEndedSession = (source = sessionInfo) => {
    const status = getSessionStatus(source);

    if (hasEndedTime(source)) return true;
    if (CLOSED_SESSION_STATUSES.has(status)) return true;

    return false;
  };

  const updateEndedSessionRef = (source = sessionInfo) => {
    const ended = isEndedSession(source);
    endedSessionRef.current = ended;

    return ended;
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
      if (text === "실시간 자막 확인 중...") return;
      if (text === "실시간 자막 확인 중") return;

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

  const scrollChatToBottom = (animated = true) => {
    requestAnimationFrame(() => {
      chatScrollRef.current?.scrollToEnd({
        animated,
      });
    });
  };

  const logMessageUpdateIfChanged = (
    messages,
    nextSessionInfo = sessionInfo
  ) => {
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
      status: getSessionStatus(nextSessionInfo),
      ended: isEndedSession(nextSessionInfo),
      lastMessageId: lastMessage
        ? getMessageId(lastMessage, messages.length - 1)
        : null,
      lastText: lastMessage ? getMessageText(lastMessage) : null,
    });
  };

  const extractMessages = (data = {}) => {
    if (Array.isArray(data.messages)) {
      return data.messages;
    }

    if (Array.isArray(data.conversationMessages)) {
      return data.conversationMessages;
    }

    if (Array.isArray(data.transcripts)) {
      return data.transcripts;
    }

    if (Array.isArray(data.sttMessages)) {
      return data.sttMessages;
    }

    if (Array.isArray(data.logs)) {
      return data.logs;
    }

    return [];
  };

  // =========================================================
  // WebSocket / STOMP 실시간 자막
  // =========================================================

  const stopRealtimeSubscription = () => {
    if (!realtimeUnsubscribeRef.current) {
      return;
    }

    try {
      realtimeUnsubscribeRef.current();
    } catch (error) {
      logMonitoringDetail(
        "실시간 STOMP 구독 해제 실패",
        error?.message
      );
    }

    realtimeUnsubscribeRef.current = null;

    logMonitoringDetail("실시간 STOMP 구독 중지", {
      sessionId: targetSessionId,
    });
  };

  const clearRealtimePartial = () => {
    realtimePartialRef.current = "";

    if (isMountedRef.current) {
      setRealtimePartial("");
    }
  };

  /**
   * 현재 백엔드는 realtime-transcripts에서 partial만 보내고,
   * Python final 수신 시에는 transcript_chunks DB 저장만 한다.
   *
   * 따라서 새 발화의 partial이 시작되면 직전 partial을
   * 관리자 화면에 로컬 기록으로 남겨둔다.
   *
   * 이 로컬 기록은 messageId / transcriptId가 없으므로
   * 관리자 PATCH 수정 대상으로 선택하지 않는다.
   */
  const commitRealtimePartial = (text) => {
    const safeText = String(text || "").trim();

    if (!safeText || !isMountedRef.current) {
      return;
    }

    const localId =
      `realtime-admin-${targetSessionId}-${Date.now()}-${++realtimeUtteranceSeqRef.current}`;

    setChatMessages((prev) => {
      const duplicateIndex = prev.findIndex(
        (item) =>
          item.__realtimeOnly === true &&
          String(getMessageText(item)).trim() === safeText
      );

      if (duplicateIndex >= 0) {
        return prev;
      }

      return [
        ...prev,
        {
          id: localId,
          messageId: null,
          transcriptId: null,
          senderType: "VISITOR",
          messageType: "REALTIME_STT",
          content: safeText,
          text: safeText,
          originalContent: null,
          createdAt: new Date().toISOString(),
          __realtimeOnly: true,
        },
      ];
    });
  };

  const handleRealtimeTranscript = (sessionId, payload) => {
    if (!payload || typeof payload !== "object") {
      return;
    }

    if (
      payload.sessionId != null &&
      String(payload.sessionId) !== String(sessionId)
    ) {
      return;
    }

    const realtimeType = String(payload.type || "")
      .trim()
      .toLowerCase();

    if (realtimeType !== "partial") {
      return;
    }

    const nextText = String(payload.text || "").trim();

    if (!nextText) {
      return;
    }

    const previousText = String(
      realtimePartialRef.current || ""
    ).trim();

    /*
     * Spring RealtimeSttClient는 같은 발화 동안 delta를 buffer에 append해서
     * 누적 전체 문자열을 보내므로 같은 발화라면 nextText가 previousText로
     * 시작한다. final에서 buffer가 제거된 뒤 다음 발화가 오면 새 문자열로
     * 다시 시작한다.
     */
    const isNewUtterance =
      Boolean(previousText) &&
      nextText !== previousText &&
      !nextText.startsWith(previousText);

    if (isNewUtterance) {
      commitRealtimePartial(previousText);
    }

    realtimePartialRef.current = nextText;

    if (isMountedRef.current) {
      setRealtimePartial(nextText);
    }

    logMonitoringDetail("실시간 partial STT 수신", {
      sessionId,
      text: nextText,
      newUtterance: isNewUtterance,
    });

    setTimeout(() => {
      if (isMountedRef.current) {
        scrollChatToBottom(true);
      }
    }, 50);
  };

  const handleRealtimeConversationMessage = (sessionId, payload) => {
    if (!payload || typeof payload !== "object") {
      return;
    }

    if (
      payload.sessionId != null &&
      String(payload.sessionId) !== String(sessionId)
    ) {
      return;
    }

    /*
     * SessionService.sendReply()는 같은 /messages topic에
     * ConversationMessageResponse와 ReplyMessage를 둘 다 보낸다.
     * DB에 저장된 정식 메시지는 messageId가 있으므로,
     * messageId 없는 보조 ReplyMessage는 중복 표시 방지를 위해 무시한다.
     */
    if (payload.messageId == null) {
      logMonitoringDetail(
        "messageId 없는 보조 메시지 이벤트 무시",
        payload
      );
      return;
    }

    const incoming = normalizeMessages([payload])[0];

    if (!incoming || !isMountedRef.current) {
      return;
    }

    const incomingText = String(getMessageText(incoming)).trim();
    const incomingIsVisitor = isVisitorMessage(incoming);

    if (incomingIsVisitor) {
      const currentPartial = String(
        realtimePartialRef.current || ""
      ).trim();

      if (currentPartial && currentPartial === incomingText) {
        clearRealtimePartial();
      }
    }

    setChatMessages((prev) => {
      const next = [...prev];

      const persistedIndex = next.findIndex(
        (item) =>
          item.messageId != null &&
          String(item.messageId) === String(incoming.messageId)
      );

      if (persistedIndex >= 0) {
        next[persistedIndex] = {
          ...next[persistedIndex],
          ...incoming,
          __realtimeOnly: false,
        };

        return next;
      }

      // 같은 방문자 문장을 partial 로컬 기록으로 이미 남겨둔 경우
      // 정식 DB 메시지로 교체한다.
      if (incomingIsVisitor) {
        const realtimeIndex = next.findIndex(
          (item) =>
            item.__realtimeOnly === true &&
            isVisitorMessage(item) &&
            String(getMessageText(item)).trim() === incomingText
        );

        if (realtimeIndex >= 0) {
          next[realtimeIndex] = {
            ...incoming,
            __realtimeOnly: false,
          };

          return next;
        }
      }

      next.push({
        ...incoming,
        __realtimeOnly: false,
      });

      return next;
    });

    logMonitoringDetail("실시간 저장 메시지 수신", {
      sessionId,
      messageId: incoming.messageId,
      senderType: incoming.senderType || null,
      text: incomingText,
    });

    setTimeout(() => {
      if (isMountedRef.current) {
        scrollChatToBottom(true);
      }
    }, 50);
  };

  const handleRealtimeMessageUpdate = (sessionId, payload) => {
    if (
      !payload ||
      typeof payload !== "object" ||
      payload.messageId == null
    ) {
      return;
    }

    if (
      payload.sessionId != null &&
      String(payload.sessionId) !== String(sessionId)
    ) {
      return;
    }

    const incoming = normalizeMessages([payload])[0];

    if (!incoming || !isMountedRef.current) {
      return;
    }

    const incomingKey = toKey(incoming.messageId);

    setChatMessages((prev) =>
      prev.map((item, idx) => {
        const itemMessageId = item.messageId;

        if (
          itemMessageId != null &&
          String(itemMessageId) === String(incoming.messageId)
        ) {
          return {
            ...item,
            ...incoming,
            __realtimeOnly: false,
          };
        }

        return item;
      })
    );

    if (selectedMessageKey === incomingKey) {
      setCurrentStt(String(getMessageText(incoming)).trim());
    }

    logMonitoringDetail("실시간 메시지 수정 이벤트 수신", {
      sessionId,
      messageId: incoming.messageId,
      text: getMessageText(incoming),
    });
  };

  const handleRealtimeStatus = (sessionId, payload) => {
    if (!payload || typeof payload !== "object") {
      return;
    }

    if (
      payload.sessionId != null &&
      String(payload.sessionId) !== String(sessionId)
    ) {
      return;
    }

    const nextStatus = normalizeStatus(payload.status);

    if (!nextStatus) {
      return;
    }

    logMonitoringDetail("실시간 세션 상태 수신", {
      sessionId,
      status: nextStatus,
      message: payload.message || null,
    });

    setSessionInfo((prev) => {
      const next = {
        ...prev,
        status: nextStatus,
      };

      if (CLOSED_SESSION_STATUSES.has(nextStatus)) {
        next.endedAt = prev.endedAt || new Date().toISOString();
      }

      return next;
    });

    if (CLOSED_SESSION_STATUSES.has(nextStatus)) {
      endedSessionRef.current = true;

      const lastPartial = String(
        realtimePartialRef.current || ""
      ).trim();

      if (lastPartial) {
        commitRealtimePartial(lastPartial);
        clearRealtimePartial();
      }

      stopRealtimeSubscription();
    }
  };

  const startRealtimeSubscription = (sessionId) => {
    stopRealtimeSubscription();

    if (!sessionId || endedSessionRef.current) {
      return;
    }

    clearRealtimePartial();

    logMonitoringDetail("실시간 STOMP 구독 시작", {
      sessionId,
    });

    realtimeUnsubscribeRef.current = subscribeSessionTopics(
      sessionId,
      {
        onRealtimeTranscript: (payload) =>
          handleRealtimeTranscript(sessionId, payload),

        onMessage: (payload) =>
          handleRealtimeConversationMessage(sessionId, payload),

        onMessageUpdate: (payload) =>
          handleRealtimeMessageUpdate(sessionId, payload),

        onStatus: (payload) =>
          handleRealtimeStatus(sessionId, payload),
      }
    );
  };

  const fetchLiveChatLogs = async (isSilent = false) => {
    if (!targetSessionId) {
      logMonitoringDetail("상세 조회 중단 - sessionId 없음");

      if (!isSilent) {
        Alert.alert("오류", "세션 정보를 찾을 수 없습니다.");

        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }

      return;
    }

    try {
      if (!isSilent && isMountedRef.current) {
        setIsLoading(true);

        logMonitoringDetail("상세 초기 조회 시작", {
          sessionId: targetSessionId,
        });
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

        const nextSessionInfo = {
          ...sessionInfo,
          ...data,
        };

        const normalizedMessages = normalizeMessages(
          extractMessages(data)
        );

        const ended = updateEndedSessionRef(nextSessionInfo);

        if (isMountedRef.current) {
          setSessionInfo(nextSessionInfo);
          setChatMessages(normalizedMessages);
        }

        logMessageUpdateIfChanged(
          normalizedMessages,
          nextSessionInfo
        );

        if (ended) {
          logMonitoringDetail(
            "종료된 세션 감지 - 실시간 구독 시작 안 함",
            {
              sessionId: targetSessionId,
              status: getSessionStatus(nextSessionInfo),
              endedAt:
                nextSessionInfo.endedAt ||
                nextSessionInfo.endTime ||
                nextSessionInfo.closedAt ||
                null,
            }
          );
        }

        return;
      }

      logMonitoringDetail(
        "상세 조회 응답 확인 필요",
        response.data
      );

      if (isMountedRef.current) {
        setChatMessages([]);
      }
    } catch (error) {
      const serverStatus = error.response?.status;

      const serverError =
        error.response?.data?.message ||
        JSON.stringify(error.response?.data) ||
        error.message;

      logMonitoringDetail("실시간 통화 상세 조회 실패", {
        sessionId: targetSessionId,
        status: serverStatus,
        error: serverError,
      });

      if (serverStatus === 404 || serverStatus === 410) {
        const nextSessionInfo = {
          ...sessionInfo,
          status: "ENDED",
        };

        updateEndedSessionRef(nextSessionInfo);

        if (isMountedRef.current) {
          setSessionInfo(nextSessionInfo);
        }

        return;
      }

      if (!isSilent) {
        Alert.alert(
          "오류",
          "실시간 통화 정보를 불러오지 못했습니다."
        );
      }
    } finally {
      if (!isSilent && isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    updateEndedSessionRef(sessionInfo);

    return () => {
      isMountedRef.current = false;
      stopRealtimeSubscription();
    };
  }, []);

  useEffect(() => {
    const keyboardShowEvent =
      Platform.OS === "ios"
        ? "keyboardWillShow"
        : "keyboardDidShow";

    const keyboardSubscription = Keyboard.addListener(
      keyboardShowEvent,
      () => {
        setTimeout(() => {
          scrollChatToBottom(true);
        }, 100);
      }
    );

    return () => {
      keyboardSubscription.remove();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!isFocused || !targetSessionId) {
      stopRealtimeSubscription();
      return undefined;
    }

    const initializeRealtimeMonitoring = async () => {
      logMonitoringDetail("화면 포커스", {
        sessionId: targetSessionId,
      });

      stopRealtimeSubscription();
      clearRealtimePartial();

      // 기존 저장 메시지와 세션 정보는 REST로 최초 1회 조회한다.
      await fetchLiveChatLogs(false);

      if (
        cancelled ||
        !isMountedRef.current ||
        endedSessionRef.current
      ) {
        return;
      }

      // 이후 변화는 WebSocket/STOMP으로 받는다.
      startRealtimeSubscription(targetSessionId);
    };

    initializeRealtimeMonitoring();

    return () => {
      cancelled = true;
      stopRealtimeSubscription();

      logMonitoringDetail("화면 이탈 - 실시간 구독 정리", {
        sessionId: targetSessionId,
      });
    };
  }, [isFocused, targetSessionId]);

  const handleSelectMessage = (msg, idx) => {
    const messageKey = toKey(getMessageId(msg, idx));
    const text = String(getMessageText(msg)).trim();

    if (!text) return;

    // messageId / transcriptId가 없는 실시간 partial 기록은
    // 백엔드 PATCH 대상이 아니므로 선택하지 않는다.
    if (msg.__realtimeOnly) {
      logMonitoringDetail(
        "실시간 임시 자막 선택 무시 - 저장 ID 없음",
        {
          key: messageKey,
          text,
        }
      );

      return;
    }

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
    Keyboard.dismiss();

    if (!selectedMessageKey) {
      Alert.alert("안내", "수정할 자막을 먼저 선택하세요.");
      return;
    }

    if (!currentStt.trim()) {
      Alert.alert("안내", "수정할 내용을 입력하세요.");
      return;
    }

    if (isSubmitting) {
      logMonitoringDetail(
        "수정 요청 무시 - 이미 처리 중"
      );

      return;
    }

    try {
      setIsSubmitting(true);

      const token = await AsyncStorage.getItem("adminToken");

      if (!token) {
        logMonitoringDetail(
          "수정 중단 - adminToken 없음"
        );

        Alert.alert("오류", "관리자 로그인이 필요합니다.");
        navigation.navigate("AdminLogin");

        return;
      }

      const selectedMessage = getSelectedMessage();

      if (!selectedMessage) {
        logMonitoringDetail(
          "수정 중단 - 선택 메시지 찾기 실패",
          {
            selectedMessageKey,
          }
        );

        Alert.alert(
          "오류",
          "선택한 자막 정보를 찾을 수 없습니다."
        );

        return;
      }

      const messageId = selectedMessage.messageId;

      const transcriptId =
        selectedMessage.transcriptId ||
        selectedMessage.id ||
        selectedMessageKey;

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
        type: messageId
          ? "conversation-message"
          : "transcript",
        messageId: messageId || null,
        transcriptId: transcriptId || null,
        body,
      });

      const response = await axios.patch(
        endpoint,
        body,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      logMonitoringDetail("메시지 수정 응답", {
        status: response.status,
        data: response.data,
      });

      if (response.data?.success === false) {
        Alert.alert(
          "실패",
          response.data?.message ||
            "수정 처리에 실패했습니다."
        );

        return;
      }

      const updatedText = currentStt.trim();

      // conversation-message 수정은 백엔드가 /messages/update도 보내지만,
      // 관리자 본인 화면에는 즉시 반영해 체감 지연을 없앤다.
      // transcript 수정 경로는 별도 update topic이 없으므로 이 로컬 반영이 필요하다.
      if (isMountedRef.current) {
        setChatMessages((prev) =>
          prev.map((msg, idx) => {
            const key = toKey(getMessageId(msg, idx));

            if (key !== selectedMessageKey) {
              return msg;
            }

            return {
              ...msg,
              content: updatedText,
              text: updatedText,
            };
          })
        );

        setCurrentStt(updatedText);
      }

      Alert.alert(
        "완료",
        "수정 내용이 반영되었습니다."
      );
    } catch (error) {
      const serverError =
        error.response?.data?.message ||
        JSON.stringify(error.response?.data) ||
        error.message;

      logMonitoringDetail("자막 수정 실패", {
        sessionId: targetSessionId,
        error: serverError,
      });

      Alert.alert(
        "오류",
        "수정에 실패했습니다. 서버 응답을 확인해 주세요."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoEditInfo = () => {
    if (!selectedMessageKey) {
      Alert.alert(
        "안내",
        "정보를 볼 자막을 먼저 선택하세요."
      );

      return;
    }

    const selectedMessage = getSelectedMessage();

    if (!selectedMessage) {
      Alert.alert(
        "오류",
        "선택한 자막 정보를 찾을 수 없습니다."
      );

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
      const stringValue = String(isoString).trim();

      const hasExplicitTimezone =
        stringValue.endsWith("Z") ||
        /[+-]\d{2}:\d{2}$/.test(stringValue);

      if (hasExplicitTimezone) {
        const date = new Date(stringValue);

        return Number.isNaN(date.getTime())
          ? null
          : date;
      }

      const normalized = stringValue.replace("T", " ");

      const [datePart, timePart = "00:00:00"] =
        normalized.split(" ");

      const [year, month, day] = datePart
        .split("-")
        .map(Number);

      const [hour = 0, minute = 0, second = 0] =
        timePart
          .split(":")
          .map((value) =>
            Number(String(value).split(".")[0])
          );

      if (!year || !month || !day) return null;

      return new Date(
        year,
        month - 1,
        day,
        hour,
        minute,
        second
      );
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
      msg.senderType ||
        msg.sender ||
        msg.role ||
        msg.type ||
        ""
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

  const ended = isEndedSession(sessionInfo);

  return (
    <Container>
      <Header>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            Keyboard.dismiss();

            logMonitoringDetail("뒤로가기 클릭");
            navigation.goBack();
          }}
        >
          <BackIcon
            source={backIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <HeaderTitle numberOfLines={1}>
          {getDisplayTitle()}
        </HeaderTitle>

        <View style={{ width: 24 }} />
      </Header>

      <KeyboardAvoidingContent
        enabled
        behavior={
          Platform.OS === "ios" ? "padding" : "height"
        }
        keyboardVerticalOffset={0}
      >
        {isLoading ? (
          <LoadingWrapper>
            <ActivityIndicator
              size="large"
              color="#1EC949"
            />
          </LoadingWrapper>
        ) : (
          <ContentWrapper>
            <ChatContainer>
              <ScrollView
                ref={chatScrollRef}
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={
                  Platform.OS === "ios"
                    ? "interactive"
                    : "on-drag"
                }
                contentContainerStyle={{
                  flexGrow: 1,
                  padding: 20,
                }}
              >
                {chatMessages.length > 0 ||
                Boolean(String(realtimePartial || "").trim()) ? (
                  <>
                    {chatMessages.map((msg, idx) => {
                      const currentKey = toKey(
                        getMessageId(msg, idx)
                      );

                      const isSelected =
                        selectedMessageKey === currentKey;

                      const isVisitor = isVisitorMessage(msg);

                      const msgTime = formatMessageTime(
                        msg.createdAt ||
                          msg.timestamp ||
                          msg.time
                      );

                      const text = String(
                        getMessageText(msg)
                      ).trim();

                      if (!text) return null;

                      if (
                        text === "실시간 자막 변환 중..." ||
                        text === "실시간 자막 변환 중" ||
                        text === "실시간 자막 확인 중..." ||
                        text === "실시간 자막 확인 중"
                      ) {
                        return null;
                      }

                      const bubbleContent = (
                        <BubbleWrapper isVisitor={isVisitor}>
                          {!isVisitor && (
                            <TimeTextRight>
                              {msgTime}
                            </TimeTextRight>
                          )}

                          <BubbleBox
                            isVisitor={isVisitor}
                            isSelected={isSelected}
                          >
                            <BubbleText isVisitor={isVisitor}>
                              {text}
                            </BubbleText>
                          </BubbleBox>

                          {isVisitor && (
                            <TimeTextLeft>
                              {msgTime}
                            </TimeTextLeft>
                          )}
                        </BubbleWrapper>
                      );

                      // final 이벤트가 별도로 오지 않아 로컬에 남겨둔
                      // partial 기록은 서버 ID가 없으므로 수정 선택 불가.
                      if (msg.__realtimeOnly) {
                        return (
                          <View key={currentKey}>
                            {bubbleContent}
                          </View>
                        );
                      }

                      return (
                        <TouchableOpacity
                          key={currentKey}
                          activeOpacity={0.85}
                          onPress={() =>
                            handleSelectMessage(msg, idx)
                          }
                        >
                          {bubbleContent}
                        </TouchableOpacity>
                      );
                    })}

                    {Boolean(
                      String(realtimePartial || "").trim()
                    ) && (
                      <BubbleWrapper isVisitor>
                        <BubbleBox
                          isVisitor
                          isSelected={false}
                        >
                          <BubbleText isVisitor>
                            {realtimePartial}
                          </BubbleText>
                        </BubbleBox>
                      </BubbleWrapper>
                    )}
                  </>
                ) : (
                  <EmptyWrapper>
                    <EmptyText>
                      아직 수신된 자막이 없습니다.
                    </EmptyText>
                  </EmptyWrapper>
                )}

                {ended && (
                  <RefreshingText isEnded={ended}>
                    종료된 통화입니다.
                  </RefreshingText>
                )}
              </ScrollView>
            </ChatContainer>
          </ContentWrapper>
        )}

        <QuickEditCard>
          <EditHeader>
            <EditTitle>바로 수정</EditTitle>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleGoEditInfo}
            >
              <DetailLinkText>정보</DetailLinkText>
            </TouchableOpacity>
          </EditHeader>

          <Divider />

          <EditInputRow>
            <EditInput
              value={currentStt}
              onChangeText={setCurrentStt}
              placeholder={
                ended
                  ? "종료된 통화입니다"
                  : "수정할 자막을 선택하세요"
              }
              placeholderTextColor="#BBB"
              editable={!isSubmitting}
              returnKeyType="done"
              blurOnSubmit
              onFocus={() => {
                setTimeout(() => {
                  scrollChatToBottom(true);
                }, 100);
              }}
              onSubmitEditing={handleUpdateMessage}
            />

            <TouchableOpacity
              activeOpacity={0.7}
              hitSlop={{
                top: 10,
                bottom: 10,
                left: 10,
                right: 10,
              }}
              onPress={handleUpdateMessage}
              disabled={
                isSubmitting || !selectedMessageKey
              }
            >
              {isSubmitting ? (
                <ActivityIndicator
                  size="small"
                  color="#1EC949"
                  style={{ marginLeft: 10 }}
                />
              ) : (
                <EditIcon
                  source={pencilIcon}
                  resizeMode="contain"
                  style={{
                    tintColor: selectedMessageKey
                      ? "#444"
                      : "#BBB",
                  }}
                />
              )}
            </TouchableOpacity>
          </EditInputRow>
        </QuickEditCard>
      </KeyboardAvoidingContent>
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

const KeyboardAvoidingContent = styled(
  KeyboardAvoidingView
)`
  flex: 1;
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
  min-height: 0px;
`;

const ChatContainer = styled.View`
  flex: 1;
  background-color: #F1F2F4;
  border-radius: 20px;
  overflow: hidden;
  min-height: 0px;
`;

const BubbleWrapper = styled.View`
  flex-direction: row;
  justify-content: ${(props) =>
    props.isVisitor ? "flex-start" : "flex-end"};
  align-items: flex-end;
  margin-bottom: 15px;
`;

const BubbleBox = styled.View`
  background-color: ${(props) =>
    props.isVisitor ? "#fff" : "#1EC949"};

  border-color: ${(props) =>
    props.isSelected
      ? "#1EC949"
      : props.isVisitor
      ? "#EAEAEA"
      : "transparent"};

  border-width: ${(props) =>
    props.isSelected
      ? "2px"
      : props.isVisitor
      ? "1px"
      : "0px"};

  border-radius: 20px;
  padding: 12px 18px;
  max-width: 75%;

  elevation: ${(props) =>
    props.isVisitor ? "1" : "0"};

  shadow-color: #000;
  shadow-opacity: 0.05;
  shadow-radius: 3px;
`;

const BubbleText = styled.Text`
  color: ${(props) =>
    props.isVisitor ? "#333" : "#fff"};
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
  flex: 1;
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
  background-color: ${(props) =>
    props.isEnded ? "#E5E7EB" : "#fff"};
  color: ${(props) =>
    props.isEnded ? "#666" : "#aaa"};
  font-size: 13px;
  font-weight: 500;
  padding: 10px 16px;
  border-radius: 18px;
  overflow: hidden;
`;

const QuickEditCard = styled.View`
  flex-shrink: 0;
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
  min-height: 24px;
`;

const EditInput = styled.TextInput`
  flex: 1;
  min-height: 24px;
  max-height: 100px;
  font-size: 15px;
  line-height: 21px;
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