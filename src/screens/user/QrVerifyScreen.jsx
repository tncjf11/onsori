import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import styled from "styled-components/native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BASE_URL from "../../api/config";

export default function QrVerifyScreen({ navigation, route }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    requestPermission();
  }, []);

  // 카메라 권한 상태 확인 중
  if (!permission) {
    return (
      <Container>
        <ActivityIndicator size="large" color="#06F393" />

        <Text
          style={{
            marginTop: 15,
            color: "#777",
            fontSize: 15,
            fontWeight: "600",
          }}
        >
          카메라 권한 확인 중...
        </Text>
      </Container>
    );
  }

  // 카메라 권한 거부
  if (!permission.granted) {
    return (
      <Container>
        <Text
          style={{
            textAlign: "center",
            color: "#666",
            fontSize: 15,
            fontWeight: "500",
            lineHeight: 23,
          }}
        >
          인터폰 단말기 연동을 위해{"\n"}
          카메라 권한이 필요합니다.
        </Text>

        <TouchableOpacity
          onPress={requestPermission}
          style={{ marginTop: 25 }}
        >
          <Text
            style={{
              color: "#06F393",
              fontSize: 16,
              fontWeight: "bold",
              textDecorationLine: "underline",
            }}
          >
            권한 허용하기
          </Text>
        </TouchableOpacity>
      </Container>
    );
  }

  /**
   * QR / 직접입력으로 받은 deviceUid를
   * 백엔드에 실제로 페어링 요청
   */
  const requestDevicePairing = async (deviceUid) => {
    const safeDeviceUid = String(deviceUid || "").trim();

    if (!safeDeviceUid) {
      Alert.alert("알림", "코드를 입력해 주세요.");
      setScanned(false);
      return;
    }

    try {
      setIsLoading(true);

      /*
       * 로그인 화면에서 route.params로 token을 넘겼다면 우선 사용하고,
       * 없으면 AsyncStorage의 accessToken 사용
       */
      const routeToken = route.params?.token;
      const storedToken = await AsyncStorage.getItem("accessToken");

      const realJwtToken = routeToken || storedToken;

      /*
       * 현재 로그인 사용자 ID
       *
       * 이후 "이전에 QR 인증한 사용자와 같은 사람인지"
       * 확인하기 위해 pairedUserId로 저장
       */
      const routeUserId = route.params?.userId;
      const storedUserId = await AsyncStorage.getItem("userId");

      const currentUserId =
        routeUserId !== undefined && routeUserId !== null
          ? String(routeUserId)
          : storedUserId;

      // JWT 자체가 없으면 QR 인증 요청 불가능
      if (!realJwtToken) {
        Alert.alert(
          "로그인 정보 없음",
          "로그인 정보가 없습니다. 다시 로그인해 주세요.",
          [
            {
              text: "확인",
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: "ResidentLogin" }],
                });
              },
            },
          ]
        );

        return;
      }

      console.log("[QR_PAIRING] 페어링 요청", {
        deviceUid: safeDeviceUid,
        userId: currentUserId,
      });

      const response = await axios.post(
        `${BASE_URL}/api/device-pairings`,
        {
          deviceUid: safeDeviceUid,
        },
        {
          headers: {
            Authorization: `Bearer ${realJwtToken}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );

      console.log("[QR_PAIRING] 페어링 응답", response.data);

      if (response.data?.success && response.data?.data) {
        /*
         * 서버가 deviceUid를 돌려주면 서버 값을 우선 사용.
         * 없으면 QR에서 읽은 값을 사용.
         */
        const verifiedDeviceUid =
          response.data?.data?.deviceUid || safeDeviceUid;

        /*
         * 현재 로그인용 JWT 저장
         */
        await AsyncStorage.setItem(
          "accessToken",
          String(realJwtToken)
        );

        /*
         * QR 인증 상태는 계속 유지한다.
         *
         * 이후 로그아웃하더라도 아래 3개는 삭제하지 않으면
         * 같은 사용자 재로그인 시 QR을 다시 찍을 필요가 없음.
         */
        await AsyncStorage.setItem(
          "isVerifiedUser",
          "true"
        );

        await AsyncStorage.setItem(
          "deviceUid",
          String(verifiedDeviceUid)
        );

        /*
         * 어떤 사용자가 이 기기를 인증했는지 저장
         *
         * 다른 카카오 계정이 로그인했을 때
         * 이전 사용자의 기기를 그대로 사용하는 것을 방지
         */
        if (currentUserId) {
          await AsyncStorage.setItem(
            "pairedUserId",
            String(currentUserId)
          );
        }

        console.log("[QR_PAIRING] 인증 정보 저장 완료", {
          deviceUid: verifiedDeviceUid,
          pairedUserId: currentUserId,
        });

        Alert.alert(
          "연동 완료",
          "디바이스가 정상적으로 등록되었습니다!",
          [
            {
              text: "확인",
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: "MainTab" }],
                });
              },
            },
          ]
        );

        return;
      }

      throw new Error(
        response.data?.message || "기기 인증 처리에 실패했습니다."
      );
    } catch (error) {
      console.log(
        "[QR_PAIRING] 인증 실패:",
        error?.response?.data || error?.message
      );

      const status = error?.response?.status;

      const serverMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message;

      /*
       * 중요:
       * 예전처럼 실패해도
       *
       * isVerifiedUser = true
       * deviceUid 저장
       * MainTab 이동
       *
       * 하면 절대 안 됨.
       */

      if (status === 401 || status === 403) {
        /*
         * JWT가 만료되거나 유효하지 않은 경우
         *
         * 현재 로그인 토큰만 삭제.
         * 과거 정상적으로 인증했던 기기 정보까지
         * 여기서 무조건 지우지는 않음.
         */
        await AsyncStorage.removeItem("accessToken");

        Alert.alert(
          "로그인 만료",
          "로그인 정보가 만료되었습니다. 다시 로그인해 주세요.",
          [
            {
              text: "확인",
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: "ResidentLogin" }],
                });
              },
            },
          ]
        );

        return;
      }

      Alert.alert(
        "연동 실패",
        serverMessage || "디바이스 연동에 실패했습니다.",
        [
          {
            text: "확인",
            onPress: () => {
              // 다시 QR 인식할 수 있도록 초기화
              setScanned(false);
            },
          },
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * QR 스캔
   */
  const handleBarCodeScanned = ({ data }) => {
    if (isLoading) {
      return;
    }

    setScanned(true);

    try {
      const rawData = String(data || "").trim();

      console.log("[QR_SCAN] RAW:", rawData);

      /*
       * QR 내용 예시
       *
       * DEVICE-001
       *
       * 또는
       *
       * https://...?...deviceUid=DEVICE-001
       *
       * 또는
       *
       * voicenotice://pair?deviceUid=DEVICE-001
       */
      if (
        rawData.includes("http://") ||
        rawData.includes("https://") ||
        rawData.includes("voicenotice://")
      ) {
        const match = rawData.match(/[?&]deviceUid=([^&]+)/i);

        const parsedDeviceUid = match
          ? decodeURIComponent(match[1])
          : rawData;

        requestDevicePairing(parsedDeviceUid);

        return;
      }

      // QR 자체가 deviceUid인 경우
      requestDevicePairing(rawData);
    } catch (error) {
      console.log("[QR_SCAN] QR 파싱 오류:", error);

      requestDevicePairing(data);
    }
  };

  /**
   * 기기코드 직접 입력
   */
  const handleManualVerify = () => {
    const safeCode = manualCode.trim();

    if (!safeCode) {
      Alert.alert("알림", "코드를 입력해 주세요.");
      return;
    }

    if (isLoading) {
      return;
    }

    setScanned(true);
    requestDevicePairing(safeCode);
  };

  return (
    <Container>
      <Header>
        <TitleText>QR 인증</TitleText>
      </Header>

      <ScannerContainer>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          onBarcodeScanned={
            scanned || isLoading
              ? undefined
              : handleBarCodeScanned
          }
          barcodeSettings={{
            barcodeTypes: ["qr"],
          }}
        />

        <OverlayContainer pointerEvents="none">
          <GuideBox>
            <CornerTopLeft />
            <CornerTopRight />
            <CornerBottomLeft />
            <CornerBottomRight />
          </GuideBox>
        </OverlayContainer>
      </ScannerContainer>

      {isLoading ? (
        <View
          style={{
            marginTop: 40,
            alignItems: "center",
          }}
        >
          <ActivityIndicator
            size="large"
            color="#06F393"
          />

          <Text
            style={{
              color: "#999",
              marginTop: 12,
              fontWeight: "600",
              fontSize: 14,
            }}
          >
            기기 보안 검증 중...
          </Text>
        </View>
      ) : (
        <InstructionText>
          사각 테두리 안에 QR 코드를{"\n"}
          인식해 주세요.
        </InstructionText>
      )}

      <InputWrapper
        style={{
          opacity: isLoading ? 0.5 : 1,
        }}
      >
        <InputBox>
          <StyledInput
            placeholder="코드 직접 입력"
            value={manualCode}
            onChangeText={setManualCode}
            placeholderTextColor="#BBB"
            editable={!isLoading}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={handleManualVerify}
          />

          {manualCode.length > 0 && !isLoading && (
            <TouchableOpacity
              onPress={() => setManualCode("")}
            >
              <Ionicons
                name="close-circle"
                size={20}
                color="#CCC"
              />
            </TouchableOpacity>
          )}
        </InputBox>

        <VerifyButton
          onPress={handleManualVerify}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          <VerifyButtonText>
            인증
          </VerifyButtonText>
        </VerifyButton>
      </InputWrapper>
    </Container>
  );
}

const Container = styled.View`
  flex: 1;
  background-color: white;
  align-items: center;
  justify-content: center;
`;

const Header = styled.View`
  margin-bottom: 40px;
`;

const TitleText = styled.Text`
  font-size: 24px;
  font-weight: 800;
  color: #333;
`;

const ScannerContainer = styled.View`
  width: 280px;
  height: 280px;
  background-color: #eee;
  border-radius: 20px;
  overflow: hidden;
  position: relative;
`;

const OverlayContainer = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
`;

const GuideBox = styled.View`
  width: 200px;
  height: 200px;
  position: relative;
`;

const Corner = styled.View`
  position: absolute;
  width: 40px;
  height: 40px;
  border-color: #ffeb00;
`;

const CornerTopLeft = styled(Corner)`
  border-top-width: 5px;
  border-left-width: 5px;
  top: 0;
  left: 0;
`;

const CornerTopRight = styled(Corner)`
  border-top-width: 5px;
  border-right-width: 5px;
  top: 0;
  right: 0;
`;

const CornerBottomLeft = styled(Corner)`
  border-bottom-width: 5px;
  border-left-width: 5px;
  bottom: 0;
  left: 0;
`;

const CornerBottomRight = styled(Corner)`
  border-bottom-width: 5px;
  border-right-width: 5px;
  bottom: 0;
  right: 0;
`;

const InstructionText = styled.Text`
  font-size: 18px;
  font-weight: 700;
  color: #555;
  text-align: center;
  margin-top: 40px;
  line-height: 26px;
`;

const InputWrapper = styled.View`
  position: absolute;
  bottom: 50px;
  flex-direction: row;
  width: 90%;
  align-items: center;
`;

const InputBox = styled.View`
  flex: 1;
  height: 50px;
  background-color: #f8f9fa;
  border-radius: 12px;
  flex-direction: row;
  align-items: center;
  padding: 0 15px;
  margin-right: 10px;
  border-width: 1px;
  border-color: #eee;
`;

const StyledInput = styled.TextInput`
  flex: 1;
  font-size: 15px;
  color: #333;
`;

const VerifyButton = styled.TouchableOpacity`
  background-color: #06f393;
  padding: 12px 20px;
  border-radius: 12px;
  height: 50px;
  justify-content: center;
`;

const VerifyButtonText = styled.Text`
  color: white;
  font-weight: 800;
  font-size: 15px;
`;