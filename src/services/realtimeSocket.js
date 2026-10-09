import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import BASE_URL from "../api/config";

const SOCKJS_URL = `${String(BASE_URL).replace(/\/+$/, "")}/ws`;

export const REALTIME_SOCKET_URL = SOCKJS_URL;

let client = null;
let authToken = null;
let connectedToken = null;
let restartPromise = null;
let subscriptionSeq = 0;

const subscriptions = new Map();

// =========================================================
// 로그
// =========================================================

const log = (message, data) => {
  if (
    typeof __DEV__ !== "undefined" &&
    !__DEV__
  ) {
    return;
  }

  if (data !== undefined) {
    console.log(
      `[REALTIME_SOCKET] ${message}`,
      data
    );
  } else {
    console.log(
      `[REALTIME_SOCKET] ${message}`
    );
  }
};

const logError = (message, data) => {
  console.error(
    `[REALTIME_SOCKET] ${message}`,
    data
  );
};

// =========================================================
// JWT 정규화
// =========================================================

const normalizeToken = (token) => {
  return String(token || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
};

// =========================================================
// Payload 파싱
// =========================================================

const parsePayload = (frame) => {
  if (!frame?.body) {
    return null;
  }

  try {
    return JSON.parse(frame.body);
  } catch {
    return frame.body;
  }
};

// =========================================================
// 기존 Subscription 객체 초기화
// =========================================================

const clearSubscriptionHandles = () => {
  subscriptions.forEach(
    (item, key) => {
      subscriptions.set(key, {
        ...item,
        stompSubscription: null,
      });
    }
  );
};

// =========================================================
// 개별 Topic 실제 Subscribe
// =========================================================

const attachSubscription = (key) => {
  if (!client?.connected) {
    return;
  }

  const item =
    subscriptions.get(key);

  if (
    !item ||
    item.stompSubscription
  ) {
    return;
  }

  const stompSubscription =
    client.subscribe(
      item.destination,
      (frame) => {
        const payload =
          parsePayload(frame);

        log(
          "메시지 수신",
          {
            destination:
              item.destination,
            payload,
          }
        );

        try {
          item.callback(
            payload,
            frame
          );
        } catch (error) {
          logError(
            "callback 처리 실패",
            error
          );
        }
      }
    );

  subscriptions.set(
    key,
    {
      ...item,
      stompSubscription,
    }
  );

  log(
    "구독 완료",
    item.destination
  );
};

// =========================================================
// 등록되어 있는 Topic 전체 Subscribe
// =========================================================

const attachAllSubscriptions = () => {
  subscriptions.forEach(
    (_, key) => {
      attachSubscription(key);
    }
  );
};

// =========================================================
// JWT 변경 시 STOMP 재연결
// =========================================================

const restartClientForTokenChange = () => {
  if (
    !client ||
    restartPromise
  ) {
    return;
  }

  const targetClient = client;

  log(
    "JWT 변경 감지 - STOMP 재연결"
  );

  clearSubscriptionHandles();

  restartPromise =
    targetClient
      .deactivate()
      .catch((error) => {
        logError(
          "JWT 변경 재연결 중 기존 연결 종료 실패",
          error
        );
      })
      .finally(() => {
        restartPromise = null;

        /*
         * disconnectRealtimeSocket()에서
         * client가 null로 바뀌었다면 재연결하지 않음
         */
        if (
          client !== targetClient
        ) {
          return;
        }

        connectedToken = null;

        if (
          subscriptions.size > 0 &&
          !targetClient.active
        ) {
          log(
            "새 JWT로 STOMP 연결 재시작"
          );

          targetClient.activate();
        }
      });
};

// =========================================================
// STOMP Client 생성
// =========================================================

const createClient = () => {
  if (client) {
    return client;
  }

  client = new Client({
    webSocketFactory: () =>
      new SockJS(SOCKJS_URL),

    /*
     * 백엔드 STOMP CONNECT 인증
     */
    connectHeaders:
      authToken
        ? {
            Authorization:
              `Bearer ${authToken}`,
          }
        : {},

    reconnectDelay: 3000,
    connectionTimeout: 20000,

    heartbeatIncoming: 0,
    heartbeatOutgoing: 0,

    debug: (message) => {
      log(
        `STOMP ${message}`
      );
    },

    /*
     * 최초 연결뿐 아니라 자동 재연결할 때도
     * 가장 최신 JWT를 CONNECT 헤더에 넣는다.
     */
    beforeConnect: async () => {
  if (authToken) {
    client.connectHeaders = {
      Authorization: `Bearer ${authToken}`,
    };
  } else {
    client.connectHeaders = {};
  }

  console.log(
    "[REALTIME_SOCKET] CONNECT 인증 확인",
    {
      hasToken: Boolean(authToken),
      tokenLength: authToken?.length || 0,
      isJwt:
        String(authToken || "").split(".").length === 3,
      hasAuthorization:
        Boolean(client.connectHeaders?.Authorization),
    }
  );
},
  });

  // =======================================================
  // STOMP 연결 성공
  // =======================================================

  client.onConnect = (frame) => {
    connectedToken =
      authToken;

    log(
      "연결 성공",
      {
        url: SOCKJS_URL,

        version:
          frame?.headers?.version,

        hasToken:
          Boolean(authToken),
      }
    );

    attachAllSubscriptions();
  };

  // =======================================================
  // STOMP 연결 해제
  // =======================================================

  client.onDisconnect = () => {
    log(
      "연결 해제"
    );

    connectedToken = null;

    clearSubscriptionHandles();
  };

  // =======================================================
  // WebSocket 종료
  // =======================================================

  client.onWebSocketClose = (
    event
  ) => {
    log(
      "WebSocket 종료",
      {
        code:
          event?.code,

        reason:
          event?.reason,
      }
    );

    connectedToken = null;

    clearSubscriptionHandles();
  };

  // =======================================================
  // WebSocket 오류
  // =======================================================

  client.onWebSocketError = (
    error
  ) => {
    logError(
      "WebSocket 오류",
      error
    );
  };

  // =======================================================
  // STOMP 오류
  //
  // 페어링이 없거나 JWT 권한이 없으면
  // 백엔드에서 여기로 ERROR frame이 올 수 있음
  // =======================================================

  client.onStompError = (
    frame
  ) => {
    logError(
      "STOMP 오류",
      {
        headers:
          frame?.headers,

        body:
          frame?.body,
      }
    );
  };

  return client;
};

// =========================================================
// Socket 연결
// =========================================================

export const connectRealtimeSocket = (
  token = null
) => {
  const safeToken =
    normalizeToken(token);

  const previousToken =
    authToken;

  /*
   * token이 전달됐을 때만 갱신
   */
  if (safeToken) {
    authToken =
      safeToken;
  }

  const stompClient =
    createClient();

  /*
   * 이미 연결되어 있는데
   * JWT가 변경됐다면
   * CONNECT를 새 JWT로 다시 해야 한다.
   */
  if (
    stompClient.connected &&
    authToken &&
    connectedToken !==
      authToken
  ) {
    restartClientForTokenChange();

    return stompClient;
  }

  /*
   * 연결 중인 상태에서 token만 바뀐 경우
   * beforeConnect에서 최신 authToken이 사용된다.
   */
  if (
    previousToken !==
      authToken
  ) {
    stompClient.connectHeaders =
      authToken
        ? {
            Authorization:
              `Bearer ${authToken}`,
          }
        : {};
  }

  if (
    !stompClient.active &&
    !stompClient.connected
  ) {
    log(
      "연결 시작",
      {
        url:
          SOCKJS_URL,

        hasToken:
          Boolean(authToken),
      }
    );

    stompClient.activate();
  }

  return stompClient;
};

// =========================================================
// 일반 Topic Subscribe
// =========================================================

export const subscribeTopic = (
  destination,
  callback,
  token = null
) => {
  if (!destination) {
    throw new Error(
      "destination이 필요합니다."
    );
  }

  if (
    typeof callback !==
    "function"
  ) {
    throw new Error(
      "callback 함수가 필요합니다."
    );
  }

  const key =
    `sub-${++subscriptionSeq}`;

  subscriptions.set(
    key,
    {
      destination,
      callback,
      stompSubscription: null,
    }
  );

  /*
   * token이 있으면
   * STOMP CONNECT 인증에도 반영
   */
  connectRealtimeSocket(
    token
  );

  attachSubscription(
    key
  );

  return () => {
    const item =
      subscriptions.get(key);

    if (!item) {
      return;
    }

    try {
      item
        .stompSubscription
        ?.unsubscribe();
    } catch (error) {
      logError(
        "구독 해제 실패",
        error
      );
    }

    subscriptions.delete(
      key
    );

    log(
      "구독 해제",
      item.destination
    );
  };
};

// =========================================================
// 세션 Topic 주소 생성
// =========================================================

const sessionTopic = (
  sessionId,
  suffix
) => {
  if (
    sessionId === null ||
    sessionId === undefined ||
    sessionId === ""
  ) {
    throw new Error(
      "sessionId가 필요합니다."
    );
  }

  return `/topic/sessions/${sessionId}/${suffix}`;
};

// =========================================================
// 세션 관련 Topic Subscribe
//
// ★ 백엔드 변경사항
//
// STOMP CONNECT 시:
//
// Authorization: Bearer {JWT_TOKEN}
//
// 을 보내야 하기 때문에
// 두 번째 파라미터로 token을 받는다.
// =========================================================

export const subscribeSessionTopics = (
  sessionId,
  token,
  {
    onRealtimeTranscript,
    onMessage,
    onMessageUpdate,
    onStatus,
    onTranscript,
  } = {}
) => {
  const safeToken =
    normalizeToken(token);

  if (!safeToken) {
    throw new Error(
      "STOMP 세션 구독을 위한 JWT token이 필요합니다."
    );
  }

  const cleanupList = [];

  // =======================================================
  // 실시간 STT
  // =======================================================

  if (
    typeof onRealtimeTranscript ===
    "function"
  ) {
    cleanupList.push(
      subscribeTopic(
        sessionTopic(
          sessionId,
          "realtime-transcripts"
        ),
        onRealtimeTranscript,
        safeToken
      )
    );
  }

  // =======================================================
  // Transcript
  // =======================================================

  if (
    typeof onTranscript ===
    "function"
  ) {
    cleanupList.push(
      subscribeTopic(
        sessionTopic(
          sessionId,
          "transcripts"
        ),
        onTranscript,
        safeToken
      )
    );
  }

  // =======================================================
  // 일반 메시지
  // =======================================================

  if (
    typeof onMessage ===
    "function"
  ) {
    cleanupList.push(
      subscribeTopic(
        sessionTopic(
          sessionId,
          "messages"
        ),
        onMessage,
        safeToken
      )
    );
  }

  // =======================================================
  // 메시지 업데이트
  // =======================================================

  if (
    typeof onMessageUpdate ===
    "function"
  ) {
    cleanupList.push(
      subscribeTopic(
        sessionTopic(
          sessionId,
          "messages/update"
        ),
        onMessageUpdate,
        safeToken
      )
    );
  }

  // =======================================================
  // 세션 상태
  // =======================================================

  if (
    typeof onStatus ===
    "function"
  ) {
    cleanupList.push(
      subscribeTopic(
        sessionTopic(
          sessionId,
          "status"
        ),
        onStatus,
        safeToken
      )
    );
  }

  // =======================================================
  // 전체 세션 구독 해제
  // =======================================================

  return () => {
    cleanupList.forEach(
      (cleanup) => {
        cleanup();
      }
    );
  };
};

// =========================================================
// Socket 완전 종료
// =========================================================

export const disconnectRealtimeSocket =
  async () => {
    subscriptions.forEach(
      (item) => {
        try {
          item
            .stompSubscription
            ?.unsubscribe();
        } catch (error) {
          logError(
            "unsubscribe 실패",
            error
          );
        }
      }
    );

    subscriptions.clear();

    if (!client) {
      authToken = null;
      connectedToken = null;

      return;
    }

    const currentClient =
      client;

    /*
     * 먼저 null 처리해서
     * JWT 재연결 Promise가 진행 중이어도
     * 다시 activate되지 않게 함
     */
    client = null;

    authToken = null;
    connectedToken = null;

    try {
      await currentClient.deactivate();

      log(
        "WebSocket 완전 종료"
      );
    } catch (error) {
      logError(
        "WebSocket 종료 실패",
        error
      );
    }
  };

// =========================================================
// 연결 여부
// =========================================================

export const isRealtimeSocketConnected =
  () => {
    return Boolean(
      client?.connected
    );
  };