import React, { useState, useEffect, useRef } from "react";
import { ScrollView, TouchableOpacity, View, Modal, Dimensions, Alert, ActivityIndicator, Vibration } from "react-native";
import styled from "styled-components/native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
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

  // 💡 [프론트엔드 단독 해결] 스마트 병합(Smart Merge) 상용구 필터링 엔진
  const getFilteredReplies = (tabName) => {
    const defaultData = {
      "인사": [ { replyCode: 101, text: "안녕하세요" }, { replyCode: 102, text: "어서오세요." }, { replyCode: 103, text: "안녕히가세요." } ],
      "질문": [ { replyCode: 201, text: "누구세요?" }, { replyCode: 202, text: "무슨 일이세요?" }, { replyCode: 203, text: "이유가 무엇인가요?" }, { replyCode: 204, text: "방문 목적이 무엇인가요?" }, { replyCode: 205, text: "필요한 것이 있나요?" }, { replyCode: 206, text: "어느 업체에서 오셨나요?" } ],
      "대답": [ { replyCode: 301, text: "네." }, { replyCode: 302, text: "아니요." }, { replyCode: 303, text: "맞습니다." }, { replyCode: 304, text: "아닙니다." }, { replyCode: 305, text: "알겠습니다." }, { replyCode: 306, text: "대화 어려워요." }, { replyCode: 307, text: "잘못 오셨습니다." }, { replyCode: 308, text: "무슨 말씀인지 안들렸어요." } ],
      "요청": [ { replyCode: 401, text: "용건을 말씀해주세요." }, { replyCode: 402, text: "자세히 말씀해주세요." }, { replyCode: 403, text: "다시 말씀해주세요." }, { replyCode: 404, text: "문 앞에 두고 가세요." }, { replyCode: 405, text: "다시 호출해주세요." }, { replyCode: 406, text: "통화 끊어주세요." }, { replyCode: 407, text: "다음에 방문해주세요." } ],
      "행동": [ { replyCode: 501, text: "지금 나갈게요." }, { replyCode: 502, text: "통화 끊겠습니다." }, { replyCode: 503, text: "문 열어드릴게요." }, { replyCode: 504, text: "나중에 갈게요." } ]
    };

    const defaultTabReplies = defaultData[tabName] || [];

    if (backendQuickReplies && backendQuickReplies.length > 0) {
      return defaultTabReplies.map(defaultItem => {
        const matchedBackendItem = backendQuickReplies.find(
          backendItem => {
            const backendText = (backendItem.text || backendItem.content || backendItem.message || "").trim();
            return backendText === defaultItem.text.trim();
          }
        );

        return {
          ...defaultItem,
          replyCode: matchedBackendItem ? (matchedBackendItem.replyCode || matchedBackendItem.id) : defaultItem.replyCode
        };
      });
    }

    return defaultTabReplies;
  };

  // ⏱️ [타이머 복구 로직] 나갔다 들어와도 시간 유지
  useEffect(() => {
    const restoreTimer = async () => {
      const startTime = await AsyncStorage.getItem("callStartTime");
      if (startTime) {
        const elapsed = Math.floor((Date.now() - parseInt(startTime)) / 1000);
        setSeconds(elapsed >= 0 ? elapsed : 0);
      } else {
        await AsyncStorage.setItem("callStartTime", Date.now().toString());
      }
    };
    restoreTimer();

    const timer = setInterval(() => { setSeconds((prev) => prev + 1); }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  useEffect(() => {
    const initializeChatRoom = async () => {
      try {
        setIsLoading(true);
        const savedToken = await AsyncStorage.getItem("accessToken");
        const activeToken = savedToken || routeToken;
        setToken(activeToken);

        const repliesRes = await axios.get(`${BASE_URL}/api/quick-replies`);
        if (repliesRes.data.success && repliesRes.data.data) {
          setBackendQuickReplies(repliesRes.data.data);
        }

        const now = new Date();
        const liveTimeStr = `${now.getHours()}:${now.getMinutes() < 10 ? "0" : ""}${now.getMinutes()}`;

        if (sessionId) {
          setCurrentSessionId(sessionId);
          setMessages([{ id: 'init', text: "호출벨이 울렸습니다.", type: "receive", time: liveTimeStr }]);
          connectWebSocket(sessionId);
        } else {
          const response = await axios.post(`${BASE_URL}/api/sessions/start`, { deviceUid: "DEVICE-001" });
          if (response.data.success && response.data.data) {
            const serverSessionId = response.data.data.sessionId;
            setCurrentSessionId(serverSessionId);
            await axios.post(`${BASE_URL}/api/sessions/${serverSessionId}/connect`);
            setMessages([{ id: 'init', text: "호출벨이 울렸습니다.", type: "receive", time: liveTimeStr }]);
            connectWebSocket(serverSessionId);
          }
        }
      } catch (error) { setCurrentSessionId(6); } finally { setIsLoading(false); }
    };
    initializeChatRoom();
    return () => { if (stompClientRef.current) stompClientRef.current.deactivate(); };
  }, [sessionId]);

  const connectWebSocket = (targetId) => {
    const socket = new SockJS(`${BASE_URL}/ws`);
    const client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/sessions/${targetId}/transcripts`, async (message) => {
          try {
            setIsTyping(true);
            const parsedData = JSON.parse(message.body);
            const now = new Date();
            const timeStr = `${now.getHours()}:${now.getMinutes() < 10 ? "0" : ""}${now.getMinutes()}`;
            const receivedText = parsedData.rawText || parsedData.text || parsedData.message || parsedData.partialText || "자막 없음";
            
            setTimeout(() => {
                setMessages((prev) => [...prev, { id: `ws-${Date.now()}`, text: receivedText, type: "receive", time: timeStr }]);
                setIsTyping(false);
            }, 800);

            const subtitleVibSetting = await AsyncStorage.getItem("subtitleVibrate");
            if (subtitleVibSetting === "true") Vibration.vibrate(400); 
          } catch (error) { console.error(error); }
        });
      },
    });
    client.activate();
    stompClientRef.current = client;
  };

  // =========================================================
  // 🔥 [긴급 타겟 1번 완료] 명세서 6-2 & 9-2 완벽 동기화 엔진
  // =========================================================
  const confirmEndCall = async () => {
    setIsOverlayVisible(false);
    
    // 🧹 [종료 시 타이머 초기화]
    await AsyncStorage.removeItem("callStartTime"); 
    
    const activeSessionId = currentSessionId || 6;
    const activeToken = token || (await AsyncStorage.getItem("accessToken"));

    try {
      // 🚀 1단계: 명세서 [6-2] 세션 종료 API 호출 (방부터 닫기!)
      await axios.post(`${BASE_URL}/api/sessions/end`, {
        sessionId: activeSessionId
      }, {
        headers: { 
          Authorization: `Bearer ${activeToken}`,
          "Content-Type": "application/json"
        }
      });
      console.log("✅ [1/2] 백엔드 세션 종료 (CLOSED) 완료");

      // 🚀 2단계: 명세서 [9-2] 최종 자막 생성 API 호출 (AI 후처리 가동!)
      // *주의: 최신 명세서상 Body(summary, memo 등) 없이 빈 깡통으로 보냅니다.
      const finalizeResponse = await axios.post(`${BASE_URL}/api/sessions/${activeSessionId}/finalize`, {}, {
        headers: { 
          Authorization: `Bearer ${activeToken}`,
          "Content-Type": "application/json"
        }
      });
      
      if (finalizeResponse.data.success) {
        const { refinedText, status } = finalizeResponse.data.data;
        console.log(`✅ [2/2] 최종 자막 생성 완료! 상태: ${status} / 요약: ${refinedText}`);
      }

    } catch (error) { 
      const serverError = error.response?.data?.message || JSON.stringify(error.response?.data) || error.message;
      console.log("🚨 저장 에러 발생 상세 사유:", serverError); 
      // 앱이 튕기지 않게 콘솔로만 에러를 잡아먹습니다.
    } finally {
      // 🚀 핵심: 에러가 나든 성공하든 앱 다운 방지를 위해 무조건 히스토리로 넘어갑니다.
      const parentNav = navigation.getParent() || navigation;
      parentNav.setParams({ intercomStatus: 'idle' });
      navigation.reset({
        index: 0,
        routes: [ { name: "MainTab", params: { screen: "히스토리", refresh: Date.now() } } ],
      });
    }
  };

  const handleSelectTag = (item) => {
    if (!selectedTags.some(tag => tag.replyCode === item.replyCode)) setSelectedTags([...selectedTags, item]);
  };
  const removeTag = (index) => {
    setSelectedTags(selectedTags.filter((_, i) => i !== index));
  };
  
  // 🚀 [시연용 무적 방어막] 백엔드가 거절해도 화면에 내 대답은 무조건 그려버립니다!
  const handleSendResponse = async () => {
    if (selectedTags.length === 0) return;
    
    const activeToken = token || (await AsyncStorage.getItem("accessToken"));
    const targetSessionId = currentSessionId || 6;
    
    // 1️⃣ 서버 통신 기다리지 않고 화면에 내 말풍선부터 띄움 (Optimistic UI)
    const now = new Date();
    const newMessageText = selectedTags.map(tag => tag.text).join(" ");
    setMessages((prev) => [...prev, { id: `my-${Date.now()}`, text: newMessageText, type: "send", time: `${now.getHours()}:${now.getMinutes()}` }]);
    setSelectedTags([]); 

    // 2️⃣ 그 뒤에 서버로 전송 시도
    try {
      await axios.post(`${BASE_URL}/api/sessions/${targetSessionId}/reply`, 
        { replyCode: selectedTags[0].replyCode },
        { 
          headers: { 
            Authorization: `Bearer ${activeToken}`,
            "Content-Type": "application/json"
          } 
        }
      );
    } catch (error) { 
      const serverError = error.response?.data?.message || JSON.stringify(error.response?.data) || error.message;
      console.log("전송 에러 상세 사유:", serverError);
      Alert.alert("전송 에러 (디버깅)", `서버 거절 사유: ${serverError}`); 
    } 
  };

  return (
    <Container>
      <Header>
        <HeaderSide><TouchableOpacity onPress={() => navigation.goBack()}><IconBtn source={backIcon} resizeMode="contain" /></TouchableOpacity></HeaderSide>
        <HeaderSide style={{ width: 120 }}><HeaderCenter><Logo source={bellIcon} resizeMode="contain" /><HeaderTitle>인터폰 실시간</HeaderTitle></HeaderCenter></HeaderSide>
        <HeaderSide style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
          <TimerText>{formatTimer(seconds)}</TimerText>
          <TouchableOpacity onPress={() => setIsOverlayVisible(true)} style={{ marginLeft: 10 }}><EndIcon source={callEndIcon} resizeMode="contain" /></TouchableOpacity>
        </HeaderSide>
      </Header>
      <ChatArea>
        {isLoading ? <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}><ActivityIndicator size="large" color="#06F393" /></View> :
          <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false} onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}>
            {messages.map((msg) => (
              msg.type === "receive" ? (
                <ReceiveBubble key={msg.id}><BubbleTextContainer><ReceiveBubbleText>{msg.text}</ReceiveBubbleText></BubbleTextContainer></ReceiveBubble>
              ) : (
                <SendBubble key={msg.id}><SendBubbleText>{msg.text}</SendBubbleText></SendBubble>
              )
            ))}
            {isTyping && (
              <ReceiveBubble>
                <BubbleTextContainer style={{ backgroundColor: '#F0F0F0' }}>
                  <ReceiveBubbleText style={{ color: '#888', fontStyle: 'italic' }}>실시간 자막 변환 중...</ReceiveBubbleText>
                </BubbleTextContainer>
              </ReceiveBubble>
            )}
          </ScrollView>}
      </ChatArea>
      <InputSection>
        <InputBar>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
            {selectedTags.map((item, index) => (
              <SelectedTag key={index}><TagText>{item.text}</TagText><TouchableOpacity onPress={() => removeTag(index)}><Ionicons name="close-circle" size={16} color="#FF4D4D" /></TouchableOpacity></SelectedTag>
            ))}
          </ScrollView>
          <TouchableOpacity onPress={handleSendResponse}><SendBtnIcon source={selectedTags.length > 0 ? sendActive : sendInactive} /></TouchableOpacity>
        </InputBar>
        <TabContainer>
          {tabs.map((tab) => <TabButton key={tab} isActive={activeTab === tab} onPress={() => setActiveTab(tab)}><TrashTabText isActive={activeTab === tab}>{tab}</TrashTabText></TabButton>)}
        </TabContainer>
        <QuickGrid>
          {getFilteredReplies(activeTab).map((item, idx) => <QuickBtn key={idx} onPress={() => handleSelectTag(item)}><QuickBtnText>{item.text}</QuickBtnText></QuickBtn>)}
        </QuickGrid>
        
        {/* API 전송에서는 제외되었지만, 디자인 유지를 위해 남겨둔 메모 입력칸 */}
        <MemoInput placeholder="통화 메모" value={memoText} onChangeText={setMemoText} />
      </InputSection>
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
const BubbleTextContainer = styled.View` max-width: 72%; background-color: #fff; border-radius: 18px; padding: 14px 18px; elevation: 1; shadow-color: #000; shadow-opacity: 0.03; shadow-radius: 3px; `;
const ReceiveBubbleText = styled.Text` font-size: 15px; color: #222; font-weight: 500; `;
const SendBubble = styled.View` flex-direction: row-reverse; align-items: flex-end; margin-bottom: 20px; width: 100%; `;
const SendBubbleText = styled.Text` max-width: 72%; background-color: #06F393; color: white; padding: 14px 18px; border-radius: 18px; font-size: 16px; font-weight: 600; elevation: 1; shadow-color: #000; shadow-opacity: 0.03; shadow-radius: 3px; `;
const InputSection = styled.View` background-color: #fff; padding: 15px 15px 30px 15px; border-top-left-radius: 30px; border-top-right-radius: 30px; elevation: 20; shadow-color: #000; shadow-opacity: 0.1; shadow-radius: 10px; `;
const InputBar = styled.View` flex-direction: row; align-items: center; background-color: #F8F9FA; border-radius: 30px; padding: 6px 12px; margin-bottom: 12px; border-width: 1px; border-color: #EAEAEA; `;
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