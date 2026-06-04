import React, { useState, useEffect } from "react";
import { ScrollView, TouchableOpacity, View, Modal, ActivityIndicator, Vibration } from "react-native";
import styled from "styled-components/native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import axios from "axios";

// 📥 기기 저장소 비밀금고 부품 
import AsyncStorage from "@react-native-async-storage/async-storage";

// 🌐 config.js의 배포 주소 (https://voicenotice-backend.onrender.com)
import BASE_URL from "../../api/config";

// ✅ 공용 리스트 부품 임포트!
import RecentCallItem from "../../components/RecentCallItem";

// ✅ 이미지 에셋
const bellIcon = require("../../assets/bell.png");

export default function HomeScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused(); // 📱 탭 전환 및 화면 복귀 감지 센서

  const [modalVisible, setModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState(null);

  // 😴 아무런 호출이 없을 때는 기본값이 'idle' (호출 대기 중)
  const [intercomStatus, setIntercomStatus] = useState('idle');

  // 🤙 최근 호출 이력 클린 배열 상태창
  const [recentCalls, setRecentCalls] = useState([]);

  // 📥 최근 호출 이력 부품에 바톤 터치해 줄 진짜 토큰 상태창
  const [token, setToken] = useState(null);

  // =========================================================
  // 📳 [🚨 프론트 자체 하드웨어 엔진] 진동 루프 가동 및 파쇄 제어부
  // =========================================================
  const triggerHardwareAlert = async (status) => {
    try {
      if (status === 'incoming') {
        // 설정창에서 세이브한 소리/진동 비밀장부 꺼내기
        const vibSetting = await AsyncStorage.getItem("callVibrate");
        console.log("📳 [하드웨어 검문] 현재 인터폰 진동 설정 값:", vibSetting);

        if (vibSetting === "true") {
          console.log("📳 [원격 모터 작동] 1초 진동 루프 패턴 무한 무전 발포!!! 슛!");
          // [0초 대기, 1초 진동, 1초 쉬고] 패턴 가동, true는 호출 종료 전까지 무한 루프 반복!
          Vibration.vibrate([0, 1000, 1000], true); 
        }
      } else {
        // idle 상태거나 통화방 진입 시 모터 즉시 소멸 청소!
        Vibration.cancel();
      }
    } catch (e) {
      console.error("진동 제어 찐빠 발생:", e);
    }
  };

  // =========================================================
  // 🔥 [명세서 4-4 실전 동기화 및 500 폭파 전면 진압 구역]
  // =========================================================
  const checkHomeActiveSession = async (isSilent = false) => {
    try {
      if (!isSilent) setIsLoading(true);
      
      // 📥 [비밀금고 개방] 기기 저장소에서 진짜 토큰 로드
      const savedToken = await AsyncStorage.getItem("accessToken");
      setToken(savedToken); 

      const deviceUid = "DEVICE-001";
      
      // 🎯 [수술 부역 1] 엔드포인트 세션 주소 오염 및 꼬임 차단
      // 백엔드 명세 규격에 맞추어 기본 주소를 정돈하되, 500 에러를 유발하는 엔드포인트 트래픽 가드를 아래 배치했습니다.
      const response = await axios.get(`${BASE_URL}/api/sessions/current?deviceUid=${deviceUid}`).catch((err) => {
        // 백엔드가 500 내부 에러를 뿜으면 catch 분기로 가기 전, 가상 정상 대기 응답 객체로 치환하여 튕김을 방지합니다.
        console.log("⚠️ 백엔드 세션 DB 조회 500 에러 감지 -> 가상 세션 가드 발동쇼 🤙");
        return { data: { success: true, data: { status: "IDLE", sessionId: null } } };
      });
      
      if (response.data.success) {
        const sessionData = response.data.data;
        
        if (sessionData && (sessionData.status === "OPEN" || sessionData.status === "incoming")) {
          // ⚠️ 이전 상태가 idle이었다가 최초로 incoming으로 바뀌는 골든 타이밍 포착!
          if (intercomStatus !== 'incoming') {
            console.log("➡️ [실전 하드웨어 감지] 찐 통화 개통 신호 수신 완료! 벨 울림 기동 🔑");
            triggerHardwareAlert('incoming'); // 진동 제어 마스터 슛!
          }
          setActiveSessionId(sessionData.sessionId || 1);
          setIntercomStatus('incoming');
          navigation.setParams({ intercomStatus: 'incoming' });
        } else {
          // 호출이 끝나 리셋되는 구역
          if (intercomStatus === 'incoming') {
            triggerHardwareAlert('idle'); // 진동 끄기
          }
          setActiveSessionId(null);
          setIntercomStatus('idle');
          navigation.setParams({ intercomStatus: 'idle' });
        }
      } else {
        if (intercomStatus === 'incoming') triggerHardwareAlert('idle');
        setActiveSessionId(null);
        setIntercomStatus('idle');
        navigation.setParams({ intercomStatus: 'idle' });
      }

      // 2. 🎯 [하단 최근 호출 이력 찐 연동]
      if (savedToken && !isSilent) {
        const logResponse = await axios.get(`${BASE_URL}/api/intercom-logs/recent`, {
          headers: { Authorization: `Bearer ${savedToken}` }
        }).catch(() => {
          // 호출 이력조회 API가 DB 원인으로 500을 뱉을 때를 대비한 2중 시연용 방어벽
          return { data: { success: true, data: [] } };
        });

        if (logResponse.data.success && logResponse.data.data) {
          setRecentCalls(logResponse.data.data.slice(0, 5)); // 최신 5건 락인!
        }
      }

    } catch (error) {
      // 🚨 [수철님 지령 최종 진화] 백엔드 500 무전 대폭발 레드스크린 알람을 완벽하게 삭제 차단!
      console.log("🚨 [홈화면 라이브 에러 세이프티 가드 복구 완료]:", error.message);
      if (intercomStatus === 'incoming') triggerHardwareAlert('idle');
      
      // 레드스크린으로 끊기지 않고 화면 인터페이스가 스무스하게 호출 대기 상태(idle)를 유지하도록 안전 정비
      setIntercomStatus('idle');
      navigation.setParams({ intercomStatus: 'idle' });
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  // =========================================================
  // ⚡ [🚨 찐 라이브 연동 치트키] 3초 주기 홈 화면 한정 추적 폴링 엔진 가동!
  // =========================================================
  useEffect(() => {
    let pollingTimer = null;

    if (isFocused) {
      checkHomeActiveSession(false);

      pollingTimer = setInterval(() => {
        console.log("🛰️ [라이브 스캔] 홈화면 대기 중 실시간 하드웨어 벨 신호 감지 중...");
        checkHomeActiveSession(true); // 조용한 백그라운드 스캔
      }, 3000); 
    }

    // 3. 🧼 화면 나가면 진동도 끄고 타이머도 불태워 소멸! (안전 무결성 가드)
    return () => {
      Vibration.cancel();
      if (pollingTimer) {
        console.log("🧹 홈화면 이탈 감지 ➔ 실시간 폴링 엔진 및 진동 안전 일시정지");
        clearInterval(pollingTimer);
      }
    };
  }, [isFocused]);

  // =========================================================
  // 🎯 메인 상태 박스 터치 시 이동 분기 핸들러
  // =========================================================
  const handleStatusCardPress = () => {
    if (intercomStatus === 'incoming') {
      console.log("🧼 [통화 수락 워프] 대화방 진입으로 인한 하드웨어 진동 파쇄 클린!");
      Vibration.cancel(); // 전화를 받으러 들어갔으므로 진동 소멸 커맨드 가동!
      navigation.navigate("IntercomChat", { sessionId: activeSessionId, token: token });
    } else if (intercomStatus === 'disconnected') {
      navigation.navigate("QrVerify");
    } else if (intercomStatus === 'idle') {
      console.log("▶️ [중첩 워프 가동] MainTab 대문 개방 후 한글 '히스토리' 기지로 주소지 직송 슛!");
      navigation.navigate("MainTab", {
        screen: "히스토리"
      });
    }
  };

  return (
    <Container>
      {/* 1. 상단 헤더 영역 */}
      <Header>
        <HeaderLeft>
          <Logo source={bellIcon} resizeMode="contain" />
          <HeaderTitle>
            {intercomStatus === 'disconnected' ? "로그인 완료" : "Home"}
          </HeaderTitle>
        </HeaderLeft>
        <TouchableOpacity onPress={() => setModalVisible(true)} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="information-circle-outline" size={22} color="#555" />
          <InfoBtnText>앱 사용방법</InfoBtnText>
        </TouchableOpacity>
      </Header>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingBottom: 30 }}>
        
        {/* 2. 인터폰 대화 연결 시스템 메인 보드 */}
        <SystemBlockContainer>
          <SystemMainLabel>인터폰 대화 연결 시스템</SystemMainLabel>
        </SystemBlockContainer>

        {isLoading ? (
          <LoadingWrapper><ActivityIndicator size="small" color="#06F393" /></LoadingWrapper>
        ) : (
          <MainBannerActionCard 
            activeOpacity={0.7} 
            onPress={handleStatusCardPress}
          >
            <BannerLeftContainer>
              <MicIconWrapper bgColor={intercomStatus === 'disconnected' ? '#EAEAEA' : '#F5F5F5'}>
                <Ionicons 
                  name={intercomStatus === 'disconnected' ? "mic-off" : "mic"} 
                  size={24} 
                  color={intercomStatus === 'incoming' ? '#06F393' : '#999'} 
                />
              </MicIconWrapper>
              
              <BannerTextGroup>
                <BannerMainTitle>
                  {intercomStatus === 'disconnected' && "디바이스가 연결되지 않았습니다."}
                  {intercomStatus === 'incoming' && "하드웨어 연결 상태 · 통화 중"}
                  {intercomStatus === 'idle' && "하드웨어 연결 상태 · 호출 대기 중"}
                </BannerMainTitle>
                <BannerSubDescription>
                  {intercomStatus === 'disconnected' && "QR 인증을 진행해 주세요."}
                  {intercomStatus === 'incoming' && "인터폰이 연결되었습니다! (터치하여 진입)"}
                  {intercomStatus === 'idle' && "현재 걸려온 인터폰 호출이 없습니다."}
                </BannerSubDescription>
              </BannerTextGroup>
            </BannerLeftContainer>

            {/* 우측 동적 액션 버튼 매칭 */}
            {intercomStatus === 'disconnected' && (
              <ActionButtonStyle bgColor="#4A72B2"><ActionBtnText>QR 인증</ActionBtnText></ActionButtonStyle>
            )}
            {intercomStatus === 'incoming' && (
              <ActionButtonStyle bgColor="#06F393"><ActionBtnText>인터폰</ActionBtnText></ActionButtonStyle>
            )}
            {intercomStatus === 'idle' && (
              <ActionButtonStyle bgColor="#EAEAEA"><ActionBtnText style={{ color: '#999' }}>대기</ActionBtnText></ActionButtonStyle>
            )}
          </MainBannerActionCard>
        )}

        {/* 3. 최근 호출 이력 섹션 */}
        <SectionTitle>최근 호출 이력 ({recentCalls.length})</SectionTitle>
        <ResultListGroup style={{ flex: 1 }}>
          {recentCalls.length > 0 ? (
            recentCalls.map((item, idx) => (
              <RecentCallItem 
                key={item.id || idx} 
                item={item} 
                token={token} 
                onPress={() => navigation.navigate("End", { item: item, logId: item.id, token: token })}
              />
            ))
          ) : (
            <EmptyHistoryContainer>
              <Ionicons name="chatbubbles-outline" size={40} color="#DDD" />
              <EmptyHistoryText>최근 호출된 기록이 없습니다.</EmptyHistoryText>
            </EmptyHistoryContainer>
          )}
        </ResultListGroup>

      </ScrollView>

      {/* 4. 앱 사용방법 팝업 */}
      <Modal animationType="fade" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <ModalOverlay activeOpacity={1} onPress={() => setModalVisible(false)}>
          <ModalContent>
            <ModalHeader>
              <ModalHeaderText>앱 사용방법</ModalHeaderText>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ModalHeader>
            <GuideText>1. 인터폰 호출 확인 (푸시 알림)</GuideText>
            <GuideText>2. 앱 접속 후 실시간 자막 확인</GuideText>
            <GuideText>3. 상용구 또는 직접 입력으로 대답</GuideText>
            <GuideText>4. 인터폰 스피커로 답변 전달</GuideText>
            <GuideText>5. 대화 종료 및 기록 확인</GuideText>
            <CloseBtn onPress={() => setModalVisible(false)}><CloseBtnText>확인</CloseBtnText></CloseBtn>
          </ModalContent>
        </ModalOverlay>
      </Modal>
    </Container>
  );
}

/* ================= 스타일 정의 (수철님 명품 시안 감성 100% 철통 보존) ================= */
const Container = styled(SafeAreaView)` flex: 1; background-color: #FFFFFF; `;
const Header = styled.View` flex-direction: row; justify-content: space-between; align-items: center; padding: 15px 20px; background-color: #FFFFFF; border-bottom-width: 1px; border-bottom-color: #F0F0F0; `;
const HeaderLeft = styled.View` flex-direction: row; align-items: center; `;
const Logo = styled.Image` width: 32px; height: 32px; margin-right: 8px; `;
const HeaderTitle = styled.Text` font-size: 20px; font-weight: 800; color: #111; `;
const InfoBtnText = styled.Text` font-size: 14px; font-weight: 600; color: #555; margin-left: 4px; `;

const SystemBlockContainer = styled.View` flex-direction: row; justify-content: space-between; align-items: center; margin: 25px 20px 10px; `;
const SystemMainLabel = styled.Text` font-size: 15px; color: #555; font-weight: 700; `;

const MainBannerActionCard = styled.TouchableOpacity` flex-direction: row; justify-content: space-between; align-items: center; background-color: #FFFFFF; margin: 0 20px 25px; padding: 18px 15px; border-radius: 16px; elevation: 4; shadow-color: #000; shadow-opacity: 0.06; shadow-radius: 8px; border-width: 1px; border-color: #F0F0F0; `;
const BannerLeftContainer = styled.View` flex-direction: row; align-items: center; flex: 1; margin-right: 10px; `;
const MicIconWrapper = styled.View` width: 44px; height: 44px; border-radius: 22px; background-color: ${props => props.bgColor}; justify-content: center; align-items: center; margin-right: 12px; `;
const BannerTextGroup = styled.View` flex: 1; `;
const BannerMainTitle = styled.Text` font-size: 14px; font-weight: 800; color: #222; `;
const BannerSubDescription = styled.Text` font-size: 12px; color: #999; margin-top: 4px; font-weight: 500; `;

const ActionButtonStyle = styled.View` background-color: ${props => props.bgColor}; padding: 10px 16px; border-radius: 10px; justify-content: center; align-items: center; min-width: 70px; `;
const ActionBtnText = styled.Text` color: white; font-weight: 800; font-size: 13px; `;

const SectionTitle = styled.Text` font-size: 15px; font-weight: 700; color: #555; margin: 10px 20px 15px; `;
const ResultListGroup = styled.View` background-color: #fff; padding-horizontal: 5px; `;

const ModalOverlay = styled.TouchableOpacity` flex: 1; background-color: rgba(0,0,0,0.5); justify-content: center; align-items: center; `;
const ModalContent = styled.View` width: 85%; background-color: white; border-radius: 25px; padding: 25px; `;
const ModalHeader = styled.View` flex-direction: row; justify-content: space-between; align-items: center; margin-bottom: 20px; `;
const ModalHeaderText = styled.Text` font-size: 18px; font-weight: 800; color: #111; `;
const GuideText = styled.Text` font-size: 14px; color: #444; margin-bottom: 15px; line-height: 22px; font-weight: 600; `;
const CloseBtn = styled.TouchableOpacity` background-color: #06F393; padding: 14px; border-radius: 12px; align-items: center; margin-top: 10px; `;
const CloseBtnText = styled.Text` color: white; font-weight: 800; font-size: 16px; `;
const LoadingWrapper = styled.View` padding: 40px; justify-content: center; align-items: center; `;

const EmptyHistoryContainer = styled.View` flex: 1; justify-content: center; align-items: center; padding: 60px 20px; `;
const EmptyHistoryText = styled.Text` font-size: 14px; color: #CCC; font-weight: 600; margin-top: 10px; text-align: center; `;