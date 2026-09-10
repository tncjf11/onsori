import { Client } from "@stomp/stompjs";
import BASE_URL from "../api/config";

// 백엔드:
// registry.addEndpoint("/ws").withSockJS()
//
// SockJS endpoint는 내부적으로 /websocket 경로도 제공하므로
// Expo / React Native에서는 native WebSocket으로 직접 연결한다.
const WS_BASE_URL = String(BASE_URL)
  .replace(/^http:/, "ws:")
  .replace(/^https:/, "wss:")
  .replace(/\/$/, "");

export const REALTIME_SOCKET_URL =
  `${WS_BASE_URL}/ws/websocket`;

let client = null;
let subscriptionSeq = 0;

// 재연결 시 다시 subscribe할 수 있도록
// 구독 정보를 저장해둔다.
const subscriptions = new Map();

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
  if (data !== undefined) {
    console.error(
      `[REALTIME_SOCKET] ${message}`,
      data
    );
  } else {
    console.error(
      `[REALTIME_SOCKET] ${message}`
    );
  }
};

// STOMP frame body를 JSON으로 변환
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

// WebSocket 연결이 끊겼을 때
// 기존 STOMP subscription 객체만 초기화.
// subscriptions 정보 자체는 유지한다.
const clearSubscriptionHandles = () => {
  subscriptions.forEach((item, key) => {
    subscriptions.set(key, {
      ...item,
      stompSubscription: null,
    });
  });
};

// 저장되어 있는 특정 topic을 실제 STOMP client에 연결
const attachSubscription = (key) => {
  if (!client?.connected) {
    return;
  }

  const item = subscriptions.get(key);

  if (!item) {
    return;
  }

  // 이미 subscribe 된 경우 중복 구독 방지
  if (item.stompSubscription) {
    return;
  }

  const stompSubscription =
    client.subscribe(
      item.destination,
      (frame) => {
        const payload =
          parsePayload(frame);

        log("메시지 수신", {
          destination:
            item.destination,
          payload,
        });

        try {
          item.callback(
            payload,
            frame
          );
        } catch (error) {
          logError(
            "callback 처리 실패",
            {
              destination:
                item.destination,
              error:
                error?.message ||
                String(error),
            }
          );
        }
      }
    );

  subscriptions.set(key, {
    ...item,
    stompSubscription,
  });

  log(
    "구독 완료",
    item.destination
  );
};

// WebSocket이 재연결됐을 때
// 기존 화면들이 요청했던 topic들을 다시 subscribe
const attachAllSubscriptions = () => {
  subscriptions.forEach(
    (_, key) => {
      attachSubscription(key);
    }
  );
};

// STOMP Client 생성
const createClient = () => {
  if (client) {
    return client;
  }

  client = new Client({
    brokerURL:
      REALTIME_SOCKET_URL,

    // 연결이 끊어졌을 경우
    // 3초 뒤 자동 재연결
    reconnectDelay: 3000,

    // 최초 연결 timeout
    connectionTimeout: 10000,

    // heartbeat
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,

    debug: (message) => {
      log(
        `STOMP ${message}`
      );
    },
  });

  // STOMP 연결 성공
  client.onConnect = (
    frame
  ) => {
    log("연결 성공", {
      url:
        REALTIME_SOCKET_URL,
      stompVersion:
        frame?.headers?.version,
    });

    // 최초 연결뿐 아니라
    // 재연결됐을 때도 기존 topic을 다시 구독
    attachAllSubscriptions();
  };

  // 정상 disconnect
  client.onDisconnect = () => {
    log("연결 해제");

    clearSubscriptionHandles();
  };

  // WebSocket 자체가 닫힘
  client.onWebSocketClose = (
    event
  ) => {
    log("WebSocket 종료", {
      code: event?.code,
      reason:
        event?.reason,
    });

    clearSubscriptionHandles();
  };

  // WebSocket 오류
  client.onWebSocketError = (
    error
  ) => {
    logError(
      "WebSocket 오류",
      error
    );
  };

  // STOMP 서버 ERROR frame
  client.onStompError = (
    frame
  ) => {
    logError("STOMP 오류", {
      message:
        frame?.headers?.message,
      body:
        frame?.body,
    });
  };

  return client;
};

/**
 * WebSocket / STOMP 연결 시작
 *
 * 이미 연결 중이거나 연결된 상태라면
 * activate를 중복 호출하지 않는다.
 */
export const connectRealtimeSocket =
  () => {
    const stompClient =
      createClient();

    if (!stompClient.active) {
      log(
        "연결 시작",
        REALTIME_SOCKET_URL
      );

      stompClient.activate();
    }

    return stompClient;
  };

/**
 * STOMP topic 하나를 구독
 *
 * 반환되는 cleanup 함수를
 * useEffect return에서 호출하면 된다.
 *
 * 예:
 *
 * const unsubscribe = subscribeTopic(
 *   "/topic/...",
 *   (data) => {}
 * );
 *
 * return unsubscribe;
 */
export const subscribeTopic = (
  destination,
  callback
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

  subscriptions.set(key, {
    destination,
    callback,
    stompSubscription: null,
  });

  // 아직 WebSocket 연결 전이면 연결 시작
  connectRealtimeSocket();

  // 이미 연결돼 있다면 바로 subscribe
  attachSubscription(key);

  // unsubscribe 함수 반환
  return () => {
    const item =
      subscriptions.get(key);

    if (!item) {
      return;
    }

    try {
      item.stompSubscription
        ?.unsubscribe();
    } catch (error) {
      logError(
        "구독 해제 실패",
        {
          destination:
            item.destination,
          error:
            error?.message ||
            String(error),
        }
      );
    }

    subscriptions.delete(key);

    log(
      "구독 해제",
      item.destination
    );
  };
};

// sessionId 기반 topic 생성
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

  return (
    `/topic/sessions/` +
    `${sessionId}/` +
    `${suffix}`
  );
};

/**
 * 세션과 관련된 WebSocket topic을
 * 한 번에 구독할 수 있는 함수.
 *
 * 필요한 callback만 넘기면 된다.
 *
 * 백엔드 topic:
 *
 * /topic/sessions/{sessionId}/realtime-transcripts
 * /topic/sessions/{sessionId}/messages
 * /topic/sessions/{sessionId}/messages/update
 * /topic/sessions/{sessionId}/status
 * /topic/sessions/{sessionId}/transcripts
 */
export const subscribeSessionTopics = (
  sessionId,
  {
    onRealtimeTranscript,
    onMessage,
    onMessageUpdate,
    onStatus,
    onTranscript,
  } = {}
) => {
  const cleanupList = [];

  // 실시간 partial STT
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
        onRealtimeTranscript
      )
    );
  }

  // 새로운 저장 메시지
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
        onMessage
      )
    );
  }

  // 수정된 메시지
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
        onMessageUpdate
      )
    );
  }

  // 통화 상태 변경
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
        onStatus
      )
    );
  }

  // transcript 이벤트
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
        onTranscript
      )
    );
  }

  // 한 번에 전부 unsubscribe
  return () => {
    cleanupList.forEach(
      (cleanup) => {
        cleanup();
      }
    );
  };
};

/**
 * WebSocket을 완전히 종료.
 *
 * 일반 화면 이동에서는 사용하지 않고
 * 로그아웃이나 앱에서 실시간 연결 자체를
 * 완전히 닫을 때 사용하는 용도.
 */
export const disconnectRealtimeSocket =
  async () => {
    subscriptions.forEach(
      (item) => {
        try {
          item.stompSubscription
            ?.unsubscribe();
        } catch {
          // 종료 과정의 개별 unsubscribe 오류 무시
        }
      }
    );

    subscriptions.clear();

    if (!client) {
      return;
    }

    const currentClient =
      client;

    client = null;

    try {
      await currentClient
        .deactivate();

      log("완전 종료");
    } catch (error) {
      logError(
        "종료 실패",
        error
      );
    }
  };

/**
 * 현재 STOMP 연결 여부 확인
 */
export const isRealtimeSocketConnected =
  () => {
    return Boolean(
      client?.connected
    );
  };