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
import { subscribeSessionTopics } from "../../services/realtimeSocket";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const backIcon = require("../../assets/back_icon.png");
const bellIcon = require("../../assets/bell.png");
const sendInactive = require("../../assets/send_inactive.png");
const sendActive = require("../../assets/send_active.png");
const callEndIcon = require("../../assets/call_end.png");
const callEndOverlayImg = require("../../assets/call_end_overlay.png");

// =========================================================
// 세션 상태
// =========================================================

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

const ACTIVE_SESSION_STATUSES = new Set([
  "OPEN",
  "CALLING",
  "TALKING",
  "ONGOING",
  "INCOMING",
  "ACTIVE",
  "CONNECTED",
]);

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

  // 현재 화면에서 사용 중인 STOMP 구독 해제 함수
  const realtimeUnsubscribeRef = useRef(null);

  // REST 메시지 조회 중복 실행 방지
  const messageFetchBusyRef = useRef(false);

  // 백엔드는 realtime-transcripts에서 partial만 보내므로
  // 현재 화면에 표시 중인 누적 partial을 ref에도 보관한다.
  const realtimePartialRef = useRef("");
  const realtimeUtteranceSeqRef = useRef(0);

  const lastVisitorMessageKeyRef = useRef(null);
  const lastMessageSignatureRef = useRef(null);

  const isEndingRef = useRef(false);
  const isMountedRef = useRef(true);

  // 동일한 종료/권한 오류 Alert 중복 방지
  const remoteEndHandledRef = useRef(false);
  const pairingErrorHandledRef = useRef(false);
  const authErrorHandledRef = useRef(false);

  const {
    sessionId: routeSessionId = null,
    activeSessionId: routeActiveSessionId = null,
    token: routeToken = null,
    deviceUid: routeDeviceUid = null,
  } = route.params || {};

  const initialSessionId =
    routeSessionId ||
    routeActiveSessionId ||
    null;

  // =========================================================
  // State
  // =========================================================

  /**
   * 빠른응답은 이제 단일 선택.
   *
   * UI 구조를 크게 안 바꾸기 위해
   * 배열 형태는 유지하지만 최대 1개만 저장.
   */
  const [selectedTags, setSelectedTags] = useState([]);

  const [isOverlayVisible, setIsOverlayVisible] = useState(false);
  const [activeTab, setActiveTab] = useState("인사");

  const [isLoading, setIsLoading] = useState(true);
  const [isEnding, setIsEnding] = useState(false);

  const [currentSessionId, setCurrentSessionId] =
    useState(initialSessionId);

  const [messages, setMessages] = useState([]);

  // Python partial STT -> Spring -> realtime-transcripts
  // 현재 발화 하나를 실시간으로 보여주는 임시 말풍선
  const [realtimePartial, setRealtimePartial] = useState("");

  const [seconds, setSeconds] = useState(0);

  const [token, setToken] = useState(null);

  const [
    backendQuickReplies,
    setBackendQuickReplies,
  ] = useState([]);

  const tabs = [
    "인사",
    "질문",
    "대답",
    "요청",
    "행동",
  ];

  // =========================================================
  // 인증된 기기 확인
  // =========================================================

  /**
   * 중요
   *
   * 예전의
   *
   * DEFAULT_DEVICE_UID = "DEVICE-001"
   *
   * fallback을 완전히 제거.
   *
   * QR 인증된 실제 기기만 사용한다.
   */
  const getVerifiedDeviceUid = async () => {
    try {
      const [
        storedDeviceUid,
        verified,
        currentUserId,
        pairedUserId,
      ] = await Promise.all([
        AsyncStorage.getItem("deviceUid"),
        AsyncStorage.getItem("isVerifiedUser"),
        AsyncStorage.getItem("userId"),
        AsyncStorage.getItem("pairedUserId"),
      ]);

      logUserChat("기기 인증 상태 확인", {
        storedDeviceUid,
        routeDeviceUid,
        verified,
        currentUserId,
        pairedUserId,
      });

      if (verified !== "true") {
        return null;
      }

      if (!storedDeviceUid) {
        return null;
      }

      if (!currentUserId) {
        return null;
      }

      if (!pairedUserId) {
        return null;
      }

      if (
        String(currentUserId) !==
        String(pairedUserId)
      ) {
        logUserChat(
          "현재 사용자와 QR 인증 사용자 불일치",
          {
            currentUserId,
            pairedUserId,
          }
        );

        return null;
      }

      /**
       * Home에서 routeDeviceUid를 넘겨줬어도
       * AsyncStorage의 실제 인증 기기를 기준으로 한다.
       *
       * route 값이 있다면 일치 여부만 로그로 확인.
       */
      if (
        routeDeviceUid &&
        String(routeDeviceUid) !==
          String(storedDeviceUid)
      ) {
        logUserChat(
          "route deviceUid와 저장 deviceUid 불일치",
          {
            routeDeviceUid,
            storedDeviceUid,
          }
        );
      }

      return String(
        storedDeviceUid
      ).trim();
    } catch (error) {
      logUserChat(
        "인증 기기 확인 실패",
        error?.message
      );

      return null;
    }
  };

  // =========================================================
  // Pairing 로컬 상태 제거
  // =========================================================

  const clearPairingState = async () => {
    try {
      await AsyncStorage.multiRemove([
        "deviceUid",
        "isVerifiedUser",
        "pairedUserId",
      ]);

      logUserChat(
        "로컬 기기 인증 정보 초기화 완료"
      );
    } catch (error) {
      logUserChat(
        "기기 인증 정보 초기화 실패",
        error?.message
      );
    }
  };

  // =========================================================
  // 시간
  // =========================================================

  const getTimeString = () => {
    const now = new Date();

    const hh = String(
      now.getHours()
    ).padStart(2, "0");

    const mm = String(
      now.getMinutes()
    ).padStart(2, "0");

    return `${hh}:${mm}`;
  };

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(
      totalSeconds / 60
    );

    const secs =
      totalSeconds % 60;

    return `${String(mins).padStart(
      2,
      "0"
    )}:${String(secs).padStart(
      2,
      "0"
    )}`;
  };

  const parseServerDate = (isoString) => {
    if (!isoString) {
      return null;
    }

    try {
      const stringValue =
        String(isoString).trim();

      const hasExplicitTimezone =
        stringValue.endsWith("Z") ||
        /[+-]\d{2}:\d{2}$/.test(
          stringValue
        );

      if (hasExplicitTimezone) {
        const date =
          new Date(stringValue);

        return Number.isNaN(
          date.getTime()
        )
          ? null
          : date;
      }

      const normalized =
        stringValue.replace(
          "T",
          " "
        );

      const [
        datePart,
        timePart = "00:00:00",
      ] = normalized.split(" ");

      const [year, month, day] =
        datePart
          .split("-")
          .map(Number);

      const [
        hour = 0,
        minute = 0,
        second = 0,
      ] = timePart
        .split(":")
        .map((value) =>
          Number(
            String(value).split(
              "."
            )[0]
          )
        );

      if (
        !year ||
        !month ||
        !day
      ) {
        return null;
      }

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

  const formatBubbleTime = (isoString) => {
    const date =
      parseServerDate(
        isoString
      );

    if (
      !date ||
      Number.isNaN(
        date.getTime()
      )
    ) {
      return getTimeString();
    }

    const hh = String(
      date.getHours()
    ).padStart(2, "0");

    const mm = String(
      date.getMinutes()
    ).padStart(2, "0");

    return `${hh}:${mm}`;
  };

  // =========================================================
  // Session helper
  // =========================================================

  const getSessionId = (session) => {
    const safeSession =
      session || {};

    return (
      safeSession.sessionId ??
      safeSession.id ??
      safeSession.callSessionId ??
      safeSession.intercomSessionId ??
      null
    );
  };

  const getSessionStatus = (session) => {
    const safeSession =
      session || {};

    return String(
      safeSession.status ||
        safeSession.sessionStatus ||
        safeSession.callStatus ||
        safeSession.state ||
        ""
    )
      .trim()
      .toUpperCase();
  };

  const hasEndedAt = (session) => {
    const safeSession =
      session || {};

    return Boolean(
      safeSession.endedAt ||
        safeSession.endTime ||
        safeSession.closedAt ||
        safeSession.completedAt ||
        safeSession.finishedAt
    );
  };

  const isClosedSession = (session) => {
    if (!session) {
      return true;
    }

    const status =
      getSessionStatus(
        session
      );

    if (
      CLOSED_SESSION_STATUSES.has(
        status
      )
    ) {
      return true;
    }

    if (hasEndedAt(session)) {
      return true;
    }

    return false;
  };

  const isActiveSession = (session) => {
    if (!session) {
      return false;
    }

    const status =
      getSessionStatus(
        session
      );

    if (
      isClosedSession(session)
    ) {
      return false;
    }

    if (!getSessionId(session)) {
      return false;
    }

    /**
     * status가 없어도
     * sessionId가 있고 종료정보가 없다면
     * 진행 중으로 판단.
     */
    if (!status) {
      return true;
    }

    return ACTIVE_SESSION_STATUSES.has(
      status
    );
  };

  // =========================================================
  // 실시간 STOMP 구독 중지
  // =========================================================

  const stopRealtimeSubscription = () => {
    if (realtimeUnsubscribeRef.current) {
      try {
        realtimeUnsubscribeRef.current();
      } catch (error) {
        logUserChat(
          "실시간 구독 해제 실패",
          error?.message
        );
      }

      realtimeUnsubscribeRef.current = null;

      logUserChat(
        "실시간 STOMP 구독 중지"
      );
    }

    messageFetchBusyRef.current = false;
  };

  // =========================================================
  // 메인 화면 이동
  // =========================================================

  const moveToIdleMainTab = async ({
    screen = "홈",
    endedSessionId = null,
  } = {}) => {
    await AsyncStorage.removeItem(
      "callStartTime"
    );

    stopRealtimeSubscription();

    if (isMountedRef.current) {
      setCurrentSessionId(
        null
      );

      setSelectedTags([]);

      setIsOverlayVisible(
        false
      );

      setIsLoading(false);
    }

    const parentNav =
      navigation.getParent() ||
      navigation;

    parentNav.setParams?.({
      intercomStatus: "idle",
      activeSessionId: null,
      sessionId: null,
    });

    logUserChat(
      "idle 상태로 MainTab 이동",
      {
        screen,
        sessionId:
          endedSessionId,
      }
    );

    navigation.reset({
      index: 0,

      routes: [
        {
          name: "MainTab",

          params: {
            screen,
            refresh:
              Date.now(),

            intercomStatus:
              "idle",

            activeSessionId:
              null,

            sessionId:
              null,
          },
        },
      ],
    });
  };

  // =========================================================
  // 로그인 만료 처리
  // =========================================================

  const handleAuthExpired = async () => {
    if (
      authErrorHandledRef.current
    ) {
      return;
    }

    authErrorHandledRef.current =
      true;

    stopRealtimeSubscription();

    await AsyncStorage.removeItem(
      "accessToken"
    );

    Alert.alert(
      "로그인 만료",
      "로그인 정보가 만료되었습니다. 다시 로그인해 주세요.",
      [
        {
          text: "확인",

          onPress: () => {
            navigation.reset({
              index: 0,

              routes: [
                {
                  name:
                    "ResidentLogin",
                },
              ],
            });
          },
        },
      ]
    );
  };

  // =========================================================
  // 세션 권한 / Pairing 오류
  // =========================================================

  const handlePairingPermissionError =
    async (
      activeToken,
      targetSessionId
    ) => {
      if (
        pairingErrorHandledRef.current
      ) {
        return;
      }

      pairingErrorHandledRef.current =
        true;

      stopRealtimeSubscription();

      /**
       * 서버에서 현재 세션에 접근 권한이 없다고 판단했으므로
       * 로컬의 페어링 정보도 더 이상 신뢰하지 않는다.
       */
      await clearPairingState();

      const userId =
        await AsyncStorage.getItem(
          "userId"
        );

      logUserChat(
        "세션 접근 권한 없음 - QR 재인증 필요",
        {
          sessionId:
            targetSessionId,
          userId,
        }
      );

      Alert.alert(
        "기기 재인증 필요",
        "현재 인터폰 기기에 대한 접근 권한을 확인할 수 없습니다. QR 인증을 다시 진행해 주세요.",
        [
          {
            text: "QR 인증",

            onPress: () => {
              navigation.reset({
                index: 0,

                routes: [
                  {
                    name:
                      "QrVerify",

                    params: {
                      token:
                        activeToken,

                      userId,
                    },
                  },
                ],
              });
            },
          },
        ]
      );
    };

  // =========================================================
  // 빠른 응답
  // =========================================================

  const DEFAULT_QUICK_REPLIES = {
    인사: [
      {
        replyCode: 101,
        text: "안녕하세요",
      },
      {
        replyCode: 102,
        text: "어서오세요.",
      },
      {
        replyCode: 103,
        text: "안녕히가세요.",
      },
    ],

    질문: [
      {
        replyCode: 201,
        text: "누구세요?",
      },
      {
        replyCode: 202,
        text: "무슨 일이세요?",
      },
      {
        replyCode: 203,
        text: "이유가 무엇인가요?",
      },
      {
        replyCode: 204,
        text: "방문 목적이 무엇인가요?",
      },
      {
        replyCode: 205,
        text: "필요한 것이 있나요?",
      },
      {
        replyCode: 206,
        text: "어느 업체에서 오셨나요?",
      },
    ],

    대답: [
      {
        replyCode: 301,
        text: "네.",
      },
      {
        replyCode: 302,
        text: "아니요.",
      },
      {
        replyCode: 303,
        text: "맞습니다.",
      },
      {
        replyCode: 304,
        text: "아닙니다.",
      },
      {
        replyCode: 305,
        text: "알겠습니다.",
      },
      {
        replyCode: 306,
        text: "대화 어려워요.",
      },
      {
        replyCode: 307,
        text: "잘못 오셨습니다.",
      },
      {
        replyCode: 308,
        text: "무슨 말씀인지 안 들렸어요.",
      },
    ],

    요청: [
      {
        replyCode: 401,
        text: "용건을 말씀해주세요.",
      },
      {
        replyCode: 402,
        text: "자세히 말씀해주세요.",
      },
      {
        replyCode: 403,
        text: "다시 말씀해주세요.",
      },
      {
        replyCode: 404,
        text: "문 앞에 두고 가세요.",
      },
      {
        replyCode: 405,
        text: "다시 호출해주세요.",
      },
      {
        replyCode: 406,
        text: "통화 끊어주세요.",
      },
      {
        replyCode: 407,
        text: "다음에 방문해주세요.",
      },
    ],

    행동: [
      {
        replyCode: 501,
        text: "지금 나갈게요.",
      },
      {
        replyCode: 502,
        text: "통화 끊겠습니다.",
      },
      {
        replyCode: 503,
        text: "문 열어드릴게요.",
      },
      {
        replyCode: 504,
        text: "나중에 갈게요.",
      },
    ],
  };

  const getQuickReplyText = (
    item = {}
  ) => {
    return String(
      item.text ||
        item.content ||
        item.message ||
        item.replyText ||
        ""
    ).trim();
  };

  /**
   * replyCode 기준으로 탭 분류
   *
   * 100번대 → 인사
   * 200번대 → 질문
   * 300번대 → 대답
   * 400번대 → 요청
   * 500번대 → 행동
   */
  const getReplyTabByCode = (
    replyCode
  ) => {
    const code =
      Number(replyCode);

    if (
      code >= 100 &&
      code < 200
    ) {
      return "인사";
    }

    if (
      code >= 200 &&
      code < 300
    ) {
      return "질문";
    }

    if (
      code >= 300 &&
      code < 400
    ) {
      return "대답";
    }

    if (
      code >= 400 &&
      code < 500
    ) {
      return "요청";
    }

    if (
      code >= 500 &&
      code < 600
    ) {
      return "행동";
    }

    return null;
  };

  const getFilteredReplies = (
    tabName
  ) => {
    /**
     * 백엔드 데이터가 없으면
     * 기존 기본 버튼 사용.
     */
    if (
      !Array.isArray(
        backendQuickReplies
      ) ||
      backendQuickReplies.length ===
        0
    ) {
      return (
        DEFAULT_QUICK_REPLIES[
          tabName
        ] || []
      );
    }

    const serverReplies =
      backendQuickReplies
        .map((item) => {
          const replyCode =
            item.replyCode ??
            item.code ??
            item.id;

          return {
            ...item,

            replyCode:
              Number(replyCode),

            text:
              getQuickReplyText(
                item
              ),
          };
        })
        .filter((item) => {
          if (
            !item.replyCode ||
            !item.text
          ) {
            return false;
          }

          return (
            getReplyTabByCode(
              item.replyCode
            ) === tabName
          );
        });

    /**
     * 서버에 해당 탭 데이터가 없으면
     * 기본값 fallback
     */
    if (
      serverReplies.length === 0
    ) {
      return (
        DEFAULT_QUICK_REPLIES[
          tabName
        ] || []
      );
    }

    return serverReplies;
  };

  // =========================================================
  // 메시지
  // =========================================================

  const getMessageText = (
    message
  ) => {
    return (
      message.content ||
      message.messageText ||
      message.text ||
      message.message ||
      message.rawText ||
      ""
    );
  };

  const getMessageType = (
    message
  ) => {
    const senderValue =
      String(
        message.senderType ||
          message.sender ||
          message.role ||
          message.type ||
          ""
      ).toUpperCase();

    if (
      senderValue ===
        "VISITOR" ||
      senderValue ===
        "INCOMING" ||
      senderValue ===
        "RECEIVE"
    ) {
      return "receive";
    }

    if (
      senderValue ===
        "RESIDENT" ||
      senderValue === "USER" ||
      senderValue ===
        "SEND" ||
      senderValue ===
        "OUTGOING"
    ) {
      return "send";
    }

    if (
      senderValue ===
      "SYSTEM"
    ) {
      return "system";
    }

    return "receive";
  };

  const isHiddenMessageText = (
    text
  ) => {
    const safeText =
      String(
        text || ""
      ).trim();

    return (
      !safeText ||
      safeText ===
        "실시간 자막 변환 중..." ||
      safeText ===
        "실시간 자막 변환 중" ||
      safeText ===
        "실시간 자막 확인 중..." ||
      safeText ===
        "실시간 자막 확인 중" ||
      safeText ===
        "자막 내용 없음"
    );
  };

  const normalizeMessages = (
    rawMessages = []
  ) => {
    if (
      !Array.isArray(rawMessages)
    ) {
      return [];
    }

    const uniqueMap =
      new Map();

    rawMessages.forEach(
      (message, index) => {
        const text =
          String(
            getMessageText(
              message
            )
          ).trim();

        if (
          isHiddenMessageText(
            text
          )
        ) {
          return;
        }

        const createdAt =
          message.createdAt ||
          message.time ||
          "";

        const type =
          getMessageType(
            message
          );

        const id =
          message.messageId ??
          message.id ??
          message.transcriptId ??
          message.chunkOrder ??
          `${type}-${createdAt}-${text}-${index}`;

        /**
         * 백엔드 messageId가 있으면 그 값을 우선 사용.
         *
         * 백엔드에서 같은 메시지를 여러 번 돌려줘도
         * 최대한 중복 제거.
         */
        const dedupeKey =
          message.messageId ??
          message.id ??
          `${type}-${createdAt}-${text}`;

        if (
          uniqueMap.has(
            dedupeKey
          )
        ) {
          return;
        }

        uniqueMap.set(
          dedupeKey,
          {
            id:
              String(id),

            messageId:
              message.messageId ??
              null,

            transcriptId:
              message.transcriptId ??
              null,

            text,

            type,

            senderType:
              message.senderType ||
              message.sender ||
              null,

            messageType:
              message.messageType ||
              null,

            originalContent:
              message.originalContent ||
              null,

            time:
              formatBubbleTime(
                createdAt
              ),

            createdAt,
          }
        );
      }
    );

    return Array.from(
      uniqueMap.values()
    );
  };

  const logMessageUpdateIfChanged = (
    targetSessionId,
    nextMessages
  ) => {
    const signature =
      nextMessages
        .map(
          (item) =>
            `${item.id}:${item.type}:${item.text}`
        )
        .join("|");

    if (
      lastMessageSignatureRef.current ===
      signature
    ) {
      return;
    }

    lastMessageSignatureRef.current =
      signature;

    const lastMessage =
      nextMessages[
        nextMessages.length - 1
      ];

    logUserChat(
      "메시지 갱신",
      {
        sessionId:
          targetSessionId,

        count:
          nextMessages.length,

        lastType:
          lastMessage?.type ||
          null,

        lastText:
          lastMessage?.text ||
          null,
      }
    );
  };

  // =========================================================
  // 현재 세션 조회
  // =========================================================

  const fetchCurrentSession =
    async (
      activeToken,
      deviceUid
    ) => {
      if (!activeToken) {
        return null;
      }

      if (!deviceUid) {
        return null;
      }

      try {
        logUserChat(
          "현재 세션 확인 요청",
          {
            deviceUid,
          }
        );

        const response =
          await axios.get(
            `${BASE_URL}/api/sessions/current`,
            {
              headers: {
                Authorization:
                  `Bearer ${activeToken}`,
              },

              params: {
                deviceUid,
              },

              timeout: 10000,
            }
          );

        const sessionData =
          response.data
            ?.success
            ? response.data
                ?.data || null
            : null;

        logUserChat(
          "현재 세션 확인 응답",
          {
            success:
              response.data
                ?.success ||
              false,

            sessionId:
              getSessionId(
                sessionData
              ),

            status:
              getSessionStatus(
                sessionData
              ),

            ended:
              hasEndedAt(
                sessionData
              ),

            raw:
              sessionData,
          }
        );

        return sessionData;
      } catch (error) {
        const status =
          error.response
            ?.status;

        const serverError =
          error.response?.data
            ?.message ||
          JSON.stringify(
            error.response?.data
          ) ||
          error.message;

        logUserChat(
          "현재 세션 확인 실패",
          {
            status,
            error:
              serverError,
          }
        );

        if (
          status === 401 ||
          status === 403
        ) {
          await handleAuthExpired();
        }

        return null;
      }
    };

  // =========================================================
  // 세션 연결 처리
  // POST /api/sessions/{sessionId}/connect
  // =========================================================

  const connectCurrentSession =
    async (
      targetSessionId,
      activeToken
    ) => {
      if (
        !targetSessionId ||
        !activeToken
      ) {
        return false;
      }

      try {
        logUserChat(
          "통화 연결 요청",
          {
            sessionId:
              targetSessionId,
          }
        );

        const response =
          await axios.post(
            `${BASE_URL}/api/sessions/${targetSessionId}/connect`,
            {},
            {
              headers: {
                Authorization:
                  `Bearer ${activeToken}`,

                "Content-Type":
                  "application/json",
              },

              timeout: 10000,
            }
          );

        logUserChat(
          "통화 연결 응답",
          {
            sessionId:
              targetSessionId,

            status:
              response.status,

            data:
              response.data,
          }
        );

        return (
          response.data
            ?.success !== false
        );
      } catch (error) {
        const status =
          error.response
            ?.status;

        const serverMessage =
          error.response?.data
            ?.message ||
          error.response?.data
            ?.error ||
          error.message;

        logUserChat(
          "통화 연결 요청 실패",
          {
            sessionId:
              targetSessionId,

            status,

            error:
              serverMessage,
          }
        );

        if (
          status === 401 ||
          status === 403
        ) {
          await handleAuthExpired();

          return false;
        }

        if (
          status === 400 &&
          String(
            serverMessage
          ).includes("권한")
        ) {
          await handlePairingPermissionError(
            activeToken,
            targetSessionId
          );

          return false;
        }

        /**
         * 404 / 409 / 410이면
         * 이미 종료되었거나 연결 불가능한 세션으로 판단.
         */
        if (
          status === 404 ||
          status === 409 ||
          status === 410
        ) {
          return false;
        }

        /**
         * connect API만 일시적으로 실패했다고
         * 전체 통화를 막지는 않는다.
         *
         * 메시지 API에서 다시 실제 상태를 확인한다.
         */
        return true;
      }
    };

  // =========================================================
  // 세션 메시지 조회
  // =========================================================

  const fetchSessionMessages =
    async ({
      targetSessionId,
      activeToken,
      shouldVibrate = false,
    }) => {
      if (
        !targetSessionId ||
        !activeToken
      ) {
        logUserChat(
          "메시지 조회 생략",
          {
            hasSessionId:
              Boolean(
                targetSessionId
              ),

            hasToken:
              Boolean(
                activeToken
              ),
          }
        );

        return;
      }

      if (
        isEndingRef.current
      ) {
        return;
      }

      /**
       * 이전 메시지 조회 요청이 아직 안 끝났다면
       * 새 요청 중복 실행하지 않음.
       */
      if (
        messageFetchBusyRef.current
      ) {
        return;
      }

      messageFetchBusyRef.current =
        true;

      try {
        const response =
          await axios.get(
            `${BASE_URL}/api/sessions/${targetSessionId}/messages`,
            {
              headers: {
                Authorization:
                  `Bearer ${activeToken}`,
              },

              timeout: 10000,
            }
          );

        if (
          response.data
            ?.success &&
          Array.isArray(
            response.data?.data
          )
        ) {
          const nextMessages =
            normalizeMessages(
              response.data.data
            );

          const lastVisitorMessage =
            [
              ...nextMessages,
            ]
              .reverse()
              .find(
                (item) =>
                  item.type ===
                  "receive"
              );

          const nextVisitorKey =
            lastVisitorMessage
              ? `${lastVisitorMessage.createdAt}-${lastVisitorMessage.text}`
              : null;

          if (
            shouldVibrate &&
            nextVisitorKey &&
            lastVisitorMessageKeyRef.current !==
              nextVisitorKey
          ) {
            const subtitleVibSetting =
              await AsyncStorage.getItem(
                "subtitleVibrate"
              );

            if (
              subtitleVibSetting ===
              "true"
            ) {
              Vibration.vibrate(
                400
              );

              logUserChat(
                "방문자 새 메시지 진동 실행",
                {
                  sessionId:
                    targetSessionId,
                }
              );
            }
          }

          if (
            nextVisitorKey
          ) {
            lastVisitorMessageKeyRef.current =
              nextVisitorKey;
          }

          logMessageUpdateIfChanged(
            targetSessionId,
            nextMessages
          );

          if (
            isMountedRef.current
          ) {
            setMessages(
              nextMessages
            );
          }
        } else {
          logUserChat(
            "메시지 조회 응답 확인 필요",
            response.data
          );
        }
      } catch (error) {
        const serverStatus =
          error.response
            ?.status;

        const serverError =
          error.response?.data
            ?.message ||
          error.response?.data
            ?.error ||
          JSON.stringify(
            error.response?.data
          ) ||
          error.message;

        logUserChat(
          "세션 메시지 조회 실패",
          {
            sessionId:
              targetSessionId,

            status:
              serverStatus,

            error:
              serverError,
          }
        );

        // =============================================
        // 로그인 인증 오류
        // =============================================

        if (
          serverStatus === 401 ||
          serverStatus === 403
        ) {
          stopRealtimeSubscription();

          await handleAuthExpired();

          return;
        }

        // =============================================
        // ★ 이전에 네가 받았던 오류
        //
        // HTTP 400
        // 해당 세션에 대한 권한이 없습니다.
        // =============================================

        if (
          serverStatus === 400
        ) {
          stopRealtimeSubscription();

          const isPermissionError =
            String(
              serverError || ""
            ).includes(
              "권한"
            );

          if (
            isPermissionError
          ) {
            await handlePairingPermissionError(
              activeToken,
              targetSessionId
            );

            return;
          }

          /**
           * 다른 종류의 잘못된 요청이라도
           * 잘못된 요청을 반복하지 않음.
           */
          Alert.alert(
            "통화 정보 오류",
            serverError ||
              "통화 정보를 확인할 수 없습니다.",
            [
              {
                text: "확인",

                onPress: () =>
                  moveToIdleMainTab(
                    {
                      screen:
                        "홈",

                      endedSessionId:
                        targetSessionId,
                    }
                  ),
              },
            ]
          );

          return;
        }

        // =============================================
        // 이미 종료된 세션
        // =============================================

        if (
          serverStatus === 404 ||
          serverStatus === 409 ||
          serverStatus === 410
        ) {
          stopRealtimeSubscription();

          if (
            !isEndingRef.current
          ) {
            Alert.alert(
              "안내",
              "종료된 통화입니다.",
              [
                {
                  text:
                    "확인",

                  onPress: () =>
                    moveToIdleMainTab(
                      {
                        screen:
                          "히스토리",

                        endedSessionId:
                          targetSessionId,
                      }
                    ),
                },
              ]
            );
          }
        }
      } finally {
        messageFetchBusyRef.current =
          false;
      }
    };

  // =========================================================
  // 실시간 메시지 / partial STT 처리
  // =========================================================

  const vibrateForNewVisitorUtterance = async (
    targetSessionId
  ) => {
    try {
      const subtitleVibSetting =
        await AsyncStorage.getItem(
          "subtitleVibrate"
        );

      if (
        subtitleVibSetting ===
        "true"
      ) {
        Vibration.vibrate(400);

        logUserChat(
          "실시간 방문자 자막 진동 실행",
          {
            sessionId:
              targetSessionId,
          }
        );
      }
    } catch (error) {
      logUserChat(
        "자막 진동 설정 확인 실패",
        error?.message
      );
    }
  };

  /**
   * 백엔드 realtime-transcripts는 현재
   * type=partial만 프론트로 전송한다.
   *
   * Python에서 final이 오면 Spring 내부 partial buffer는
   * 초기화되지만 final 이벤트 자체는 프론트로 오지 않는다.
   *
   * 따라서 다음 partial이 이전 누적문장으로 시작하지 않으면
   * "새 발화가 시작됐다"고 판단하고 이전 partial을
   * 화면의 확정 수신 말풍선으로 남긴다.
   */
  const commitPreviousRealtimePartial = (
    text
  ) => {
    const safeText =
      String(
        text || ""
      ).trim();

    if (!safeText) {
      return;
    }

    const nextId =
      `realtime-receive-${Date.now()}-${++realtimeUtteranceSeqRef.current}`;

    setMessages(
      (prev) => {
        const alreadyExists =
          prev.some(
            (item) =>
              item.type ===
                "receive" &&
              String(
                item.text || ""
              ).trim() ===
                safeText
          );

        if (alreadyExists) {
          return prev;
        }

        return [
          ...prev,
          {
            id: nextId,
            messageId: null,
            transcriptId: null,
            text: safeText,
            type: "receive",
            senderType: "VISITOR",
            messageType: "REALTIME_STT",
            originalContent: null,
            time: getTimeString(),
            createdAt:
              new Date().toISOString(),
            isRealtimeCommitted:
              true,
          },
        ];
      }
    );
  };

  const clearRealtimePartial = () => {
    realtimePartialRef.current =
      "";

    if (
      isMountedRef.current
    ) {
      setRealtimePartial("");
    }
  };

  const handleRealtimeTranscriptMessage = (
    targetSessionId,
    payload
  ) => {
    if (
      !payload ||
      typeof payload !==
        "object"
    ) {
      return;
    }

    if (
      payload.sessionId != null &&
      String(
        payload.sessionId
      ) !==
        String(
          targetSessionId
        )
    ) {
      return;
    }

    const realtimeType =
      String(
        payload.type || ""
      )
        .trim()
        .toLowerCase();

    if (
      realtimeType !==
      "partial"
    ) {
      return;
    }

    const nextText =
      String(
        payload.text || ""
      ).trim();

    if (!nextText) {
      return;
    }

    const previousText =
      String(
        realtimePartialRef.current ||
          ""
      ).trim();

    /**
     * 같은 발화 중에는 Spring이 delta를 누적해서 보내므로
     * nextText는 previousText로 시작해야 한다.
     *
     * 그렇지 않으면 Python final 이후
     * 다음 발화의 첫 partial로 판단.
     */
    const isNewUtterance =
      Boolean(previousText) &&
      nextText !==
        previousText &&
      !nextText.startsWith(
        previousText
      );

    if (
      isNewUtterance
    ) {
      commitPreviousRealtimePartial(
        previousText
      );

      vibrateForNewVisitorUtterance(
        targetSessionId
      );
    } else if (
      !previousText
    ) {
      vibrateForNewVisitorUtterance(
        targetSessionId
      );
    }

    realtimePartialRef.current =
      nextText;

    if (
      isMountedRef.current
    ) {
      setRealtimePartial(
        nextText
      );
    }

    logUserChat(
      "실시간 partial STT 수신",
      {
        sessionId:
          targetSessionId,
        text:
          nextText,
        newUtterance:
          isNewUtterance,
      }
    );
  };

  /**
   * /topic/sessions/{id}/messages
   *
   * ConversationMessageService는 messageId가 들어있는
   * ConversationMessageResponse를 전송한다.
   *
   * SessionService.sendReply()는 같은 destination으로
   * ReplyMessage(messageId 없음)도 한 번 더 전송하므로,
   * 여기서는 messageId가 없는 이벤트를 무시해 중복 말풍선을 막는다.
   */
  const handleRealtimeConversationMessage = (
    targetSessionId,
    payload
  ) => {
    if (
      !payload ||
      typeof payload !==
        "object"
    ) {
      return;
    }

    if (
      payload.sessionId != null &&
      String(
        payload.sessionId
      ) !==
        String(
          targetSessionId
        )
    ) {
      return;
    }

    if (
      payload.messageId == null
    ) {
      logUserChat(
        "messageId 없는 중복/보조 메시지 이벤트 무시",
        payload
      );

      return;
    }

    const normalized =
      normalizeMessages([
        payload,
      ])[0];

    if (!normalized) {
      return;
    }

    /**
     * 서버가 확정 VISITOR 메시지를 보내는 경로가 생기거나
     * 기존 STT 경로에서 메시지가 들어온 경우,
     * 동일 텍스트의 realtime 임시 말풍선은 제거한다.
     */
    if (
      normalized.type ===
        "receive"
    ) {
      const currentPartial =
        String(
          realtimePartialRef.current ||
            ""
        ).trim();

      if (
        currentPartial &&
        currentPartial ===
          normalized.text
      ) {
        clearRealtimePartial();
      }
    }

    setMessages(
      (prev) => {
        let next = [
          ...prev,
        ];

        /**
         * 서버 messageId 기준 기존 메시지 갱신
         */
        const sameMessageIndex =
          next.findIndex(
            (item) =>
              item.messageId != null &&
              String(
                item.messageId
              ) ===
                String(
                  normalized.messageId
                )
          );

        if (
          sameMessageIndex >=
          0
        ) {
          next[
            sameMessageIndex
          ] = {
            ...next[
              sameMessageIndex
            ],
            ...normalized,
          };

          return next;
        }

        /**
         * POST /reply 성공 직후 만든 local-send 말풍선이 있다면
         * 서버의 정식 messageId 메시지로 교체.
         */
        if (
          normalized.type ===
          "send"
        ) {
          const localIndex =
            next.findIndex(
              (item) =>
                String(
                  item.id || ""
                ).startsWith(
                  "local-send-"
                ) &&
                item.type ===
                  "send" &&
                String(
                  item.text || ""
                ).trim() ===
                  normalized.text
            );

          if (
            localIndex >= 0
          ) {
            next[
              localIndex
            ] = normalized;

            return next;
          }
        }

        /**
         * realtime partial에서 로컬 확정해둔 방문자 말풍선과
         * 서버 확정 메시지가 동일하면 서버 메시지로 교체.
         */
        if (
          normalized.type ===
          "receive"
        ) {
          const realtimeIndex =
            next.findIndex(
              (item) =>
                item.isRealtimeCommitted ===
                  true &&
                item.type ===
                  "receive" &&
                String(
                  item.text || ""
                ).trim() ===
                  normalized.text
            );

          if (
            realtimeIndex >=
            0
          ) {
            next[
              realtimeIndex
            ] = normalized;

            return next;
          }
        }

        next.push(
          normalized
        );

        return next;
      }
    );

    if (
      normalized.type ===
      "receive"
    ) {
      const visitorKey =
        `${normalized.createdAt}-${normalized.text}`;

      if (
        lastVisitorMessageKeyRef.current !==
        visitorKey
      ) {
        lastVisitorMessageKeyRef.current =
          visitorKey;
      }
    }

    logUserChat(
      "실시간 대화 메시지 수신",
      {
        sessionId:
          targetSessionId,
        messageId:
          normalized.messageId,
        type:
          normalized.type,
        text:
          normalized.text,
      }
    );
  };

  const handleRealtimeMessageUpdate = (
    targetSessionId,
    payload
  ) => {
    if (
      !payload ||
      typeof payload !==
        "object" ||
      payload.messageId == null
    ) {
      return;
    }

    if (
      payload.sessionId != null &&
      String(
        payload.sessionId
      ) !==
        String(
          targetSessionId
        )
    ) {
      return;
    }

    const normalized =
      normalizeMessages([
        payload,
      ])[0];

    if (!normalized) {
      return;
    }

    setMessages(
      (prev) =>
        prev.map(
          (item) =>
            item.messageId !=
              null &&
            String(
              item.messageId
            ) ===
              String(
                normalized.messageId
              )
              ? {
                  ...item,
                  ...normalized,
                }
              : item
        )
    );

    logUserChat(
      "실시간 메시지 수정 이벤트 수신",
      {
        sessionId:
          targetSessionId,
        messageId:
          normalized.messageId,
        text:
          normalized.text,
      }
    );
  };

  const handleRealtimeStatusMessage = (
    targetSessionId,
    payload
  ) => {
    if (
      !payload ||
      typeof payload !==
        "object"
    ) {
      return;
    }

    if (
      payload.sessionId != null &&
      String(
        payload.sessionId
      ) !==
        String(
          targetSessionId
        )
    ) {
      return;
    }

    const nextStatus =
      String(
        payload.status || ""
      )
        .trim()
        .toUpperCase();

    logUserChat(
      "실시간 세션 상태 수신",
      {
        sessionId:
          targetSessionId,
        status:
          nextStatus,
        message:
          payload.message ||
          null,
      }
    );

    if (
      !CLOSED_SESSION_STATUSES.has(
        nextStatus
      )
    ) {
      return;
    }

    stopRealtimeSubscription();

    if (
      isEndingRef.current ||
      remoteEndHandledRef.current
    ) {
      return;
    }

    remoteEndHandledRef.current =
      true;

    Alert.alert(
      "안내",
      payload.message ||
        "통화가 종료되었습니다.",
      [
        {
          text: "확인",
          onPress: () =>
            moveToIdleMainTab(
              {
                screen:
                  "히스토리",
                endedSessionId:
                  targetSessionId,
              }
            ),
        },
      ]
    );
  };

  // =========================================================
  // STOMP session topic 구독 시작
  // =========================================================

  const startRealtimeSubscription = (
    targetSessionId
  ) => {
    stopRealtimeSubscription();

    if (
      !targetSessionId
    ) {
      return;
    }

    realtimePartialRef.current =
      "";

    if (
      isMountedRef.current
    ) {
      setRealtimePartial("");
    }

    remoteEndHandledRef.current =
      false;

    lastMessageSignatureRef.current =
      null;

    lastVisitorMessageKeyRef.current =
      null;

    pairingErrorHandledRef.current =
      false;

    logUserChat(
      "실시간 STOMP 구독 시작",
      {
        sessionId:
          targetSessionId,
      }
    );

    realtimeUnsubscribeRef.current =
      subscribeSessionTopics(
        targetSessionId,
        {
          onRealtimeTranscript:
            (payload) =>
              handleRealtimeTranscriptMessage(
                targetSessionId,
                payload
              ),

          onMessage:
            (payload) =>
              handleRealtimeConversationMessage(
                targetSessionId,
                payload
              ),

          onMessageUpdate:
            (payload) =>
              handleRealtimeMessageUpdate(
                targetSessionId,
                payload
              ),

          onStatus:
            (payload) =>
              handleRealtimeStatusMessage(
                targetSessionId,
                payload
              ),
        }
      );
  };

  // =========================================================
  // Mount / Unmount
  // =========================================================

  useEffect(() => {
    isMountedRef.current =
      true;

    return () => {
      isMountedRef.current =
        false;

      stopRealtimeSubscription();

      Vibration.cancel();
    };
  }, []);

  // =========================================================
  // 타이머
  // =========================================================

  useEffect(() => {
    logUserChat(
      "화면 진입",
      {
        routeSessionId,
        routeActiveSessionId,
        initialSessionId,
        routeDeviceUid,

        hasRouteToken:
          Boolean(
            routeToken
          ),
      }
    );

    const restoreTimer =
      async () => {
        try {
          const startTime =
            await AsyncStorage.getItem(
              "callStartTime"
            );

          if (startTime) {
            const elapsed =
              Math.floor(
                (Date.now() -
                  Number(
                    startTime
                  )) /
                  1000
              );

            if (
              isMountedRef.current
            ) {
              setSeconds(
                elapsed >= 0
                  ? elapsed
                  : 0
              );
            }

            logUserChat(
              "타이머 복구",
              {
                elapsedSeconds:
                  elapsed >= 0
                    ? elapsed
                    : 0,
              }
            );
          } else {
            await AsyncStorage.setItem(
              "callStartTime",
              Date.now().toString()
            );

            logUserChat(
              "타이머 새로 시작"
            );
          }
        } catch (error) {
          logUserChat(
            "타이머 복구 실패",
            error?.message
          );
        }
      };

    restoreTimer();

    const timer =
      setInterval(() => {
        if (
          isMountedRef.current &&
          !isEndingRef.current
        ) {
          setSeconds(
            (prev) =>
              prev + 1
          );
        }
      }, 1000);

    return () =>
      clearInterval(
        timer
      );
  }, []);

  // =========================================================
  // Android 뒤로가기
  // =========================================================

  useEffect(() => {
    const backHandler =
      BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          if (
            isEndingRef.current
          ) {
            return true;
          }

          logUserChat(
            "Android 뒤로가기 감지 - 종료 모달 표시"
          );

          setIsOverlayVisible(
            true
          );

          return true;
        }
      );

    return () =>
      backHandler.remove();
  }, []);

  // =========================================================
  // Chat 초기화
  // =========================================================

  useEffect(() => {
    let isCancelled =
      false;

    const initializeChatRoom =
      async () => {
        try {
          setIsLoading(
            true
          );

          stopRealtimeSubscription();

          pairingErrorHandledRef.current =
            false;

          authErrorHandledRef.current =
            false;

          const savedToken =
            await AsyncStorage.getItem(
              "accessToken"
            );

          const activeToken =
            savedToken ||
            routeToken ||
            null;

          logUserChat(
            "초기화 시작",
            {
              hasSavedToken:
                Boolean(
                  savedToken
                ),

              hasRouteToken:
                Boolean(
                  routeToken
                ),

              activeSessionId:
                initialSessionId,
            }
          );

          if (
            !isCancelled &&
            isMountedRef.current
          ) {
            setToken(
              activeToken
            );
          }

          // =============================================
          // 로그인 확인
          // =============================================

          if (!activeToken) {
            logUserChat(
              "초기화 중단 - accessToken 없음"
            );

            Alert.alert(
              "오류",
              "로그인이 필요합니다.",
              [
                {
                  text:
                    "확인",

                  onPress:
                    () => {
                      navigation.reset(
                        {
                          index: 0,

                          routes:
                            [
                              {
                                name:
                                  "ResidentLogin",
                              },
                            ],
                        }
                      );
                    },
                },
              ]
            );

            return;
          }

          // =============================================
          // QR 인증 기기 확인
          // =============================================

          const deviceUid =
            await getVerifiedDeviceUid();

          if (!deviceUid) {
            logUserChat(
              "초기화 중단 - 인증된 deviceUid 없음"
            );

            const userId =
              await AsyncStorage.getItem(
                "userId"
              );

            Alert.alert(
              "기기 인증 필요",
              "인터폰 기기 인증이 필요합니다.",
              [
                {
                  text:
                    "QR 인증",

                  onPress:
                    () => {
                      navigation.reset(
                        {
                          index: 0,

                          routes:
                            [
                              {
                                name:
                                  "QrVerify",

                                params:
                                  {
                                    token:
                                      activeToken,

                                    userId,
                                  },
                              },
                            ],
                        }
                      );
                    },
                },
              ]
            );

            return;
          }

          // =============================================
          // 빠른응답 목록
          // =============================================

          try {
            const repliesRes =
              await axios.get(
                `${BASE_URL}/api/quick-replies`,
                {
                  headers: {
                    Authorization:
                      `Bearer ${activeToken}`,
                  },

                  timeout: 10000,
                }
              );

            if (
              repliesRes.data
                ?.success &&
              Array.isArray(
                repliesRes.data
                  ?.data
              ) &&
              !isCancelled &&
              isMountedRef.current
            ) {
              setBackendQuickReplies(
                repliesRes.data
                  .data
              );

              logUserChat(
                "빠른 응답 목록 조회 완료",
                {
                  count:
                    repliesRes
                      .data.data
                      .length,
                }
              );
            }
          } catch (error) {
            logUserChat(
              "빠른 응답 목록 조회 실패 - 기본 목록 사용",
              error?.message
            );
          }

          // =============================================
          // sessionId 확인
          // =============================================

          if (!initialSessionId) {
            logUserChat(
              "초기화 중단 - sessionId 없음"
            );

            Alert.alert(
              "안내",
              "현재 연결된 인터폰 통화가 없습니다.",
              [
                {
                  text:
                    "확인",

                  onPress:
                    () =>
                      moveToIdleMainTab(
                        {
                          screen:
                            "홈",
                        }
                      ),
                },
              ]
            );

            return;
          }

          // =============================================
          // 현재 세션 재검증
          // =============================================

          const currentSession =
            await fetchCurrentSession(
              activeToken,
              deviceUid
            );

          if (
            pairingErrorHandledRef.current ||
            authErrorHandledRef.current
          ) {
            return;
          }

          const currentOpenSessionId =
            getSessionId(
              currentSession
            );

          if (
            !currentSession ||
            isClosedSession(
              currentSession
            ) ||
            !isActiveSession(
              currentSession
            ) ||
            String(
              currentOpenSessionId
            ) !==
              String(
                initialSessionId
              )
          ) {
            logUserChat(
              "초기화 중단 - 현재 활성 세션 아님",
              {
                routeSessionId:
                  initialSessionId,

                currentSessionId:
                  currentOpenSessionId,

                currentStatus:
                  getSessionStatus(
                    currentSession
                  ),

                hasEndedAt:
                  hasEndedAt(
                    currentSession
                  ),
              }
            );

            Alert.alert(
              "안내",
              "이미 종료된 통화입니다.",
              [
                {
                  text:
                    "확인",

                  onPress:
                    () =>
                      moveToIdleMainTab(
                        {
                          screen:
                            "히스토리",

                          endedSessionId:
                            initialSessionId,
                        }
                      ),
                },
              ]
            );

            return;
          }

          if (
            !isCancelled &&
            isMountedRef.current
          ) {
            setCurrentSessionId(
              initialSessionId
            );

            setMessages([]);
          }

          logUserChat(
            "기존 활성 세션 사용",
            {
              sessionId:
                initialSessionId,

              deviceUid,

              status:
                getSessionStatus(
                  currentSession
                ),
            }
          );

          // =============================================
          // ★ 통화 연결 API
          // =============================================

          const connectSuccess =
            await connectCurrentSession(
              initialSessionId,
              activeToken
            );

          if (
            pairingErrorHandledRef.current ||
            authErrorHandledRef.current
          ) {
            return;
          }

          if (
            !connectSuccess
          ) {
            Alert.alert(
              "안내",
              "통화 연결 상태를 확인할 수 없습니다.",
              [
                {
                  text:
                    "확인",

                  onPress:
                    () =>
                      moveToIdleMainTab(
                        {
                          screen:
                            "히스토리",

                          endedSessionId:
                            initialSessionId,
                        }
                      ),
                },
              ]
            );

            return;
          }

          // =============================================
          // 기존 메시지 최초 1회 조회
          // =============================================

          await fetchSessionMessages({
            targetSessionId:
              initialSessionId,
            activeToken,
            shouldVibrate:
              false,
          });

          if (
            pairingErrorHandledRef.current ||
            authErrorHandledRef.current
          ) {
            return;
          }

          // =============================================
          // 이후 실시간 STOMP 구독
          // =============================================

          startRealtimeSubscription(
            initialSessionId
          );
        } catch (error) {
          const serverError =
            error.response?.data
              ?.message ||
            JSON.stringify(
              error.response?.data
            ) ||
            error.message;

          logUserChat(
            "채팅방 초기화 실패",
            serverError
          );

          Alert.alert(
            "오류",
            "인터폰 세션 정보를 불러오지 못했습니다.",
            [
              {
                text: "확인",

                onPress: () =>
                  moveToIdleMainTab(
                    {
                      screen:
                        "홈",
                    }
                  ),
              },
            ]
          );
        } finally {
          if (
            !isCancelled &&
            isMountedRef.current
          ) {
            setIsLoading(
              false
            );
          }
        }
      };

    initializeChatRoom();

    return () => {
      isCancelled = true;

      stopRealtimeSubscription();

      logUserChat(
        "화면 이탈 - 실시간 구독 정리"
      );
    };
  }, [initialSessionId]);

  // =========================================================
  // 종료
  // =========================================================

  const moveToHistoryAfterEnd =
    async (
      endedSessionId
    ) => {
      await moveToIdleMainTab(
        {
          screen:
            "히스토리",

          endedSessionId,
        }
      );
    };

  const confirmEndCall =
    async () => {
      if (
        isEndingRef.current
      ) {
        logUserChat(
          "종료 요청 무시 - 이미 처리 중"
        );

        return;
      }

      isEndingRef.current =
        true;

      setIsEnding(true);

      setIsOverlayVisible(
        false
      );

      stopRealtimeSubscription();

      const activeSessionId =
        currentSessionId ||
        initialSessionId;

      const activeToken =
        token ||
        (await AsyncStorage.getItem(
          "accessToken"
        ));

      if (!activeSessionId) {
        logUserChat(
          "종료 실패 - sessionId 없음"
        );

        Alert.alert(
          "오류",
          "종료할 세션 정보를 찾을 수 없습니다.",
          [
            {
              text: "확인",

              onPress:
                async () => {
                  await moveToHistoryAfterEnd(
                    null
                  );
                },
            },
          ]
        );

        return;
      }

      if (!activeToken) {
        isEndingRef.current =
          false;

        setIsEnding(false);

        await handleAuthExpired();

        return;
      }

      let isEndSuccess =
        false;

      try {
        logUserChat(
          "세션 종료 요청",
          {
            sessionId:
              activeSessionId,

            hasToken:
              Boolean(
                activeToken
              ),
          }
        );

        const response =
          await axios.post(
            `${BASE_URL}/api/sessions/end`,
            {
              sessionId:
                activeSessionId,
            },
            {
              headers: {
                Authorization:
                  `Bearer ${activeToken}`,

                "Content-Type":
                  "application/json",
              },

              timeout: 10000,
            }
          );

        isEndSuccess =
          response.data
            ?.success !==
          false;

        logUserChat(
          "세션 종료 응답",
          {
            sessionId:
              activeSessionId,

            status:
              response.status,

            data:
              response.data,

            success:
              response.data
                ?.success,

            endedAt:
              response.data
                ?.data
                ?.endedAt ||
              null,
          }
        );
      } catch (error) {
        const status =
          error.response
            ?.status;

        const serverError =
          error.response?.data
            ?.message ||
          JSON.stringify(
            error.response?.data
          ) ||
          error.message;

        logUserChat(
          "세션 종료 실패",
          {
            sessionId:
              activeSessionId,

            status,

            error:
              serverError,
          }
        );

        if (
          status === 401 ||
          status === 403
        ) {
          isEndingRef.current =
            false;

          setIsEnding(false);

          await handleAuthExpired();

          return;
        }
      } finally {
        if (isEndSuccess) {
          await moveToHistoryAfterEnd(
            activeSessionId
          );
        } else if (
          !authErrorHandledRef.current
        ) {
          isEndingRef.current =
            false;

          if (
            isMountedRef.current
          ) {
            setIsEnding(
              false
            );
          }

          Alert.alert(
            "종료 실패",
            "통화 종료 처리에 실패했습니다. 잠시 후 다시 시도해 주세요."
          );

          /**
           * 종료 요청이 실패했으니 실시간 구독을 다시 시작.
           */
          if (
            activeSessionId &&
            activeToken
          ) {
            startRealtimeSubscription(
              activeSessionId
            );
          }
        }
      }
    };

  // =========================================================
  // 빠른 응답 선택
  // =========================================================

  const handleSelectTag = (
    item
  ) => {
    if (
      isEndingRef.current
    ) {
      return;
    }

    /**
     * ★ 단일 선택
     *
     * 기존에는
     *
     * [네.] + [문 앞에 두고 가세요.]
     *
     * 두 개 선택이 가능했는데,
     * 백엔드는 replyCode 1개만 받음.
     *
     * 이제 하나만 선택.
     */
    setSelectedTags(
      (prev) => {
        const currentlySelected =
          prev[0];

        /**
         * 같은 버튼 다시 누르면 선택 해제
         */
        if (
          currentlySelected &&
          String(
            currentlySelected.replyCode
          ) ===
            String(
              item.replyCode
            )
        ) {
          logUserChat(
            "빠른 응답 선택 해제",
            {
              replyCode:
                item.replyCode,
            }
          );

          return [];
        }

        logUserChat(
          "빠른 응답 선택",
          {
            replyCode:
              item.replyCode,

            text:
              item.text,
          }
        );

        return [item];
      }
    );
  };

  const removeTag = () => {
    if (
      isEndingRef.current
    ) {
      return;
    }

    setSelectedTags([]);
  };

  // =========================================================
  // 로컬 메시지 즉시 추가
  // =========================================================

  const appendLocalSendMessage =
    (text) => {
      const safeText =
        String(
          text || ""
        ).trim();

      if (!safeText) {
        return;
      }

      setMessages(
        (prev) => {
          /**
           * WebSocket의 정식 메시지가 HTTP 응답보다 먼저 도착한 경우
           * 같은 내용의 local 말풍선을 또 추가하지 않는다.
           */
          const alreadyExists =
            [...prev]
              .reverse()
              .slice(0, 5)
              .some(
                (item) =>
                  item.type ===
                    "send" &&
                  String(
                    item.text || ""
                  ).trim() ===
                    safeText
              );

          if (
            alreadyExists
          ) {
            return prev;
          }

          return [
            ...prev,

            {
              id:
                `local-send-${Date.now()}`,

              messageId:
                null,

              transcriptId:
                null,

              text:
                safeText,

              type:
                "send",

              senderType:
                "USER",

              messageType:
                "QUICK_REPLY",

              originalContent:
                null,

              time:
                getTimeString(),

              createdAt:
                new Date().toISOString(),
            },
          ];
        }
      );
    };

  // =========================================================
  // 빠른 응답 전송
  // =========================================================

  const handleSendResponse =
    async () => {
      if (
        isEndingRef.current
      ) {
        return;
      }

      if (
        selectedTags.length ===
        0
      ) {
        return;
      }

      const selectedReply =
        selectedTags[0];

      const targetSessionId =
        currentSessionId;

      const activeToken =
        token ||
        (await AsyncStorage.getItem(
          "accessToken"
        ));

      if (!targetSessionId) {
        Alert.alert(
          "오류",
          "현재 연결된 세션이 없습니다."
        );

        return;
      }

      if (!activeToken) {
        await handleAuthExpired();

        return;
      }

      if (
        !selectedReply
          ?.replyCode
      ) {
        Alert.alert(
          "오류",
          "빠른 응답 정보를 확인할 수 없습니다."
        );

        return;
      }

      const messageText =
        String(
          selectedReply.text ||
            ""
        ).trim();

      try {
        logUserChat(
          "빠른 응답 전송 요청",
          {
            sessionId:
              targetSessionId,

            replyCode:
              selectedReply.replyCode,

            text:
              messageText,
          }
        );

        const response =
          await axios.post(
            `${BASE_URL}/api/sessions/${targetSessionId}/reply`,
            {
              replyCode:
                selectedReply.replyCode,
            },
            {
              headers: {
                Authorization:
                  `Bearer ${activeToken}`,

                "Content-Type":
                  "application/json",
              },

              timeout: 10000,
            }
          );

        logUserChat(
          "빠른 응답 전송 완료",
          {
            sessionId:
              targetSessionId,

            status:
              response.status,

            response:
              response.data,
          }
        );

        /**
         * 서버 전송 성공 이후에만
         * 내 메시지를 화면에 즉시 표시.
         *
         * 실패했는데 화면에는 보이는
         * phantom message 방지.
         */
        appendLocalSendMessage(
          messageText
        );

        setSelectedTags([]);

        /**
         * 이후 서버의 /messages WebSocket 이벤트가 오면
         * local-send 말풍선을 정식 messageId 메시지로 교체한다.
         *
         * 더 이상 전송 직후 REST 재조회는 하지 않는다.
         */
      } catch (error) {
        const serverStatus =
          error.response
            ?.status;

        const serverError =
          error.response?.data
            ?.message ||
          error.response?.data
            ?.error ||
          JSON.stringify(
            error.response?.data
          ) ||
          error.message;

        logUserChat(
          "빠른 응답 전송 실패",
          {
            sessionId:
              targetSessionId,

            status:
              serverStatus,

            error:
              serverError,
          }
        );

        if (
          serverStatus === 401 ||
          serverStatus === 403
        ) {
          await handleAuthExpired();

          return;
        }

        /**
         * 세션 권한 문제
         */
        if (
          serverStatus ===
            400 &&
          String(
            serverError
          ).includes("권한")
        ) {
          await handlePairingPermissionError(
            activeToken,
            targetSessionId
          );

          return;
        }

        /**
         * 이미 종료된 세션
         */
        if (
          serverStatus === 404 ||
          serverStatus === 409 ||
          serverStatus === 410
        ) {
          stopRealtimeSubscription();

          Alert.alert(
            "안내",
            "종료된 통화에는 응답을 보낼 수 없습니다.",
            [
              {
                text:
                  "확인",

                onPress:
                  () =>
                    moveToIdleMainTab(
                      {
                        screen:
                          "히스토리",

                        endedSessionId:
                          targetSessionId,
                      }
                    ),
              },
            ]
          );

          return;
        }

        Alert.alert(
          "전송 실패",
          serverError ||
            "빠른 응답을 전송하지 못했습니다."
        );
      }
    };

  // =========================================================
  // System 메시지는 UI에서 숨김
  // =========================================================

  const visibleMessages =
    messages.filter(
      (msg) =>
        msg.type !==
        "system"
    );

  // =========================================================
  // UI
  // =========================================================

  return (
    <Container>
      {/* ================= HEADER ================= */}

      <Header>
        <HeaderSide>
          <TouchableOpacity
            onPress={() => {
              if (
                isEndingRef.current
              ) {
                return;
              }

              logUserChat(
                "상단 뒤로가기 클릭 - 종료 모달 표시"
              );

              setIsOverlayVisible(
                true
              );
            }}
            disabled={isEnding}
          >
            <IconBtn
              source={backIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </HeaderSide>

        <HeaderSide
          style={{
            width: 120,
          }}
        >
          <HeaderCenter>
            <Logo
              source={bellIcon}
              resizeMode="contain"
            />

            <HeaderTitle>
              인터폰 실시간
            </HeaderTitle>
          </HeaderCenter>
        </HeaderSide>

        <HeaderSide
          style={{
            flexDirection:
              "row",

            justifyContent:
              "flex-end",

            alignItems:
              "center",
          }}
        >
          <TimerText>
            {formatTimer(
              seconds
            )}
          </TimerText>

          <TouchableOpacity
            onPress={() => {
              if (
                isEndingRef.current
              ) {
                return;
              }

              logUserChat(
                "통화 종료 버튼 클릭 - 종료 모달 표시"
              );

              setIsOverlayVisible(
                true
              );
            }}
            disabled={isEnding}
            style={{
              marginLeft: 10,
            }}
          >
            <EndIcon
              source={callEndIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </HeaderSide>
      </Header>

      {/* ================= CHAT ================= */}

      <ChatArea>
        {isLoading ? (
          <View
            style={{
              flex: 1,

              justifyContent:
                "center",

              alignItems:
                "center",
            }}
          >
            <ActivityIndicator
              size="large"
              color="#06F393"
            />
          </View>
        ) : (
          <ScrollView
            ref={scrollViewRef}
            showsVerticalScrollIndicator={
              false
            }
            onContentSizeChange={() =>
              scrollViewRef.current?.scrollToEnd(
                {
                  animated:
                    true,
                }
              )
            }
          >
            {visibleMessages.map(
              (msg) =>
                msg.type ===
                "receive" ? (
                  <ReceiveBubble
                    key={
                      msg.id
                    }
                  >
                    <BubbleTextContainer>
                      <ReceiveBubbleText>
                        {
                          msg.text
                        }
                      </ReceiveBubbleText>
                    </BubbleTextContainer>
                  </ReceiveBubble>
                ) : (
                  <SendBubble
                    key={
                      msg.id
                    }
                  >
                    <SendBubbleText>
                      {
                        msg.text
                      }
                    </SendBubbleText>
                  </SendBubble>
                )
            )}

            {Boolean(
              String(
                realtimePartial ||
                  ""
              ).trim()
            ) && (
              <ReceiveBubble
                key="realtime-partial"
              >
                <BubbleTextContainer>
                  <ReceiveBubbleText>
                    {
                      realtimePartial
                    }
                  </ReceiveBubbleText>
                </BubbleTextContainer>
              </ReceiveBubble>
            )}
          </ScrollView>
        )}
      </ChatArea>

      {/* ================= QUICK REPLY ================= */}

      <InputSection>
        <InputBar>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
            contentContainerStyle={{
              alignItems:
                "center",
            }}
          >
            {selectedTags.map(
              (item) => (
                <SelectedTag
                  key={String(
                    item.replyCode
                  )}
                >
                  <TagText>
                    {
                      item.text
                    }
                  </TagText>

                  <TouchableOpacity
                    onPress={
                      removeTag
                    }
                    disabled={
                      isEnding
                    }
                  >
                    <Ionicons
                      name="close-circle"
                      size={16}
                      color="#FF4D4D"
                    />
                  </TouchableOpacity>
                </SelectedTag>
              )
            )}
          </ScrollView>

          <TouchableOpacity
            onPress={
              handleSendResponse
            }
            disabled={
              isEnding ||
              selectedTags.length ===
                0
            }
          >
            <SendBtnIcon
              source={
                selectedTags.length >
                0
                  ? sendActive
                  : sendInactive
              }
            />
          </TouchableOpacity>
        </InputBar>

        {/* Tabs */}

        <TabContainer>
          {tabs.map(
            (tab) => (
              <TabButton
                key={tab}
                isActive={
                  activeTab ===
                  tab
                }
                onPress={() => {
                  if (
                    isEndingRef.current
                  ) {
                    return;
                  }

                  setActiveTab(
                    tab
                  );

                  /**
                   * 다른 카테고리로 이동하면
                   * 기존 선택 답변 제거.
                   */
                  setSelectedTags(
                    []
                  );
                }}
                disabled={
                  isEnding
                }
              >
                <TabText
                  isActive={
                    activeTab ===
                    tab
                  }
                >
                  {tab}
                </TabText>
              </TabButton>
            )
          )}
        </TabContainer>

        {/* Quick buttons */}

        <QuickGrid>
          {getFilteredReplies(
            activeTab
          ).map((item) => {
            const isSelected =
              selectedTags.some(
                (selected) =>
                  String(
                    selected.replyCode
                  ) ===
                  String(
                    item.replyCode
                  )
              );

            return (
              <QuickBtn
                key={`${activeTab}-${item.replyCode}`}
                onPress={() =>
                  handleSelectTag(
                    item
                  )
                }
                disabled={
                  isEnding
                }
                isSelected={
                  isSelected
                }
              >
                <QuickBtnText
                  isSelected={
                    isSelected
                  }
                >
                  {item.text}
                </QuickBtnText>
              </QuickBtn>
            );
          })}
        </QuickGrid>
      </InputSection>

      {/* ================= END MODAL ================= */}

      <Modal
        transparent
        visible={
          isOverlayVisible
        }
        animationType="fade"
        onRequestClose={() => {
          if (
            isEndingRef.current
          ) {
            return;
          }

          setIsOverlayVisible(
            false
          );
        }}
      >
        <OverlayBackground>
          <OverlayImageCard
            source={
              callEndOverlayImg
            }
            resizeMode="contain"
          >
            <TransparentButtonRow>
              {/* 종료 */}

              <TransparentTouchArea
                onPress={() => {
                  if (
                    isEndingRef.current
                  ) {
                    return;
                  }

                  confirmEndCall();
                }}
                disabled={
                  isEnding
                }
              />

              {/* 취소 */}

              <TransparentTouchArea
                onPress={() => {
                  if (
                    isEndingRef.current
                  ) {
                    return;
                  }

                  logUserChat(
                    "종료 모달 취소"
                  );

                  setIsOverlayVisible(
                    false
                  );
                }}
                disabled={
                  isEnding
                }
              />
            </TransparentButtonRow>
          </OverlayImageCard>
        </OverlayBackground>
      </Modal>
    </Container>
  );
}

// =========================================================
// STYLE
// =========================================================

const Container = styled(
  SafeAreaContainer
)`
  flex: 1;
  background-color: #f5f5f5;
`;

const Header = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background-color: #fff;
  border-bottom-width: 1px;
  border-bottom-color: #eee;
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
  color: #ff5c00;
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
  background-color: #06f393;
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
  background-color: #f8f9fa;
  border-radius: 30px;
  padding: 6px 12px;
  margin-bottom: 12px;
  border-width: 1px;
  border-color: #eaeaea;
`;

const SelectedTag = styled.View`
  flex-direction: row;
  align-items: center;
  background-color: #ffffff;
  border-width: 1px;
  border-color: #e2e8f0;
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
  border-bottom-width: ${(props) =>
    props.isActive
      ? "2px"
      : "0px"};
  border-bottom-color: #333;
`;

const TabText = styled.Text`
  font-size: 15px;
  font-weight: ${(props) =>
    props.isActive
      ? "800"
      : "500"};
  color: ${(props) =>
    props.isActive
      ? "#333"
      : "#AAA"};
`;

const QuickGrid = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: space-between;
  margin-bottom: 5px;
`;

const QuickBtn = styled.TouchableOpacity`
  width: 48.5%;
  background-color: ${(props) =>
    props.isSelected
      ? "#E9FFF5"
      : "#F8F9FA"};
  padding: 14px 10px;
  border-radius: 15px;
  align-items: center;
  margin-bottom: 10px;
  border-width: 1px;
  border-color: ${(props) =>
    props.isSelected
      ? "#06F393"
      : "#F0F1F2"};
`;

const QuickBtnText = styled.Text`
  font-size: 15px;
  color: ${(props) =>
    props.isSelected
      ? "#00B96B"
      : "#444"};
  font-weight: ${(props) =>
    props.isSelected
      ? "800"
      : "600"};
`;

const OverlayBackground = styled.View`
  flex: 1;
  background-color: rgba(
    0,
    0,
    0,
    0.4
  );
  justify-content: center;
  align-items: center;
`;

const OverlayImageCard = styled.ImageBackground`
  width: ${SCREEN_WIDTH *
  0.8}px;
  height: ${SCREEN_WIDTH *
  0.8 *
  0.52}px;
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