import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  CameraView,
  useCameraPermissions,
} from "expo-camera";
import styled from "styled-components/native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

import BASE_URL from "../../api/config";

export default function QrVerifyScreen({
  navigation,
  route,
}) {
  const [
    permission,
    requestPermission,
  ] = useCameraPermissions();

  const [scanned, setScanned] =
    useState(false);

  const [manualCode, setManualCode] =
    useState("");

  const [isLoading, setIsLoading] =
    useState(false);

  // =========================================================
  // 카메라 권한 요청
  // =========================================================

  useEffect(() => {
    requestPermission();
  }, []);

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <Container>
        <Text
          style={{
            textAlign: "center",
            color: "#666",
            fontSize: 15,
            fontWeight: "500",
          }}
        >
          인터폰 단말기 연동을 위해
          {"\n"}
          카메라 권한이 필요합니다.
        </Text>

        <TouchableOpacity
          onPress={requestPermission}
          style={{
            marginTop: 25,
          }}
        >
          <Text
            style={{
              color: "#06F393",
              fontSize: 16,
              fontWeight: "bold",
              textDecorationLine:
                "underline",
            }}
          >
            권한 허용하기
          </Text>
        </TouchableOpacity>
      </Container>
    );
  }

  // =========================================================
  // 기기 Pairing 요청
  // =========================================================

  const requestDevicePairing = async (
    deviceUid
  ) => {
    const safeDeviceUid =
      String(
        deviceUid || ""
      ).trim();

    if (!safeDeviceUid) {
      Alert.alert(
        "알림",
        "코드를 입력해 주세요."
      );

      setScanned(false);

      return;
    }

    try {
      setIsLoading(true);

      // =====================================================
      // JWT 확인
      // =====================================================

      const storedToken =
        await AsyncStorage.getItem(
          "accessToken"
        );

      const realJwtToken =
        route.params?.token ||
        storedToken;

      if (!realJwtToken) {
        Alert.alert(
          "로그인 필요",
          "로그인 정보가 없습니다. 다시 로그인해 주세요.",
          [
            {
              text: "확인",

              onPress: () =>
                navigation.replace(
                  "ResidentLogin"
                ),
            },
          ]
        );

        return;
      }

      // =====================================================
      // 현재 로그인 User ID 확인
      //
      // 최초 로그인 직후:
      // route.params.userId 사용
      //
      // 재연동:
      // AsyncStorage userId 사용
      // =====================================================

      const storedUserId =
        await AsyncStorage.getItem(
          "userId"
        );

      const currentUserId =
        route.params?.userId ||
        storedUserId;

      if (!currentUserId) {
        console.log(
          "[QR_VERIFY] 사용자 ID 없음",
          {
            routeUserId:
              route.params?.userId,

            storedUserId,
          }
        );

        Alert.alert(
          "로그인 정보 오류",
          "사용자 정보를 확인할 수 없습니다. 다시 로그인해 주세요.",
          [
            {
              text: "확인",

              onPress: async () => {
                await AsyncStorage.multiRemove([
                  "accessToken",
                  "userId",
                  "userName",
                ]);

                navigation.replace(
                  "ResidentLogin"
                );
              },
            },
          ]
        );

        return;
      }

      console.log(
        "[QR_VERIFY] 기기 연동 요청",
        {
          deviceUid:
            safeDeviceUid,

          userId:
            String(currentUserId),
        }
      );

      // =====================================================
      // 백엔드 Pairing 요청
      // =====================================================

      const response =
        await axios.post(
          `${BASE_URL}/api/device-pairings`,
          {
            deviceUid:
              safeDeviceUid,
          },
          {
            headers: {
              Authorization:
                `Bearer ${realJwtToken}`,

              "Content-Type":
                "application/json",
            },
          }
        );

      if (
        !response.data?.success ||
        !response.data?.data
      ) {
        throw new Error(
          response.data?.message ||
            "기기 연동에 실패했습니다."
        );
      }

      const pairedDeviceUid =
        response.data.data
          .deviceUid ||
        safeDeviceUid;

      // =====================================================
      // 백엔드 Pairing 성공 후에만 저장
      //
      // ★ pairedUserId 추가
      // =====================================================

      await AsyncStorage.multiSet([
        [
          "accessToken",
          String(realJwtToken),
        ],

        [
          "userId",
          String(currentUserId),
        ],

        [
          "isVerifiedUser",
          "true",
        ],

        [
          "deviceUid",
          String(
            pairedDeviceUid
          ),
        ],

        [
          "pairedUserId",
          String(
            currentUserId
          ),
        ],
      ]);

      console.log(
        "[QR_VERIFY] 기기 연동 완료",
        {
          deviceUid:
            pairedDeviceUid,

          pairedUserId:
            String(
              currentUserId
            ),
        }
      );

      Alert.alert(
        "연동 완료",
        "디바이스가 정상적으로 등록되었습니다!",
        [
          {
            text: "확인",

            onPress: () =>
              navigation.replace(
                "MainTab"
              ),
          },
        ]
      );
    } catch (error) {
      const status =
        error?.response?.status;

      const serverMessage =
        error?.response?.data
          ?.message ||
        error?.response?.data
          ?.error ||
        error?.message ||
        "기기 연동에 실패했습니다.";

      console.log(
        "[QR_VERIFY] QR 인증 실패",
        {
          status,

          response:
            error?.response?.data,

          message:
            error?.message,
        }
      );

      // 실패 시 다시 스캔 가능
      setScanned(false);

      // =====================================================
      // 인증 만료 / 권한 오류
      // =====================================================

      if (
        status === 401 ||
        status === 403
      ) {
        Alert.alert(
          "로그인 만료",
          "로그인 정보가 유효하지 않습니다. 다시 로그인해 주세요.",
          [
            {
              text: "확인",

              onPress: async () => {
                /**
                 * 로그인 정보만 삭제
                 *
                 * 기존 QR Pairing 정보는 남겨둠.
                 *
                 * 같은 사용자가 다시 로그인하면
                 * pairedUserId 비교 후 재사용 가능.
                 */
                await AsyncStorage.multiRemove([
                  "accessToken",
                  "userId",
                  "userName",
                ]);

                navigation.replace(
                  "ResidentLogin"
                );
              },
            },
          ]
        );

        return;
      }

      Alert.alert(
        "연동 실패",
        serverMessage
      );
    } finally {
      setIsLoading(false);
    }
  };

  // =========================================================
  // QR 스캔
  // =========================================================

  const handleBarCodeScanned = ({
    data,
  }) => {
    setScanned(true);

    try {
      const rawData =
        String(
          data || ""
        ).trim();

      if (
        rawData.includes(
          "http://"
        ) ||
        rawData.includes(
          "https://"
        ) ||
        rawData.includes(
          "voicenotice://"
        )
      ) {
        const match =
          rawData.match(
            /deviceUid=([^&]+)/
          );

        const parsedDeviceUid =
          match
            ? decodeURIComponent(
                match[1]
              )
            : rawData;

        requestDevicePairing(
          parsedDeviceUid
        );

        return;
      }

      requestDevicePairing(
        rawData
      );
    } catch {
      requestDevicePairing(
        data
      );
    }
  };

  // =========================================================
  // 수동 코드 인증
  // =========================================================

  const handleManualVerify = () => {
    const safeCode =
      manualCode.trim();

    if (
      safeCode.length > 0
    ) {
      requestDevicePairing(
        safeCode
      );
    } else {
      Alert.alert(
        "알림",
        "코드를 입력해 주세요."
      );
    }
  };

  // =========================================================
  // UI
  // =========================================================

  return (
    <Container>
      <Header>
        <TitleText>
          QR 인증
        </TitleText>
      </Header>

      <ScannerContainer>
        <CameraView
          style={
            StyleSheet
              .absoluteFillObject
          }
          onBarcodeScanned={
            scanned ||
            isLoading
              ? undefined
              : handleBarCodeScanned
          }
          barcodeSettings={{
            barcodeTypes: [
              "qr",
            ],
          }}
        />

        <OverlayContainer>
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
            alignItems:
              "center",
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
              fontWeight:
                "600",
              fontSize: 14,
            }}
          >
            기기 보안 검증 중...
          </Text>
        </View>
      ) : (
        <InstructionText>
          사각 테두리 안에 QR 코드를
          {"\n"}
          인식해 주세요.
        </InstructionText>
      )}

      <InputWrapper
        style={{
          opacity:
            isLoading
              ? 0.5
              : 1,
        }}
      >
        <InputBox>
          <StyledInput
            placeholder="코드 직접 입력"
            value={
              manualCode
            }
            onChangeText={
              setManualCode
            }
            placeholderTextColor="#BBB"
            editable={
              !isLoading
            }
          />

          {manualCode.length >
            0 &&
            !isLoading && (
              <TouchableOpacity
                onPress={() =>
                  setManualCode(
                    ""
                  )
                }
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
          onPress={
            handleManualVerify
          }
          disabled={
            isLoading
          }
        >
          <VerifyButtonText>
            인증
          </VerifyButtonText>
        </VerifyButton>
      </InputWrapper>
    </Container>
  );
}

// =========================================================
// STYLE
// =========================================================

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

const CornerTopLeft = styled(
  Corner
)`
  border-top-width: 5px;
  border-left-width: 5px;
  top: 0;
  left: 0;
`;

const CornerTopRight = styled(
  Corner
)`
  border-top-width: 5px;
  border-right-width: 5px;
  top: 0;
  right: 0;
`;

const CornerBottomLeft = styled(
  Corner
)`
  border-bottom-width: 5px;
  border-left-width: 5px;
  bottom: 0;
  left: 0;
`;

const CornerBottomRight = styled(
  Corner
)`
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