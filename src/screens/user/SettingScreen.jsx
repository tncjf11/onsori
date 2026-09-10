import React, { useState, useEffect } from "react";
import {
  ScrollView,
  TouchableOpacity,
  Modal,
  Dimensions,
  Alert,
  Platform,
} from "react-native";
import styled from "styled-components/native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView as SafeAreaContainer } from "react-native-safe-area-context";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

import BASE_URL from "../../api/config";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const bellIcon = require("../../assets/bell.png");
const checkOn = require("../../assets/check_on.png");
const checkOff = require("../../assets/check_off.png");
const arrowRight = require("../../assets/arrow_right.png");
const logoutIcon = require("../../assets/logout_icon.png");
const deleteUserIcon = require("../../assets/delete_user_icon.png");

const logoutOverlayImg = require("../../assets/logout_overlay.png");
const deleteUserOverlayImg = require("../../assets/delete_user_overlay.png");

/**
 * =========================================================
 * Expo Go 여부
 * =========================================================
 *
 * Expo Go에서는 Android Remote Push가 지원되지 않으므로
 * expo-notifications 자체를 불러오지 않는다.
 *
 * 중요:
 * 파일 상단에서
 *
 * import * as Notifications from "expo-notifications";
 *
 * 를 하지 않는다.
 *
 * 그래야 Expo Go 실행 시 expo-notifications 모듈 때문에
 * WARN / ERROR 메시지가 뜨는 것을 막을 수 있다.
 */
const IS_EXPO_GO =
  Constants.appOwnership === "expo";

/**
 * =========================================================
 * Logout Storage
 * =========================================================
 *
 * 로그아웃할 때 삭제할 정보
 *
 * 아래 QR 인증 정보는 삭제하지 않음:
 *
 * deviceUid
 * isVerifiedUser
 * pairedUserId
 *
 * 같은 계정으로 다시 로그인하면
 * QR 재인증 없이 사용할 수 있게 유지.
 */
const LOGOUT_STORAGE_KEYS = [
  "accessToken",
  "userName",
  "userId",

  // 다음 로그인 사용자 기준 Push Token 재등록
  "isPushTokenSaved",
  "registeredPushToken",

  // 진행 중 통화 정보
  "callStartTime",
];

/**
 * 아래 사용자 설정도 로그아웃해도 유지:
 *
 * callVibrate
 * callSound
 * subtitleVibrate
 */

export default function SettingScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  // =========================================================
  // 알림 설정
  // =========================================================

  const [isVibrateCall, setIsVibrateCall] =
    useState(false);

  const [isSoundCall, setIsSoundCall] =
    useState(false);

  const [
    isVibrateSubtitle,
    setIsVibrateSubtitle,
  ] = useState(false);

  // =========================================================
  // 사용자 정보
  // =========================================================

  const [userName, setUserName] =
    useState("로딩 중...");

  const [userId, setUserId] =
    useState("로딩 중...");

  // =========================================================
  // Modal
  // =========================================================

  const [
    isLogoutModalVisible,
    setIsLogoutModalVisible,
  ] = useState(false);

  const [
    isDeleteUserModalVisible,
    setIsDeleteUserModalVisible,
  ] = useState(false);

  // =========================================================
  // Push 서버 오류 표시
  // =========================================================

  const [
    showErrorBanner,
    setShowErrorBanner,
  ] = useState(false);

  // =========================================================
  // 설정 / 사용자 정보 불러오기
  // =========================================================

  const loadHardwareAndUserInfo = async () => {
    try {
      const [
        vCall,
        sCall,
        vSub,
        savedName,
        savedId,
      ] = await Promise.all([
        AsyncStorage.getItem("callVibrate"),
        AsyncStorage.getItem("callSound"),
        AsyncStorage.getItem("subtitleVibrate"),
        AsyncStorage.getItem("userName"),
        AsyncStorage.getItem("userId"),
      ]);

      setIsVibrateCall(
        vCall === "true"
      );

      setIsSoundCall(
        sCall === "true"
      );

      setIsVibrateSubtitle(
        vSub === "true"
      );

      setUserName(
        savedName ||
          "카카오 연동 유저"
      );

      setUserId(
        savedId ||
          "정보 없음"
      );

      console.log(
        "[SETTING] 설정 정보 로드 완료",
        {
          userId: savedId,
          userName: savedName,
          callVibrate: vCall,
          callSound: sCall,
          subtitleVibrate: vSub,
        }
      );
    } catch (error) {
      console.error(
        "[SETTING] 설정 정보 로드 실패:",
        error?.message
      );
    }
  };

  useEffect(() => {
    if (isFocused) {
      loadHardwareAndUserInfo();
    }
  }, [isFocused]);

  // =========================================================
  // expo-notifications 동적 로드
  // =========================================================

  const getNotificationsModule = () => {
    /**
     * Expo Go이면 모듈 자체를 로드하지 않음.
     *
     * 이게 이번 수정의 핵심.
     */
    if (IS_EXPO_GO) {
      return null;
    }

    try {
      /**
       * Development Build / Production Build에서만
       * expo-notifications 로드.
       */
      const Notifications =
        require("expo-notifications");

      return Notifications;
    } catch (error) {
      console.log(
        "[PUSH] expo-notifications 모듈 로드 불가:",
        error?.message
      );

      return null;
    }
  };

  // =========================================================
  // 실제 Expo Push Token 발급
  // =========================================================

  const getRealExpoPushToken = async () => {
    /**
     * =====================================================
     * Expo Go
     * =====================================================
     *
     * Push 기능을 아예 실행하지 않는다.
     *
     * expo-notifications 모듈도 로드하지 않기 때문에
     * Expo Go의 Push 관련 ERROR/WARN이 발생하지 않음.
     */
    if (IS_EXPO_GO) {
      console.log(
        "[PUSH] Expo Go 환경 - Push Token 등록 생략"
      );

      return null;
    }

    try {
      const Notifications =
        getNotificationsModule();

      if (!Notifications) {
        return null;
      }

      // =====================================================
      // Android Notification Channel
      // =====================================================

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync(
          "default",
          {
            name: "인터폰 알림",

            importance:
              Notifications.AndroidImportance.MAX,

            vibrationPattern: [
              0,
              250,
              250,
              250,
            ],
          }
        );
      }

      // =====================================================
      // 알림 권한 확인
      // =====================================================

      const {
        status: existingStatus,
      } =
        await Notifications.getPermissionsAsync();

      let finalStatus =
        existingStatus;

      // =====================================================
      // 권한 요청
      // =====================================================

      if (
        existingStatus !== "granted"
      ) {
        const { status } =
          await Notifications.requestPermissionsAsync();

        finalStatus =
          status;
      }

      if (
        finalStatus !== "granted"
      ) {
        console.log(
          "[PUSH] 알림 권한이 허용되지 않았습니다."
        );

        return null;
      }

      // =====================================================
      // EAS Project ID
      // =====================================================

      const projectId =
        Constants?.expoConfig
          ?.extra?.eas
          ?.projectId ??
        Constants?.easConfig
          ?.projectId;

      if (!projectId) {
        console.log(
          "[PUSH] EAS projectId 없음 - Push Token 발급 생략"
        );

        return null;
      }

      // =====================================================
      // Expo Push Token
      // =====================================================

      const tokenResponse =
        await Notifications.getExpoPushTokenAsync({
          projectId,
        });

      const expoPushToken =
        tokenResponse?.data;

      if (!expoPushToken) {
        console.log(
          "[PUSH] Expo Push Token 발급 결과 없음"
        );

        return null;
      }

      console.log(
        "[PUSH] Expo Push Token 발급 완료"
      );

      return expoPushToken;
    } catch (error) {
      /**
       * Push 관련 문제는
       * 앱 전체 기능을 막지 않음.
       */
      console.log(
        "[PUSH] Push Token 발급 생략:",
        error?.message
      );

      return null;
    }
  };

  // =========================================================
  // Push Token 서버 등록
  //
  // POST /api/push-tokens
  // =========================================================

  const savePushTokenToServer = async () => {
    /**
     * =====================================================
     * Expo Go에서는 여기서 바로 종료
     * =====================================================
     *
     * Push Token 요청 X
     * 권한 요청 X
     * expo-notifications 로드 X
     * 서버 POST X
     */
    if (IS_EXPO_GO) {
      setShowErrorBanner(false);

      console.log(
        "[PUSH] Expo Go 환경 - Push 기능 비활성"
      );

      return;
    }

    try {
      const accessToken =
        await AsyncStorage.getItem(
          "accessToken"
        );

      if (!accessToken) {
        console.log(
          "[PUSH] accessToken 없음 - Push Token 등록 생략"
        );

        return;
      }

      // =====================================================
      // 실제 Expo Token
      // =====================================================

      const expoPushToken =
        await getRealExpoPushToken();

      /**
       * Push Token 발급 자체가 불가능하면
       * 서버 요청하지 않음.
       *
       * 가짜 Token도 전송하지 않음.
       */
      if (!expoPushToken) {
        setShowErrorBanner(false);

        return;
      }

      const [
        isPushSaved,
        registeredPushToken,
      ] = await Promise.all([
        AsyncStorage.getItem(
          "isPushTokenSaved"
        ),

        AsyncStorage.getItem(
          "registeredPushToken"
        ),
      ]);

      // =====================================================
      // 이미 동일 Token 등록 완료
      // =====================================================

      if (
        isPushSaved === "true" &&
        registeredPushToken ===
          expoPushToken
      ) {
        console.log(
          "[PUSH] 이미 등록된 Push Token"
        );

        setShowErrorBanner(false);

        return;
      }

      console.log(
        "[PUSH] 서버 등록 요청"
      );

      // =====================================================
      // 서버 등록
      // =====================================================

      const response =
        await axios.post(
          `${BASE_URL}/api/push-tokens`,
          {
            token:
              expoPushToken,
          },
          {
            headers: {
              Authorization:
                `Bearer ${accessToken}`,

              "Content-Type":
                "application/json",
            },

            timeout: 10000,
          }
        );

      console.log(
        "[PUSH] 서버 등록 응답:",
        {
          status:
            response.status,

          success:
            response.data
              ?.success,
        }
      );

      if (
        response.status >= 200 &&
        response.status < 300
      ) {
        await AsyncStorage.multiSet([
          [
            "isPushTokenSaved",
            "true",
          ],

          [
            "registeredPushToken",
            expoPushToken,
          ],
        ]);

        setShowErrorBanner(false);

        console.log(
          "[PUSH] Push Token 서버 저장 완료"
        );

        return;
      }

      throw new Error(
        response.data?.message ||
          "Push Token 등록 실패"
      );
    } catch (error) {
      console.error(
        "[PUSH] Push Token 서버 등록 실패:",
        error?.response?.data ||
          error?.message
      );

      setShowErrorBanner(true);
    }
  };

  // =========================================================
  // 화면 진입 시 Push 등록
  // =========================================================

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    /**
     * Expo Go에서는
     * savePushTokenToServer가 바로 종료됨.
     */
    savePushTokenToServer();
  }, [isFocused]);

  // =========================================================
  // 알림 설정 변경
  // =========================================================

  const toggleSetting = async (
    type
  ) => {
    try {
      // =====================================================
      // 호출 진동
      // =====================================================

      if (
        type === "vibrateCall"
      ) {
        const next =
          !isVibrateCall;

        setIsVibrateCall(
          next
        );

        await AsyncStorage.setItem(
          "callVibrate",
          String(next)
        );

        console.log(
          "[SETTING] 인터폰 호출 진동:",
          next
        );

        return;
      }

      // =====================================================
      // 호출 소리
      // =====================================================

      if (
        type === "soundCall"
      ) {
        const next =
          !isSoundCall;

        setIsSoundCall(
          next
        );

        await AsyncStorage.setItem(
          "callSound",
          String(next)
        );

        console.log(
          "[SETTING] 인터폰 호출 소리:",
          next
        );

        return;
      }

      // =====================================================
      // 자막 진동
      // =====================================================

      if (
        type ===
        "vibrateSubtitle"
      ) {
        const next =
          !isVibrateSubtitle;

        setIsVibrateSubtitle(
          next
        );

        await AsyncStorage.setItem(
          "subtitleVibrate",
          String(next)
        );

        console.log(
          "[SETTING] 자막 발생 진동:",
          next
        );

        return;
      }
    } catch (error) {
      console.error(
        "[SETTING] 설정 저장 실패:",
        error?.message
      );

      Alert.alert(
        "설정 저장 실패",
        "설정을 저장하지 못했습니다."
      );
    }
  };

  // =========================================================
  // 로그아웃
  // =========================================================

  const handleLogoutConfirm =
    async () => {
      try {
        setIsLogoutModalVisible(
          false
        );

        /**
         * QR 인증 정보는 유지:
         *
         * deviceUid
         * isVerifiedUser
         * pairedUserId
         */

        await AsyncStorage.multiRemove(
          LOGOUT_STORAGE_KEYS
        );

        /**
         * 알림 설정도 유지:
         *
         * callVibrate
         * callSound
         * subtitleVibrate
         */

        console.log(
          "[SETTING] 로그아웃 완료"
        );

        navigation.reset({
          index: 0,

          routes: [
            {
              name:
                "ResidentLogin",
            },
          ],
        });
      } catch (error) {
        console.error(
          "[SETTING] 로그아웃 처리 실패:",
          error?.message
        );

        Alert.alert(
          "로그아웃 실패",
          "로그아웃 처리 중 오류가 발생했습니다."
        );
      }
    };

  // =========================================================
  // 회원탈퇴
  // =========================================================

  const handleDeleteUserConfirm =
    async () => {
      try {
        setIsDeleteUserModalVisible(
          false
        );

        /**
         * 현재 백엔드 회원탈퇴 API 미연결.
         *
         * AsyncStorage만 삭제하고
         * 실제 탈퇴가 된 것처럼 처리하지 않음.
         */

        Alert.alert(
          "회원탈퇴 기능 준비 중",
          "현재 서버에 회원탈퇴 API가 연결되어 있지 않아 계정을 삭제할 수 없습니다.\n\n백엔드 회원탈퇴 API가 추가된 후 연결해 주세요."
        );
      } catch (error) {
        console.error(
          "[SETTING] 회원탈퇴 처리 실패:",
          error?.message
        );
      }
    };

  // =========================================================
  // UI
  // =========================================================

  return (
    <Container>
      {/* ================= HEADER ================= */}

      <Header>
        <Logo
          source={bellIcon}
          resizeMode="contain"
        />

        <HeaderTitle>
          설정
        </HeaderTitle>
      </Header>

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* ================= 알림 ================= */}

        <SectionContainer>
          <SectionLabel>
            알림
          </SectionLabel>

          {/* 호출 진동 */}

          <SettingItem
            activeOpacity={0.7}
            onPress={() =>
              toggleSetting(
                "vibrateCall"
              )
            }
          >
            <ItemText>
              인터폰 호출 시 진동
            </ItemText>

            <CheckBoxContainer>
              <BoxBase
                source={checkOff}
              />

              {isVibrateCall && (
                <CheckMark
                  source={checkOn}
                />
              )}
            </CheckBoxContainer>
          </SettingItem>

          {/* 호출 소리 */}

          <SettingItem
            activeOpacity={0.7}
            onPress={() =>
              toggleSetting(
                "soundCall"
              )
            }
          >
            <ItemText>
              인터폰 호출 시 소리
            </ItemText>

            <CheckBoxContainer>
              <BoxBase
                source={checkOff}
              />

              {isSoundCall && (
                <CheckMark
                  source={checkOn}
                />
              )}
            </CheckBoxContainer>
          </SettingItem>

          {/* 자막 진동 */}

          <SettingItem
            activeOpacity={0.7}
            onPress={() =>
              toggleSetting(
                "vibrateSubtitle"
              )
            }
          >
            <ItemText>
              대화 자막 발생 시 진동
            </ItemText>

            <CheckBoxContainer>
              <BoxBase
                source={checkOff}
              />

              {isVibrateSubtitle && (
                <CheckMark
                  source={checkOn}
                />
              )}
            </CheckBoxContainer>
          </SettingItem>
        </SectionContainer>

        {/* ================= 설정 ================= */}

        <SectionContainer>
          <SectionLabel>
            설정
          </SectionLabel>

          <SettingLinkItem
            activeOpacity={0.6}
            onPress={() =>
              navigation.navigate(
                "DeviceSetting"
              )
            }
          >
            <ItemText>
              기기 설정
            </ItemText>

            <ArrowIcon
              source={arrowRight}
            />
          </SettingLinkItem>

          <SettingLinkItem
            activeOpacity={0.6}
            onPress={() =>
              navigation.navigate(
                "TermsPolicy"
              )
            }
          >
            <ItemText>
              약관 및 정책
            </ItemText>

            <ArrowIcon
              source={arrowRight}
            />
          </SettingLinkItem>
        </SectionContainer>

        {/* ================= 계정 ================= */}

        <SectionContainer>
          <SectionLabel>
            계정 관리
          </SectionLabel>

          <InfoRow>
            <InfoLabel>
              회원 아이디
            </InfoLabel>

            <InfoValue>
              {userId}
            </InfoValue>
          </InfoRow>

          <InfoRow>
            <InfoLabel>
              연결된 계정
            </InfoLabel>

            <InfoValue>
              (카카오) {userName}
            </InfoValue>
          </InfoRow>

          {/* 로그아웃 */}

          <ActionItem
            onPress={() =>
              setIsLogoutModalVisible(
                true
              )
            }
            style={{
              borderTopWidth: 1,
              borderTopColor:
                "#EEE",
              marginTop: 10,
            }}
          >
            <ActionLeft>
              <ActionIcon
                source={
                  logoutIcon
                }
              />

              <ActionText>
                로그아웃
              </ActionText>
            </ActionLeft>
          </ActionItem>

          {/* 회원탈퇴 */}

          <ActionItem
            onPress={() =>
              setIsDeleteUserModalVisible(
                true
              )
            }
          >
            <ActionLeft>
              <ActionIcon
                source={
                  deleteUserIcon
                }
              />

              <ActionText
                style={{
                  color:
                    "#FF4D4D",
                }}
              >
                회원탈퇴
              </ActionText>
            </ActionLeft>
          </ActionItem>
        </SectionContainer>

        {/* ================= FOOTER ================= */}

        <Footer>
          <InquiryText>
            기기 문의 222@hanseo.ac.kr    041 - 000 - 0000
          </InquiryText>
        </Footer>
      </ScrollView>

      {/* ================= ERROR TOAST ================= */}

      {showErrorBanner && (
        <ErrorToastRow>
          <Ionicons
            name="alert-circle"
            size={20}
            color="#fff"
            style={{
              marginRight: 8,
            }}
          />

          <ErrorToastText>
            푸시 알림 정보를 서버에 저장하지 못했습니다. 잠시 후 다시
            시도해 주세요.
          </ErrorToastText>

          <TouchableOpacity
            onPress={() =>
              setShowErrorBanner(
                false
              )
            }
          >
            <Ionicons
              name="close"
              size={18}
              color="#fff"
              style={{
                marginLeft: 10,
              }}
            />
          </TouchableOpacity>
        </ErrorToastRow>
      )}

      {/* ================= LOGOUT MODAL ================= */}

      <Modal
        transparent
        visible={
          isLogoutModalVisible
        }
        animationType="fade"
        onRequestClose={() =>
          setIsLogoutModalVisible(
            false
          )
        }
      >
        <OverlayBackground>
          <OverlayImageCard
            source={
              logoutOverlayImg
            }
            resizeMode="contain"
          >
            <TransparentButtonRow>
              {/* 로그아웃 확인 */}

              <TransparentTouchArea
                onPress={
                  handleLogoutConfirm
                }
              />

              {/* 취소 */}

              <TransparentTouchArea
                onPress={() =>
                  setIsLogoutModalVisible(
                    false
                  )
                }
              />
            </TransparentButtonRow>
          </OverlayImageCard>
        </OverlayBackground>
      </Modal>

      {/* ================= DELETE USER MODAL ================= */}

      <Modal
        transparent
        visible={
          isDeleteUserModalVisible
        }
        animationType="fade"
        onRequestClose={() =>
          setIsDeleteUserModalVisible(
            false
          )
        }
      >
        <OverlayBackground>
          <OverlayImageCard
            source={
              deleteUserOverlayImg
            }
            resizeMode="contain"
          >
            <TransparentButtonRow>
              {/* 탈퇴 확인 */}

              <TransparentTouchArea
                onPress={
                  handleDeleteUserConfirm
                }
              />

              {/* 취소 */}

              <TransparentTouchArea
                onPress={() =>
                  setIsDeleteUserModalVisible(
                    false
                  )
                }
              />
            </TransparentButtonRow>
          </OverlayImageCard>
        </OverlayBackground>
      </Modal>
    </Container>
  );
}

// =========================================================
// STYLE
// =========================================================

const Container = styled(
  SafeAreaContainer
)`
  flex: 1;
  background-color: #fff;
`;

const Header = styled.View`
  flex-direction: row;
  align-items: center;
  padding: 15px 20px;
  border-bottom-width: 1px;
  border-bottom-color: #eee;
`;

const Logo = styled.Image`
  width: 32px;
  height: 32px;
  margin-right: 10px;
`;

const HeaderTitle = styled.Text`
  font-size: 20px;
  font-weight: 800;
  color: #333;
`;

const SectionContainer = styled.View`
  padding: 20px 0 10px;
  border-bottom-width: 8px;
  border-bottom-color: #f8f9fa;
`;

const SectionLabel = styled.Text`
  font-size: 14px;
  color: #999;
  padding: 0 20px;
  margin-bottom: 10px;
  font-weight: 600;
`;

const SettingItem = styled.TouchableOpacity`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
`;

const SettingLinkItem = styled(
  SettingItem
)``;

const ItemText = styled.Text`
  font-size: 16px;
  color: #333;
  font-weight: 500;
`;

const CheckBoxContainer = styled.View`
  width: 24px;
  height: 24px;
  position: relative;
`;

const BoxBase = styled.Image`
  width: 24px;
  height: 24px;
`;

const CheckMark = styled.Image`
  width: 24px;
  height: 24px;
  position: absolute;
  top: 0;
  left: 0;
`;

const ArrowIcon = styled.Image`
  width: 18px;
  height: 18px;
`;

const InfoRow = styled.View`
  flex-direction: row;
  padding: 12px 20px;
`;

const InfoLabel = styled.Text`
  font-size: 14px;
  color: #999;
  width: 100px;
`;

const InfoValue = styled.Text`
  font-size: 14px;
  color: #555;
  flex: 1;
`;

const ActionItem = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  padding: 15px 20px;
`;

const ActionLeft = styled.View`
  flex-direction: row;
  align-items: center;
`;

const ActionIcon = styled.Image`
  width: 24px;
  height: 24px;
  margin-right: 8px;
`;

const ActionText = styled.Text`
  font-size: 15px;
  color: #333;
  font-weight: 600;
`;

const Footer = styled.View`
  padding: 30px 20px;
  align-items: center;
`;

const InquiryText = styled.Text`
  font-size: 12px;
  color: #bbb;
`;

const OverlayBackground = styled.View`
  flex: 1;
  background-color: rgba(
    0,
    0,
    0,
    0.4
  );
  justify-content: center;
  align-items: center;
`;

const OverlayImageCard = styled.ImageBackground`
  width: ${SCREEN_WIDTH *
  0.8}px;

  height: ${SCREEN_WIDTH *
  0.8 *
  0.52}px;

  justify-content: flex-end;
  padding-bottom: 15px;
`;

const TransparentButtonRow = styled.View`
  flex-direction: row;
  width: 100%;
  height: 50px;
  padding-horizontal: 15px;
  justify-content: space-between;
`;

const TransparentTouchArea = styled.TouchableOpacity`
  width: 47%;
  height: 100%;
  background-color: transparent;
`;

const ErrorToastRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  background-color: #2d3748;
  padding: 14px 20px;
  position: absolute;
  bottom: 20px;
  left: 20px;
  right: 20px;
  border-radius: 15px;
  border-left-width: 5px;
  border-left-color: #ff4d4d;
  z-index: 9999;
`;

const ErrorToastText = styled.Text`
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  flex: 1;
`;