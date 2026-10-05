import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BASE_URL from "../../api/config";

export default function useIntercomSession({
  initialSessionId,
  routeToken,
  isMountedRef,
  logUserChat,
  handleAuthExpired,
  moveToIdleMainTab,
  setMessages,
  stopRealtimeSubscription,
}) {

  const [currentSessionId, setCurrentSessionId] =
    useState(initialSessionId);

  const [token, setToken] = useState(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [inputText, setInputText] =
    useState("");

  const [seconds, setSeconds] =
    useState(0);

  const [isEnding, setIsEnding] =
    useState(false);


  // =========================================================
  // 공통 유틸
  // =========================================================

  const getSessionId = useCallback((session) => {
    return (
      session?.sessionId ??
      session?.id ??
      null
    );
  }, []);


  const getServerError = useCallback((error) => {
    return (
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.response?.data?.detail ||
      error?.message ||
      "알 수 없는 오류가 발생했습니다."
    );
  }, []);


  // =========================================================
  // 메시지 정규화
  // =========================================================

  const normalizeMessage = useCallback(
    (message, index = 0) => {

      const sender = String(
        message?.senderType ||
        message?.sender ||
        message?.role ||
        message?.type ||
        ""
      ).toUpperCase();


      const text = String(
        message?.content ||
        message?.messageText ||
        message?.text ||
        message?.message ||
        message?.rawText ||
        ""
      );


      let type = "receive";


      if (
        sender === "USER" ||
        sender === "RESIDENT" ||
        sender === "SEND" ||
        sender === "OUTGOING"
      ) {
        type = "send";
      }


      if (
        sender === "SYSTEM" ||
        sender === "SYSTEM_MESSAGE"
      ) {
        type = "system";
      }


      return {
        id: String(
          message?.messageId ||
          message?.id ||
          `message-${Date.now()}-${index}`
        ),

        messageId:
          message?.messageId ||
          message?.id ||
          null,

        transcriptId:
          message?.transcriptId ||
          null,

        text,

        type,

        senderType:
          message?.senderType ||
          sender,

        messageType:
          message?.messageType ||
          null,

        originalContent:
          message?.originalContent ||
          null,

        createdAt:
          message?.createdAt ||
          new Date().toISOString(),
      };
    },
    []
  );


  const normalizeMessages = useCallback(
    (list = []) => {

      if (!Array.isArray(list)) {
        return [];
      }


      return list
        .map((item, index) =>
          normalizeMessage(item, index)
        )
        .filter(
          (item) =>
            item.text &&
            item.text.trim()
        );
    },
    [normalizeMessage]
  );


  // =========================================================
  // 로컬 전송 메시지 추가
  // =========================================================

  const appendLocalSendMessage = useCallback(
    (text, messageType = "MESSAGE") => {

      const safeText =
        String(text || "").trim();


      if (!safeText) {
        return;
      }


      if (!isMountedRef.current) {
        return;
      }


      setMessages((prev) => {

        const alreadyExists =
          [...prev]
            .reverse()
            .slice(0, 10)
            .some(
              (item) =>
                item.type === "send" &&
                String(item.text || "").trim() ===
                  safeText
            );


        if (alreadyExists) {
          return prev;
        }


        return [
          ...prev,

          {
            id:
              `local-send-${Date.now()}`,

            messageId: null,

            transcriptId: null,

            text: safeText,

            type: "send",

            senderType: "USER",

            messageType,

            originalContent: null,

            createdAt:
              new Date().toISOString(),
          },
        ];
      });
    },
    [isMountedRef, setMessages]
  );


  // =========================================================
  // 현재 세션 조회
  // =========================================================

  const fetchCurrentSession = useCallback(
    async (activeToken, deviceUid) => {

      if (!activeToken || !deviceUid) {

        logUserChat(
          "현재 세션 조회 생략",
          {
            hasToken:
              Boolean(activeToken),

            hasDeviceUid:
              Boolean(deviceUid),
          }
        );

        return null;
      }


      try {

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
          response.data?.success !== false
            ? response.data?.data || null
            : null;


        logUserChat(
          "현재 세션 확인 응답",
          {
            sessionId:
              getSessionId(sessionData),

            success:
              response.data?.success,

            data:
              sessionData,
          }
        );


        return sessionData;

      } catch (error) {

        const status =
          error?.response?.status;

        const serverMessage =
          getServerError(error);


        logUserChat(
          "현재 세션 조회 실패",
          {
            status,
            error: serverMessage,
          }
        );


        if (
          (status === 401 ||
            status === 403) &&
          handleAuthExpired
        ) {
          await handleAuthExpired();
        }


        return null;
      }
    },
    [
      getSessionId,
      getServerError,
      handleAuthExpired,
      logUserChat,
    ]
  );


  // =========================================================
  // 세션 연결
  // =========================================================

  const connectCurrentSession = useCallback(
    async (sessionId, activeToken) => {

      if (!sessionId || !activeToken) {
        return false;
      }


      try {

        const response =
          await axios.post(
            `${BASE_URL}/api/sessions/${sessionId}/connect`,
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
            sessionId,

            status:
              response.status,

            data:
              response.data,
          }
        );


        return (
          response.data?.success !== false
        );

      } catch (error) {

        const status =
          error?.response?.status;

        const serverMessage =
          getServerError(error);


        logUserChat(
          "세션 연결 실패",
          {
            sessionId,
            status,
            error: serverMessage,
          }
        );


        if (
          (status === 401 ||
            status === 403) &&
          handleAuthExpired
        ) {
          await handleAuthExpired();
        }


        if (
          status === 404 ||
          status === 409 ||
          status === 410
        ) {
          return false;
        }


        return true;
      }
    },
    [
      getServerError,
      handleAuthExpired,
      logUserChat,
    ]
  );


  // =========================================================
  // 세션 메시지 조회
  // =========================================================

  const fetchSessionMessages = useCallback(
    async ({
      targetSessionId,
      activeToken,
    }) => {

      if (
        !targetSessionId ||
        !activeToken
      ) {

        logUserChat(
          "메시지 조회 생략",
          {
            hasSessionId:
              Boolean(targetSessionId),

            hasToken:
              Boolean(activeToken),
          }
        );

        return;
      }


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
          response.data?.success &&
          Array.isArray(
            response.data?.data
          )
        ) {

          const normalized =
            normalizeMessages(
              response.data.data
            );


          if (isMountedRef.current) {
            setMessages(normalized);
          }


          logUserChat(
            "세션 메시지 조회 완료",
            {
              sessionId:
                targetSessionId,

              count:
                normalized.length,
            }
          );


          return normalized;
        }


        logUserChat(
          "메시지 조회 응답 확인 필요",
          response.data
        );


        return [];

      } catch (error) {

        const status =
          error?.response?.status;

        const serverMessage =
          getServerError(error);


        logUserChat(
          "메시지 조회 실패",
          {
            sessionId:
              targetSessionId,

            status,

            error:
              serverMessage,
          }
        );


        if (
          (status === 401 ||
            status === 403) &&
          handleAuthExpired
        ) {
          await handleAuthExpired();
        }


        return [];
      }
    },
    [
      getServerError,
      handleAuthExpired,
      isMountedRef,
      logUserChat,
      normalizeMessages,
      setMessages,
    ]
  );


  // =========================================================
  // 빠른 응답 전송
  // =========================================================

  const sendQuickReply = useCallback(
    async ({
      replyCode,
      text,
    }) => {

      if (isEnding) {
        return false;
      }


      const targetSessionId =
        currentSessionId;


      if (!targetSessionId) {

        logUserChat(
          "빠른 응답 전송 실패",
          {
            error:
              "현재 연결된 세션이 없습니다.",
          }
        );

        return false;
      }


      const activeToken =
        token ||
        (
          await AsyncStorage.getItem(
            "accessToken"
          )
        );


      if (!activeToken) {

        if (handleAuthExpired) {
          await handleAuthExpired();
        }

        return false;
      }


      if (
        replyCode === undefined ||
        replyCode === null ||
        replyCode === ""
      ) {

        logUserChat(
          "빠른 응답 전송 실패",
          {
            sessionId:
              targetSessionId,

            error:
              "replyCode가 없습니다.",
          }
        );

        return false;
      }


      const messageText =
        String(text || "").trim();


      try {

        logUserChat(
          "빠른 응답 전송 요청",
          {
            sessionId:
              targetSessionId,

            replyCode,

            text:
              messageText,
          }
        );


        const response =
          await axios.post(
            `${BASE_URL}/api/sessions/${targetSessionId}/reply`,
            {
              replyCode,
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


        if (messageText) {

          appendLocalSendMessage(
            messageText,
            "QUICK_REPLY"
          );

        }


        return true;

      } catch (error) {

        const status =
          error?.response?.status;

        const serverMessage =
          getServerError(error);


        logUserChat(
          "빠른 응답 전송 실패",
          {
            sessionId:
              targetSessionId,

            replyCode,

            status,

            error:
              serverMessage,
          }
        );


        if (
          (status === 401 ||
            status === 403) &&
          handleAuthExpired
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
          return false;
        }


        if (
          status === 404 ||
          status === 409 ||
          status === 410
        ) {

          if (stopRealtimeSubscription) {

            try {

              stopRealtimeSubscription();

            } catch (stopError) {

              logUserChat(
                "실시간 구독 종료 실패",
                stopError?.message
              );

            }
          }


          moveToIdleMainTab({
            screen:
              "히스토리",

            endedSessionId:
              targetSessionId,
          });


          return false;
        }


        return false;
      }
    },
    [
      appendLocalSendMessage,
      currentSessionId,
      getServerError,
      handleAuthExpired,
      isEnding,
      logUserChat,
      moveToIdleMainTab,
      stopRealtimeSubscription,
      token,
    ]
  );


  // =========================================================
  // 일반 텍스트 메시지 전송
  //
  // 사용자가 입력한 어떤 텍스트든 전송 가능
  //
  // POST
  // /api/sessions/{sessionId}/messages
  //
  // {
  //   message: "사용자가 입력한 내용"
  // }
  // =========================================================

  const sendMessage = useCallback(
    async () => {

      const text =
        String(inputText || "").trim();


      if (!text) {
        return false;
      }


      if (isEnding) {
        return false;
      }


      const targetSessionId =
        currentSessionId;


      if (!targetSessionId) {

        logUserChat(
          "일반 메시지 전송 실패",
          {
            error:
              "현재 연결된 세션이 없습니다.",
          }
        );

        return false;
      }


      const activeToken =
        token ||
        (
          await AsyncStorage.getItem(
            "accessToken"
          )
        );


      if (!activeToken) {

        if (handleAuthExpired) {
          await handleAuthExpired();
        }

        return false;
      }


            /*
       * 전송 버튼을 누르는 순간
       * 입력창을 먼저 비운다.
       *
       * 현재 백엔드는 메시지를 저장하고
       * WebSocket으로 전송한 뒤,
       * TTS WebSocket 문제로 500을 반환할 수 있기 때문에
       * HTTP 성공 여부와 관계없이 입력창은 초기화한다.
       */
      if (isMountedRef.current) {
        setInputText("");
      }


      try {

        logUserChat(
          "일반 메시지 전송 요청",
          {
            sessionId:
              targetSessionId,

            text,
          }
        );


        const response =
          await axios.post(
            `${BASE_URL}/api/sessions/${targetSessionId}/tts`,
            {
              text: text,
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
          "일반 메시지 전송 완료",
          {
            sessionId:
              targetSessionId,

            status:
              response.status,

            response:
              response.data,
          }
        );


        /*
         * 서버 전송 성공 후
         * 내 말풍선을 즉시 표시한다.
         *
         * WebSocket에서도 같은 메시지가
         * 들어올 수 있으므로
         * useIntercomRealtime에서
         * 중복 메시지를 처리한다.
         */
        if (isMountedRef.current) {

          appendLocalSendMessage(
            text,
            "MESSAGE"
          );

        }


        return true;

      } catch (error) {

        const status =
          error?.response?.status;

        const serverMessage =
          getServerError(error);


        logUserChat(
          "일반 메시지 전송 실패",
          {
            sessionId:
              targetSessionId,

            status,

            error:
              serverMessage,

            response:
              error?.response?.data,
          }
        );


        if (
          (status === 401 ||
            status === 403) &&
          handleAuthExpired
        ) {

          await handleAuthExpired();

          return false;
        }


        /*
         * 세션이 이미 종료된 경우
         */
        if (
          status === 404 ||
          status === 409 ||
          status === 410
        ) {

          if (stopRealtimeSubscription) {

            try {

              stopRealtimeSubscription();

            } catch (stopError) {

              logUserChat(
                "실시간 구독 종료 실패",
                stopError?.message
              );

            }
          }


          moveToIdleMainTab({
            screen:
              "히스토리",

            endedSessionId:
              targetSessionId,
          });


          return false;
        }


        return false;
      }
    },
    [
      appendLocalSendMessage,
      currentSessionId,
      getServerError,
      handleAuthExpired,
      inputText,
      isEnding,
      isMountedRef,
      logUserChat,
      moveToIdleMainTab,
      setInputText,
      stopRealtimeSubscription,
      token,
    ]
  );


  // =========================================================
  // 세션 초기화
  // =========================================================

  const initializeSession =
    useCallback(async () => {

      try {

        setIsLoading(true);


        const savedToken =
          await AsyncStorage.getItem(
            "accessToken"
          );


        const activeToken =
          savedToken ||
          routeToken ||
          null;


        setToken(activeToken);


        if (!activeToken) {

          if (handleAuthExpired) {
            await handleAuthExpired();
          }

          return;
        }


        if (!initialSessionId) {

          moveToIdleMainTab({
            screen: "홈",
          });

          return;
        }


        const deviceUid =
          await AsyncStorage.getItem(
            "deviceUid"
          );


        const session =
          await fetchCurrentSession(
            activeToken,
            deviceUid
          );


        const serverSessionId =
          getSessionId(session);


        if (
          !session ||
          String(serverSessionId) !==
            String(initialSessionId)
        ) {

          logUserChat(
            "현재 세션 불일치",
            {
              requestedSessionId:
                initialSessionId,

              serverSessionId,
            }
          );


          moveToIdleMainTab({
            screen:
              "히스토리",

            endedSessionId:
              initialSessionId,
          });

          return;
        }


        setCurrentSessionId(
          initialSessionId
        );


        const connected =
          await connectCurrentSession(
            initialSessionId,
            activeToken
          );


        if (!connected) {

          logUserChat(
            "세션 연결 실패로 초기화 중단",
            {
              sessionId:
                initialSessionId,
            }
          );

          return;
        }


        await fetchSessionMessages({
          targetSessionId:
            initialSessionId,

          activeToken,
        });

      } catch (error) {

        logUserChat(
          "세션 초기화 실패",
          {
            error:
              getServerError(error),
          }
        );

      } finally {

        if (isMountedRef.current) {
          setIsLoading(false);
        }

      }

    }, [
      connectCurrentSession,
      fetchCurrentSession,
      fetchSessionMessages,
      getServerError,
      getSessionId,
      handleAuthExpired,
      initialSessionId,
      isMountedRef,
      logUserChat,
      moveToIdleMainTab,
      routeToken,
    ]);


  // =========================================================
  // 통화 종료
  // =========================================================

  const endCall = useCallback(
    async () => {

      if (
        isEnding ||
        !currentSessionId
      ) {

        logUserChat(
          "통화 종료 요청 무시",
          {
            isEnding,

            sessionId:
              currentSessionId,
          }
        );

        return false;
      }


      setIsEnding(true);


      if (stopRealtimeSubscription) {

        try {

          stopRealtimeSubscription();

        } catch (error) {

          logUserChat(
            "실시간 구독 종료 실패",
            error?.message
          );

        }
      }


      const activeToken =
        token ||
        (
          await AsyncStorage.getItem(
            "accessToken"
          )
        );


      if (!activeToken) {

        setIsEnding(false);

        if (handleAuthExpired) {
          await handleAuthExpired();
        }

        return false;
      }


      const activeSessionId =
        currentSessionId;


      let isEndSuccess = false;


      try {

        logUserChat(
          "세션 종료 요청",
          {
            sessionId:
              activeSessionId,

            hasToken:
              Boolean(activeToken),
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
          response.data?.success !== false;


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
              response.data?.success,

            endedAt:
              response.data?.data
                ?.endedAt ||
              null,
          }
        );


        if (isEndSuccess) {

          moveToIdleMainTab({
            screen:
              "히스토리",

            endedSessionId:
              activeSessionId,
          });

        }


        return isEndSuccess;

      } catch (error) {

        const status =
          error?.response?.status;

        const serverMessage =
          getServerError(error);


        logUserChat(
          "세션 종료 실패",
          {
            sessionId:
              activeSessionId,

            status,

            error:
              serverMessage,
          }
        );


        if (
          (status === 401 ||
            status === 403) &&
          handleAuthExpired
        ) {

          await handleAuthExpired();

          return false;
        }


        return false;

      } finally {

        if (
          !isEndSuccess &&
          isMountedRef.current
        ) {
          setIsEnding(false);
        }

      }

    },
    [
      currentSessionId,
      getServerError,
      handleAuthExpired,
      isEnding,
      isMountedRef,
      logUserChat,
      moveToIdleMainTab,
      stopRealtimeSubscription,
      token,
    ]
  );


  // =========================================================
  // 통화 시간
  // =========================================================

  useEffect(() => {

    const timer =
      setInterval(() => {

        setSeconds(
          (prev) => prev + 1
        );

      }, 1000);


    return () => {
      clearInterval(timer);
    };

  }, []);


  // =========================================================
  // Return
  // =========================================================

  return {

    currentSessionId,
    setCurrentSessionId,

    token,
    setToken,

    isLoading,
    setIsLoading,

    inputText,
    setInputText,

    seconds,

    isEnding,

    /*
     * 일반 텍스트 전송
     */
    sendMessage,

    /*
     * 추천문구 빠른 응답
     */
    sendQuickReply,

    endCall,

    fetchCurrentSession,

    connectCurrentSession,

    fetchSessionMessages,

    initializeSession,

    normalizeMessage,

    normalizeMessages,

    appendLocalSendMessage,
  };
}