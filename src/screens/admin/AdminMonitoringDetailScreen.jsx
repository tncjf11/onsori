import React, { useState, useEffect } from "react";
import { ScrollView, TouchableOpacity, View, TextInput, ActivityIndicator, Alert } from "react-native";
import styled from "styled-components/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, useIsFocused } from "@react-navigation/native";
import axios from "axios";

// 📥 관리자 마스터 키 수급을 위한 비밀금고 부품 임포트!
import AsyncStorage from "@react-native-async-storage/async-storage";

// 🌐 config.js의 배포 주소
import BASE_URL from "../../api/config";

// ✅ 이미지 에셋
const backIcon = require("../../assets/back_icon.png");
const pencilIcon = require("../../assets/pencil_icon.png");

export default function AdminMonitoringDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const isFocused = useIsFocused(); // 📱 자막 수정 후 라이브 리프레시 센서

  // 📥 상위 모니터링 관제탑 목록에서 넘겨받은 고유 식별자 가방 열기
  const { logId, sessionId, item: passedItem } = route.params || {};
  const targetLogId = logId || passedItem?.id;

  // 📱 라이브 대화 내용 및 교정 상태 관리창
  const [chatMessages, setChatMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentStt, setCurrentStt] = useState(""); // 하단 인풋 입력창 상태
  const [selectedTranscriptId, setSelectedTranscriptId] = useState(null); // 교정 타겟 자막 번호 고정자

  // =========================================================
  // 📡 [재호 찐 컨트롤러] 실시간 통화 자막 아카이브 긁어오기 엔진
  // =========================================================
  const fetchLiveChatLogs = async (isSilent = false) => {
    if (!targetLogId) {
      console.log("⚠️ logId 정보가 유실되어 안전 상태로 대기합니다.");
      setIsLoading(false);
      return;
    }

    try {
      if (!isSilent) setIsLoading(true);
      const token = await AsyncStorage.getItem("adminToken");

      // 🎯 해당 로그의 실시간 자막 리스트 수급 무전 송신!
      const response = await axios.get(`${BASE_URL}/api/admin/intercom-logs/${targetLogId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success && response.data.data) {
        const sData = response.data.data;
        const rawList = sData.transcripts || sData.messages || sData.chatList || [];
        setChatMessages(rawList);

        // 💡 [바로 수정 편의 핏 UI 가이드] 
        // 마지막으로 들어온 방문자의 자막이 있다면 하단 교정 입력창에 미리 자석처럼 셋팅해 줍니다!
        const visitorMsgs = rawList.filter(m => m.sender === "visitor" || m.type === "incoming");
        if (visitorMsgs.length > 0 && !currentStt) {
          const lastVisitorMsg = visitorMsgs[visitorMsgs.length - 1];
          setCurrentStt(lastVisitorMsg.text || lastVisitorMsg.message || "");
          setSelectedTranscriptId(lastVisitorMsg.id || lastVisitorMsg.transcriptId); // 자막 ID 확보!
        }
      }
    } catch (error) {
      console.error("🚨 [관제 상세방 로드 실패]:", error.message);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  // 실시간 렌더링 동기화 벨트 가동
  useEffect(() => {
    if (isFocused) {
      fetchLiveChatLogs(false);
    }
  }, [isFocused, targetLogId]);

  // =========================================================
  // ✏️ [🚨 재호 찐 자막 컨트롤러 연동] 원격 실시간 자막 교정 엔진 발포!
  // =========================================================
  const handleUpdateTranscript = async () => {
    if (!currentStt.trim()) {
      Alert.alert("입력 공백", "수정할 자막 내용을 입력해 주셔요! 🤙");
      return;
    }

    if (!selectedTranscriptId) {
      Alert.alert("타겟 누락", "교정할 방문인의 실시간 자막 대화가 선택되지 않았쇼.");
      return;
    }

    try {
      console.log(`🛰️ [원격 자막 교정 발포] transcriptId: ${selectedTranscriptId}`);
      const token = await AsyncStorage.getItem("adminToken");

      // 🎯 [명세서 찐 연동] PATCH /api/admin/transcripts/{transcriptId} 완착 타격!
      // TranscriptUpdateRequest 규격(text 또는 content) 명찰 그물망 매선 패킹!
      const response = await axios.patch(
        `${BASE_URL}/api/admin/transcripts/${selectedTranscriptId}`,
        { 
          text: currentStt.trim(),
          content: currentStt.trim()
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        Alert.alert("교정 완료", "오인식된 실시간 자막이 정상적으로 원격 수정되었쇼! 뽈칵! 🤙", [
          {
            text: "확인",
            onPress: () => {
              fetchLiveChatLogs(true); // 관제 대화방 리스트 최신본 재스캔 리프레시!
            }
          }
        ]);
      }
    } catch (error) {
      console.error("🚨 [원격 자막 수정 실패]:", error.message);
      Alert.alert("오류", "백엔드 전산실 자막 수정 패치 도중 찐빠가 발생했쇼.");
    }
  };

  // 🕒 시간 도장 포맷 유틸
  const formatTime = (timeStr) => {
    if (!timeStr) return "00:00";
    try {
      const date = new Date(timeStr);
      return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
    } catch {
      return timeStr;
    }
  };

  return (
    <Container>
      {/* 1. 헤더 영역 */}
      <Header>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <BackIcon source={backIcon} resizeMode="contain" />
        </TouchableOpacity>
        <HeaderTitle>{passedItem?.deviceUid || "라이브 인터폰"} 관제탑</HeaderTitle>
        <View style={{ width: 24 }} />
      </Header>

      {/* 2. 실시간 채팅 모니터링 영역 (백엔드 찐 트래픽 결합형 동적 렌더링!) */}
      {isLoading ? (
        <LoadingWrapper>
          <ActivityIndicator size="large" color="#06F393" />
          <LoadingText>라이브 자막 오디오 데이터 동기화 중...</LoadingText>
        </LoadingWrapper>
      ) : (
        <ChatArea>
          <ScrollView showsVerticalScrollIndicator={false}>
            {chatMessages.length > 0 ? (
              chatMessages.map((msg, idx) => {
                const isVisitor = msg.sender === "visitor" || msg.role === "visitor" || msg.type === "incoming";
                
                return isVisitor ? (
                  /* 방문인의 말풍선 ➔ 관리자가 터치하면 하단 바로 수정 타겟으로 뽈칵 꽂힘! */
                  <TouchableOpacity 
                    key={msg.id || idx} 
                    activeOpacity={0.7}
                    onPress={() => {
                      setCurrentStt(msg.text || msg.message || "");
                      setSelectedTranscriptId(msg.id || msg.transcriptId);
                    }}
                  >
                    <ReceiveBubble style={{ borderColor: selectedTranscriptId === (msg.id || msg.transcriptId) ? "#06F393" : "transparent", borderWidth: 1, borderRadius: 15, padding: 2 }}>
                      <BubbleText>{msg.text || msg.message || msg.content || "자막 변환 오류"}</BubbleText>
                      <BubbleTime>{formatTime(msg.createdAt || msg.time)}</BubbleTime>
                    </ReceiveBubble>
                  </TouchableOpacity>
                ) : (
                  /* 거주민 수철님이 날린 상용구 답변 말풍선 */
                  <SendBubble key={msg.id || idx}>
                    <BubbleTime>{formatTime(msg.createdAt || msg.time)}</BubbleTime>
                    <BubbleText style={{ color: "#fff", backgroundColor: "#06F393" }}>
                      {msg.text || msg.message || msg.content}
                    </BubbleText>
                  </SendBubble>
                );
              })
            ) : (
              <EmptyWrapper>
                <Ionicons name="chatbubbles-outline" size={36} color="#AAA" />
                <LoadingText style={{ color: "#AAA" }}>현재 오고 간 대화 자막이 없쇼.</LoadingText>
              </EmptyWrapper>
            )}

            {/* 🤙 실시간 자막 변환 중인 느낌의 안내 가드 블록 */}
            <ReceiveBubble style={{ marginTop: 10 }}>
              <BubbleText style={{ color: "#AAA", fontStyle: 'italic', backgroundColor: "transparent", elevation: 0, shadowOpacity: 0 }}>
                🛰️ 실시간 오디오 스트리밍 변환 트래픽 가동 중...
              </BubbleText>
            </ReceiveBubble>
          </ScrollView>
        </ChatArea>
      )}

      {/* 3. 하단 바로 수정 (Quick Edit) 영역 완착! 🤙 */}
      <QuickEditCard>
        <EditHeader>
          <EditTitle>오타 자막 원격 바로 수정</EditTitle>
          <TouchableOpacity onPress={() => navigation.navigate("AdminHistory")}>
            <DetailLinkText>로그 전체이력</DetailLinkText>
          </TouchableOpacity>
        </EditHeader>

        <EditInputRow>
          <EditInput 
            value={currentStt}
            onChangeText={setCurrentStt}
            placeholder={selectedTranscriptId ? "교정할 자막 내용을 입력하셔요" : "위 방문자 말풍선을 먼저 선택하셔요 🤙"}
            editable={selectedTranscriptId !== null}
          />
          <TouchableOpacity onPress={handleUpdateTranscript} disabled={!selectedTranscriptId}>
            <EditIcon source={pencilIcon} resizeMode="contain" style={{ tintColor: selectedTranscriptId ? "#06F393" : "#BBB" }} />
          </TouchableOpacity>
        </EditInputRow>
      </QuickEditCard>
    </Container>
  );
}

/* ================= 스타일 정의 (수철님 명품 시안 컴포넌트 100% 철통 보존 🤙) ================= */
const Container = styled(SafeAreaView)` flex: 1; background-color: #F8F9FA; `;
const Header = styled.View` flex-direction: row; justify-content: space-between; align-items: center; padding: 15px 20px; background-color: #fff; border-bottom-width: 1px; border-bottom-color: #F0F0F0; `;
const BackIcon = styled.Image` width: 24px; height: 24px; `;
const HeaderTitle = styled.Text` font-size: 18px; font-weight: 800; color: #333; `;

const ChatArea = styled.View` flex: 1; background-color: #F2F3F5; margin: 15px; padding: 15px; border-radius: 25px; `;
const ReceiveBubble = styled.View` flex-direction: row; align-items: flex-end; margin-bottom: 15px; `;
const SendBubble = styled.View` flex-direction: row; justify-content: flex-end; align-items: flex-end; margin-bottom: 15px; `;
const BubbleText = styled.Text` background-color: #fff; padding: 12px 18px; border-radius: 20px; font-size: 14px; max-width: 75%; elevation: 1; shadow-color: #000; shadow-opacity: 0.05; shadow-radius: 5px; color: #333; font-weight: 500; `;
const BubbleTime = styled.Text` font-size: 11px; color: #999; margin: 0 8px; `;

const QuickEditCard = styled.View` background-color: #fff; margin: 0 15px 20px; padding: 20px; border-radius: 20px; elevation: 5; shadow-color: #000; shadow-opacity: 0.1; shadow-radius: 10px; border-width: 1.5px; border-color: #06F393; `;
const EditHeader = styled.View` flex-direction: row; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom-width: 1px; border-bottom-color: #F0F0F0; `;
const EditTitle = styled.Text` font-size: 14px; font-weight: 800; color: #333; `;
const DetailLinkText = styled.Text` font-size: 13px; color: #BBB; font-weight: 600; text-decoration-line: underline; `;
const EditInputRow = styled.View` flex-direction: row; align-items: center; background-color: #F8F9FA; padding: 10px 15px; border-radius: 12px; `;
const EditInput = styled.TextInput` flex: 1; font-size: 14px; color: #333; padding: 0; font-weight: 600; `;
const EditIcon = styled.Image` width: 22px; height: 22px; `;

const LoadingWrapper = styled.View` flex: 1; justify-content: center; align-items: center; padding-top: 100px; `;
const LoadingText = styled.Text` font-size: 13px; color: #718096; font-weight: 600; margin-top: 12px; `;
const EmptyWrapper = styled.View` flex: 1; padding: 60px 20px; justify-content: center; align-items: center; `;