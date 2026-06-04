import React, { useState, useEffect } from "react";
import { ScrollView, TouchableOpacity, View, ActivityIndicator, Alert } from "react-native";
import styled from "styled-components/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons"; 
import axios from "axios";

// 📥 기기 저장소 비밀금고 부품 임포트!
import AsyncStorage from "@react-native-async-storage/async-storage";

// 🌐 config.js의 배포 주소
import BASE_URL from "../../api/config";

// ✅ 공용 리스트 부품 임포트!
import RecentCallItem from "../../components/RecentCallItem";

// ✅ 이미지 에셋 (철통 보존 🤙)
const backIcon = require("../../assets/back_icon.png");
const bellIcon = require("../../assets/bell.png");

export default function EndScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  
  // 📥 기록의 고유 번호(logId) 타겟팅 추출!
  const incomingItem = route.params?.item || {};
  const logId = route.params?.logId || incomingItem.id;

  // 📱 상태 관리 및 로딩 장치
  const [detailData, setDetailData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // =========================================================
  // 🔥 [대통합 개편] AsyncStorage 기반 상세 조회 및 카톡방 배열 복원 메커니즘 🚀
  // =========================================================
  useEffect(() => {
    const fetchLogDetail = async () => {
      if (!logId) {
        console.log("⚠️ logId가 전달되지 않아 공백 화면으로 안전 대기합니다.");
        setDetailData(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        console.log("▶️ [상세방 내부 요격] AsyncStorage에서 직접 마스터 신분증 로드... 🔑");
        const savedToken = await AsyncStorage.getItem("accessToken");

        if (!savedToken) {
          console.log("❌ 상세방 가드 발동 ➔ 기기 내부에 유효한 토큰이 잡히지 않습니다.");
          setDetailData(null);
          setIsLoading(false);
          return;
        }

        console.log(`▶️ [명세서 8-2 라이브 슛] 금고 토큰 탑재 후 상세 정보 파싱 시작... logId: ${logId}`);
        
        const response = await axios.get(`${BASE_URL}/api/intercom-logs/${logId}`, {
          headers: { Authorization: `Bearer ${savedToken}` }
        });
        
        console.log("▶️ [명세서 8-2 응답 수신] 실전 데이터 바인딩 가동 👇");

        if (response.data.success && response.data.data) {
          const sData = response.data.data;
          
          const parsedMessages = [];
          // 🎯 [1번 버그 완파] 유저 라인의 찐 자막 배열창 규격인 chatList 경로를 전면 동기화 정착했습니다.
          const rawTranscripts = sData.chatList || sData.transcripts || sData.messages || [];

          if (rawTranscripts && rawTranscripts.length > 0) {
            rawTranscripts.forEach((msg, idx) => {
              // 백엔드 명세 DTO 필드명인 senderType 혹은 sender 기반 분기 필터링 적용
              const isVisitor = msg.senderType === "VISITOR" || msg.sender === "visitor" || msg.role === "visitor" || msg.type === "incoming";
              
              parsedMessages.push({
                id: msg.id || `msg-${idx}-${Date.now()}`,
                // 변환 도중 깡통 텍스트가 오는 현상을 방지하는 다중 대체 명찰 파싱
                text: msg.messageText || msg.text || msg.message || msg.content || "호출 신호 감지",
                type: isVisitor ? "receive" : "send",
                time: formatBubbleTime(msg.createdAt || msg.time || sData.createdAt)
              });
            });
          } else {
            // 폴백 단문 바인딩 처리
            if (sData.visitorText && sData.visitorText.trim() !== "") {
              parsedMessages.push({
                id: `rec-fallback-${Date.now()}`,
                text: sData.visitorText,
                type: "receive",
                time: formatBubbleTime(sData.createdAt)
              });
            }
            if (sData.residentReply && sData.residentReply.trim() !== "") {
              parsedMessages.push({
                id: `send-fallback-${Date.now()}`,
                text: sData.residentReply,
                type: "send",
                time: formatBubbleTime(sData.createdAt)
              });
            }
          }
          
          // 🎯 [3번 버그 완파] 타이틀 오염 상태 우회 디폴트 마감
          const refinedSummary = sData.summary && sData.summary.trim() !== "내용 없음" ? sData.summary.trim() : "인터폰 호출 알림";

          setDetailData({
            time: formatFormattedTime(sData.createdAt), // 🎯 2번 버그: 9시간 시차 상쇄 적용 완착
            tags: sData.intent ? [sData.intent, refinedSummary] : ["일반", refinedSummary], 
            memo: sData.memo && sData.memo.trim() !== "" ? sData.memo.trim() : "당시 작성된 특이사항 메모가 없습니다.",
            messages: parsedMessages 
          });
        } else {
          setDetailData(null);
        }
      } catch (error) {
        console.error("🚨 [명세서 8-2 에러] 리드 실패 ➔ 빈 화면 방어벽 가동:", error.message);
        setDetailData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogDetail();
  }, [logId]);

  // =========================================================
  // 🗑️ [🚨 신규 명세 수용 치트키] 내 인터폰 로그 삭제 시스템 개통!
  // =========================================================
  const handleDeleteLog = () => {
    Alert.alert(
      "기록 삭제",
      "정말로 이 인터폰 통화 기록을 삭제하시겠습니까? 잉~ 🤙",
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            try {
              console.log(`▶️ [명세서 신규 기능 발포] 내 로그 삭제 시작 🚀 id: ${logId}`);
              const savedToken = await AsyncStorage.getItem("accessToken");
              
              const response = await axios.delete(`${BASE_URL}/api/intercom-logs/${logId}`, {
                headers: { Authorization: `Bearer ${savedToken}` }
              });

              if (response.data.success) {
                Alert.alert("완료", "기록이 정상적으로 삭제되었습니다.", [
                  { 
                    text: "확인", 
                    onPress: () => navigation.navigate("MainTab", { screen: "히스토리" }) 
                  }
                ]);
              } else {
                Alert.alert("실패", response.data.message || "삭제 처리에 실패했습니다.");
              }
            } catch (error) {
              console.error("🚨 [로그 삭제 통신 에러]:", error.message);
              Alert.alert("오류", "서버 통신 중 에러가 발생했쇼.");
            }
          }
        }
      ]
    );
  };

  // =========================================================
  // 🕒 [🚨 2번 버그 완파] ISO 타임스탬프 9시간 현지 한국 시차 보정 유틸
  // =========================================================
  const formatFormattedTime = (isoString) => {
    if (!isoString) return "시간 정보 없음";
    try {
      const logTime = new Date(isoString);
      // 세계 표준시(UTC) 자석 상쇄 수식
      const isUtc = !isoString.includes("+09") && (isoString.endsWith("Z") || isoString.includes("T"));
      const kstTime = isUtc ? new Date(logTime.getTime() + 9 * 60 * 60 * 1000) : logTime;

      const yyyy = kstTime.getFullYear();
      const mm = String(kstTime.getMonth() + 1).padStart(2, '0');
      const dd = String(kstTime.getDate()).padStart(2, '0');
      const hh = String(kstTime.getHours()).padStart(2, '0');
      const min = String(kstTime.getMinutes()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
    } catch (e) {
      return isoString;
    }
  };

  // 말풍선 각각의 미세 타임 도장 파서 (9시간 시차 상쇄 결합)
  const formatBubbleTime = (isoString) => {
    if (!isoString) return "00:00";
    try {
      const logTime = new Date(isoString);
      const isUtc = !isoString.includes("+09") && (isoString.endsWith("Z") || isoString.includes("T"));
      const kstTime = isUtc ? new Date(logTime.getTime() + 9 * 60 * 60 * 1000) : logTime;

      const hh = String(kstTime.getHours()).padStart(2, '0');
      const min = String(kstTime.getMinutes()).padStart(2, '0');
      return `${hh}:${min}`;
    } catch (e) {
      return "00:00";
    }
  };

  const hasMessages = detailData && detailData.messages && detailData.messages.length > 0;

  return (
    <Container>
      {/* 1. 헤더 영역 */}
      <Header>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <BackIcon source={backIcon} resizeMode="contain" />
        </TouchableOpacity>
        <HeaderTitleContainer>
          <Logo source={bellIcon} resizeMode="contain" />
          <HeaderTitle>인터폰 기록 상세</HeaderTitle>
        </HeaderTitleContainer>
        <TouchableOpacity onPress={handleDeleteLog} style={{ padding: 4 }}>
          <Ionicons name="trash-outline" size={24} color="#FF4D4D" />
        </TouchableOpacity>
      </Header>

      {isLoading ? (
        <LoadingWrapper>
          <ActivityIndicator size="large" color="#06F393" />
          <LoadingText>상세 통화 기록 복원 중...</LoadingText>
        </LoadingWrapper>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
          {/* 2. 방문 요약 카드 영역 */}
          <SummarySection>
            <InfoRow>
              <InfoLabel>방문 일시</InfoLabel>
              <InfoValue>{detailData?.time || "시간 정보 없음"}</InfoValue>
            </InfoRow>
            <TagRow>
              {detailData?.tags?.map((tag, idx) => (
                <TagBox key={idx}>
                  <TagText>#{tag}</TagText>
                </TagBox>
              ))}
            </TagRow>
          </SummarySection>

          {/* 3. 💬 대화 로그 가변 구역 */}
          <ChatLogArea style={{ flex: !hasMessages ? 1 : undefined }}>
            {hasMessages ? (
              detailData.messages.map((msg) => (
                msg.type === "receive" ? (
                  <ReceiveContainer key={msg.id}>
                    <ReceiveBubble>
                      <BubbleText>{msg.text}</BubbleText>
                    </ReceiveBubble>
                    <BubbleTime>{msg.time || "00:00"}</BubbleTime>
                  </ReceiveContainer>
                ) : (
                  <SendContainer key={msg.id}>
                    <SendBubble>
                      <SendBubbleText>{msg.text}</SendBubbleText>
                    </SendBubble>
                    <SendTime>{msg.time || "00:00"}</SendTime>
                  </SendContainer>
                )
              ))
            ) : (
              <EmptyChatLogWrapper>
                <Ionicons name="document-text-outline" size={36} color="#CCC" />
                <EmptyChatLogText>기록된 대화 내역이 없습니다.</EmptyChatLogText> 
              </EmptyChatLogWrapper>
            )}
          </ChatLogArea>
          
          {/* 4. 작성 메모 확인 구역 */}
          <MemoBox>
            <MemoTitle>당시 메모</MemoTitle>
            <MemoText>{detailData?.memo || "당시 작성된 특이사항 메모가 없습니다."}</MemoText>
          </MemoBox>

          {/* 5. 메인 화면 가기 버튼 */}
          <HomeBtn activeOpacity={0.8} onPress={() => navigation.navigate("MainTab")}>
            <HomeBtnText>메인 화면으로 이동</HomeBtnText>
          </HomeBtn>
        </ScrollView>
      )}
    </Container>
  );
}

/* ================= 스타일 정의 (수철님 명품 시안 컴포넌트 100% 철통 보존 🤙) ================= */
const Container = styled(SafeAreaView)` flex: 1; background-color: #F5F5F5; `;
const Header = styled.View` flex-direction: row; justify-content: space-between; align-items: center; padding: 15px 20px; background-color: #fff; border-bottom-width: 1px; border-bottom-color: #EEE; `;
const BackIcon = styled.Image` width: 24px; height: 24px; `;
const HeaderTitleContainer = styled.View` flex-direction: row; align-items: center; margin-left: 10px; `;
const Logo = styled.Image` width: 28px; height: 28px; margin-right: 6px; `;
const HeaderTitle = styled.Text` font-size: 18px; font-weight: 800; `;

const SummarySection = styled.View` background-color: #fff; padding: 22px 20px; border-bottom-left-radius: 30px; border-bottom-right-radius: 30px; elevation: 2; shadow-color: #000; shadow-opacity: 0.03; shadow-radius: 5px; `;
const InfoRow = styled.View` flex-direction: row; align-items: center; margin-bottom: 12px; `;
const InfoLabel = styled.Text` font-size: 14px; color: #999; width: 75px; font-weight: 600; `;
const InfoValue = styled.Text` font-size: 14px; color: #333; font-weight: 800; `;
const TagRow = styled.View` flex-direction: row; `;
const TagBox = styled.View` background-color: #EBF1FA; padding: 6px 14px; border-radius: 20px; margin-right: 8px; `;
const TagText = styled.Text` font-size: 12px; color: #4A72B2; font-weight: 800; `;

const ChatLogArea = styled.View` padding: 20px 15px; justify-content: center; `;
const ReceiveContainer = styled.View` flex-direction: row; align-items: flex-end; margin-bottom: 16px; width: 100%; `;
const ReceiveBubble = styled.View` max-width: 75%; background-color: #4A4A4A; padding: 12px 18px; border-radius: 20px; border-top-left-radius: 4px; `;
const BubbleText = styled.Text` font-size: 15px; color: #FFFFFF; line-height: 22px; font-weight: 500; `;
const BubbleTime = styled.Text` font-size: 11px; color: #999; margin-left: 8px; `;

const SendContainer = styled.View` flex-direction: row-reverse; align-items: flex-end; margin-bottom: 16px; width: 100%; `;
const SendBubble = styled.View` max-width: 75%; background-color: #6D5D55; padding: 12px 18px; border-radius: 20px; border-top-right-radius: 4px; `;
const SendBubbleText = styled.Text` font-size: 15px; color: #FFFFFF; line-height: 22px; font-weight: 500; `;
const SendTime = styled.Text` font-size: 11px; color: #999; margin-right: 8px; `;

const MemoBox = styled.View` margin: 5px 15px 20px; padding: 20px; background-color: #fff; border-radius: 20px; border-width: 1px; border-color: #EAEAEA; `;
const MemoTitle = styled.Text` font-size: 13px; color: #BBB; margin-bottom: 10px; font-weight: 800; `;
const MemoText = styled.Text` font-size: 15px; color: #444; font-weight: 600; line-height: 22px; `;

const HomeBtn = styled.TouchableOpacity` background-color: #222; margin: 10px 15px 30px; padding: 16px; border-radius: 16px; align-items: center; `;
const HomeBtnText = styled.Text` color: #fff; font-size: 16px; font-weight: 800; `;

const LoadingWrapper = styled.View` flex: 1; justify-content: center; align-items: center; padding-top: 100px; `;
const LoadingText = styled.Text` font-size: 13px; color: #999; font-weight: 600; margin-top: 10px; `;

const EmptyChatLogWrapper = styled.View` width: 100%; justify-content: center; align-items: center; padding: 40px 20px; `;
const EmptyChatLogText = styled.Text` font-size: 14px; color: #BBB; font-weight: 600; margin-top: 10px; text-align: center; `;