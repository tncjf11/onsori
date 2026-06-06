import React, { useState, useEffect } from "react";
import { ScrollView, TouchableOpacity, View, ActivityIndicator, Alert, TextInput } from "react-native";
import styled from "styled-components/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, useIsFocused } from "@react-navigation/native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BASE_URL from "../../api/config";

const backIcon = require("../../assets/back_icon.png");
const pencilIcon = require("../../assets/pencil_icon.png");

export default function AdminMonitoringDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const isFocused = useIsFocused();

  // 🤙 파라미터 유연성 확보: sessionId, logId, 혹은 객체 내부의 id 등 
  const { sessionId, logId, item: passedItem } = route.params || {};
  const targetSessionId = sessionId || passedItem?.sessionId || passedItem?.id || logId;

  const [chatMessages, setChatMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentStt, setCurrentStt] = useState("");
  const [selectedTranscriptId, setSelectedTranscriptId] = useState(null);

  // =========================================================
  // 🔥 [명세서 13-2] 활성 세션 상세 조회 API 완벽 동기화
  // =========================================================
  const fetchLiveChatLogs = async (isSilent = false) => {
    if (!targetSessionId) return;
    try {
      if (!isSilent) setIsLoading(true);
      const token = await AsyncStorage.getItem("adminToken");
      
      // 🚀 엔드포인트 수정: /api/admin/monitoring/{sessionId}
      const response = await axios.get(`${BASE_URL}/api/admin/monitoring/${targetSessionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success && response.data.data) {
        setChatMessages(response.data.data.transcripts || []);
      }
    } catch (error) {
      console.error("🚨 관제 상세 로드 실패:", error.message);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  useEffect(() => { if (isFocused) fetchLiveChatLogs(false); }, [isFocused, targetSessionId]);

  // =========================================================
  // 🔥 [명세서 10-1] 관리자 자막 수정 API 연동
  // =========================================================
  const handleUpdateTranscript = async () => {
    if (!currentStt.trim() || !selectedTranscriptId) return;
    try {
      const token = await AsyncStorage.getItem("adminToken");
      
      // 🚀 PATCH /api/admin/transcripts/{transcriptId}
      await axios.patch(`${BASE_URL}/api/admin/transcripts/${selectedTranscriptId}`, 
        { text: currentStt.trim() }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert("성공", "교정 반영 완료.");
      
      // 수정 완료 후 자막 리스트 조용히 새로고침
      fetchLiveChatLogs(true);
    } catch (error) { 
      Alert.alert("오류", "수정 실패. 서버 응답을 확인해주세요."); 
    }
  };

  // 🕒 시간 추출 유틸 (시안용 21:22 포맷)
  const formatMessageTime = (isoString) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      const isUtc = !isoString.includes("+09") && (isoString.endsWith("Z") || isoString.includes("T"));
      const kstDate = isUtc ? new Date(date.getTime() + 9 * 60 * 60 * 1000) : date;
      return `${String(kstDate.getHours()).padStart(2, '0')}:${String(kstDate.getMinutes()).padStart(2, '0')}`;
    } catch { return ""; }
  };

  return (
    <Container>
      {/* 1. 헤더 (시안 반영: OOO님의 통화) */}
      <Header>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <BackIcon source={backIcon} />
        </TouchableOpacity>
        <HeaderTitle>{passedItem?.deviceUid || "user998"}님의 통화</HeaderTitle>
        <View style={{ width: 24 }} />
      </Header>

      {isLoading ? (
        <LoadingWrapper><ActivityIndicator size="large" color="#1EC949" /></LoadingWrapper>
      ) : (
        <ContentWrapper>
          {/* 2. 하얀색 둥근 채팅 컨테이너 (시안 100% 반영) */}
          <ChatContainer>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
              {chatMessages.map((msg, idx) => {
                // 실시간 STT는 기본적으로 방문자(incoming)로 간주
                const isVisitor = msg.sender === "visitor" || msg.type === "incoming" || !msg.sender;
                
                // 🚀 핵심 수정: 명세서 13-2에 따라 자막 ID는 msg.transcriptId 입니다!
                const currentId = msg.transcriptId || msg.id; 
                const isSelected = selectedTranscriptId === currentId;
                const msgTime = formatMessageTime(msg.createdAt || msg.timestamp);

                return (
                  <TouchableOpacity key={currentId || idx} activeOpacity={0.8} onPress={() => {
                    setCurrentStt(msg.text);
                    setSelectedTranscriptId(currentId);
                  }}>
                    {/* 3. 말풍선 + 시간 배치 (시안 100% 반영) */}
                    <BubbleWrapper isVisitor={isVisitor}>
                      {!isVisitor && <TimeTextRight>{msgTime}</TimeTextRight>}
                      
                      <BubbleBox isVisitor={isVisitor} isSelected={isSelected}>
                        <BubbleText isVisitor={isVisitor}>{msg.text}</BubbleText>
                      </BubbleBox>
                      
                      {isVisitor && <TimeTextLeft>{msgTime}</TimeTextLeft>}
                    </BubbleWrapper>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </ChatContainer>
        </ContentWrapper>
      )}

      {/* 4. 하단 바로 수정 카드 (시안 100% 반영) */}
      <QuickEditCard>
        <EditHeader>
          <EditTitle>바로 수정</EditTitle>
          <TouchableOpacity onPress={() => navigation.navigate("AdminMessageEdit", { 
            transcriptId: selectedTranscriptId, 
            item: { id: selectedTranscriptId, text: currentStt } 
          })}>
            <DetailLinkText>정보</DetailLinkText>
          </TouchableOpacity>
        </EditHeader>
        
        <Divider />

        <EditInputRow>
          <EditInput 
            value={currentStt} 
            onChangeText={setCurrentStt} 
            placeholder="수정할 자막을 선택하세요" 
            placeholderTextColor="#BBB"
          />
          <TouchableOpacity onPress={handleUpdateTranscript}>
            <EditIcon source={pencilIcon} style={{ tintColor: selectedTranscriptId ? "#444" : "#BBB" }} />
          </TouchableOpacity>
        </EditInputRow>
      </QuickEditCard>
    </Container>
  );
}

/* ================= 스타일 정의 (시안 100% 반영) ================= */
const Container = styled(SafeAreaView)` flex: 1; background-color: #F4F5F7; `;
const Header = styled.View` flex-direction: row; justify-content: space-between; align-items: center; padding: 15px 20px; background-color: #F4F5F7; `;
const BackIcon = styled.Image` width: 24px; height: 24px; tint-color: #333; `;
const HeaderTitle = styled.Text` font-size: 20px; font-weight: 800; color: #333; `;

const ContentWrapper = styled.View` flex: 1; padding: 0 15px; margin-top: 10px; `;

/* 💬 둥근 하얀색 채팅 컨테이너 */
const ChatContainer = styled.View` flex: 1; background-color: #fff; border-radius: 20px; overflow: hidden; `;

const BubbleWrapper = styled.View` flex-direction: row; justify-content: ${props => props.isVisitor ? 'flex-start' : 'flex-end'}; align-items: flex-end; margin-bottom: 15px; `;

const BubbleBox = styled.View` 
  background-color: ${props => props.isVisitor ? '#fff' : '#1EC949'};
  border: ${props => props.isVisitor ? '1px solid #EAEAEA' : 'none'};
  border-color: ${props => props.isSelected && props.isVisitor ? '#1EC949' : (props.isVisitor ? '#EAEAEA' : 'transparent')};
  border-width: ${props => props.isSelected ? '2px' : (props.isVisitor ? '1px' : '0px')};
  border-radius: 20px;
  padding: 12px 18px;
  max-width: 75%;
  elevation: ${props => props.isVisitor ? '1' : '0'};
  shadow-color: #000;
  shadow-opacity: 0.05;
  shadow-radius: 3px;
`;

const BubbleText = styled.Text` color: ${props => props.isVisitor ? '#333' : '#fff'}; font-size: 15px; font-weight: 500; `;

const TimeTextLeft = styled.Text` font-size: 12px; color: #999; margin-left: 8px; margin-bottom: 5px; `;
const TimeTextRight = styled.Text` font-size: 12px; color: #999; margin-right: 8px; margin-bottom: 5px; `;

/* 📝 하단 바로 수정 카드 */
const QuickEditCard = styled.View` background-color: #fff; margin: 15px; padding: 20px; border-radius: 20px; elevation: 3; shadow-color: #000; shadow-opacity: 0.05; shadow-radius: 5px; `;
const EditHeader = styled.View` flex-direction: row; justify-content: space-between; align-items: center; margin-bottom: 12px; `;
const EditTitle = styled.Text` font-size: 16px; font-weight: 800; color: #333; `;
const DetailLinkText = styled.Text` font-size: 14px; color: #999; font-weight: 500; `;

const Divider = styled.View` height: 1px; background-color: #F0F0F0; margin-bottom: 12px; `;

const EditInputRow = styled.View` flex-direction: row; align-items: center; justify-content: space-between; `;
const EditInput = styled.TextInput` flex: 1; font-size: 15px; color: #333; padding: 0; font-weight: 500; `;
const EditIcon = styled.Image` width: 22px; height: 22px; margin-left: 10px; `;

const LoadingWrapper = styled.View` flex: 1; justify-content: center; align-items: center; `;