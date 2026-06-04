import React, { useState, useEffect } from "react";
import { ScrollView, TouchableOpacity, View, Modal, Dimensions, Alert, ActivityIndicator } from "react-native";
import styled from "styled-components/native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import axios from "axios";

// 📥 유저 진짜 세션 키 및 하드웨어 설정을 기기 서랍장에서 꺼내기 위한 비밀금고!
import AsyncStorage from "@react-native-async-storage/async-storage";

// 🌐 config.js의 배포 주소 (https://voicenotice-backend.onrender.com)
import BASE_URL from "../../api/config";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ✅ 기존 이미지 에셋 매핑 완료 🤙 (순정 철통 보존)
const bellIcon = require("../../assets/bell.png");
const checkOn = require("../../assets/check_on.png");
const checkOff = require("../../assets/check_off.png");
const arrowRight = require("../../assets/arrow_right.png");
const logoutIcon = require("../../assets/logout_icon.png");
const deleteUserIcon = require("../../assets/delete_user_icon.png");

// ✅ 시안용 통짜 오버레이 이미지 에셋
const logoutOverlayImg = require("../../assets/logout_overlay.png");
const deleteUserOverlayImg = require("../../assets/delete_user_overlay.png");

export default function SettingScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused(); // 📱 화면 진입 시 금고 실시간 동기화 센서
  
  // 📳 하드웨어 제어용 상태창 - [수철님 지령 수용] 처음부터 무조건 꺼진(false) 상태로 시동 가드!
  const [isVibrateCall, setIsVibrateCall] = useState(false);
  const [isSoundCall, setIsSoundCall] = useState(false);
  const [isVibrateSubtitle, setIsVibrateSubtitle] = useState(false);

  // 📱 오버레이 모달 제어용 상태창
  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);
  const [isDeleteUserModalVisible, setIsDeleteUserModalVisible] = useState(false);
  const [showErrorBanner, setShowErrorBanner] = useState(false); // 🚨 에러 배너 제어용 실드

  // =========================================================
  // 🔒 [금고 내부 데이터 로드 엔지] 진동/소리 세팅 값 가져오기
  // =========================================================
  const loadHardwareSettings = async () => {
    try {
      const vCall = await AsyncStorage.getItem("callVibrate");
      const sCall = await AsyncStorage.getItem("callSound");
      const vSub = await AsyncStorage.getItem("subtitleVibrate");

      // 금고 장부가 "true"라고 명시되어 있을 때만 체크를 켜고, 나머지는(null이거나 "false") 처음부터 무조건 꺼짐!
      setIsVibrateCall(vCall === "true");
      setIsSoundCall(sCall === "true");
      setIsVibrateSubtitle(vSub === "true");
      console.log("📳 [설정방 동기화 완료] 가동 취향 장부 로드 마감 완료!");
    } catch (e) {
      console.error("금고 스캔 실패:", e);
    }
  };

  useEffect(() => {
    if (isFocused) {
      loadHardwareSettings();
    }
  }, [isFocused]);

  // =========================================================
  // 🔥 [명세서 2-1 찐 개편 요격] 푸시 토큰 백엔드 기지국 동기화
  // =========================================================
  useEffect(() => {
    const savePushTokenToServer = async () => {
      try {
        // 🔑 1-1번 로그인 화면에서 적립해둔 찐유저 JWT 마스터 키 꺼내기!
        const realJwt = await AsyncStorage.getItem("accessToken");
        
        // 시연용 임시 껍데기 디바이스 푸시 명찰 규격 유지
        const dummyExpoPushToken = "ExponentPushToken[vx_onsori_2026]"; 

        if (!realJwt) {
          console.log("⚠️ 유저 인증 키 유실 상태 ➔ 토큰 저장 유예");
          setShowErrorBanner(true); // 토큰이 없으면 명세서 에러 경고등 켜기
          return;
        }

        console.log("▶️ [명세서 2-1 요청] 찐 JWT 토큰 장착 완료! 푸시 토큰 등록 시작... 🚀");
        
        const response = await axios.post(
          `${BASE_URL}/api/push-tokens`,
          { token: dummyExpoPushToken },
          {
            headers: {
              Authorization: `Bearer ${realJwt}`,
              "Content-Type": "application/json",
            },
          }
        );

        console.log("▶️ [명세서 2-1 완료] 서버 푸시 토큰 락인 대성공! 🪙 status:", response.status);
        setShowErrorBanner(false); // 성공했으므로 에러 사이렌 배너 완전 소멸!

      } catch (error) {
        console.error("🚨 [명세서 2-1 에러 발생]:", error.message);
        setShowErrorBanner(true); // 찐빠 나면 빨간 에러창 가드 가동
      }
    };

    if (isFocused) {
      savePushTokenToServer();
    }
  }, [isFocused]);

  // =========================================================
  // 📳 하드웨어 개별 체크박스 토글 및 실시간 금고 저장 엔진
  // =========================================================
  const toggleSetting = async (type) => {
    try {
      if (type === "vibrateCall") {
        const next = !isVibrateCall;
        setIsVibrateCall(next);
        await AsyncStorage.setItem("callVibrate", String(next));
      } else if (type === "soundCall") {
        const next = !isSoundCall;
        setIsSoundCall(next);
        await AsyncStorage.setItem("callSound", String(next));
      } else if (type === "vibrateSubtitle") {
        const next = !isVibrateSubtitle;
        setIsVibrateSubtitle(next);
        await AsyncStorage.setItem("subtitleVibrate", String(next));
      }
    } catch (e) {
      console.error("설정 저장 찐빠:", e);
    }
  };

  // 🎯 로그아웃 실행 로직 (안전 벨트 청소 가드 이식)
  const handleLogoutConfirm = async () => {
    setIsLogoutModalVisible(false);
    console.log("🧹 [로그아웃 세션 소멸] 유저 토큰 및 취향 초기화 가동");
    await AsyncStorage.removeItem("accessToken");
    // 로그아웃 시 다음 사람을 위해 취향 장부도 다시 꺼짐으로 초기화 마감
    await AsyncStorage.setItem("callVibrate", "false");
    await AsyncStorage.setItem("callSound", "false");
    await AsyncStorage.setItem("subtitleVibrate", "false");
    
    navigation.replace("ResidentLogin"); 
  };

  // 🎯 회원탈퇴 실행 로직
  const handleDeleteUserConfirm = async () => {
    setIsDeleteUserModalVisible(false);
    await AsyncStorage.clear(); // 전체 장부 영구 파쇄
    navigation.replace("ResidentLogin");
  };

  return (
    <Container>
      {/* 1. 헤더 구역 */}
      <Header>
        <Logo source={bellIcon} resizeMode="contain" />
        <HeaderTitle>설정</HeaderTitle>
      </Header>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 1. 알림 동적 스위칭 설정 섹션 (토글 엔진 연동 완착! 🤙) */}
        <SectionContainer>
          <SectionLabel>알림</SectionLabel>
          
          <SettingItem activeOpacity={0.7} onPress={() => toggleSetting("vibrateCall")}>
            <ItemText>인터폰 호출 시 진동</ItemText>
            <CheckBoxContainer>
              <BoxBase source={checkOff} />
              {isVibrateCall && <CheckMark source={checkOn} />}
            </CheckBoxContainer>
          </SettingItem>

          <SettingItem activeOpacity={0.7} onPress={() => toggleSetting("soundCall")}>
            <ItemText>인터폰 호출 시 소리</ItemText>
            <CheckBoxContainer>
              <BoxBase source={checkOff} />
              {isSoundCall && <CheckMark source={checkOn} />}
            </CheckBoxContainer>
          </SettingItem>

          <SettingItem activeOpacity={0.7} onPress={() => toggleSetting("vibrateSubtitle")}>
            <ItemText>대화 자막 발생 시 진동</ItemText>
            <CheckBoxContainer>
              <BoxBase source={checkOff} />
              {isVibrateSubtitle && <CheckMark source={checkOn} />}
            </CheckBoxContainer>
          </SettingItem>
        </SectionContainer>

        {/* 2. 일반 설정 라우팅 섹션 */}
        <SectionContainer>
          <SectionLabel>설정</SectionLabel>
          <SettingLinkItem 
            activeOpacity={0.6} 
            onPress={() => navigation.navigate("DeviceSetting")}
          >
            <ItemText>기기 설정</ItemText>
            <ArrowIcon source={arrowRight} />
          </SettingLinkItem>
          
          <SettingLinkItem 
            activeOpacity={0.6} 
            onPress={() => navigation.navigate("TermsPolicy")}
          >
            <ItemText>약관 및 정책</ItemText>
            <ArrowIcon source={arrowRight} />
          </SettingLinkItem>
        </SectionContainer>

        {/* 3. 계정 관리 정보 바인딩 섹션 */}
        <SectionContainer>
          <SectionLabel>계정 관리</SectionLabel>
          <InfoRow><InfoLabel>회원 아이디</InfoLabel><InfoValue>user121398701928</InfoValue></InfoRow>
          <InfoRow><InfoLabel>연결된 계정</InfoLabel><InfoValue>(카카오) seousususususu</InfoValue></InfoRow>
          
          <ActionItem onPress={() => setIsLogoutModalVisible(true)} style={{ borderTopWidth: 1, borderTopColor: '#EEE', marginTop: 10 }}>
            <ActionLeft><ActionIcon source={logoutIcon} /><ActionText>로그아웃</ActionText></ActionLeft>
          </ActionItem>
          
          <ActionItem onPress={() => setIsDeleteUserModalVisible(true)}>
            <ActionLeft><ActionIcon source={deleteUserIcon} /><ActionText style={{ color: '#FF4D4D' }}>회원탈퇴</ActionText></ActionLeft>
          </ActionItem>
        </SectionContainer>

        {/* 4. 푸터 가이드 (한서대 원본 이메일 완벽 수호!) 🤙 */}
        <Footer>
          <InquiryText>기기 문의 222@hanseo.ac.kr    041 - 000 - 0000</InquiryText>
        </Footer>
      </ScrollView>

      {/* 🚨 실전형 안전 가드 에셋 스낵바 알림 장치 (문제가 있을 때만 동적으로 기동!) */}
      {showErrorBanner && (
        <ErrorToastRow>
          <Ionicons name="alert-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
          <ErrorToastText>🚨 [명세서 2-1 에러] 푸시 토큰 유실됨! 재로그인 필요</ErrorToastText>
          <TouchableOpacity onPress={() => setShowErrorBanner(false)}>
            <Ionicons name="close" size={18} color="#fff" style={{ marginLeft: 10 }} />
          </TouchableOpacity>
        </ErrorToastRow>
      )}

      {/* 🚨 1. 로그아웃 투명 터치 오버레이 모달 */}
      <Modal transparent={true} visible={isLogoutModalVisible} animationType="fade" onRequestClose={() => setIsLogoutModalVisible(false)}>
        <OverlayBackground>
          <OverlayImageCard source={logoutOverlayImg} resizeMode="contain">
            <TransparentButtonRow>
              <TransparentTouchArea onPress={handleLogoutConfirm} />
              <TransparentTouchArea onPress={() => setIsLogoutModalVisible(false)} />
            </TransparentButtonRow>
          </OverlayImageCard>
        </OverlayBackground>
      </Modal>

      {/* 🚨 2. 회원탈퇴 투명 터치 오버레이 모달 */}
      <Modal transparent={true} visible={isDeleteUserModalVisible} animationType="fade" onRequestClose={() => setIsDeleteUserModalVisible(false)}>
        <OverlayBackground>
          <OverlayImageCard source={deleteUserOverlayImg} resizeMode="contain">
            <TransparentButtonRow>
              <TransparentTouchArea onPress={handleDeleteUserConfirm} />
              <TransparentTouchArea onPress={() => setIsDeleteUserModalVisible(false)} />
            </TransparentButtonRow>
          </OverlayImageCard>
        </OverlayBackground>
      </Modal>

    </Container>
  );
}

/* ================= 스타일 정의 (수철님 명품 시안 피팅 완벽 보존 🤙) ================= */
const Container = styled(SafeAreaView)` flex: 1; background-color: #fff; `;
const Header = styled.View` flex-direction: row; align-items: center; padding: 15px 20px; border-bottom-width: 1px; border-bottom-color: #EEE; `;
const Logo = styled.Image` width: 32px; height: 32px; margin-right: 10px; `;
const HeaderTitle = styled.Text` font-size: 20px; font-weight: 800; color: #333; `;
const SectionContainer = styled.View` padding: 20px 0 10px; border-bottom-width: 8px; border-bottom-color: #F8F9FA; `;
const SectionLabel = styled.Text` font-size: 14px; color: #999; padding: 0 20px; margin-bottom: 10px; font-weight: 600; `;
const SettingItem = styled.TouchableOpacity` flex-direction: row; justify-content: space-between; align-items: center; padding: 15px 20px; `;
const SettingLinkItem = styled(SettingItem)``;
const ItemText = styled.Text` font-size: 16px; color: #333; font-weight: 500; `;
const CheckBoxContainer = styled.View` width: 24px; height: 24px; position: relative; `;
const BoxBase = styled.Image` width: 24px; height: 24px; `;
const CheckMark = styled.Image` width: 24px; height: 24px; position: absolute; top: 0; left: 0; `;
const ArrowIcon = styled.Image` width: 18px; height: 18px; `;
const InfoRow = styled.View` flex-direction: row; padding: 12px 20px; `;
const InfoLabel = styled.Text` font-size: 14px; color: #999; width: 100px; `;
const InfoValue = styled.Text` font-size: 14px; color: #555; `;
const ActionItem = styled.TouchableOpacity` flex-direction: row; align-items: center; padding: 15px 20px; `;
const ActionLeft = styled.View` flex-direction: row; align-items: center; `;
const ActionIcon = styled.Image` width: 22px; height: 22px; margin-right: 10px; `;
const ActionText = styled.Text` font-size: 15px; color: #333; font-weight: 600; `;
const Footer = styled.View` padding: 30px 20px; align-items: center; `;
const InquiryText = styled.Text` font-size: 12px; color: #BBB; `;

const OverlayBackground = styled.View` flex: 1; background-color: rgba(0, 0, 0, 0.4); justify-content: center; align-items: center; `;
const OverlayImageCard = styled.ImageBackground` width: ${SCREEN_WIDTH * 0.8}px; height: ${(SCREEN_WIDTH * 0.8) * 0.52}px; justify-content: flex-end; padding-bottom: 15px; `;
const TransparentButtonRow = styled.View` flex-direction: row; width: 100%; height: 50px; padding-horizontal: 15px; justify-content: space-between; `;
const TransparentTouchArea = styled.TouchableOpacity` width: 47%; height: 100%; background-color: transparent; `;

const ErrorToastRow = styled.View` flex-direction: row; align-items: center; justify-content: space-between; background-color: #2D3748; padding: 14px 20px; position: absolute; bottom: 20px; left: 20px; right: 20px; border-radius: 15px; border-left-width: 5px; border-left-color: #FF4D4D; z-index: 9999; `;
const ErrorToastText = styled.Text` color: #fff; font-size: 13px; font-weight: 700; flex: 1; `;