import { useState } from "react";
// 🎯 react-native 패키지 import 구역에 Dimensions 모듈이 누락 없이 동기화되었습니다.
import { useNavigation } from "@react-navigation/native";
import axios from "axios";
import { ActivityIndicator, Alert, Dimensions, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import styled from "styled-components/native";

// 📥 관리자 전용 마스터 키 저축을 위한 비밀금고 부품 임포트
import AsyncStorage from "@react-native-async-storage/async-storage";

// 🌐 config.js의 배포 주소
import BASE_URL from "../../api/config";

// ✅ 이미지 에셋 (기존 bell.png 재사용)
const bellLogo = require("../../assets/bell.png");

// 🕒 기기 디스플레이 전체 높이 계산용 변수 선언 완료 (ReferenceError 근본적 박멸)
const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function AdminLoginScreen() {
  const navigation = useNavigation();
  const [adminId, setAdminId] = useState("");
  const [adminPw, setAdminPw] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false); // ⏱️ 연타 방지 및 로딩 쉴드

  // =========================================================
  // 🔥 [재호 찐 Auth 컨트롤러 연동] 관리자 마스터 로그인 엔진 가동
  // =========================================================
  const handleAdminLogin = async () => {
    if (!adminId.trim() || !adminPw.trim()) {
      Alert.alert("입력 오류", "관리자 ID와 비밀번호를 모두 입력해 주십시오.");
      return;
    }

    try {
      setIsSubmitting(true);
      console.log(`🛰️ [관리자 인증 타격] ID: ${adminId} 기지국 무전 송신 시작...`);

      // 🎯 [명찰 싱크 완료] 재호 분의 AdminLoginRequest 장부 규격에 맞춰 adminId와 password로 포장
      const response = await axios.post(`${BASE_URL}/api/admin/auth/login`, {
        adminId: adminId.trim(),
        password: adminPw.trim()
      });

      console.log("▶️ [관리자 인증 수신] 응답 장부 검문 결과:", response.data);

      if (response.data.success || response.status === 200) {
        
        // 🔑 [🚨 토큰 유실 에러 전면 차단 3중 안전벨트]
        // 백엔드 응답 그릇 구조에서 어떤 명찰로 토큰을 반환하든 예외 없이 가로챕니다.
        const token = 
          response.data?.data?.token || 
          response.data?.data?.accessToken || 
          response.data?.token || 
          response.data?.accessToken;

        if (token) {
          // 🔑 [금고 분리 저축] 일반 유저와 꼬이지 않게 'adminToken' 명찰로 분리 낙찰
          await AsyncStorage.setItem("adminToken", token);
          console.log("🔒 [금고 박제 완료] 마스터 adminToken 저장 완료!");

          Alert.alert("인증 성공", "관리자 시스템 연결이 완료되었습니다.", [
            { 
              text: "확인", 
              onPress: () => navigation.navigate("AdminDashboard") // 📊 메인 관제판으로 워프
            }
          ]);
        } else {
          Alert.alert("인증 오류", "백엔드에서 발급된 관리자 토큰 정보가 유실되었습니다.");
        }
      } else {
        Alert.alert("로그인 실패", response.data.message || "관리자 계정 정보가 일치하지 않습니다.");
      }
    } catch (error) {
      console.error("🚨 [관리자 로그인 통신 대실패]:", error.message);
      Alert.alert("통신 오류", "백엔드 서버 연결에 실패했습니다. 서버 상태를 확인해 주십시오.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <InnerContainer>
            {/* 1. 상단 타이틀 */}
            <Title>관리자 로그인</Title>

            {/* 2. 중앙 메인 로고 */}
            <LogoContainer>
              <MainLogo source={bellLogo} resizeMode="contain" />
            </LogoContainer>

            {/* 3. 로그인 폼 (민트색 둥근 테두리) */}
            <InputWrapper>
              <StyledInput 
                placeholder="관리자 ID" 
                value={adminId}
                onChangeText={setAdminId}
                placeholderTextColor="#BBB"
                autoCapitalize="none"
                editable={!isSubmitting}
              />
              <Divider />
              <StyledInput 
                placeholder="비밀번호" 
                value={adminPw}
                onChangeText={setAdminPw}
                secureTextEntry={true}
                placeholderTextColor="#BBB"
                editable={!isSubmitting}
              />
            </InputWrapper>

            {/* 4. 로그인 버튼 */}
            <LoginBtn opacity={isSubmitting ? 0.6 : 1} onPress={handleAdminLogin} disabled={isSubmitting}>
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <LoginBtnText>로그인</LoginBtnText>
              )}
            </LoginBtn>

            {/* 5. 하단 사용자 로그인 전환 링크 (자연스러운 스크롤 하단 배치 피팅 완료) */}
            <Footer>
              <TouchableOpacity onPress={() => navigation.navigate("ResidentLogin")} disabled={isSubmitting}>
                <FooterText>일반 사용자 로그인</FooterText>
              </TouchableOpacity>
            </Footer>
          </InnerContainer>
        </ScrollView>
      </KeyboardAvoidingView>
    </Container>
  );
}

/* ================= 스타일 정의 (시안 100% 보존 및 자판 왜곡 결함 제거) ================= */
const Container = styled(SafeAreaView)`
  flex: 1;
  background-color: #F8F9FA;
`;

const InnerContainer = styled.View`
  flex: 1;
  padding: 40px 40px 60px 40px;
  align-items: center;
  justify-content: center;
  min-height: ${SCREEN_HEIGHT * 0.85}px;
`;

const Title = styled.Text`
  font-size: 32px;
  font-weight: 900;
  color: #06F393;
  margin-bottom: 40px;
`;

const LogoContainer = styled.View`
  margin-bottom: 50px;
`;

const MainLogo = styled.Image`
  width: 180px;
  height: 180px;
`;

const InputWrapper = styled.View`
  width: 100%;
  background-color: #fff;
  border-radius: 20px;
  border-width: 2px;
  border-color: #06F393;
  padding: 5px 20px;
  margin-bottom: 20px;
`;

const StyledInput = styled.TextInput`
  width: 100%;
  height: 55px;
  font-size: 16px;
  color: #333;
`;

const Divider = styled.View`
  width: 100%;
  height: 1px;
  background-color: #06F393;
  opacity: 0.3;
`;

const LoginBtn = styled.TouchableOpacity`
  width: 100%;
  background-color: #06F393;
  padding: 18px;
  border-radius: 20px;
  align-items: center;
  margin-bottom: 25px;
  justify-content: center;
  height: 58px;
`;

const LoginBtnText = styled.Text`
  color: #fff;
  font-size: 18px;
  font-weight: 800;
`;

const Footer = styled.View`
  width: 100%;
  align-items: flex-end;
  padding-right: 5px;
  margin-top: 10px;
`;

const FooterText = styled.Text`
  font-size: 13px;
  color: #06F393;
  font-weight: 600;
  text-decoration-line: underline;
`;