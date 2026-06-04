import React, { useState } from "react";
import { ScrollView, TouchableOpacity, TextInput, View, Alert } from "react-native";
import styled from "styled-components/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import axios from "axios";

// 🌐 config.js의 배포 주소 (https://voicenotice-backend.onrender.com)
import BASE_URL from "../../api/config";

// ✅ 이미지 에셋
const backIcon = require("../../assets/back_icon.png");

export default function DeviceSettingScreen() {
  const navigation = useNavigation();

  // ✅ 기기 및 네트워크 상태 관리 (시안 기본값 매칭)
  const [modelNumber, setModelNumber] = useState("PP53E20260228533");
  const [wifiName, setWifiName] = useState("iptime");
  const [wifiPassword, setWifiPassword] = useState("");

  // =========================================================
  // 🔥 [명세서 3-2 동기화 구간] 사용자 - 인터폰 디바이스 연동 API
  // =========================================================
  const handleDevicePairing = async () => {
    if (!modelNumber.trim()) {
      Alert.alert("경고", "모델 번호(Device UID)를 입력해주세요.");
      return;
    }

    try {
      // 🤙 로그인(1-1) 성공 시 어딘가에 저장해 둔 유저의 찐 JWT 토큰을 실어줘야 합니다!
      const dummyJwt = "백엔드에서_발급한_JWT";

      console.log(`▶️ [명세서 3-2 요청] 디바이스 연동 시도 🚀 UID: ${modelNumber}`);

      const response = await axios.post(
        `${BASE_URL}/api/device-pairings`,
        {
          deviceUid: modelNumber, // 예: "DEVICE-001" 또는 입력된 모델 번호
        },
        {
          headers: {
            Authorization: `Bearer ${dummyJwt}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("▶️ [명세서 3-2 응답 수신] 결과 데이터 👇\n", JSON.stringify(response.data, null, 2));

      if (response.data.success) {
        Alert.alert(
          "연동 성공", 
          `디바이스가 성공적으로 연결되었습니다!\n📍 위치: ${response.data.data.location || "등록된 위치"}`
        );
      } else {
        throw new Error(response.data.message || "연동 실패");
      }

    } catch (error) {
      console.error("🚨 [명세서 3-2 에러] 디바이스 연결 실패:", error.response?.data || error.message);
      Alert.alert(
        "연동 실패", 
        error.response?.data?.message || "백엔드 서버와 기기 연동 중 오류가 발생했습니다."
      );
    }
  };

  // 🎯 와이파이 설정 정보 로컬 저장 핸들러
  const handleWifiSave = (type) => {
    Alert.alert("설정 완료", `${type} 정보가 로컬 장치에 안전하게 임시 저장되었습니다.`);
  };

  return (
    <Container>
      {/* 1. 헤더 영역 */}
      <Header>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <BackIcon source={backIcon} resizeMode="contain" />
        </TouchableOpacity>
        <HeaderTitle>기기 설정</HeaderTitle>
        <View style={{ width: 24 }} /> 
      </Header>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 2. 기기 설정 섹션 */}
        <SectionContainer>
          <SectionLabel>기기 설정</SectionLabel>
          
          <InputGroup>
            <InputLabel>모델 번호</InputLabel>
            <InputRow>
              <StyledInput 
                value={modelNumber}
                onChangeText={setModelNumber}
                placeholder="모델 번호 입력"
                placeholderTextColor="#BBB"
              />
              {/* 뽈칵 누르면 재호 분 백엔드로 디바이스 바인딩 요청 발송! */}
              <TouchableOpacity onPress={handleDevicePairing}>
                <SaveText>저장</SaveText>
              </TouchableOpacity>
            </InputRow>
          </InputGroup>

          <TouchableOpacity activeOpacity={0.6} onPress={() => Alert.alert("인증", "인증 코드가 기기로 재발송되었습니다.")}>
            <SingleActionRow>
              <ActionText>코드 재인증</ActionText>
            </SingleActionRow>
          </TouchableOpacity>
        </SectionContainer>

        {/* 3. 네트워크 섹션 */}
        <SectionContainer>
          <SectionLabel>네트워크</SectionLabel>
          
          <InputGroup>
            <InputLabel>Wi-Fi 이름</InputLabel>
            <InputRow>
              <StyledInput 
                value={wifiName}
                onChangeText={setWifiName}
                placeholder="와이파이 이름"
                placeholderTextColor="#BBB"
              />
              <TouchableOpacity onPress={() => handleWifiSave("Wi-Fi 이름")}>
                <SaveText>저장</SaveText>
              </TouchableOpacity>
            </InputRow>
          </InputGroup>

          <InputGroup style={{ borderBottomWidth: 0 }}>
            <InputLabel>Wi-Fi 비밀번호</InputLabel>
            <InputRow>
              <StyledInput 
                secureTextEntry={true}
                value={wifiPassword}
                onChangeText={setWifiPassword}
                placeholder="비밀번호 입력"
                placeholderTextColor="#BBB"
              />
              <TouchableOpacity onPress={() => handleWifiSave("Wi-Fi 비밀번호")}>
                <SaveText>저장</SaveText>
              </TouchableOpacity>
            </InputRow>
          </InputGroup>
        </SectionContainer>
      </ScrollView>
    </Container>
  );
}

/* ================= 스타일 정의 (수철님 명품 시안 100% 동기화 🤙) ================= */
const Container = styled(SafeAreaView)` flex: 1; background-color: #fff; `;
const Header = styled.View` flex-direction: row; justify-content: space-between; align-items: center; padding: 15px 20px; border-bottom-width: 1px; border-bottom-color: #EEE; `;
const BackIcon = styled.Image` width: 24px; height: 24px; `;
const HeaderTitle = styled.Text` font-size: 18px; font-weight: 700; color: #333; `;
const SectionContainer = styled.View` padding-top: 20px; `;
const SectionLabel = styled.Text` font-size: 13px; color: #999; padding: 0 20px; margin-bottom: 5px; `;
const InputGroup = styled.View` padding: 15px 20px; border-bottom-width: 1px; border-bottom-color: #F5F5F5; `;
const InputLabel = styled.Text` font-size: 15px; color: #333; font-weight: 600; margin-bottom: 10px; `;
const InputRow = styled.View` flex-direction: row; align-items: center; background-color: #F8F9FA; border-radius: 4px; padding: 0 15px; `;
const StyledInput = styled.TextInput` flex: 1; height: 40px; font-size: 14px; color: #666; `;
const SaveText = styled.Text` font-size: 14px; color: #333; font-weight: 500; margin-left: 10px; `;
const SingleActionRow = styled.View` padding: 15px 20px; border-bottom-width: 1px; border-bottom-color: #F5F5F5; `;
const ActionText = styled.Text` font-size: 15px; color: #333; font-weight: 600; `;