import React, { useState, useEffect } from "react";
import { ScrollView, TouchableOpacity, View, Modal, ActivityIndicator, Vibration } from "react-native";
import styled from "styled-components/native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import axios from "axios";

// 📥 기기 저장소 비밀금고 부품 임포트 (진짜 토큰 및 하드웨어 취향 수급용 🔑)
import AsyncStorage from "@react-native-async-storage/async-storage";

// 🌐 config.js의 배포 주소
import BASE_URL from "../../api/config";

// ✅ 공용 리스트 부품 임포트! 뽈칵!
import RecentCallItem from "../../components/RecentCallItem";

export default function IntercomScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const [modalVisible, setModalVisible] = useState(false);
  const [status, setStatus] = useState('idle'); // 'disconnected' / 'incoming' / 'idle'
  const [activeSessionId, setActiveSessionId] = useState(null);
  
  // 📱 백엔드 데이터 실전 바인딩용 상태 관리
  const [recentCalls, setRecentCalls] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // =========================================================
  // 🔥 [통합 기지국 가동] 세션 정보(4-4)와 과거 이력(8-1) 연쇄 타격 엔진 🚀
  // =========================================================
  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      const deviceUid = "DEVICE-001";

      // 📥 [비밀금고 개방] 기기 저장소에서 진짜 찐 유저 토큰 로드 🔑
      const savedToken = await AsyncStorage.getItem("accessToken");

      // 1️⃣ [명세서 4-4] 현재 문밖에 열려있는 실시간 세션 조회
      console.log(`▶️ [명세서 4-4 요청] 현재 오픈 세션 추적 시작... 🚀`);
      const sessionResponse = await axios.get(`${BASE_URL}/api/sessions/current?deviceUid=${deviceUid}`);
      
      if (sessionResponse.data.success && sessionResponse.data.data) {
        const sessionData = sessionResponse.data.data;
        if (sessionData.status === "OPEN" || sessionData.status === "open") {
          setActiveSessionId(sessionData.sessionId);
          
          // ⚠️ [🚨 하드웨어 실전 연동 타이머 골든벨] 
          // 상태창이 incoming으로 바뀌는 순간 설정창의 진동 옵션을 검문하여 진짜 모터를 흔듭니다!
          if (status !== 'incoming') {
            const vibSetting = await AsyncStorage.getItem("callVibrate");
            if (vibSetting === "true") {
              console.log("📳 [인터폰 메인] 호출 감지 ➔ 1초 진동 루프 패턴 발포! 슛!");
              Vibration.vibrate([0, 1000, 1000], true); // 무한 반복 루프 진동 기동
            }
          }
          setStatus('incoming'); 
        } else {
          Vibration.cancel(); // 호출 수신 상태가 아니면 진동 소멸
          setActiveSessionId(null);
          setStatus('idle'); 
        }
      } else {
        Vibration.cancel();
        setActiveSessionId(null);
        setStatus('idle'); 
      }

      // 2️⃣ [명세서 8-1 찐 연동] 가짜 깡통 dummyJwt를 파쇄하고 진짜 토큰 장착 완료! 🪙
      if (!savedToken) {
        console.log("⚠️ 유저 인증 토큰 누락 상태 ➔ 이력 조회 대기");
        setIsLoading(false);
        return;
      }

      console.log(`▶️ [명세서 8-1 요청] 내 인터폰 과거 로그 아카이브 호출... 🚀`);
      const logsResponse = await axios.get(`${BASE_URL}/api/intercom-logs`, {
        headers: { Authorization: `Bearer ${savedToken}` } // 🔑 금고에서 꺼낸 진짜 토큰 적립!
      });

      console.log("▶️ [명세서 8-1 응답 수신] 이력 복원 데이터 완료 👇");
      
      if (logsResponse.data.success && logsResponse.data.data) {
        const parsedLogs = logsResponse.data.data.map(log => ({
          id: log.id,
          title: log.summary || "인터폰 호출 알림",
          time: formatTimeGap(log.createdAt), 
          type: log.intent === "DELIVERY" ? "message" : "bell", 
          tags: log.intent ? [log.intent] : ["방문"]
        }));
        setRecentCalls(parsedLogs);
      }

    } catch (error) {
      console.error("🚨 [인터폰 대시보드 연동 에러]:", error.message);
      Vibration.cancel();
      setStatus('disconnected'); 
      
      setRecentCalls([
        { id: 1, title: "관리사무소에서 방문 (네트워크 불안정)", time: "3시간 전", type: "message", tags: ["관리실"] },
        { id: 2, title: "방문 판매원 이력", time: "4/3 19:33", type: "message", tags: ["일반"] }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // ⏰ 백엔드가 주는 ISO 날짜 문자열을 시안 속 예쁜 타임갭으로 변환하는 도구쇼
  const formatTimeGap = (isoString) => {
    if (!isoString) return "기록 없음";
    try {
      const now = new Date();
      const logTime = new Date(isoString);
      const diffMs = now - logTime;
      const diffMins = Math.floor(diffMs / (1000 * 60));

      if (diffMins < 1) return "방금 전";
      if (diffMins < 60) return `${diffMins}분 전`;
      
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}시간 전`;
      
      return isoString.substring(0, 10);
    } catch {
      return "이력 시각 파싱 실패";
    }
  };

  // 📱 사용자가 메뉴로 복귀 시 항상 최신 정보 리프레시 및 진동 소멸 브레이크!
  useEffect(() => {
    if (isFocused) {
      loadDashboardData();
    } else {
      console.log("🧼 인터폰 메인 화면 이탈 감지 ➔ 하드웨어 진동 안전 강제 취소");
      Vibration.cancel(); // 탭을 바꾸면 무조건 모터를 진정시킵니다.
    }
    return () => Vibration.cancel();
  }, [isFocused]);

  const handlePressStatus = async () => {
    if (status === 'incoming') {
      console.log("🧼 [인터폰 통화 수락 워프] 대화방 진입으로 인한 루프 진동 즉시 클린 소멸!");
      Vibration.cancel(); // 전화를 받으러 넘어가므로 진동 파쇄!
      
      const savedToken = await AsyncStorage.getItem("accessToken");
      navigation.navigate("IntercomChat", { sessionId: activeSessionId, token: savedToken }); 
    } else if (status === 'disconnected') {
      navigation.navigate("QrVerify");
    }
  };

  return (
    <Container>
      {/* 1. 헤더 영역 */}
      <Header>
        <HeaderLeft>
          <Logo source={require("../../assets/bell.png")} resizeMode="contain" />
          <HeaderTitle>인터폰 상황실</HeaderTitle>
        </HeaderLeft>
        <TouchableOpacity onPress={() => setModalVisible(true)} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="information-circle-outline" size={22} color="#555" />
          <InfoBtnText>Tips</InfoBtnText>
        </TouchableOpacity>
      </Header>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 2. 인터폰 대화 연결 시스템 배너 바 */}
        <SystemBlockContainer>
          <SystemMainLabel>인터폰 대화 연결 시스템</SystemMainLabel>
          <SystemTimeStatus>
            {status === 'disconnected' ? "--:--" : "00:03"}
          </SystemTimeStatus>
        </SystemBlockContainer>

        {isLoading ? (
          <LoadingBox><ActivityIndicator size="small" color="#06F393" /></LoadingBox>
        ) : (
          <MainBannerCard 
            activeOpacity={status === 'idle' ? 1 : 0.7} 
            onPress={handlePressStatus}
          >
            <BannerLeftArea>
              <MicIconBox bgColor={status === 'disconnected' ? '#EAEAEA' : '#F5F5F5'}>
                <Ionicons 
                  name={status === 'disconnected' ? "mic-off" : "mic"} 
                  size={24} 
                  color={status === 'incoming' ? '#06F393' : '#999'} 
                />
              </MicIconBox>
              
              <BannerTextGroup>
                <BannerMainTitle>
                  {status === 'disconnected' && "디바이스가 연결되지 않았습니다."}
                  {status === 'incoming' && "하드웨어 연결 상태 · 통화 중"}
                  {status === 'idle' && "하드웨어 연결 상태 · 호출 대기 중"}
                </BannerMainTitle>
                <BannerSubText>
                  {status === 'disconnected' && "QR 인증을 진행해 주세요."}
                  {status === 'incoming' && "인터폰이 연결되었습니다! (터치하여 수락)"}
                  {status === 'idle' && "현재 걸려온 인터폰 벨 호출이 없습니다."}
                </BannerSubText>
              </BannerTextGroup>
            </BannerLeftArea>

            {status === 'disconnected' && (
              <ActionBadge bgColor="#4A72B2"><ActionText>QR 인증</ActionText></ActionBadge>
            )}
            {status === 'incoming' && (
              <ActionBadge bgColor="#06F393"><ActionText>인터폰</ActionText></ActionBadge>
            )}
            {status === 'idle' && (
              <ActionBadge bgColor="#EAEAEA"><ActionText style={{ color: '#999' }}>대기</ActionText></ActionBadge>
            )}
          </MainBannerCard>
        )}

        {/* 3. 최근 호출 히스토리 목록 섹션 (찐 서버 데이터 기반 루프 순회) */}
        <SectionTitle>최근 호출 장부 내역 ({recentCalls.length})</SectionTitle>
        <ListWrapper>
          {recentCalls.length > 0 ? (
            recentCalls.map((item, idx) => (
              <RecentCallItem key={item.id || idx} item={item} />
            ))
          ) : (
            <LoadingBox><BannerSubText style={{ textAlign: "center" }}>기록된 최근 호출 데이터가 없습니다.</BannerSubText></LoadingBox>
          )}
        </ListWrapper>
      </ScrollView>

      {/* 온소리 사용 TIP 팝업 모달 */}
      <Modal animationType="fade" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <ModalOverlay activeOpacity={1} onPress={() => setModalVisible(false)}>
          <ModalContent>
             <ModalHeader>
              <ModalHeaderText>온소리 사용 TIP</ModalHeaderText>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={24} color="#333" /></TouchableOpacity>
            </ModalHeader>
            <GuideText>1. 인터폰 호출 확인 (푸시 알림)</GuideText>
            <GuideText>2. 대화 연결하기 버튼 클릭</GuideText>
            <GuideText>3. 실시간 자막으로 방문자 확인</GuideText>
            <GuideText>4. 빠른 응답 버튼으로 즉시 답변</GuideText>
            <GuideText>5. 대화 종료 후 히스토리 자동 저장</GuideText>
          </ModalContent>
        </ModalOverlay>
      </Modal>
    </Container>
  );
}

/* ================= 스타일 정의 (수철님 명품 시안 컴포넌트 100% 철통 보존 🤙) ================= */
const Container = styled(SafeAreaView)` flex: 1; background-color: #fff; `;
const Header = styled.View` flex-direction: row; justify-content: space-between; align-items: center; padding: 15px 20px; border-bottom-width: 1px; border-bottom-color: #eee; `;
const HeaderLeft = styled.View` flex-direction: row; align-items: center; `;
const Logo = styled.Image` width: 32px; height: 32px; margin-right: 8px; `;
const HeaderTitle = styled.Text` font-size: 20px; font-weight: 800; `;
const InfoBtnText = styled.Text` font-size: 15px; font-weight: 600; color: #555; margin-left: 4px; `;

const SystemBlockContainer = styled.View` flex-direction: row; justify-content: space-between; align-items: center; margin: 25px 20px 10px; `;
const SystemMainLabel = styled.Text` font-size: 15px; color: #555; font-weight: 700; `;
const SystemTimeStatus = styled.Text` font-size: 14px; color: #666; font-weight: 600; `;

const MainBannerCard = styled.TouchableOpacity` flex-direction: row; justify-content: space-between; align-items: center; background-color: #FFFFFF; margin: 0 20px 25px; padding: 18px 15px; border-radius: 16px; elevation: 4; shadow-color: #000; shadow-opacity: 0.06; shadow-radius: 8px; border-width: 1px; border-color: #F0F0F0; `;
const BannerLeftArea = styled.View` flex-direction: row; align-items: center; flex: 1; margin-right: 10px; `;
const MicIconBox = styled.View` width: 44px; height: 44px; border-radius: 22px; background-color: ${props => props.bgColor}; justify-content: center; align-items: center; margin-right: 12px; `;
const BannerTextGroup = styled.View` flex: 1; `;
const BannerMainTitle = styled.Text` font-size: 14px; font-weight: 800; color: #222; `;
const BannerSubText = styled.Text` font-size: 12px; color: #999; margin-top: 4px; font-weight: 500; `;

const ActionBadge = styled.View` background-color: ${props => props.bgColor}; padding: 10px 16px; border-radius: 10px; justify-content: center; align-items: center; min-width: 70px; `;
const ActionText = styled.Text` color: white; font-weight: 800; font-size: 13px; `;

const SectionTitle = styled.Text` font-size: 15px; font-weight: 700; color: #555; margin: 10px 20px 15px; `;
const ListWrapper = styled.View` background-color: #fff; padding-horizontal: 5px; `;

const ModalOverlay = styled.TouchableOpacity` flex: 1; background-color: rgba(0,0,0,0.5); justify-content: center; align-items: center; `;
const ModalContent = styled.View` width: 85%; background-color: white; border-radius: 20px; padding: 25px; `;
const ModalHeader = styled.View` flex-direction: row; justify-content: space-between; align-items: center; margin-bottom: 20px; `;
const ModalHeaderText = styled.Text` font-size: 18px; font-weight: 800; `;
const GuideText = styled.Text` font-size: 15px; color: #555; margin-bottom: 12px; line-height: 22px; font-weight: 600; `;
const LoadingBox = styled.View` padding: 40px; justify-content: center; align-items: center; background-color: #fff; `;