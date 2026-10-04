import { useRef } from "react";
import { Vibration } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { subscribeSessionTopics } from "../../services/realtimeSocket";


export default function useIntercomRealtime({
  isMountedRef,
  logUserChat,
  moveToIdleMainTab,
}) {

  const unsubscribeRef = useRef(null);
  const partialRef = useRef("");
  const utteranceSeqRef = useRef(0);
  const remoteEndHandledRef = useRef(false);


  // =========================================================
  // 메시지 정규화
  // =========================================================

  const normalizeMessage = (message) => {

    const sender =
      String(
        message?.senderType ||
        message?.sender ||
        message?.role ||
        ""
      ).toUpperCase();


    return {
      id:
        String(
          message?.messageId ||
          message?.id ||
          `realtime-${Date.now()}`
        ),

      messageId:
        message?.messageId ||
        message?.id ||
        null,

      transcriptId:
        message?.transcriptId ||
        null,

      text:
        String(
          message?.content ||
          message?.messageText ||
          message?.text ||
          message?.message ||
          ""
        ),

      type:
        sender === "USER" ||
        sender === "RESIDENT" ||
        sender === "SEND" ||
        sender === "OUTGOING"
          ? "send"
          : "receive",

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
  };


  // =========================================================
  // 실시간 구독 종료
  // =========================================================

  const stopRealtimeSubscription = () => {

    if (unsubscribeRef.current) {

      try {

        unsubscribeRef.current();

      } catch (error) {

        logUserChat(
          "실시간 구독 해제 실패",
          error?.message
        );

      }


      unsubscribeRef.current = null;


      logUserChat(
        "실시간 STOMP 구독 중지"
      );
    }
  };


  // =========================================================
  // 실시간 자막 초기화
  // =========================================================

  const clearRealtimePartial = (
    setRealtimePartial
  ) => {

    partialRef.current = "";


    if (setRealtimePartial) {

      setRealtimePartial("");

    }
  };


  // =========================================================
  // 방문자 발화 진동
  // =========================================================

  const vibrateForNewVisitorUtterance =
    async (sessionId) => {

      try {

        const setting =
          await AsyncStorage.getItem(
            "subtitleVibrate"
          );


        if (setting === "true") {

          Vibration.vibrate(400);


          logUserChat(
            "실시간 방문자 자막 진동",
            {
              sessionId,
            }
          );

        }

      } catch (error) {

        logUserChat(
          "진동 설정 확인 실패",
          error?.message
        );

      }
    };


  // =========================================================
  // 실시간 STT 문장 확정
  // =========================================================

  const commitPartial = (
    text,
    setMessages
  ) => {

    const safeText =
      String(text || "").trim();


    if (!safeText) {
      return;
    }


    setMessages((prev) => {

      const exists =
        prev.some(
          (item) =>
            item.type === "receive" &&
            String(item.text || "").trim() ===
              safeText
        );


      if (exists) {
        return prev;
      }


      return [
        ...prev,

        {
          id:
            `realtime-${Date.now()}-${++utteranceSeqRef.current}`,

          messageId: null,

          transcriptId: null,

          text: safeText,

          type: "receive",

          senderType: "VISITOR",

          messageType:
            "REALTIME_STT",

          originalContent: null,

          createdAt:
            new Date().toISOString(),

          isRealtimeCommitted: true,
        },
      ];
    });
  };


  // =========================================================
  // 실시간 STT 처리
  // =========================================================

  const handleRealtimeTranscript = (
    sessionId,
    payload,
    setRealtimePartial,
    setMessages
  ) => {

    if (!payload) {
      return;
    }


    if (
      payload.sessionId &&
      String(payload.sessionId) !==
        String(sessionId)
    ) {
      return;
    }


    const text =
      String(
        payload.text ||
        ""
      ).trim();


    if (!text) {
      return;
    }


    const previous =
      String(
        partialRef.current ||
        ""
      ).trim();


    /*
     * 기존 문장과 완전히 다른 새로운 문장이 들어온 경우
     * 이전 문장을 확정 메시지로 저장한다.
     */
    const newUtterance =
      previous &&
      text !== previous &&
      !text.startsWith(previous);


    if (newUtterance) {

      commitPartial(
        previous,
        setMessages
      );


      vibrateForNewVisitorUtterance(
        sessionId
      );

    }


    /*
     * 첫 발화
     */
    if (!previous) {

      vibrateForNewVisitorUtterance(
        sessionId
      );

    }


    partialRef.current =
      text;


    if (isMountedRef.current) {

      setRealtimePartial(
        text
      );

    }
  };


  // =========================================================
  // 실시간 메시지 처리
  // =========================================================

  const handleRealtimeMessage = (
    sessionId,
    payload,
    setMessages
  ) => {

    if (!payload) {
      return;
    }


    if (
      payload.sessionId &&
      String(payload.sessionId) !==
        String(sessionId)
    ) {
      return;
    }


    const message =
      normalizeMessage(
        payload
      );


    const safeMessageText =
      String(
        message.text ||
        ""
      ).trim();


    if (!safeMessageText) {
      return;
    }


    setMessages((prev) => {

      // =====================================================
      // 1. 서버 messageId 기준 중복 확인
      // =====================================================

      const exists =
        prev.some(
          (item) =>
            item.messageId &&
            message.messageId &&
            String(item.messageId) ===
              String(message.messageId)
        );


      if (exists) {
        return prev;
      }


      // =====================================================
      // 2. 내가 보낸 로컬 메시지와
      //    WebSocket 서버 메시지 중복 방지
      //
      // sendMessage() 성공 후 프론트에서는
      // messageId:null 상태의 로컬 말풍선을 먼저 추가한다.
      //
      // 이후 서버에서 같은 메시지가 WebSocket으로 오면
      // 새로 추가하지 않고 기존 로컬 메시지를
      // 서버 메시지로 교체한다.
      // =====================================================

      if (message.type === "send") {

        /*
         * 뒤에서부터 가장 최근 메시지를 확인한다.
         *
         * 동일한 문장을 연속해서 보내는 경우도 있기 때문에
         * 가장 최근의 messageId 없는 로컬 메시지만 교체한다.
         */
        let localIndex = -1;


        for (
          let i = prev.length - 1;
          i >= 0;
          i--
        ) {

          const item =
            prev[i];


          const itemText =
            String(
              item?.text ||
              ""
            ).trim();


          if (
            item?.type === "send" &&
            !item?.messageId &&
            itemText === safeMessageText
          ) {

            localIndex = i;
            break;

          }
        }


        if (localIndex !== -1) {

          const next =
            [...prev];


          next[localIndex] = {
            ...next[localIndex],
            ...message,

            /*
             * 서버에서 받은 값으로 교체하면서
             * 기존 화면 순서를 그대로 유지한다.
             */
            id:
              message.id ||
              next[localIndex].id,
          };


          return next;
        }
      }


      // =====================================================
      // 3. 실시간 STT로 이미 추가된 방문자 메시지와
      //    서버 확정 메시지 중복 방지
      // =====================================================

      if (message.type === "receive") {

        const realtimeIndex =
          prev.findIndex(
            (item) =>
              item.type === "receive" &&
              item.isRealtimeCommitted &&
              String(
                item.text ||
                ""
              ).trim() ===
                safeMessageText
          );


        if (realtimeIndex !== -1) {

          const next =
            [...prev];


          next[realtimeIndex] = {
            ...next[realtimeIndex],
            ...message,

            isRealtimeCommitted:
              false,
          };


          return next;
        }
      }


      // =====================================================
      // 4. 새로운 메시지
      // =====================================================

      return [
        ...prev,
        message,
      ];
    });


    logUserChat(
      "실시간 메시지 수신",
      {
        sessionId,
        messageId:
          message.messageId,
        text:
          message.text,
        type:
          message.type,
      }
    );
  };


  // =========================================================
  // 세션 상태 처리
  // =========================================================

  const handleStatus = (
    sessionId,
    payload
  ) => {

    const status =
      String(
        payload?.status ||
        ""
      ).toUpperCase();


    if (
      ![
        "CLOSED",
        "ENDED",
        "COMPLETE",
        "COMPLETED",
      ].includes(status)
    ) {
      return;
    }


    /*
     * 동일한 종료 이벤트가 여러 번 와도
     * 화면 이동은 한 번만 수행
     */
    if (
      remoteEndHandledRef.current
    ) {
      return;
    }


    remoteEndHandledRef.current =
      true;


    stopRealtimeSubscription();


    moveToIdleMainTab({
      screen:
        "히스토리",

      endedSessionId:
        sessionId,
    });
  };


  // =========================================================
  // 실시간 구독 시작
  // =========================================================

  const startRealtimeSubscription = (
    sessionId,
    setMessages,
    setRealtimePartial
  ) => {

    /*
     * 기존 구독이 있다면 먼저 해제
     */
    stopRealtimeSubscription();


    if (!sessionId) {
      return;
    }


    partialRef.current =
      "";


    remoteEndHandledRef.current =
      false;


    logUserChat(
      "실시간 STOMP 구독 시작",
      {
        sessionId,
      }
    );


    unsubscribeRef.current =
      subscribeSessionTopics(
        sessionId,
        {

          // -----------------------------------------
          // 실시간 STT
          // -----------------------------------------

          onRealtimeTranscript:
            (payload) =>
              handleRealtimeTranscript(
                sessionId,
                payload,
                setRealtimePartial,
                setMessages
              ),


          // -----------------------------------------
          // 일반 메시지 / 빠른 응답
          // -----------------------------------------

          onMessage:
            (payload) =>
              handleRealtimeMessage(
                sessionId,
                payload,
                setMessages
              ),


          // -----------------------------------------
          // 세션 상태
          // -----------------------------------------

          onStatus:
            (payload) =>
              handleStatus(
                sessionId,
                payload
              ),
        }
      );
  };


  // =========================================================
  // Return
  // =========================================================

  return {

    startRealtimeSubscription,

    stopRealtimeSubscription,

    clearRealtimePartial,

    partialRef,
  };
}