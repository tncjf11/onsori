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

  // 👤 [동적 계정 정보 상태창] 금고에서 꺼낸 유저 정보를 담을 그릇
  const [userName, setUserName] = useState("로딩 중...");
  const [userId, setUserId] = useState("로딩 중...");

  // 📱 오버레이 모달 제어용 상태창
  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);
  const [isDeleteUserModalVisible, setIsDeleteUserModalVisible] = useState(false);
  const [showErrorBanner, setShowErrorBanner] = useState(false); // 🚨 에러 배너 제어용 실드

  // =========================================================
  // 🔒 [금고 내부 데이터 로드 엔진] 진동/소리 세팅 값 및 계정 정보 가져오기
  // =========================================================
  const loadHardwareAndUserInfo = async () => {
    try {
      // 1. 하드웨어 설정 로드
      const vCall = await AsyncStorage.getItem("callVibrate");
      const sCall = await AsyncStorage.getItem("callSound");
      const vSub = await AsyncStorage.getItem("subtitleVibrate");

      setIsVibrateCall(vCall === "true");
      setIsSoundCall(sCall === "true");
      setIsVibrateSubtitle(vSub === "true");

      // 2. 유저 계정 정보 로드 (로그인 시 금고에 넣어둔 정보)
      const savedName = await AsyncStorage.getItem("userName");
      const savedId = await AsyncStorage.getItem("userId");
      
      setUserName(savedName || "카카오 연동 유저"); 
      setUserId(savedId || `user_${Math.floor(Math.random() * 100000000)}`); // ID가 없으면 임시 발급 
      
      console.log("📳 [설정방 동기화 완료] 가동 취향 및 유저 정보 로드 마감 완료!");
    } catch (e) {
      console.error("금고 스캔 실패:", e);
    }
  };

  useEffect(() => {
    if (isFocused) {
      loadHardwareAndUserInfo();
    }
  }, [isFocused]);

  // =========================================================
  // 🔥 [폭탄 제거 🚀] 푸시 토큰 1회만 전송하도록 API 스팸 방어막 탑재
  // =========================================================
  useEffect(() => {
    const savePushTokenToServer = async () => {
      try {
        // 🚨 방어막: 이미 토큰을 보낸 적이 있다면 여기서 바로 함수 종료! (API 스팸 차단)
        const isPushSaved = await AsyncStorage.getItem("isPushTokenSaved");
        if (isPushSaved === "true") return;

        // 🔑 로그인 화면에서 적립해둔 찐유저 JWT 마스터 키 꺼내기
        const realJwt = await AsyncStorage.getItem("accessToken");
        const dummyExpoPushToken = "ExponentPushToken[vx_onsori_2026]"; 

        if (!realJwt) {
          setShowErrorBanner(true);
          return;
        }

        console.log("▶️ [명세서 2-1 요청] 푸시 토큰 1회성 등록 시작... 🚀");
        
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
        
        // 🚀 핵심: 성공했으므로 방어막 스탬프를 찍어 다음 번엔 전송하지 않게 만듦!
        await AsyncStorage.setItem("isPushTokenSaved", "true");
        setShowErrorBanner(false); 

      } catch (error) {
        console.error("🚨 [명세서 2-1 에러 발생]:", error.message);
        setShowErrorBanner(true); 
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

  // =========================================================
  // 🎯 로그아웃 실행 로직 (안전 벨트 청소 가드 이식 완착 🚀)
  // =========================================================
  const handleLogoutConfirm = async () => {
    setIsLogoutModalVisible(false);
    console.log("🧹 [로그아웃 세션 소멸] 유저 토큰 및 취향 초기화 가동");
    
    // 유저 데이터 및 방어막 전면 초기화
    await AsyncStorage.removeItem("accessToken");
    await AsyncStorage.removeItem("isVerifiedUser"); 
    await AsyncStorage.removeItem("userName"); 
    await AsyncStorage.removeItem("userId"); 
    await AsyncStorage.removeItem("isPushTokenSaved"); 

    await AsyncStorage.setItem("callVibrate", "false");
    await AsyncStorage.setItem("callSound", "false");
    await AsyncStorage.setItem("subtitleVibrate", "false");
    
    // 🚀 스택 초기화로 뒤로 가기 눌러도 홈으로 못 돌아가게 완벽 차단!
    navigation.reset({
      index: 0,
      routes: [{ name: "ResidentLogin" }],
    });
  };

  // =========================================================
  // 🎯 회원탈퇴 실행 로직
  // =========================================================
  const handleDeleteUserConfirm = async () => {
    setIsDeleteUserModalVisible(false);
    await AsyncStorage.clear(); // 전체 장부 영구 파쇄 (방어막 포함 전부 소멸)
    
    navigation.reset({
      index: 0,
      routes: [{ name: "ResidentLogin" }],
    });
  };

  return (
    <Container>
      <Header>
        <Logo source={bellIcon} resizeMode="contain" />
        <HeaderTitle>설정</HeaderTitle>
      </Header>

      <ScrollView showsVerticalScrollIndicator={false}>
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

        <SectionContainer>
          <SectionLabel>설정</SectionLabel>
          <SettingLinkItem activeOpacity={0.6} onPress={() => navigation.navigate("DeviceSetting")}>
            <ItemText>기기 설정</ItemText>
            <ArrowIcon source={arrowRight} />
          </SettingLinkItem>
          
          <SettingLinkItem activeOpacity={0.6} onPress={() => navigation.navigate("TermsPolicy")}>
            <ItemText>약관 및 정책</ItemText>
            <ArrowIcon source={arrowRight} />
          </SettingLinkItem>
        </SectionContainer>

        {/* 👤 [동적 계정 정보 바인딩 완료 🚀] 하드코딩 탈출! */}
        <SectionContainer>
          <SectionLabel>계정 관리</SectionLabel>
          <InfoRow><InfoLabel>회원 아이디</InfoLabel><InfoValue>{userId}</InfoValue></InfoRow>
          <InfoRow><InfoLabel>연결된 계정</InfoLabel><InfoValue>(카카오) {userName}</InfoValue></InfoRow>
          
          <ActionItem onPress={() => setIsLogoutModalVisible(true)} style={{ borderTopWidth: 1, borderTopColor: '#EEE', marginTop: 10 }}>
            <ActionLeft><ActionIcon source={logoutIcon} /><ActionText>로그아웃</ActionText></ActionLeft>
          </ActionItem>
          
          <ActionItem onPress={() => setIsDeleteUserModalVisible(true)}>
            <ActionLeft><ActionIcon source={deleteUserIcon} /><ActionText style={{ color: '#FF4D4D' }}>회원탈퇴</ActionText></ActionLeft>
          </ActionItem>
        </SectionContainer>

        <Footer>
          <InquiryText>기기 문의 222@hanseo.ac.kr    041 - 000 - 0000</InquiryText>
        </Footer>
      </ScrollView>

      {showErrorBanner && (
        <ErrorToastRow>
          <Ionicons name="alert-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
          <ErrorToastText>🚨 [명세서 2-1 에러] 푸시 토큰 등록 실패! (백엔드 확인 요망)</ErrorToastText>
          <TouchableOpacity onPress={() => setShowErrorBanner(false)}>
            <Ionicons name="close" size={18} color="#fff" style={{ marginLeft: 10 }} />
          </TouchableOpacity>
        </ErrorToastRow>
      )}

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
const ActionIcon = styled.Image` width: 32px; height: 32px; margin-right: 8px; `;
const ActionText = styled.Text` font-size: 15px; color: #333; font-weight: 600; `;
const Footer = styled.View` padding: 30px 20px; align-items: center; `;
const InquiryText = styled.Text` font-size: 12px; color: #BBB; `;

const OverlayBackground = styled.View` flex: 1; background-color: rgba(0, 0, 0, 0.4); justify-content: center; align-items: center; `;
const OverlayImageCard = styled.ImageBackground` width: ${SCREEN_WIDTH * 0.8}px; height: ${(SCREEN_WIDTH * 0.8) * 0.52}px; justify-content: flex-end; padding-bottom: 15px; `;
const TransparentButtonRow = styled.View` flex-direction: row; width: 100%; height: 50px; padding-horizontal: 15px; justify-content: space-between; `;
const TransparentTouchArea = styled.TouchableOpacity` width: 47%; height: 100%; background-color: transparent; `;

const ErrorToastRow = styled.View` flex-direction: row; align-items: center; justify-content: space-between; background-color: #2D3748; padding: 14px 20px; position: absolute; bottom: 20px; left: 20px; right: 20px; border-radius: 15px; border-left-width: 5px; border-left-color: #FF4D4D; z-index: 9999; `;
const ErrorToastText = styled.Text` color: #fff; font-size: 13px; font-weight: 700; flex: 1; `;