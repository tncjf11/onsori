import React, { useState, useEffect } from "react";
import { ScrollView, TouchableOpacity, View, ActivityIndicator } from "react-native";
import styled from "styled-components/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, useIsFocused } from "@react-navigation/native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BASE_URL from "../../api/config";

// ✅ 이미지 에셋
const backIcon = require("../../assets/back_icon.png");
const iconWrench = require("../../assets/icon_wrench.png");

export default function AdminHistoryDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const isFocused = useIsFocused();

  // 🤙 검색 결과(목록)에서 넘겨받은 사용자 정보 및 로그 ID
  const { item } = route.params || {};
  const targetLogId = item?.id || route.params?.logId;

  // 📱 동적 렌더링용 상태창
  const [transcripts, setTranscripts] = useState([]);
  const [editHistory, setEditHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // =========================================================
  // 🔥 [실전 연동] 관리자용 상세 로그 동적 수급 엔진
  // =========================================================
  const fetchHistoryDetail = async () => {
    if (!targetLogId) return;

    try {
      setIsLoading(true);
      const token = await AsyncStorage.getItem("adminToken");
      const response = await axios.get(`${BASE_URL}/api/admin/intercom-logs/${targetLogId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success && response.data.data) {
        const logData = response.data.data;
        const fetchedTranscripts = logData.transcripts || [];
        setTranscripts(fetchedTranscripts);

        // 🧮 수정 이력 필터링: 원본 텍스트(originalText)가 존재하고 현재 텍스트와 다른 경우만 추출
        const historyList = fetchedTranscripts.filter(t => t.originalText && t.originalText !== t.text);
        setEditHistory(historyList);
      }
    } catch (error) {
      console.error("🚨 통화 기록 상세 로드 실패:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      fetchHistoryDetail();
    }
  }, [isFocused, targetLogId]);

  // 🕒 시간 포맷터 (예: 21:22)
  const formatTime = (isoString) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      const isUtc = !isoString.includes("+09") && (isoString.endsWith("Z") || isoString.includes("T"));
      const kstDate = isUtc ? new Date(date.getTime() + 9 * 60 * 60 * 1000) : date;
      return `${String(kstDate.getHours()).padStart(2, '0')}:${String(kstDate.getMinutes()).padStart(2, '0')}`;
    } catch { return ""; }
  };

  // 📅 날짜+시간 포맷터 (예: 2026/05/04 19:20)
  const formatDateTime = (isoString) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      const isUtc = !isoString.includes("+09") && (isoString.endsWith("Z") || isoString.includes("T"));
      const kstDate = isUtc ? new Date(date.getTime() + 9 * 60 * 60 * 1000) : date;
      const yyyy = kstDate.getFullYear();
      const mm = String(kstDate.getMonth() + 1).padStart(2, '0');
      const dd = String(kstDate.getDate()).padStart(2, '0');
      const hh = String(kstDate.getHours()).padStart(2, '0');
      const min = String(kstDate.getMinutes()).padStart(2, '0');
      return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
    } catch { return ""; }
  };

  return (
    <Container>
      {/* 1. 헤더 영역 */}
      <Header>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <BackIcon source={backIcon} resizeMode="contain" />
        </TouchableOpacity>
        <HeaderTitle>{item?.deviceUid || item?.title || "알수없음"}님의 통화 기록</HeaderTitle>
        <View style={{ width: 24 }} />
      </Header>

      {isLoading ? (
        <LoadingWrapper>
          <ActivityIndicator size="large" color="#1EC949" />
        </LoadingWrapper>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          
          {/* 2. 대화 로그 카드 (동적 바인딩) */}
          <ChatCard>
            {transcripts.map((msg, idx) => {
              const isVisitor = msg.sender === "visitor" || msg.type === "incoming";
              const msgTime = formatTime(msg.createdAt || msg.timestamp);

              return (
                <BubbleWrapper key={msg.id || idx} isVisitor={isVisitor}>
                  {!isVisitor && <BubbleTimeRight>{msgTime}</BubbleTimeRight>}
                  <BubbleBox isVisitor={isVisitor}>
                    <BubbleText isVisitor={isVisitor}>{msg.text}</BubbleText>
                  </BubbleBox>
                  {isVisitor && <BubbleTimeLeft>{msgTime}</BubbleTimeLeft>}
                </BubbleWrapper>
              );
            })}
            
            {transcripts.length === 0 && (
              <EmptyText>대화 기록이 없습니다.</EmptyText>
            )}
          </ChatCard>

          {/* 3. 수정 이력 카드 (동적 바인딩) */}
          <HistoryCard>
            <SectionHeader>
              <WrenchIcon source={iconWrench} resizeMode="contain" />
              <SectionTitle>수정 이력</SectionTitle>
            </SectionHeader>

            {editHistory.length > 0 ? (
              editHistory.map((hist, idx) => {
                const isLast = idx === editHistory.length - 1;
                return (
                  <HistoryItem key={hist.id || idx} style={isLast ? { borderBottomWidth: 0, paddingBottom: 0, marginBottom: 0 } : {}}>
                    <HistoryHeader>
                      <HistoryIcon>↪</HistoryIcon>
                      <HistoryMainText numberOfLines={1}>{hist.text}</HistoryMainText>
                      <HistoryTime>{formatDateTime(hist.updatedAt || hist.createdAt)}</HistoryTime>
                    </HistoryHeader>
                    <HistorySubText>{hist.originalText}</HistorySubText>
                  </HistoryItem>
                );
              })
            ) : (
              <EmptyText>수정된 이력이 없습니다.</EmptyText>
            )}
          </HistoryCard>

        </ScrollView>
      )}
    </Container>
  );
}

/* ================= 스타일 정의 (시안 100% 동기화 🤙) ================= */

const Container = styled(SafeAreaView)`
  flex: 1;
  background-color: #F4F5F7; /* 시안 바탕색 */
`;

const Header = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background-color: #F4F5F7;
`;

const BackIcon = styled.Image`
  width: 24px;
  height: 24px;
  tint-color: #333;
`;

const HeaderTitle = styled.Text`
  font-size: 20px;
  font-weight: 800;
  color: #333;
`;

/* 💬 채팅 카드 UI (시안의 회색 둥근 배경) */
const ChatCard = styled.View`
  background-color: #EFEFEF; 
  margin: 15px 20px;
  padding: 25px 20px;
  border-radius: 20px;
`;

const BubbleWrapper = styled.View`
  flex-direction: row;
  justify-content: ${props => props.isVisitor ? 'flex-start' : 'flex-end'};
  align-items: flex-end;
  margin-bottom: 15px;
`;

const BubbleBox = styled.View`
  background-color: ${props => props.isVisitor ? '#FFFFFF' : '#1EC949'};
  padding: 12px 18px;
  border-radius: 20px;
  max-width: 75%;
`;

const BubbleText = styled.Text`
  font-size: 15px;
  font-weight: 500;
  color: ${props => props.isVisitor ? '#333' : '#FFF'};
`;

const BubbleTimeLeft = styled.Text`
  font-size: 12px;
  color: #888;
  margin-left: 8px;
  margin-bottom: 5px;
`;

const BubbleTimeRight = styled.Text`
  font-size: 12px;
  color: #888;
  margin-right: 8px;
  margin-bottom: 5px;
`;

/* 📝 수정 이력 카드 UI (시안의 하얀색 배경) */
const HistoryCard = styled.View`
  background-color: #FFFFFF;
  margin: 10px 20px;
  padding: 20px;
  border-radius: 20px;
  elevation: 2;
  shadow-color: #000;
  shadow-opacity: 0.05;
  shadow-radius: 5px;
`;

const SectionHeader = styled.View`
  flex-direction: row;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom-width: 1px;
  border-bottom-color: #F0F0F0;
`;

const WrenchIcon = styled.Image`
  width: 22px;
  height: 22px;
  margin-right: 10px;
  tint-color: #555;
`;

const SectionTitle = styled.Text`
  font-size: 16px;
  font-weight: 700;
  color: #333;
`;

const HistoryItem = styled.View`
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom-width: 1px;
  border-bottom-color: #F4F5F7;
  border-style: dashed;
`;

const HistoryHeader = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 5px;
`;

const HistoryIcon = styled.Text`
  font-size: 16px;
  color: #666;
  margin-right: 8px;
`;

const HistoryMainText = styled.Text`
  flex: 1;
  font-size: 14px;
  color: #333;
  font-weight: 600;
`;

const HistoryTime = styled.Text`
  font-size: 12px;
  color: #999;
  margin-left: 10px;
`;

const HistorySubText = styled.Text`
  font-size: 13px;
  color: #777;
  margin-left: 24px;
  line-height: 20px;
`;

const LoadingWrapper = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
`;

const EmptyText = styled.Text`
  text-align: center;
  font-size: 14px;
  color: #999;
  padding: 20px 0;
`;