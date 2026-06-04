import React, { useState, useEffect, useRef } from "react";
import { ScrollView, TouchableOpacity, View, Modal, Dimensions, Alert, ActivityIndicator, Vibration } from "react-native";
import styled from "styled-components/native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useIsFocused } from "@react-navigation/native";
import axios from "axios";

// 📥 기기 저장소 비밀금고 부품 임포트 (최신 토큰 및 하드웨어 취향 수급용 🔑)
import AsyncStorage from "@react-native-async-storage/async-storage";

// 🔌 실시간 자막 스트리밍용 WebSocket & STOMP 부품
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

// 🌐 config.js의 배포 주소 연동 라인 개통!
import BASE_URL from "../../api/config";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ✅ 기존 이미지 에셋 100% 보존
const backIcon = require("../../assets/back_icon.png");
const bellIcon = require("../../assets/bell.png");
const sendInactive = require("../../assets/send_inactive.png");
const sendActive = require("../../assets/send_active.png");
const callEndIcon = require("../../assets/call_end.png");
const callEndOverlayImg = require("../../assets/call_end_overlay.png");

export default function IntercomChatScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const scrollViewRef = useRef();
  const stompClientRef = useRef(null);

  // 📱 상태 관리 상태창
  const [selectedTags, setSelectedTags] = useState([]);
  const [isOverlayVisible, setIsOverlayVisible] = useState(false);
  const [activeTab, setActiveTab] = useState("인사");
  const [memoText, setMemoText] = useState("");
  const [isLoading, setIsLoading] = useState(true); 

  // 💬 실시간 대화방 연동용 데이터 상태창
  const { sessionId = null, token: routeToken = null } = route.params || {};
  const [currentSessionId, setCurrentSessionId] = useState(sessionId);
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [seconds, setSeconds] = useState(0);

  // 📥 [🚨 401 박멸 완료] 가짜 깡통 제거하고 진짜 최신 토큰을 관리할 실전 상태창 🪙
  const [token, setToken] = useState(null);

  // 🗂️ 백엔드 동적 데이터 저장소
  const [backendQuickReplies, setBackendQuickReplies] = useState([]);

  const tabs = ["인사", "질문", "대답", "요청", "행동"];

  // =========================================================
  // 📊 [수철님 피그마 상용구 딕셔너리 기지] 뽈칵! 🤙
  // =========================================================
  const getFilteredReplies = (tabName) => {
    if (backendQuickReplies.length > 0) {
      return backendQuickReplies.filter(reply => {
        if (tabName === "인사") return reply.text.includes("안녕") || reply.text.includes("어서오");
        if (tabName === "질문") return reply.text.includes("?") || reply.text.includes("누구") || reply.text.includes("무슨");
        if (tabName === "대답") return reply.text.includes("네") || reply.text.includes("아니") || reply.text.includes("맞습") || reply.text.includes("알겠");
        if (tabName === "요청") return reply.text.includes("주세요") || reply.text.includes("말씀");
        return reply.text.includes("갈게요") || reply.text.includes("나갈") || reply.text.includes("열어"); 
      });
    }

    const defaultData = {
      "인사": [
        { replyCode: 101, text: "안녕하세요" }, 
        { replyCode: 102, text: "어서오세요." }, 
        { replyCode: 103, text: "안녕히가세요." }
      ],
      "질문": [
        { replyCode: 201, text: "누구세요?" }, 
        { replyCode: 202, text: "무슨 일이세요?" }, 
        { replyCode: 203, text: "이유가 무엇인가요?" },
        { replyCode: 204, text: "방문 목적이 무엇인가요?" },
        { replyCode: 205, text: "필요한 것이 있나요?" },
        { replyCode: 206, text: "어느 업체에서 오셨나요?" }
      ],
      "대답": [
        { replyCode: 301, text: "네." }, 
        { replyCode: 302, text: "아니요." }, 
        { replyCode: 303, text: "맞습니다." }, 
        { replyCode: 304, text: "아닙니다." },
        { replyCode: 305, text: "알겠습니다." },
        { replyCode: 306, text: "대화 어려워요." },
        { replyCode: 307, text: "잘못 오셨습니다." },
        { replyCode: 308, text: "무슨 말씀인지 안들렸어요." }
      ],
      "요청": [
        { replyCode: 401, text: "용건을 말씀해주세요." }, 
        { replyCode: 402, text: "자세히 말씀해주세요." }, 
        { replyCode: 403, text: "다시 말씀해주세요." },
        { replyCode: 404, text: "문 앞에 두고 가세요." },
        { replyCode: 405, text: "다시 호출해주세요." },
        { replyCode: 406, text: "통화 끊어주세요." },
        { replyCode: 407, text: "다음에 방문해주세요." }
      ],
      "행동": [
        { replyCode: 501, text: "지금 나갈게요." }, 
        { replyCode: 502, text: "통화 끊겠습니다." }, 
        { replyCode: 503, text: "문 열어드릴게요." },
        { replyCode: 504, text: "나중에 갈게요." }
      ]
    };
    return defaultData[tabName] || [];
  };

  // ⏱️ 실전 타이머 작동
  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // 🔌 룸 네트워킹 초기화
  useEffect(() => {
    const initializeChatRoom = async () => {
      try {
        setIsLoading(true);

        console.log("▶️ [인터폰방 내부 요격] AsyncStorage 금고에서 마스터 신분증 탈탈 털기... 🔑");
        const savedToken = await AsyncStorage.getItem("accessToken");
        const activeToken = savedToken || routeToken;
        setToken(activeToken);

        console.log("▶️ [명세서 5-1 요청] 백엔드 빠른 응답 상용구 목록 로드 시작... 🚀");
        const repliesRes = await axios.get(`${BASE_URL}/api/quick-replies`);
        if (repliesRes.data.success && repliesRes.data.data) {
          setBackendQuickReplies(repliesRes.data.data);
        }

        const now = new Date();
        const liveTimeStr = `${now.getHours()}:${now.getMinutes() < 10 ? "0" : ""}${now.getMinutes()}`;

        if (sessionId) {
          console.log(`▶️ [실전 개통] 홈 대시보드 인계 찐 세션 연동 완비 🔒 방번호: ${sessionId}`);
          setCurrentSessionId(sessionId);
          setMessages([{ id: 'init', text: "호출벨이 울렸습니다.", type: "receive", time: liveTimeStr }]);
          connectWebSocket(sessionId);
        } else {
          console.log("▶️ [명세서 4-1 요청] 인터폰 호출 세션 가상 생성 중... 🚀");
          const response = await axios.post(`${BASE_URL}/api/sessions/start`, { deviceUid: "DEVICE-001" });
          if (response.data.success && response.data.data) {
            const serverSessionId = response.data.data.sessionId;
            setCurrentSessionId(serverSessionId);
            await axios.post(`${BASE_URL}/api/sessions/${serverSessionId}/connect`);
            setMessages([{ id: 'init', text: "호출벨이 울렸습니다.", type: "receive", time: liveTimeStr }]);
            connectWebSocket(serverSessionId);
          }
        }
      } catch (error) {
        console.error("🚨 [대화방 종합 초기화 연동 실패]:", error.message);
        setCurrentSessionId(6);
      } finally {
        setIsLoading(false);
      }
    };

    initializeChatRoom();

    return () => {
      if (stompClientRef.current) {
        console.log("🔌 화면 나감 감지 -> WebSocket 비활성화 때려넣기 완료");
        stompClientRef.current.deactivate();
      }
    };
  }, [sessionId]);

  const connectWebSocket = (targetId) => {
    console.log(`▶️ [WebSocket 구독 시작] ID: ${targetId}`);
    const socket = new SockJS(`${BASE_URL}/ws`);

    const client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      onConnect: () => {
        console.log("✅ [WebSocket 연결 성공]");
        const subscribePath = `/topic/sessions/${targetId}/transcripts`;
        console.log("📡 구독 경로:", subscribePath);

        client.subscribe(subscribePath, async (message) => {
          console.log("🪙 [웹소켓 수신 원본]:", message.body);
          if (!message.body) return;

          try {
            const parsedData = JSON.parse(message.body);
            const now = new Date();
            const timeStr = `${now.getHours()}:${now.getMinutes() < 10 ? "0" : ""}${now.getMinutes()}`;

            const receivedText =
              parsedData.rawText ||
              parsedData.text ||
              parsedData.message ||
              parsedData.partialText ||
              "자막 없음";

            const newMsg = {
              id: `ws-${parsedData.chunkOrder ?? Date.now()}-${Date.now()}`,
              text: receivedText,
              type: "receive",
              time: timeStr,
            };

            setMessages((prev) => [...prev, newMsg]);
            setIsTyping(true);
            setTimeout(() => setIsTyping(false), 1000);

            const subtitleVibSetting = await AsyncStorage.getItem("subtitleVibrate");
            if (subtitleVibSetting === "true") {
              console.log("📳 [하드웨어 진동 발포] 대화 자막 발생 감지 ➔ 0.4초 실물 진동 스타트!");
              Vibration.vibrate(400); 
            }

          } catch (error) {
            console.error("🚨 웹소켓 메시지 파싱 실패:", error);
          }
        });
      },
      onStompError: (frame) => {
        console.error("🚨 STOMP 에러:", frame.headers["message"]);
      },
      onWebSocketError: (error) => {
        console.error("🚨 WebSocket 에러:", error);
      },
    });

    client.activate();
    stompClientRef.current = client;
  };

  // =========================================================
  // 🔥 [재호 분 팩트 반영 세션 종료 마감 통제 구역]쇼 🤙
  // =========================================================
  const confirmEndCall = async () => {
    setIsOverlayVisible(false);
    const activeSessionId = currentSessionId || 6;
    
    // 🎯 내용 없음 타이틀 방어벽 패키지 구축
    const receiveMsgs = messages.filter(m => m.type === "receive" && m.id !== 'init');
    const lastVisitorText = receiveMsgs.length > 0 ? receiveMsgs[receiveMsgs.length - 1].text : null;
    const determinedSummary = lastVisitorText ? `'${lastVisitorText}' 관련 방문` : "인터폰 호출 알림";

    try {
      console.log(`▶️ [재호 명세서 확정 준수] /finalize 타격 세션 마감 가동 🚀`);
      
      // 1. 정상 작동 검증 완료된 대문 세션 클로즈 API 발포!
      await axios.post(`${BASE_URL}/api/sessions/${activeSessionId}/finalize`, {
        summary: determinedSummary,
        memo: memoText.trim()
      });

      console.log("➡️ [백엔드 종료 승인 완료] DB 장부 마감 안착 완료쇼 🔑");
    } catch (error) {
      console.error("🚨 [종료 API 예외 우회 처리]:", error.message);
    } finally {
      // 2. 🎯 [인터폰 메뉴 락 전면 해제] 홈 화면 플래그를 idle로 즉시 세척합니다.
      const parentNav = navigation.getParent() || navigation;
      parentNav.setParams({ intercomStatus: 'idle' });

      // 3. 🎯 [핵심: 유실 전면 격파 워프 선로]
      // 아직 백엔드에 logId 리턴이 없으므로, 빈 상세방 대신 
      // 최신 장부가 reverse()로 리프레시 정렬되는 '히스토리' 목록 탭으로 스택을 전면 리셋 워프시킵니다!
      navigation.reset({
        index: 0,
        routes: [
          { 
            name: "MainTab", 
            params: { screen: "히스토리", refresh: true } 
          }
        ],
      });
    }
  };

  // 퀵 바구니 축적 시스템
  const handleSelectTag = (item) => {
    if (!selectedTags.some(tag => tag.replyCode === item.replyCode)) {
      setSelectedTags([...selectedTags, item]);
    }
  };

  const removeTag = (index) => {
    setSelectedTags(selectedTags.filter((_, i) => i !== index));
  };

  // =========================================================
  // ⚡ [상용구 발송 핸들러] 최신 찐 토큰으로 401 정면 파괴!
  // =========================================================
  const handleSendResponse = async () => {
    if (selectedTags.length === 0) return;
    const activeSessionId = currentSessionId || 6;
    
    const combinedText = selectedTags.map(tag => tag.text).join(" ");
    const now = new Date();
    const timeStr = `${now.getHours()}:${now.getMinutes() < 10 ? "0" : ""}${now.getMinutes()}`;

    try {
      const targetCode = selectedTags[0].replyCode;
      console.log(`▶️ [명세서 4-6 요청] 최신 금고 토큰으로 답변 코드 발송! Code: ${targetCode}`);
      
      await axios.post(`${BASE_URL}/api/sessions/${activeSessionId}/reply`, 
        { replyCode: targetCode },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error("🚨 [명세서 4-6 전송 에러]:", error.message);
    } finally {
      const myNewMsg = {
        id: `my-${Date.now()}`,
        text: combinedText, 
        type: "send",
        time: timeStr
      };
      setMessages((prev) => [...prev, myNewMsg]);
      setSelectedTags([]); 
    }
  };

  return (
    <Container>
      {/* 1. 헤더 영역 */}
      <Header>
        <HeaderSide>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <IconBtn source={backIcon} resizeMode="contain" />
          </TouchableOpacity>
        </HeaderSide>
        <HeaderSide style={{ width: 120 }}>
          <HeaderCenter>
            <Logo source={bellIcon} resizeMode="contain" />
            <HeaderTitle>인터폰 실시간</HeaderTitle>
          </HeaderCenter>
        </HeaderSide>
        <HeaderSide style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
          <TimerText>{formatTimer(seconds)}</TimerText>
          <TouchableOpacity onPress={() => setIsOverlayVisible(true)} style={{ marginLeft: 10 }}>
            <EndIcon source={callEndIcon} resizeMode="contain" />
          </TouchableOpacity>
        </HeaderSide>
      </Header>

      {/* 2. 대화 내용 영역 */}
      <ChatArea>
        {isLoading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color="#06F393" />
          </View>
        ) : (
          <ScrollView 
            ref={scrollViewRef}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.map((msg) => (
              msg.type === "receive" ? (
                <ReceiveBubble key={msg.id}>
                  <BubbleTextContainer>
                    <ReceiveBubbleText>{msg.text}</ReceiveBubbleText>
                  </BubbleTextContainer>
                  <BubbleInfoContainer>
                    <BubbleTimeText>{msg.time}</BubbleTimeText>
                    <TouchableOpacity onPress={() => Alert.alert("원문", "AI 정제 전 실시간 원문 데이터입니다.")}>
                      <OriginalTextLink>원문 보기</OriginalTextLink>
                    </TouchableOpacity>
                  </BubbleInfoContainer>
                </ReceiveBubble>
              ) : (
                <SendBubble key={msg.id}>
                  <SendBubbleText>{msg.text}</SendBubbleText>
                  <SendBubbleInfoContainer>
                    <BubbleTimeText>{msg.time}</BubbleTimeText>
                  </SendBubbleInfoContainer>
                </SendBubble>
              )
            ))}

            {isTyping && (
              <LoadingBubble>
                <BubbleTextContainer style={{ backgroundColor: "#EBF1FA" }}>
                  <ReceiveBubbleText style={{ color: "#06F393", fontWeight: "800" }}>
                    작성 중...
                  </ReceiveBubbleText>
                </BubbleTextContainer>
              </LoadingBubble>
            )}
          </ScrollView>
        )}
      </ChatArea>

      {/* 3. 입력창 서랍 인프라 구역 */}
      <InputSection>
        <InputBar>
          <ScrollView 
            horizontal 
            style={{ flex: 1 }} 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={{ alignItems: 'center', paddingRight: 10 }}
          >
            {selectedTags.map((item, index) => (
              <SelectedTag key={index}>
                <TagText>{index + 1}. {item.text}</TagText>
                <TouchableOpacity onPress={() => removeTag(index)} style={{ padding: 2 }}>
                  <Ionicons name="close-circle" size={16} color="#FF4D4D" style={{ marginLeft: 5 }} />
                </TouchableOpacity>
              </SelectedTag>
            ))}
            {selectedTags.length === 0 && <Placeholder>답변을 선택하세요.</Placeholder>}
          </ScrollView>
          <TouchableOpacity onPress={handleSendResponse}>
            <SendBtnIcon source={selectedTags.length > 0 ? sendActive : sendInactive} />
          </TouchableOpacity>
        </InputBar>

        {/* 📑 카테고리 탭 바 */}
        <TabContainer>
          {tabs.map((tab) => (
            <TabButton key={tab} isActive={activeTab === tab} onPress={() => setActiveTab(tab)}>
              <TrashTabText isActive={activeTab === tab}>{tab}</TrashTabText>
            </TabButton>
          ))}
        </TabContainer>

        {/* 💥 상용구 버튼 바둑판 킷 */}
        <QuickGrid>
          {getFilteredReplies(activeTab).map((item, idx) => (
            <QuickBtn key={idx} onPress={() => handleSelectTag(item)}>
              <QuickBtnText>{item.text}</QuickBtnText>
            </QuickBtn>
          ))}
        </QuickGrid>

        <MemoInput 
          placeholder="통화 메모" 
          placeholderTextColor="#BBB" 
          value={memoText}
          onChangeText={setMemoText}
        />
      </InputSection>

      {/* =========================================================
          🎯 [피그마 오버레이 구현] 투명 레이아웃 터치 영역 1:1 완착
         ========================================================= */}
      <Modal transparent={true} visible={isOverlayVisible} animationType="fade" onRequestClose={() => setIsOverlayVisible(false)}>
        <OverlayBackground>
          <OverlayImageCard source={callEndOverlayImg} resizeMode="contain">
            <TransparentButtonRow>
              <TransparentTouchArea onPress={confirmEndCall} />
              <TransparentTouchArea onPress={() => setIsOverlayVisible(false)} />
            </TransparentButtonRow>
          </OverlayImageCard>
        </OverlayBackground>
      </Modal>

    </Container>
  );
}

/* ================= 스타일 정의 (수철님 명품 시안 100% 철통 보존 🤙) ================= */
const Container = styled(SafeAreaView)` flex: 1; background-color: #F5F5F5; `;
const Header = styled.View` flex-direction: row; justify-content: space-between; align-items: center; padding: 10px 15px; background-color: #fff; border-bottom-width: 1px; border-bottom-color: #EEE; `;
const HeaderSide = styled.View` width: 85px; `; 
const HeaderCenter = styled.View` flex-direction: row; align-items: center; `;
const IconBtn = styled.Image` width: 24px; height: 24px; `;
const EndIcon = styled.Image` width: 28px; height: 28px; `;
const Logo = styled.Image` width: 28px; height: 28px; margin-right: 6px; `;
const HeaderTitle = styled.Text` font-size: 16px; font-weight: 800; `;
const TimerText = styled.Text` font-size: 14px; color: #FF5C00; font-weight: 700; letter-spacing: -0.2px; `;

const ChatArea = styled.View` flex: 1; padding: 20px 15px; `;
const ReceiveBubble = styled.View` flex-direction: row; align-items: flex-end; margin-bottom: 20px; width: 100%; `;
const BubbleTextContainer = styled.View` max-width: 72%; background-color: #fff; border-radius: 18px; border-top-left-radius: 2px; padding: 14px 18px; elevation: 1; shadow-color: #000; shadow-opacity: 0.03; shadow-radius: 3px; `;
const ReceiveBubbleText = styled.Text` font-size: 15px; color: #222; font-weight: 500; line-height: 22px; `;
const BubbleInfoContainer = styled.View` margin-left: 10px; justify-content: flex-end; `;
const BubbleTimeText = styled.Text` font-size: 11px; color: #999; font-weight: 500; `;
const OriginalTextLink = styled.Text` font-size: 11px; color: #999; font-weight: 500; margin-top: 5px; text-decoration-line: underline; `;

const SendBubble = styled.View` flex-direction: row-reverse; align-items: flex-end; margin-bottom: 20px; width: 100%; `;
const SendBubbleText = styled.Text` max-width: 72%; background-color: #06F393; color: white; padding: 14px 18px; border-radius: 18px; border-top-right-radius: 2px; font-size: 16px; font-weight: 600; line-height: 22px; elevation: 1; shadow-color: #000; shadow-opacity: 0.03; shadow-radius: 3px; `;
const SendBubbleInfoContainer = styled.View` margin-right: 10px; `;

const LoadingBubble = styled(ReceiveBubble)` opacity: 0.9; margin-top: 5px; `;

const InputSection = styled.View` background-color: #fff; padding: 15px 15px 30px 15px; border-top-left-radius: 30px; border-top-right-radius: 30px; elevation: 20; shadow-color: #000; shadow-opacity: 0.1; shadow-radius: 10px; `;
const InputBar = styled.View` flex-direction: row; align-items: center; background-color: #F8F9FA; border-radius: 30px; padding: 6px 12px; margin-bottom: 12px; border-width: 1px; border-color: #EAEAEA; `;
const Placeholder = styled.Text` color: #BBB; margin-left: 10px; font-size: 14px; `;

const SelectedTag = styled.View` flex-direction: row; align-items: center; background-color: #FFFFFF; border-width: 1px; border-color: #E2E8F0; padding: 6px 12px; border-radius: 16px; margin-right: 8px; elevation: 1; `;
const TagText = styled.Text` font-size: 13px; color: #333333; font-weight: 600; `;
const SendBtnIcon = styled.Image` width: 38px; height: 38px; margin-left: 5px; `;

const TabContainer = styled.View` flex-direction: row; margin-bottom: 15px; padding-left: 5px; `;
const TabButton = styled.TouchableOpacity` margin-right: 18px; padding-bottom: 4px; border-bottom-width: ${props => props.isActive ? "2px" : "0px"}; border-bottom-color: #333; `;
const TrashTabText = styled.Text` font-size: 15px; font-weight: ${props => props.isActive ? "800" : "500"}; color: ${props => props.isActive ? "#333" : "#AAA"}; `;

const QuickGrid = styled.View` flex-direction: row; flex-wrap: wrap; justify-content: space-between; margin-bottom: 5px; `;
const QuickBtn = styled.TouchableOpacity` width: 48.5%; background-color: #F8F9FA; padding: 14px 10px; border-radius: 15px; align-items: center; margin-bottom: 10px; border-width: 1px; border-color: #F0F1F2; `;
const QuickBtnText = styled.Text` font-size: 15px; color: #444; font-weight: 600; `;
const MemoInput = styled.TextInput` background-color: #F8F9FA; padding: 12px 20px; border-radius: 20px; font-size: 14px; margin-top: 5px; border-width: 1px; border-color: #EAEAEA; `; 

const OverlayBackground = styled.View` flex: 1; background-color: rgba(0, 0, 0, 0.4); justify-content: center; align-items: center; `;
const OverlayImageCard = styled.ImageBackground` width: ${SCREEN_WIDTH * 0.8}px; height: ${(SCREEN_WIDTH * 0.8) * 0.52}px; justify-content: flex-end; padding-bottom: 15px; `;
const TransparentButtonRow = styled.View` flex-direction: row; width: 100%; height: 50px; padding-horizontal: 15px; justify-content: space-between; `;
const TransparentTouchArea = styled.TouchableOpacity` width: 47%; height: 100%; background-color: transparent; `;