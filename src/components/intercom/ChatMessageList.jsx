import {
  ActivityIndicator,
  Platform,
  ScrollView,
} from "react-native";

import {
  useCallback,
  useEffect,
  useMemo,
} from "react";

import styled from "styled-components/native";

export default function ChatMessageList({
  isLoading,
  messages = [],
  realtimePartial = "",
  scrollViewRef,

  /*
   * IntercomChatScreen에서 전달받는
   * 현재 키보드 높이
   */
  keyboardHeight = 0,

  /*
   * absolute 입력창에 마지막 메시지가
   * 가려지지 않도록 확보할 하단 공간
   */
  bottomInset = 20,
}) {

  // =========================================================
  // 시스템 메시지 제외
  // =========================================================

  const visibleMessages = useMemo(
    () =>
      messages.filter(
        (msg) =>
          msg.type !== "system"
      ),
    [messages]
  );

  // =========================================================
  // 최하단 이동
  // =========================================================

  const scrollToBottom = useCallback(
    (
      animated = true,
      delay = 80
    ) => {
      const timer = setTimeout(() => {
        requestAnimationFrame(() => {
          scrollViewRef
            ?.current
            ?.scrollToEnd({
              animated,
            });
        });
      }, delay);

      return timer;
    },
    [scrollViewRef]
  );

  // =========================================================
  // 새 메시지 / 실시간 자막 변경
  // =========================================================

  useEffect(() => {
    if (
      visibleMessages.length === 0 &&
      !String(realtimePartial || "").trim()
    ) {
      return;
    }

    /*
     * 메시지가 들어온 직후
     */
    const timer1 =
      scrollToBottom(
        true,
        80
      );

    /*
     * 말풍선 렌더링 완료 후
     * 한 번 더 이동
     */
    const timer2 =
      scrollToBottom(
        true,
        220
      );

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [
    visibleMessages,
    realtimePartial,
    scrollToBottom,
  ]);

  // =========================================================
  // 키보드 높이 변경
  //
  // 키보드가 나타난 직후에는
  // 입력창 위치 / ScrollView 레이아웃 계산이
  // 동시에 일어나기 때문에 여러 번 내려준다.
  // =========================================================

  useEffect(() => {
    if (keyboardHeight <= 0) {
      const timer =
        scrollToBottom(
          true,
          100
        );

      return () => {
        clearTimeout(timer);
      };
    }

    const timer1 =
      scrollToBottom(
        true,
        100
      );

    const timer2 =
      scrollToBottom(
        true,
        300
      );

    const timer3 =
      scrollToBottom(
        true,
        500
      );

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [
    keyboardHeight,
    scrollToBottom,
  ]);

  // =========================================================
  // 입력창 하단 공간이 변경됐을 때
  // =========================================================

  useEffect(() => {
    if (bottomInset <= 20) {
      return;
    }

    const timer1 =
      scrollToBottom(
        true,
        100
      );

    const timer2 =
      scrollToBottom(
        true,
        300
      );

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [
    bottomInset,
    scrollToBottom,
  ]);

  // =========================================================
  // Render
  // =========================================================

  return (
    <ChatArea>
      {isLoading ? (
        <LoadingContainer>
          <ActivityIndicator
            size="large"
            color="#06F393"
          />
        </LoadingContainer>
      ) : (
        <ScrollView
          ref={scrollViewRef}

          style={{
            flex: 1,
          }}

          showsVerticalScrollIndicator={false}

          /*
           * 입력창을 눌렀을 때
           * ScrollView가 터치를 가로채지 않도록
           */
          keyboardShouldPersistTaps="handled"

          /*
           * 채팅을 아래로 드래그하면
           * 키보드를 닫을 수 있게 함
           */
          keyboardDismissMode={
            Platform.OS === "ios"
              ? "interactive"
              : "on-drag"
          }

          /*
           * 채팅은 원래처럼
           * 화면 위에서부터 시작한다.
           *
           * 마지막 메시지는 absolute 입력창에
           * 가려지지 않도록 bottomInset만큼
           * 아래 공간을 확보한다.
           */
          contentContainerStyle={{
            paddingTop: 4,
            paddingBottom: bottomInset,
            flexGrow: 1,
          }}

          /*
           * ScrollView 자체 크기가 바뀌었을 때
           */
          onLayout={() => {
            if (keyboardHeight > 0) {
              scrollToBottom(
                false,
                100
              );

              scrollToBottom(
                true,
                300
              );
            }
          }}

          /*
           * 새 메시지나 padding 변경으로
           * 전체 content 높이가 변경됐을 때
           */
          onContentSizeChange={() => {
            scrollToBottom(
              true,
              80
            );

            scrollToBottom(
              true,
              200
            );
          }}
        >
          {visibleMessages.map(
            (msg, index) => {
              const text =
                String(
                  msg.text || ""
                ).trim();

              if (!text) {
                return null;
              }

              // =================================================
              // 상대방 메시지
              // =================================================

              if (
                msg.type ===
                "receive"
              ) {
                return (
                  <ReceiveRow
                    key={
                      msg.id ||
                      `receive-${index}`
                    }
                  >
                    <ReceiveBubble>
                      <ReceiveBubbleText>
                        {text}
                      </ReceiveBubbleText>
                    </ReceiveBubble>
                  </ReceiveRow>
                );
              }

              // =================================================
              // 내가 보낸 메시지
              // =================================================

              return (
                <SendRow
                  key={
                    msg.id ||
                    `send-${index}`
                  }
                >
                  <SendBubble>
                    <SendBubbleText>
                      {text}
                    </SendBubbleText>
                  </SendBubble>
                </SendRow>
              );
            }
          )}

          {/*
           * 방문자 실시간 STT
           */}
          {String(
            realtimePartial || ""
          ).trim() ? (
            <ReceiveRow
              key="realtime-partial"
            >
              <ReceiveBubble>
                <ReceiveBubbleText>
                  {String(
                    realtimePartial
                  ).trim()}
                </ReceiveBubbleText>
              </ReceiveBubble>
            </ReceiveRow>
          ) : null}
        </ScrollView>
      )}
    </ChatArea>
  );
}

// =========================================================
// 채팅 영역
// =========================================================

const ChatArea = styled.View`
  flex: 1;
  min-height: 0;
  padding: 10px 16px 0;
  background-color: #f3f4f6;
`;

// =========================================================
// 로딩
// =========================================================

const LoadingContainer = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
`;

// =========================================================
// 상대방 메시지
// =========================================================

const ReceiveRow = styled.View`
  width: 100%;
  align-items: flex-start;
  margin-bottom: 10px;
`;

const ReceiveBubble = styled.View`
  align-self: flex-start;
  max-width: 78%;
  background-color: #ffffff;
  border-radius: 18px;
  padding: 11px 14px;
  shadow-color: #000000;
  shadow-opacity: 0.035;
  shadow-radius: 4px;
  shadow-offset: 0px 1px;
  elevation: 1;
`;

const ReceiveBubbleText = styled.Text`
  font-size: 15px;
  line-height: 22px;
  color: #222222;
  flex-shrink: 1;
`;

// =========================================================
// 내가 보낸 메시지
// =========================================================

const SendRow = styled.View`
  width: 100%;
  align-items: flex-end;
  margin-bottom: 10px;
`;

const SendBubble = styled.View`
  align-self: flex-end;
  max-width: 78%;
  background-color: #06f393;
  border-radius: 18px;
  padding: 11px 14px;
`;

const SendBubbleText = styled.Text`
  font-size: 15px;
  line-height: 22px;
  color: #ffffff;
  font-weight: 700;
  flex-shrink: 1;
`;