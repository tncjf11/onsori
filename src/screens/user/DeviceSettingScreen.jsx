import React, { useEffect, useState } from "react";
import {
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import styled from "styled-components/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

import BASE_URL from "../../api/config";

// 이미지 에셋
const backIcon = require("../../assets/back_icon.png");

export default function DeviceSettingScreen() {
  const navigation = useNavigation();

  // =========================================================
  // 상태
  // =========================================================

  const [modelNumber, setModelNumber] = useState("");
  const [wifiName, setWifiName] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  // =========================================================
  // 저장된 기기 / Wi-Fi 정보 불러오기
  // =========================================================

  useEffect(() => {
    loadSavedSettings();
  }, []);

  const loadSavedSettings = async () => {
    try {
      const [
        savedDeviceUid,
        savedWifiName,
        savedWifiPassword,
      ] = await Promise.all([
        AsyncStorage.getItem("deviceUid"),
        AsyncStorage.getItem("wifiName"),
        AsyncStorage.getItem("wifiPassword"),
      ]);

      if (savedDeviceUid) {
        setModelNumber(savedDeviceUid);
      }

      if (savedWifiName) {
        setWifiName(savedWifiName);
      }

      if (savedWifiPassword) {
        setWifiPassword(savedWifiPassword);
      }
    } catch (error) {
      console.log(
        "[DEVICE_SETTING] 저장된 설정 불러오기 실패:",
        error
      );
    }
  };

  // =========================================================
  // 사용자 - 인터폰 디바이스 연동
  //
  // POST /api/device-pairings
  // Authorization: Bearer {JWT}
  // =========================================================

  const handleDevicePairing = async () => {
    const safeDeviceUid = modelNumber.trim();

    if (!safeDeviceUid) {
      Alert.alert(
        "경고",
        "모델 번호(Device UID)를 입력해주세요."
      );
      return;
    }

    if (isLoading) {
      return;
    }

    try {
      setIsLoading(true);

      // 실제 로그인 JWT
      const accessToken =
        await AsyncStorage.getItem("accessToken");

      // 현재 로그인 사용자
      const userId =
        await AsyncStorage.getItem("userId");

      if (!accessToken) {
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

      console.log(
        "[DEVICE_PAIRING] 디바이스 연동 요청:",
        {
          deviceUid: safeDeviceUid,
          userId,
        }
      );

      const response = await axios.post(
        `${BASE_URL}/api/device-pairings`,
        {
          deviceUid: safeDeviceUid,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },

          timeout: 10000,
        }
      );

      console.log(
        "[DEVICE_PAIRING] 응답:",
        JSON.stringify(response.data, null, 2)
      );

      if (
        response.data?.success &&
        response.data?.data
      ) {
        /*
         * 백엔드에서 deviceUid를 다시 내려주면
         * 서버 응답값을 우선 사용
         */
        const newDeviceUid =
          response.data.data.deviceUid ||
          safeDeviceUid;

        /*
         * 현재 앱에서 사용할 기기를
         * 새 기기로 변경
         */
        await AsyncStorage.setItem(
          "deviceUid",
          String(newDeviceUid)
        );

        /*
         * QR/기기 인증 완료 상태 유지
         */
        await AsyncStorage.setItem(
          "isVerifiedUser",
          "true"
        );

        /*
         * 최초 QR 인증 방식과 동일하게
         * 이 기기를 등록한 사용자 기록
         */
        if (userId) {
          await AsyncStorage.setItem(
            "pairedUserId",
            String(userId)
          );
        }

        // 화면에도 서버에서 확정된 UID 적용
        setModelNumber(String(newDeviceUid));

        const location =
          response.data.data.location ||
          "등록된 위치";

        Alert.alert(
          "연동 성공",
          `디바이스가 성공적으로 연결되었습니다!\n\n기기: ${newDeviceUid}\n위치: ${location}`
        );

        return;
      }

      throw new Error(
        response.data?.message ||
          "디바이스 연동에 실패했습니다."
      );
    } catch (error) {
      console.error(
        "[DEVICE_PAIRING] 디바이스 연결 실패:",
        error?.response?.data ||
          error?.message
      );

      const status =
        error?.response?.status;

      const serverMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message;

      // JWT 만료 / 인증 실패
      if (
        status === 401 ||
        status === 403
      ) {
        await AsyncStorage.removeItem(
          "accessToken"
        );

        Alert.alert(
          "로그인 만료",
          "로그인 정보가 만료되었습니다. 다시 로그인해 주세요.",
          [
            {
              text: "확인",
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [
                    { name: "ResidentLogin" },
                  ],
                });
              },
            },
          ]
        );

        return;
      }

      Alert.alert(
        "연동 실패",
        serverMessage ||
          "백엔드 서버와 기기 연동 중 오류가 발생했습니다."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // =========================================================
  // QR 코드 재인증
  // =========================================================

  const handleQrReverify = async () => {
    try {
      const accessToken =
        await AsyncStorage.getItem(
          "accessToken"
        );

      const userId =
        await AsyncStorage.getItem(
          "userId"
        );

      if (!accessToken) {
        Alert.alert(
          "로그인 정보 없음",
          "다시 로그인한 후 이용해 주세요.",
          [
            {
              text: "확인",
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [
                    { name: "ResidentLogin" },
                  ],
                });
              },
            },
          ]
        );

        return;
      }

      /*
       * 기존의
       *
       * "인증 코드가 기기로 재발송되었습니다."
       *
       * Alert만 띄우는 가짜 기능을 없애고
       * 실제 QR 인증 페이지로 이동
       */
      navigation.navigate("QrVerify", {
        token: accessToken,
        userId,
        isReverify: true,
      });
    } catch (error) {
      console.log(
        "[DEVICE_SETTING] QR 재인증 이동 실패:",
        error
      );

      Alert.alert(
        "오류",
        "QR 인증 화면을 불러오지 못했습니다."
      );
    }
  };

  // =========================================================
  // Wi-Fi 설정
  //
  // 현재 백엔드에 Wi-Fi 설정 API가 없으므로
  // 앱 내부 AsyncStorage에만 저장
  // =========================================================

  const handleWifiNameSave = async () => {
    const safeWifiName =
      wifiName.trim();

    if (!safeWifiName) {
      Alert.alert(
        "알림",
        "Wi-Fi 이름을 입력해주세요."
      );
      return;
    }

    try {
      await AsyncStorage.setItem(
        "wifiName",
        safeWifiName
      );

      setWifiName(safeWifiName);

      Alert.alert(
        "설정 완료",
        "Wi-Fi 이름이 앱에 저장되었습니다."
      );
    } catch (error) {
      console.log(
        "[DEVICE_SETTING] Wi-Fi 이름 저장 실패:",
        error
      );

      Alert.alert(
        "저장 실패",
        "Wi-Fi 이름을 저장하지 못했습니다."
      );
    }
  };

  const handleWifiPasswordSave = async () => {
    if (!wifiPassword) {
      Alert.alert(
        "알림",
        "Wi-Fi 비밀번호를 입력해주세요."
      );
      return;
    }

    try {
      await AsyncStorage.setItem(
        "wifiPassword",
        wifiPassword
      );

      Alert.alert(
        "설정 완료",
        "Wi-Fi 비밀번호가 앱에 저장되었습니다."
      );
    } catch (error) {
      console.log(
        "[DEVICE_SETTING] Wi-Fi 비밀번호 저장 실패:",
        error
      );

      Alert.alert(
        "저장 실패",
        "Wi-Fi 비밀번호를 저장하지 못했습니다."
      );
    }
  };

  // =========================================================
  // 화면
  // =========================================================

  return (
    <Container>
      {/* 헤더 */}
      <Header>
        <TouchableOpacity
          onPress={() =>
            navigation.goBack()
          }
        >
          <BackIcon
            source={backIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <HeaderTitle>
          기기 설정
        </HeaderTitle>

        <Spacer />
      </Header>

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        keyboardShouldPersistTaps="handled"
      >
        {/* ============================= */}
        {/* 기기 설정 */}
        {/* ============================= */}

        <SectionContainer>
          <SectionLabel>
            기기 설정
          </SectionLabel>

          <InputGroup>
            <InputLabel>
              모델 번호
            </InputLabel>

            <InputRow>
              <StyledInput
                value={modelNumber}
                onChangeText={
                  setModelNumber
                }
                placeholder="Device UID 입력"
                placeholderTextColor="#BBB"
                editable={!isLoading}
                autoCapitalize="none"
                autoCorrect={false}
              />

              {isLoading ? (
                <ActivityIndicator
                  size="small"
                  color="#06F393"
                />
              ) : (
                <TouchableOpacity
                  onPress={
                    handleDevicePairing
                  }
                >
                  <SaveText>
                    저장
                  </SaveText>
                </TouchableOpacity>
              )}
            </InputRow>
          </InputGroup>

          {/* 실제 QR 인증 페이지로 이동 */}
          <TouchableOpacity
            activeOpacity={0.6}
            onPress={
              handleQrReverify
            }
            disabled={isLoading}
          >
            <SingleActionRow>
              <ActionText>
                QR 코드 재인증
              </ActionText>
            </SingleActionRow>
          </TouchableOpacity>
        </SectionContainer>

        {/* ============================= */}
        {/* 네트워크 */}
        {/* ============================= */}

        <SectionContainer>
          <SectionLabel>
            네트워크
          </SectionLabel>

          <InputGroup>
            <InputLabel>
              Wi-Fi 이름
            </InputLabel>

            <InputRow>
              <StyledInput
                value={wifiName}
                onChangeText={
                  setWifiName
                }
                placeholder="Wi-Fi 이름"
                placeholderTextColor="#BBB"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TouchableOpacity
                onPress={
                  handleWifiNameSave
                }
              >
                <SaveText>
                  저장
                </SaveText>
              </TouchableOpacity>
            </InputRow>
          </InputGroup>

          <InputGroup
            style={{
              borderBottomWidth: 0,
            }}
          >
            <InputLabel>
              Wi-Fi 비밀번호
            </InputLabel>

            <InputRow>
              <StyledInput
                secureTextEntry
                value={wifiPassword}
                onChangeText={
                  setWifiPassword
                }
                placeholder="비밀번호 입력"
                placeholderTextColor="#BBB"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TouchableOpacity
                onPress={
                  handleWifiPasswordSave
                }
              >
                <SaveText>
                  저장
                </SaveText>
              </TouchableOpacity>
            </InputRow>
          </InputGroup>

          <WifiNotice>
            Wi-Fi 설정은 현재 서버와
            연동되지 않아 앱 내부에만
            저장됩니다.
          </WifiNotice>
        </SectionContainer>
      </ScrollView>
    </Container>
  );
}

// =========================================================
// 스타일
// =========================================================

const Container = styled(
  SafeAreaView
)`
  flex: 1;
  background-color: #fff;
`;

const Header = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom-width: 1px;
  border-bottom-color: #eee;
`;

const BackIcon = styled.Image`
  width: 24px;
  height: 24px;
`;

const Spacer = styled.View`
  width: 24px;
`;

const HeaderTitle = styled.Text`
  font-size: 18px;
  font-weight: 700;
  color: #333;
`;

const SectionContainer = styled.View`
  padding-top: 20px;
`;

const SectionLabel = styled.Text`
  font-size: 13px;
  color: #999;
  padding: 0 20px;
  margin-bottom: 5px;
`;

const InputGroup = styled.View`
  padding: 15px 20px;
  border-bottom-width: 1px;
  border-bottom-color: #f5f5f5;
`;

const InputLabel = styled.Text`
  font-size: 15px;
  color: #333;
  font-weight: 600;
  margin-bottom: 10px;
`;

const InputRow = styled.View`
  flex-direction: row;
  align-items: center;
  background-color: #f8f9fa;
  border-radius: 4px;
  padding: 0 15px;
`;

const StyledInput = styled.TextInput`
  flex: 1;
  height: 40px;
  font-size: 14px;
  color: #666;
`;

const SaveText = styled.Text`
  font-size: 14px;
  color: #333;
  font-weight: 500;
  margin-left: 10px;
`;

const SingleActionRow = styled.View`
  padding: 15px 20px;
  border-bottom-width: 1px;
  border-bottom-color: #f5f5f5;
`;

const ActionText = styled.Text`
  font-size: 15px;
  color: #333;
  font-weight: 600;
`;

const WifiNotice = styled.Text`
  margin: 15px 20px 30px 20px;
  font-size: 12px;
  line-height: 18px;
  color: #aaa;
`;