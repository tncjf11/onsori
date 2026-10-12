import { useNavigation, useRoute } from "@react-navigation/native";
import { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ChatInput from "../../components/intercom/ChatInput";
import ChatMessageList from "../../components/intercom/ChatMessageList";
import EndCallModal from "../../components/intercom/EndCallModal";
import IntercomHeader from "../../components/intercom/IntercomHeader";
import IntercomTimer from "../../components/intercom/IntercomTimer";

import useIntercomRealtime from "../../hooks/intercom/useIntercomRealtime";
import useIntercomSession from "../../hooks/intercom/useIntercomSession";

const BOTTOM_NAV_HEIGHT = 80;
const KEYBOARD_EXTRA_OFFSET = 50;

export default function IntercomChatScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const scrollViewRef = useRef(null);
  const isMountedRef = useRef(true);

  const [messages, setMessages] = useState([]);
  const [realtimePartial, setRealtimePartial] = useState("");
  const [isEndModalVisible, setIsEndModalVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [inputPanelHeight, setInputPanelHeight] = useState(0);

  const isKeyboardVisible = keyboardHeight > 0;

  const logUserChat = (message, data) => {
    console.log(`[USER_CHAT] ${message}`, data || "");
  };

  const moveToIdleMainTab = ({
    screen = "홈",
    endedSessionId = null,
  } = {}) => {
    navigation.reset({
      index: 0,
      routes: [
        {
          name: "MainTab",
          params: {
            screen,
            endedSessionId,
          },
        },
      ],
    });
  };

  const handleBackPress = () => {
    Keyboard.dismiss();

    navigation.reset({
      index: 0,
      routes: [
        {
          name: "MainTab",
          params: {
            screen: "홈",
          },
        },
      ],
    });
  };

  const handleAuthExpired = async () => {
    navigation.reset({
      index: 0,
      routes: [
        {
          name: "ResidentLogin",
        },
      ],
    });
  };

  const {
    startRealtimeSubscription,
    stopRealtimeSubscription,
  } = useIntercomRealtime({
    isMountedRef,
    logUserChat,
    moveToIdleMainTab,
  });

  const {
    currentSessionId,
    token,
    inputText,
    setInputText,
    sendMessage,
    endCall,
    isLoading,
    seconds,
    isEnding,
    initializeSession,
  } = useIntercomSession({
    initialSessionId:
      route.params?.sessionId ||
      route.params?.activeSessionId,
    routeToken: route.params?.token,
    isMountedRef,
    logUserChat,
    handleAuthExpired,
    moveToIdleMainTab,
    setMessages,
    stopRealtimeSubscription,
  });

  useEffect(() => {
    isMountedRef.current = true;

    initializeSession();

    return () => {
      isMountedRef.current = false;
      stopRealtimeSubscription();
    };
  }, []);

  useEffect(() => {
    if (!currentSessionId || !token) {
      return;
    }

    startRealtimeSubscription(
      currentSessionId,
      token,
      setMessages,
      setRealtimePartial
    );

    return () => {
      stopRealtimeSubscription();
    };
  }, [currentSessionId, token]);

  const scrollToBottom = (
    delay = 100,
    animated = true
  ) => {
    return setTimeout(() => {
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollToEnd({
          animated,
        });
      });
    }, delay);
  };

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios"
        ? "keyboardWillShow"
        : "keyboardDidShow";

    const hideEvent =
      Platform.OS === "ios"
        ? "keyboardWillHide"
        : "keyboardDidHide";

    const showSubscription = Keyboard.addListener(
      showEvent,
      (event) => {
        const height =
          event?.endCoordinates?.height || 0;

        setKeyboardHeight(height);

        scrollToBottom(100);
        scrollToBottom(300);
        scrollToBottom(500);
      }
    );

    const hideSubscription = Keyboard.addListener(
      hideEvent,
      () => {
        setKeyboardHeight(0);

        scrollToBottom(100);
        scrollToBottom(250);
      }
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (keyboardHeight <= 0) {
      return;
    }

    const timer1 = scrollToBottom(100);
    const timer2 = scrollToBottom(300);
    const timer3 = scrollToBottom(500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [keyboardHeight]);

  useEffect(() => {
    if (
      keyboardHeight <= 0 ||
      inputPanelHeight <= 0
    ) {
      return;
    }

    const timer1 = scrollToBottom(100);
    const timer2 = scrollToBottom(300);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [keyboardHeight, inputPanelHeight]);

  const handleFocus = () => {
    scrollToBottom(100);
    scrollToBottom(300);
    scrollToBottom(500);
  };

  const handleSend = async () => {
    const text = String(inputText || "").trim();

    if (!text || isEnding) {
      return;
    }

    logUserChat("일반 텍스트 전송 요청", {
      sessionId: currentSessionId,
      text,
    });

    try {
      const success = await sendMessage();

      if (success) {
        scrollToBottom(80);
        scrollToBottom(220);
      }
    } catch (error) {
      logUserChat("일반 텍스트 전송 처리 실패", {
        error: error?.message,
      });
    }
  };

  const handleOpenEndModal = () => {
    if (isEnding) {
      return;
    }

    setIsEndModalVisible(true);
  };

  const handleConfirmEnd = () => {
    if (isEnding) {
      return;
    }

    setIsEndModalVisible(false);
    endCall();
  };

  const handleCancelEnd = () => {
    if (isEnding) {
      return;
    }

    setIsEndModalVisible(false);
  };

  const inputBottom =
    isKeyboardVisible
      ? keyboardHeight + KEYBOARD_EXTRA_OFFSET
      : BOTTOM_NAV_HEIGHT;

  const messageBottomInset =
    inputBottom +
    inputPanelHeight +
    12;

  const keyboardBehavior =
    Platform.OS === "ios"
      ? "padding"
      : undefined;

  return (
    <KeyboardAvoidingView
      style={{
        flex: 1,
        backgroundColor: "#f3f4f6",
      }}
      behavior={keyboardBehavior}
      keyboardVerticalOffset={0}
    >
      <SafeAreaView
        edges={["top"]}
        style={{
          backgroundColor: "#ffffff",
        }}
      >
        <IntercomHeader
          isEnding={isEnding}
          onBackPress={handleBackPress}
          onOpenEndModal={handleOpenEndModal}
        />
      </SafeAreaView>

      <IntercomTimer seconds={seconds} />

      <View
        style={{
          flex: 1,
          minHeight: 0,
        }}
      >
        <ChatMessageList
          isLoading={isLoading}
          messages={messages}
          realtimePartial={realtimePartial}
          scrollViewRef={scrollViewRef}
          keyboardHeight={keyboardHeight}
          bottomInset={messageBottomInset}
        />

        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: inputBottom,
            zIndex: 100,
            elevation: 100,
          }}
        >
          <View
            onLayout={(event) => {
              const height =
                event?.nativeEvent?.layout?.height || 0;

              if (
                height > 0 &&
                height !== inputPanelHeight
              ) {
                setInputPanelHeight(height);
              }
            }}
            style={{
              width: "100%",
              backgroundColor: "#ffffff",
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              shadowColor: "#000000",
              shadowOpacity: 0.08,
              shadowRadius: 8,
              shadowOffset: {
                width: 0,
                height: -2,
              },
              elevation: 12,
            }}
          >
            <ChatInput
              inputText={inputText}
              onChangeText={setInputText}
              onFocus={handleFocus}
              onSend={handleSend}
              disabled={isEnding}
            />
          </View>
        </View>
      </View>

      <EndCallModal
        visible={isEndModalVisible}
        isEnding={isEnding}
        onConfirm={handleConfirmEnd}
        onCancel={handleCancelEnd}
        onRequestClose={handleCancelEnd}
      />
    </KeyboardAvoidingView>
  );
}