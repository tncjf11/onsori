import React, { useState } from "react";
import { Dimensions, View, ActivityIndicator, Modal, TouchableOpacity, Text, Alert, SafeAreaView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { WebView } from "react-native-webview"; 
import styled from "styled-components/native";
import axios from "axios";

// 📥 안전하게 초기값을 보관하기 위한 AsyncStorage 비밀금고 부품 임포트!
import AsyncStorage from "@react-native-async-storage/async-storage";

// 🌐 config.js의 진짜 배포 주소 (https://voicenotice-backend.onrender.com)
import BASE_URL from "../../api/config";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// ✅ 이미지 에셋 경로 100% 철통 보존
const kakaoIcon = require("../../assets/kakao.png");
const helloBubbleImage = require("../../assets/hello.png"); 
const bellCharacterImage = require("../../assets/bell.png"); 
const yellowBarImage = require("../../assets/yellowbar.png"); 

// 🔑 [재호 카카오 세팅 정보 유지]
const REST_API_KEY = "6995a27f1c3c0a59b90e27ae3b9cdbe1"; 
const CLIENT_SECRET = "bFbFbVNKgMN9O9GVTVY0qE3qzDrACDcp"; 
const REDIRECT_URI = "https://voicenotice-backend.onrender.com/login/oauth2/code/kakao"; 

export default function ResidentLoginScreen({ navigation }) {
  const [loading, setLoading] = useState(false); 
  const [showWebView, setShowWebView] = useState(false); 

  // =========================================================
  // 🔥 [명세서 1-1 실전 동기화] 카카오 인가코드 파싱 및 찐 토큰 토스 가동
  // =========================================================
  const handleWebViewNavigationStateChange = async (newNavState) => {
    const { url } = newNavState;
    if (!url) return;

    console.log(" 현재 웹뷰 주소창 위치 👁️ :", url);

    if (url.startsWith(REDIRECT_URI) && url.includes("code=")) {
      setShowWebView(false); 
      setLoading(true);

      try {
        // 1. 인가코드 잘라내기
        const code = url.split("code=")[1].split("&")[0];
        console.log("▶️ 1. 카카오 일회용 인가코드 획득 🎫 :", code);

        // 2. 카카오 기지국 서버와 찐 access_token 교환
        const tokenResponse = await axios({
          method: "POST",
          url: "https://kauth.kakao.com/oauth/token",
          headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
          data: `grant_type=authorization_code&client_id=${REST_API_KEY}&redirect_uri=${REDIRECT_URI}&code=${code}&client_secret=${CLIENT_SECRET}`,
        });

        const kakaoAccessToken = tokenResponse.data.access_token;
        console.log("▶️ 2. 카카오 공식 access_token 확보 🔑 :", kakaoAccessToken);

        // 3. [명세서 1-1 타격] 재호 분 백엔드로 카카오 토큰 전송 🚀
        const targetUrl = `${BASE_URL}/api/auth/kakao`;
        console.log("▶️ 3. [명세서 1-1 요청] 백엔드로 검증 바디 토스... 주소:", targetUrl);
        
        const backendResponse = await axios.post(targetUrl, {
          accessToken: kakaoAccessToken 
        });

        console.log("▶️ 4. [명세서 1-1 응답 수신] 결과 데이터 👇\n", JSON.stringify(backendResponse.data, null, 2));

        if (backendResponse.data.success && backendResponse.data.data) {
          const backendJwtToken = backendResponse.data.data.accessToken;
          console.log("▶️ 5. [대성공] 재호 백엔드 찐 JWT 토큰 확보 완료 🪙 JWT:", backendJwtToken);
          
          // =========================================================
          // 🔥 [🚨 수철님 뇌지컬 안심 패치 장착] 
          // 백엔드 통신과 무관하게, 최초 로그인 통과 시점에 딱 하드웨어 세팅 장부만 
          // 처음부터 꺼짐("false") 상태로 프론트 비밀금고에 저축합니다! 이상 무! 🤙
          // =========================================================
          await AsyncStorage.setItem("callVibrate", "false");
          await AsyncStorage.setItem("callSound", "false");
          await AsyncStorage.setItem("subtitleVibrate", "false");
          console.log("🔒 [하드웨어 설정 금고 안착] 소리/진동 초기 상태 'false' 박제 완료!");
          
          Alert.alert("로그인 성공", `${backendResponse.data.data.name}님 환영합니다!`);
          
          navigation.replace("QrVerify", { token: backendJwtToken });
        } else {
          throw new Error(backendResponse.data.message || "백엔드 인증 처리 실패");
        }

      } catch (error) {
        console.error("🚨 명세서 1-1 실전 연동 중 에러 터짐:", error);
        Alert.alert("로그인 실패", "재호 백엔드 서버와 토큰 검증 통신 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Container>
      {/* 1. 상단 그라데이션 헤더 */}
      <HeaderSection style={{ height: SCREEN_HEIGHT * 0.28 }}>
        <Gradient colors={["#06F393", "#79F7C8", "#DFFFF4"]}>
          <Welcome>WELCOME!</Welcome>
          <SubText>안녕하세요, 사용자 여러분!</SubText>
        </Gradient>
      </HeaderSection>

      {/* 2. 메인 화이트 카드 */}
      <CardSection>
        <QRInfoText>로그인후  QR 인증해주세요!!</QRInfoText>

        {/* 3. 중앙 캐릭터 및 말풍선 영역 */}
        <CharacterArea>
          <View style={{ alignItems: 'flex-end', width: '80%', marginBottom: -15, zIndex: 10 }}>
            <HelloBubble source={helloBubbleImage} resizeMode="contain" />
          </View>
          <BellCharacter source={bellCharacterImage} resizeMode="contain" />
        </CharacterArea>

        {/* 로딩 바 */}
        {loading && (
          <View style={{ marginBottom: 10 }}>
            <ActivityIndicator size="large" color="#06F393" />
          </View>
        )}

        {/* 4. 하단 버튼 영역 */}
        <ButtonArea disabled={loading} style={{ opacity: loading ? 0.6 : 1 }}>
          <ImageButton onPress={() => setShowWebView(true)} disabled={loading}>
            <BarImageBackground source={yellowBarImage} resizeMode="stretch" />
            <ButtonContent>
              {/* 🤙 [잘림 완화 패치] 에셋이 잘리지 않도록 렌더링 세팅 고정 */}
              <Icon source={kakaoIcon} resizeMode="contain" />
              <ButtonText>카카오로 로그인하기</ButtonText>
            </ButtonContent>
          </ImageButton>
        </ButtonArea>

        {/* 5. 관리자 페이지 링크 */}
        <AdminLink onPress={() => navigation.navigate("AdminLogin")} disabled={loading}>
          <AdminText>관리자 페이지로 가기</AdminText>
        </AdminLink>
      </CardSection>

      {/* 📱 찐 카카오톡 인증창을 호출하는 풀 스크린 웹뷰 모달 가동 */}
      <Modal visible={showWebView} animationType="slide" onRequestClose={() => setShowWebView(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
          <View style={{ height: 50, justifyContent: 'center', paddingHorizontal: 20, backgroundColor: '#f5f5f5' }}>
            <TouchableOpacity onPress={() => setShowWebView(false)}>
              <Text style={{ color: '#333', fontSize: 16, fontWeight: 'bold' }}>취소하고 나가기</Text>
            </TouchableOpacity>
          </View>
          <WebView 
            source={{ uri: `https://kauth.kakao.com/oauth/authorize?response_type=code&client_id=${REST_API_KEY}&redirect_uri=${REDIRECT_URI}` }}
            onNavigationStateChange={handleWebViewNavigationStateChange} 
            startInLoadingState={true}
            renderLoading={() => <ActivityIndicator size="large" color="#06F393" style={{ flex: 1 }} />}
          />
        </SafeAreaView>
      </Modal>
    </Container>
  );
}

/* ================= 스타일 정의 (수철님 명품 시안 100% 철통 보존 🤙) ================= */
const Container = styled.View` flex: 1; background-color: white; `;
const HeaderSection = styled.View` width: 100%; `;
const Gradient = styled(LinearGradient)` flex: 1; justify-content: center; padding: 0 40px; `;
const Welcome = styled.Text` font-size: 36px; font-weight: 900; color: white; `;
const SubText = styled.Text` font-size: 16px; font-weight: 700; color: white; margin-top: 5px; `;
const CardSection = styled.View` flex: 1; background-color: white; border-top-left-radius: 60px; border-top-right-radius: 60px; margin-top: -50px; padding: 40px 30px; align-items: center; `;
const QRInfoText = styled.Text` font-size: 20px; font-weight: 900; color: #06F393; margin-bottom: 20px; `;
const CharacterArea = styled.View` flex: 1; width: 100%; justify-content: center; align-items: center; position: relative; `;
const HelloBubble = styled.Image` width: 140px; height: 60px; `;
const BellCharacter = styled.Image` width: 100%; height: 85%; `;
const ButtonArea = styled.View` width: 100%; padding-bottom: 10px; padding-top: 10px; `; 
const ImageButton = styled.TouchableOpacity` width: 100%; height: 70px; justify-content: center; align-items: center; margin-bottom: 12px; position: relative; `;
const BarImageBackground = styled.Image` position: absolute; width: 100%; height: 100%; z-index: 1; `;
const ButtonContent = styled.View` flex-direction: row; align-items: center; z-index: 2; `;

const Icon = styled.Image`
  width: 28px;
  height: 28px;
  margin-left: -15px;
  margin-right: 5px; 
  tint-color: #111;
`;

const ButtonText = styled.Text` font-size: 16px; font-weight: 800; color: #333; `;
const AdminLink = styled.TouchableOpacity` align-self: flex-end; margin-top: 15px; `;
const AdminText = styled.Text` font-size: 12px; font-weight: 800; color: #06F393; `;