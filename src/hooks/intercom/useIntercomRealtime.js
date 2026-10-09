import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRef } from "react";
import { Vibration } from "react-native";

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
    const sender = String(
      message?.senderType ||
        message?.sender ||
        message?.role ||
        ""
    ).toUpperCase();

    return {
      id: String(
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

      text: String(
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
  // 중복 비교용 문자열 정규화
  //
  // 아래 차이를 같은 문장으로 비교하기 위함
  //
  // "안녕하세요 오늘 왔습니다"
  // "안녕하세요, 오늘 왔습니다."
  // "안녕하세요  오늘 왔습니다"
  // =========================================================

  const normalizeCompareText = (text) => {
    return String(text || "")
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^0-9a-zA-Z가-힣]/g, "")
      .trim();
  };

  // =========================================================
  // 실시간 STT / 서버 확정 메시지 동일 여부
  // =========================================================

  const isSameRealtimeMessage = (
    firstText,
    secondText
  ) => {
    const first =
      normalizeCompareText(firstText);

    const second =
      normalizeCompareText(secondText);

    if (
      !first ||
      !second
    ) {
      return false;
    }

    /*
     * 문장부호 / 공백 제거 후 완전히 같음
     */
    if (first === second) {
      return true;
    }

    /*
     * 짧은 문장은
     * "네", "안녕" 등의 서로 다른 발화를
     * 잘못 합치는 것을 막기 위해
     * 완전일치만 허용
     */
    if (
      first.length < 8 ||
      second.length < 8
    ) {
      return false;
    }

    const shorter =
      first.length <= second.length
        ? first
        : second;

    const longer =
      first.length > second.length
        ? first
        : second;

    /*
     * 실시간 STT보다
     * 서버 확정본에 앞뒤 단어가 조금 더 붙은 경우
     */
    if (
      longer.includes(shorter)
    ) {
      const ratio =
        shorter.length /
        longer.length;

      if (ratio >= 0.65) {
        return true;
      }
    }

    /*
     * 긴 문장에서 마지막 몇 글자 정도만
     * STT 보정된 경우
     */
    const minLength =
      Math.min(
        first.length,
        second.length
      );

    let commonPrefixLength = 0;

    for (
      let i = 0;
      i < minLength;
      i++
    ) {
      if (
        first[i] !==
        second[i]
      ) {
        break;
      }

      commonPrefixLength++;
    }

    const prefixRatio =
      commonPrefixLength /
      minLength;

    return prefixRatio >= 0.8;
  };

  // =========================================================
  // 현재 STT가 기존 발화의 연장 / 수정인지 확인
  //
  // 긴 문장을 말할 때 STT가
  // 중간 내용을 조금 수정했다고
  // 새로운 발화로 잘못 판단하는 현상 방지
  // =========================================================

  const isSameRealtimeFlow = (
    previousText,
    currentText
  ) => {
    const previous =
      normalizeCompareText(
        previousText
      );

    const current =
      normalizeCompareText(
        currentText
      );

    if (
      !previous ||
      !current
    ) {
      return false;
    }

    if (
      previous === current
    ) {
      return true;
    }

    /*
     * 일반적인 실시간 STT 증가 형태
     *
     * 안녕하세요
     * ↓
     * 안녕하세요택배왔습니다
     */
    if (
      current.startsWith(
        previous
      ) ||
      previous.startsWith(
        current
      )
    ) {
      return true;
    }

    /*
     * 긴 문장에서는 STT가 중간 단어를
     * 수정하는 경우가 있으므로
     * 유사도 비교
     */
    if (
      previous.length >= 8 &&
      current.length >= 8
    ) {
      const shorter =
        previous.length <=
        current.length
          ? previous
          : current;

      const longer =
        previous.length >
        current.length
          ? previous
          : current;

      if (
        longer.includes(
          shorter
        )
      ) {
        const ratio =
          shorter.length /
          longer.length;

        if (ratio >= 0.65) {
          return true;
        }
      }

      const minLength =
        Math.min(
          previous.length,
          current.length
        );

      let commonPrefixLength = 0;

      for (
        let i = 0;
        i < minLength;
        i++
      ) {
        if (
          previous[i] !==
          current[i]
        ) {
          break;
        }

        commonPrefixLength++;
      }

      const prefixRatio =
        commonPrefixLength /
        minLength;

      if (
        prefixRatio >= 0.65
      ) {
        return true;
      }
    }

    return false;
  };

  // =========================================================
  // 실시간 구독 종료
  // =========================================================

  const stopRealtimeSubscription = () => {
    if (!unsubscribeRef.current) {
      return;
    }

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
      /*
       * 공백 / 문장부호 차이까지 고려해서
       * 이미 같은 방문자 메시지가 있으면 추가하지 않음
       */
      const exists =
        prev.some(
          (item) =>
            item.type ===
              "receive" &&
            isSameRealtimeMessage(
              item.text,
              safeText
            )
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

          /*
           * 서버 확정 메시지가 오면
           * 이 말풍선을 교체하는 기준
           */
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
      String(
        payload.sessionId
      ) !==
        String(sessionId)
    ) {
      return;
    }

    const text =
      String(
        payload.text || ""
      ).trim();

    if (!text) {
      return;
    }

    const previous =
      String(
        partialRef.current || ""
      ).trim();

    /*
     * 기존 코드에서는
     *
     * !text.startsWith(previous)
     *
     * 만으로 새 발화를 판단했기 때문에
     * 긴 STT가 중간 단어를 수정하면
     * 같은 발화가 두 문장으로 갈라질 수 있었다.
     *
     * 이제 공백 / 문장부호 / 일부 STT 수정까지
     * 고려해서 새 발화 여부를 판단한다.
     */
    const newUtterance =
      Boolean(previous) &&
      !isSameRealtimeFlow(
        previous,
        text
      );

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
      setRealtimePartial(text);
    }
  };

  // =========================================================
  // 실시간 메시지 처리
  // =========================================================

  const handleRealtimeMessage = (
    sessionId,
    payload,
    setMessages,
    setRealtimePartial
  ) => {
    if (!payload) {
      return;
    }

    if (
      payload.sessionId &&
      String(
        payload.sessionId
      ) !==
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
        message.text || ""
      ).trim();

    if (!safeMessageText) {
      return;
    }

    /*
     * 서버 확정 방문자 메시지가
     * 현재 화면에 표시 중인 realtimePartial과
     * 같은 내용이면 partial을 제거한다.
     *
     * 이 처리가 없으면:
     *
     * 서버 확정 말풍선
     * +
     * 실시간 partial 말풍선
     *
     * 두 개가 동시에 보일 수 있다.
     */
    if (
      message.type ===
        "receive" &&
      partialRef.current &&
      isSameRealtimeMessage(
        partialRef.current,
        safeMessageText
      )
    ) {
      clearRealtimePartial(
        setRealtimePartial
      );
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
            String(
              item.messageId
            ) ===
              String(
                message.messageId
              )
        );

      if (exists) {
        return prev;
      }

      // =====================================================
      // 2. 내가 보낸 로컬 메시지와
      //    WebSocket 서버 메시지 중복 방지
      //
      // sendMessage() 성공 후
      // messageId:null 로컬 말풍선이 먼저 추가된다.
      //
      // 서버 WebSocket에서 같은 메시지가 들어오면
      // 새 말풍선을 만들지 않고 기존 것을 교체한다.
      // =====================================================

      if (
        message.type ===
        "send"
      ) {
        let localIndex = -1;

        for (
          let i =
            prev.length - 1;
          i >= 0;
          i--
        ) {
          const item =
            prev[i];

          const itemText =
            String(
              item?.text || ""
            ).trim();

          if (
            item?.type ===
              "send" &&
            !item?.messageId &&
            itemText ===
              safeMessageText
          ) {
            localIndex = i;
            break;
          }
        }

        if (
          localIndex !== -1
        ) {
          const next =
            [...prev];

          next[localIndex] = {
            ...next[localIndex],
            ...message,

            /*
             * 서버에서 받은 값으로 교체하면서
             * 기존 화면 순서를 그대로 유지
             */
            id:
              message.id ||
              next[localIndex]
                .id,
          };

          return next;
        }
      }

      // =====================================================
      // 3. 실시간 STT로 이미 추가된 방문자 메시지와
      //    서버 확정 메시지 중복 방지
      //
      // 기존:
      // 완전히 똑같은 문자열만 처리
      //
      // 변경:
      // 띄어쓰기 / 문장부호 / 일부 STT 보정까지
      // 같은 메시지로 판단
      // =====================================================

      if (
        message.type ===
        "receive"
      ) {
        let realtimeIndex = -1;

        /*
         * 가장 최근 STT 확정 메시지부터 찾는다.
         *
         * 같은 말을 이전에 했던 경우
         * 옛날 메시지를 교체하는 것을 방지
         */
        for (
          let i =
            prev.length - 1;
          i >= 0;
          i--
        ) {
          const item =
            prev[i];

          if (
            item?.type !==
              "receive" ||
            !item
              ?.isRealtimeCommitted
          ) {
            continue;
          }

          if (
            isSameRealtimeMessage(
              item.text,
              safeMessageText
            )
          ) {
            realtimeIndex = i;
            break;
          }
        }

        if (
          realtimeIndex !== -1
        ) {
          const next =
            [...prev];

          next[
            realtimeIndex
          ] = {
            ...next[
              realtimeIndex
            ],

            ...message,

            /*
             * 이제 서버 확정 메시지로 변경됨
             */
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
        payload?.status || ""
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
      screen: "히스토리",
      endedSessionId:
        sessionId,
    });
  };

  // =========================================================
  // 실시간 구독 시작
  // =========================================================

  const startRealtimeSubscription = (
    sessionId,
    token,
    setMessages,
    setRealtimePartial
  ) => {
    /*
     * 기존 구독이 있다면 먼저 해제
     */
    stopRealtimeSubscription();

    if (!sessionId) {
      logUserChat(
        "실시간 STOMP 구독 실패",
        {
          reason:
            "sessionId가 없습니다.",
        }
      );

      return;
    }

    /*
     * 백엔드 STOMP CONNECT 권한 검사를 위해
     * JWT가 반드시 필요
     */
    if (!token) {
      logUserChat(
        "실시간 STOMP 구독 실패",
        {
          sessionId,

          reason:
            "JWT token이 없습니다.",
        }
      );

      return;
    }

    partialRef.current = "";

    /*
     * 새 세션 진입 시
     * 이전 실시간 자막도 제거
     */
    if (
      isMountedRef.current &&
      setRealtimePartial
    ) {
      setRealtimePartial("");
    }

    remoteEndHandledRef.current =
      false;

    logUserChat(
      "실시간 STOMP 구독 시작",
      {
        sessionId,
        hasToken: true,
      }
    );

    /*
     * realtimeSocket 쪽으로 JWT 전달
     */
    unsubscribeRef.current =
      subscribeSessionTopics(
        sessionId,
        token,
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
          // 일반 메시지
          // -----------------------------------------

          onMessage:
            (payload) =>
              handleRealtimeMessage(
                sessionId,
                payload,
                setMessages,
                setRealtimePartial
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