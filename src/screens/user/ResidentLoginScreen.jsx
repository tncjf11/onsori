import React, { useState, useEffect, useRef } from "react";
import {
  Dimensions,
  View,
  ActivityIndicator,
  Modal,
  TouchableOpacity,
  Text,
  Alert,
} from "react-native";
import { SafeAreaView as SafeAreaContainer } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { WebView } from "react-native-webview";
import styled from "styled-components/native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

import BASE_URL from "../../api/config";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const kakaoIcon = require("../../assets/kakao.png");
const helloBubbleImage = require("../../assets/hello.png");
const bellCharacterImage = require("../../assets/bell.png");
const yellowBarImage = require("../../assets/yellowbar.png");

const REST_API_KEY = "6995a27f1c3c0a59b90e27ae3b9cdbe1";
const CLIENT_SECRET = "bFbFbVNKgMN9O9GVTVY0qE3qzDrACDcp";
const REDIRECT_URI = `${BASE_URL}/login/oauth2/code/kakao`;

export default function ResidentLoginScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [showWebView, setShowWebView] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const authCodeHandledRef = useRef(false);

  useEffect(() => {
    const checkVerification = async () => {
      try {
        const isVerified = await AsyncStorage.getItem("isVerifiedUser");
        const accessToken = await AsyncStorage.getItem("accessToken");

        if (isVerified === "true" && accessToken) {
          navigation.replace("MainTab");
        }
      } catch (error) {
        console.error("인증 상태 확인 실패:", error?.message);
      } finally {
        setCheckingAuth(false);
      }
    };

    checkVerification();
  }, [navigation]);

  const openKakaoLogin = () => {
    authCodeHandledRef.current = false;
    setShowWebView(true);
  };

  const closeKakaoLogin = () => {
    setShowWebView(false);
    setLoading(false);
  };

  const handleWebViewNavigationStateChange = async (newNavState) => {
    const { url } = newNavState;

    if (!url || !url.startsWith(REDIRECT_URI)) return;
    if (!url.includes("code=")) return;
    if (authCodeHandledRef.current) return;

    authCodeHandledRef.current = true;
    setShowWebView(false);
    setLoading(true);

    try {
      const code = decodeURIComponent(url.split("code=")[1].split("&")[0]);

      const tokenResponse = await axios({
        method: "POST",
        url: "https://kauth.kakao.com/oauth/token",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
        },
        data:
          `grant_type=authorization_code` +
          `&client_id=${REST_API_KEY}` +
          `&redirect_uri=${REDIRECT_URI}` +
          `&code=${code}` +
          `&client_secret=${CLIENT_SECRET}`,
      });

      const kakaoAccessToken = tokenResponse.data?.access_token;

      if (!kakaoAccessToken) {
        Alert.alert("로그인 실패", "카카오 access token을 받지 못했습니다.");
        return;
      }

      const backendResponse = await axios.post(`${BASE_URL}/api/auth/kakao`, {
        accessToken: kakaoAccessToken,
      });

      if (backendResponse.data?.success && backendResponse.data?.data) {
        const backendJwtToken = backendResponse.data.data.accessToken;
        const userName = backendResponse.data.data.name || "사용자";
        const userId =
          backendResponse.data.data.id?.toString() || `kakao_${Date.now()}`;

        await AsyncStorage.setItem("userName", userName);
        await AsyncStorage.setItem("userId", userId);
        await AsyncStorage.setItem("callVibrate", "false");
        await AsyncStorage.setItem("callSound", "false");
        await AsyncStorage.setItem("subtitleVibrate", "false");

        Alert.alert("로그인 성공", `${userName}님 환영합니다!`, [
          {
            text: "확인",
            onPress: () =>
              navigation.replace("QrVerify", {
                token: backendJwtToken,
              }),
          },
        ]);
      } else {
        Alert.alert("로그인 실패", "서버 로그인 응답이 올바르지 않습니다.");
      }
    } catch (error) {
      console.error("로그인 실패:", error?.response?.data || error?.message);
      Alert.alert("로그인 실패", "서버 통신 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <Container style={{ justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#06F393" />
      </Container>
    );
  }

  return (
    <Container>
      <HeaderSection style={{ height: SCREEN_HEIGHT * 0.28 }}>
        <Gradient colors={["#06F393", "#79F7C8", "#DFFFF4"]}>
          <Welcome>WELCOME!</Welcome>
          <SubText>안녕하세요, 사용자 여러분!</SubText>
        </Gradient>
      </HeaderSection>

      <CardSection>
        <QRInfoText>로그인후 QR 인증해주세요!!</QRInfoText>

        <CharacterArea>
          <View
            style={{
              alignItems: "flex-end",
              width: "80%",
              marginBottom: -15,
              zIndex: 10,
            }}
          >
            <HelloBubble source={helloBubbleImage} resizeMode="contain" />
          </View>

          <BellCharacter source={bellCharacterImage} resizeMode="contain" />
        </CharacterArea>

        {loading && (
          <ActivityIndicator
            size="large"
            color="#06F393"
            style={{ marginBottom: 10 }}
          />
        )}

        <ButtonArea style={{ opacity: loading ? 0.6 : 1 }}>
          <ImageButton onPress={openKakaoLogin} disabled={loading}>
            <BarImageBackground source={yellowBarImage} resizeMode="stretch" />

            <ButtonContent>
              <Icon source={kakaoIcon} resizeMode="contain" />
              <ButtonText>카카오로 로그인하기</ButtonText>
            </ButtonContent>
          </ImageButton>
        </ButtonArea>

        <AdminLink
          onPress={() => navigation.navigate("AdminLogin")}
          disabled={loading}
        >
          <AdminText>관리자 페이지로 가기</AdminText>
        </AdminLink>
      </CardSection>

      <Modal
        visible={showWebView}
        animationType="slide"
        onRequestClose={closeKakaoLogin}
      >
        <SafeAreaContainer style={{ flex: 1, backgroundColor: "#f5f5f5" }}>
          <View
            style={{
              height: 50,
              justifyContent: "center",
              paddingHorizontal: 20,
              backgroundColor: "#f5f5f5",
            }}
          >
            <TouchableOpacity onPress={closeKakaoLogin}>
              <Text
                style={{
                  color: "#333",
                  fontSize: 16,
                  fontWeight: "bold",
                }}
              >
                취소하고 나가기
              </Text>
            </TouchableOpacity>
          </View>

          <WebView
            source={{
              uri:
                `https://kauth.kakao.com/oauth/authorize?response_type=code` +
                `&client_id=${REST_API_KEY}` +
                `&redirect_uri=${REDIRECT_URI}`,
            }}
            onNavigationStateChange={handleWebViewNavigationStateChange}
            startInLoadingState={true}
            renderLoading={() => (
              <ActivityIndicator
                size="large"
                color="#06F393"
                style={{ flex: 1 }}
              />
            )}
          />
        </SafeAreaContainer>
      </Modal>
    </Container>
  );
}

const Container = styled.View`
  flex: 1;
  background-color: white;
`;

const HeaderSection = styled.View`
  width: 100%;
`;

const Gradient = styled(LinearGradient)`
  flex: 1;
  justify-content: center;
  padding: 0 40px;
`;

const Welcome = styled.Text`
  font-size: 36px;
  font-weight: 900;
  color: white;
`;

const SubText = styled.Text`
  font-size: 16px;
  font-weight: 700;
  color: white;
  margin-top: 5px;
`;

const CardSection = styled.View`
  flex: 1;
  background-color: white;
  border-top-left-radius: 60px;
  border-top-right-radius: 60px;
  margin-top: -50px;
  padding: 40px 30px;
  align-items: center;
`;

const QRInfoText = styled.Text`
  font-size: 20px;
  font-weight: 900;
  color: #06F393;
  margin-bottom: 20px;
`;

const CharacterArea = styled.View`
  flex: 1;
  width: 100%;
  justify-content: center;
  align-items: center;
  position: relative;
`;

const HelloBubble = styled.Image`
  width: 140px;
  height: 60px;
`;

const BellCharacter = styled.Image`
  width: 100%;
  height: 85%;
`;

const ButtonArea = styled.View`
  width: 100%;
  padding-bottom: 10px;
  padding-top: 10px;
`;

const ImageButton = styled.TouchableOpacity`
  width: 100%;
  height: 70px;
  justify-content: center;
  align-items: center;
  margin-bottom: 12px;
  position: relative;
`;

const BarImageBackground = styled.Image`
  position: absolute;
  width: 100%;
  height: 100%;
  z-index: 1;
`;

const ButtonContent = styled.View`
  flex-direction: row;
  align-items: center;
  z-index: 2;
`;

const Icon = styled.Image`
  width: 28px;
  height: 28px;
  margin-left: -15px;
  margin-right: 5px;
  tint-color: #111;
`;

const ButtonText = styled.Text`
  font-size: 16px;
  font-weight: 800;
  color: #333;
`;

const AdminLink = styled.TouchableOpacity`
  align-self: flex-end;
  margin-top: 15px;
`;

const AdminText = styled.Text`
  font-size: 12px;
  font-weight: 800;
  color: #06F393;
`;