import React, { useState, useEffect } from "react";
import { ScrollView, TouchableOpacity, View, TextInput, ActivityIndicator, Alert } from "react-native";
import styled from "styled-components/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, useIsFocused } from "@react-navigation/native";
import axios from "axios";

// 📥 관리자 전용 마스터 키 로드를 위한 비밀금고 부품 임포트!
import AsyncStorage from "@react-native-async-storage/async-storage";

// 🌐 config.js의 배포 주소
import BASE_URL from "../../api/config";

// ✅ 이미지 에셋 (수철님이 말씀하신 3개 + 기존 펜슬 아이콘 🤙 순정 보존)
const backIcon = require("../../assets/back_icon.png");
const iconMailRaw = require("../../assets/icon_mail_raw.png");
const iconMailAi = require("../../assets/icon_mail_ai.png");
const iconWrench = require("../../assets/icon_wrench.png");
const pencilIcon = require("../../assets/pencil_icon.png");

export default function AdminMessageEditScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const isFocused = useIsFocused(); // 📱 이력 갱신용 강제 리프레시 센서

  // 📥 상위 관제 화면에서 바통터치 받아 넘어온 찐 자막 식별 고유 ID 개봉!
  const { transcriptId, item: passedItem } = route.params || {};
  // 만약 상위방에서 id를 transcriptId 명찰로 안 줬을 때를 대비한 2중 가드 스위치
  const targetTranscriptId = transcriptId || passedItem?.id || passedItem?.transcriptId || 1;

  // 📱 상태 관리 및 실시간 관제 장치
  const [originalText, setOriginalText] = useState(""); // 교정 전 원본 자막 창
  const [editedText, setEditedText] = useState(""); // AI 및 관리자 수정본 입력창
  const [historyList, setHistoryList] = useState([]); // 백엔드에서 긁어올 수정 이력 타임라인 배열
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false); // 연타 방지 및 쉴드

  // =========================================================
  // 📡 [재호 찐 자막 컨트롤러 연동] 자막 상세 상태 및 수정 이력 로드 엔진 🚀
  // =========================================================
  const fetchTranscriptAndHistories = async () => {
    try {
      setIsLoading(true);
      console.log(`▶️ [자막 관제] 금고 내부 마스터 토큰 수급 시작... 타겟 자막 ID: ${targetTranscriptId}`);
      
      const token = await AsyncStorage.getItem("adminToken");
      if (!token) {
        navigation.navigate("AdminLogin");
        return;
      }

      // 1. 상위방에서 들고온 자막 기본 핏 셋팅 가드
      if (passedItem) {
        setOriginalText(passedItem.originalText || passedItem.rawText || "음성 소음 인식");
        setEditedText(passedItem.text || passedItem.message || passedItem.content || "");
      } else {
        // 상위 가방이 비어있을 때의 무결성 방어벽 데이터 디폴트 셋팅
        setOriginalText("계세 요 택배입니다. (오인식본)");
        setEditedText("계세요? 택배입니다.");
      }

      // 2. 🎯 [명세서 찐 매선] GET /api/admin/transcripts/{transcriptId}/histories 타격!
      console.log("🛰️ [수정 이력 아카이브 무전 송신] 타임라인 장부 조회 슛!");
      const response = await axios.get(`${BASE_URL}/api/admin/transcripts/${targetTranscriptId}/histories`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success && response.data.data) {
        setHistoryList(response.data.data);
      }
    } catch (error) {
      console.error("🚨 [자막 이력 장부 스캔 대실패]:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      fetchTranscriptAndHistories();
    }
  }, [isFocused, targetTranscriptId]);

  // =========================================================
  // ✏️ [🚨 재호 찐 자막 패치 엔진 발포] 원격 정밀 자막 교정 시스템
  // =========================================================
  const handleModifyTranscript = async () => {
    if (!editedText.trim()) {
      Alert.alert("입력 오류", "교정 수정할 자막 텍스트를 입력해 주셔요! 🤙");
      return;
    }

    try {
      setIsSubmitting(true);
      console.log(`🛰️ [원격 패치 신호 송신] 타겟 자막 번호: ${targetTranscriptId}`);
      
      const token = await AsyncStorage.getItem("adminToken");

      // 🎯 [명세서 찐 연동] PATCH /api/admin/transcripts/{transcriptId} 정밀 요격!
      // TranscriptUpdateRequest 규격 명찰에 맞춰 바디 객체 조립!
      const response = await axios.patch(
        `${BASE_URL}/api/admin/transcripts/${targetTranscriptId}`,
        { text: editedText.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        Alert.alert("교정 완료", "백엔드 전산실 데이터베이스 자막 장부 수정 완착! 뽈칵! 🤙", [
          {
            text: "확인",
            onPress: () => {
              fetchTranscriptAndHistories(); // 타임라인 리스트 즉시 리프레시 갱신 스캔!
            }
          }
        ]);
      }
    } catch (error) {
      console.error("🚨 [자막 원격 수정 대실패]:", error.message);
      Alert.alert("오류", "백엔드 기지국 패치 신호 전송 중 찐빠가 발생했쇼.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 🕒 이력 날짜 변환용 유틸
  const formatHistoryDate = (isoString) => {
    if (!isoString) return "2026/05/04 00:00";
    try {
      const date = new Date(isoString);
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const hh = String(date.getHours()).padStart(2, '0');
      const min = String(date.getMinutes()).padStart(2, '0');
      return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
    } catch {
      return isoString.substring(0, 16);
    }
  };

  return (
    <Container>
      {/* 1. 헤더 영역 */}
      <Header>
        <TouchableOpacity onPress={() => navigation.goBack()} disabled={isSubmitting}>
          <BackIcon source={backIcon} resizeMode="contain" />
        </TouchableOpacity>
        <HeaderTitle>메시지 상세 교정 관제</HeaderTitle>
        <View style={{ width: 24 }} />
      </Header>

      {isLoading ? (
        <LoadingWrapper>
          <ActivityIndicator size="large" color="#06F393" />
          <LoadingText>자막 아카이브 및 과거 교정 이력 추적 중...</LoadingText>
        </LoadingWrapper>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          
          {/* 2. 교정 정보 카드 (원본 vs AI 실전형 동적 분기 뽈칵! 🤙) */}
          <InfoCard>
            {/* 교정 전 원본 (음성 텍스트 추출 가드) */}
            <InfoSection>
              <SectionTop>
                <SectionIcon source={iconMailRaw} resizeMode="contain" />
                <SectionLabel>오디오 추출 최초 원본 (STT raw)</SectionLabel>
              </SectionTop>
              <MainText style={{ color: "#A0AEC0", fontStyle: "italic" }}>{originalText}</MainText>
            </InfoSection>

            <Divider />

            {/* AI 및 관리자 후처리 교정본 - TextInput으로 무결점 파이프라인 업그레이드! */}
            <InfoSection>
              <SectionTop>
                <SectionIcon source={iconMailAi} resizeMode="contain" />
                <SectionLabel>교정 표시 텍스트 (수정 가변 입력창)</SectionLabel>
              </SectionTop>
              
              <EditInputRow style={{ backgroundStyle: "#F8F9FA", paddingHorizontal: 10, borderRadius: 12 }}>
                <StyledTextInput
                  value={editedText}
                  onChangeText={setEditedText}
                  placeholder="오인식 자막을 직접 타자 쳐서 수정하셔요"
                  placeholderTextColor="#BBB"
                  editable={!isSubmitting}
                />
                <TouchableOpacity onPress={handleModifyTranscript} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#06F393" />
                  ) : (
                    <EditIcon source={pencilIcon} resizeMode="contain" style={{ tintColor: "#06F393" }} />
                  )}
                </TouchableOpacity>
              </EditInputRow>
            </InfoSection>
          </InfoCard>

          {/* 3. 수정 이력 섹션 (렌치 아이콘 뽈칵! 🤙 백엔드 histories 라이브 맵핑!) */}
          <HistoryCard>
            <HistoryHeader>
              <WrenchIcon source={iconWrench} resizeMode="contain" style={{ tintColor: "#06F393" }} />
              <SectionTitle>자막 원격 수정 이력 타임라인 ({historyList.length})</SectionTitle>
            </HistoryHeader>

            {/* 히스토리 동적 리스트 반복문 바인딩 */}
            {historyList.length > 0 ? (
              historyList.map((item, idx) => (
                <HistoryItem key={item.id || idx} style={{ borderBottomWidth: idx === historyList.length - 1 ? 0 : 1 }}>
                  <HistoryMain>
                    {/* 백엔드 TranscriptEditHistoryResponse 데이터 필드 명찰 정밀 바인딩 */}
                    <HistoryTextContainer>
                      <HistoryLabelText style={{ color: "#999" }}>[수정 전] {item.previousText || item.beforeText || "공백"}</HistoryLabelText>
                      <HistoryText style={{ marginTop: 4, fontWeight: "700" }}>➔ [수정 후] {item.modifiedText || item.afterText || item.text}</HistoryText>
                    </HistoryTextContainer>
                    <HistoryDate>{formatHistoryDate(item.createdAt || item.time)}</HistoryDate>
                  </HistoryMain>
                </HistoryItem>
              ))
            ) : (
              <EmptyWrapper>
                <Ionicons name="git-commit-outline" size={30} color="#DDD" />
                <HistoryText style={{ color: "#BBB", textAlign: "center", marginTop: 5 }}>해당 실시간 자막의 과거 수동 교정 이력이 없쇼.</HistoryText>
              </EmptyWrapper>
            )}
          </HistoryCard>

        </ScrollView>
      )}
    </Container>
  );
}

/* ================= 스타일 정의 (수철님 명품 시안 컴포넌트 100% 철통 보존 🤙) ================= */
const Container = styled(SafeAreaView)` flex: 1; background-color: #F8F9FA; `;
const Header = styled.View` flex-direction: row; justify-content: space-between; align-items: center; padding: 15px 20px; background-color: #fff; border-bottom-width: 1px; border-bottom-color: #F0F0F0; `;
const BackIcon = styled.Image` width: 24px; height: 24px; `;
const HeaderTitle = styled.Text` font-size: 18px; font-weight: 800; color: #333; `;

const InfoCard = styled.View` background-color: #fff; margin: 20px 20px 0; padding: 25px 20px; border-radius: 25px; border-width: 1.5px; border-color: #06F393; `;
const InfoSection = styled.View` padding: 5px 0; `;
const SectionTop = styled.View` flex-direction: row; align-items: center; margin-bottom: 12px; `;
const SectionIcon = styled.Image` width: 20px; height: 20px; margin-right: 10px; `;
const SectionLabel = styled.Text` font-size: 13px; font-weight: 800; color: #4A5568; `;
const MainText = styled.Text` font-size: 15px; color: #666; margin-left: 30px; font-weight: 600; `;
const Divider = styled.View` height: 1px; background-color: #F0F0F0; margin: 20px 0; `;

const EditInputRow = styled.View` flex-direction: row; justify-content: space-between; align-items: center; background-color: #FAFAFA; border-radius: 12px; padding: 4px 12px; `;
const StyledTextInput = styled.TextInput` flex: 1; height: 48px; font-size: 15px; color: #2D3748; font-weight: 700; padding: 0; `;
const EditIcon = styled.Image` width: 22px; height: 22px; `;

const HistoryCard = styled(InfoCard)` margin-top: 15px; margin-bottom: 30px; border-color: #06F393; `;
const HistoryHeader = styled.View` flex-direction: row; align-items: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom-width: 1px; border-bottom-color: #F0F0F0; `;
const WrenchIcon = styled.Image` width: 18px; height: 18px; margin-right: 10px; `;
const SectionTitle = styled.Text` font-size: 15px; font-weight: 800; color: #222; `;

const HistoryItem = styled.View` padding: 15px 0; border-bottom-width: 1px; border-bottom-color: #F8F8F8; `;
const HistoryMain = styled.View` flex-direction: row; justify-content: space-between; align-items: flex-start; `;
const HistoryTextContainer = styled.View` flex: 1; margin-right: 15px; `;
const HistoryLabelText = styled.Text` font-size: 12px; `;
const HistoryText = styled.Text` font-size: 13px; color: #4A5568; line-height: 18px; `;
const HistoryDate = styled.Text` font-size: 11px; color: #A0AEC0; font-weight: 700; `;

const LoadingWrapper = styled.View` flex: 1; justify-content: center; align-items: center; padding-top: 100px; `;
const LoadingText = styled.Text` font-size: 13px; color: #718096; font-weight: 600; margin-top: 12px; `;
const EmptyWrapper = styled.View` padding: 20px 0; justify-content: center; align-items: center; `;