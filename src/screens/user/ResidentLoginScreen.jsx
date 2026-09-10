import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView as SafeAreaContainer } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import styled from "styled-components/native";

import BASE_URL from "../../api/config";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const kakaoIcon = require("../../assets/kakao.png");
const helloBubbleImage = require("../../assets/hello.png");
const bellCharacterImage = require("../../assets/bell.png");
const yellowBarImage = require("../../assets/yellowbar.png");

/**
 * 카카오 REST API KEY
 *
 * Client Secret은 프론트에 넣지 않음.
 */
const REST_API_KEY = "6995a27f1c3c0a59b90e27ae3b9cdbe1";

/**
 * BASE_URL 마지막 / 제거
 */
const CLEAN_BASE_URL = String(BASE_URL || "").replace(/\/+$/, "");

/**
 * 카카오 Redirect URI
 */
const REDIRECT_URI =
  `${CLEAN_BASE_URL}/login/oauth2/code/kakao`;

/**
 * 카카오 로그인 URL
 */
const KAKAO_AUTH_URL =
  `https://kauth.kakao.com/oauth/authorize` +
  `?response_type=code` +
  `&client_id=${encodeURIComponent(REST_API_KEY)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

// =========================================================
// URL Query Parameter
// =========================================================

const getQueryParameter = (
  url,
  parameterName
) => {
  if (!url || !parameterName) {
    return null;
  }

  try {
    const pattern = new RegExp(
      `[?&]${parameterName}=([^&#]*)`
    );

    const match = String(url).match(pattern);

    if (!match?.[1]) {
      return null;
    }

    return decodeURIComponent(
      match[1].replace(/\+/g, " ")
    );
  } catch (error) {
    console.log(
      "[RESIDENT_LOGIN] URL 파라미터 분석 실패:",
      error?.message
    );

    return null;
  }
};

const logResidentLogin = (message, data) => {
  if (data !== undefined) {
    console.log(
      `[RESIDENT_LOGIN] ${message}`,
      data
    );
  } else {
    console.log(
      `[RESIDENT_LOGIN] ${message}`
    );
  }
};

export default function ResidentLoginScreen({
  navigation,
}) {
  const [loading, setLoading] = useState(false);

  const [showWebView, setShowWebView] =
    useState(false);

  const [checkingAuth, setCheckingAuth] =
    useState(true);

  /**
   * WebView URL 변경이 여러 번 발생하므로
   * 같은 authorization code 중복 처리 방지
   */
  const authCodeHandledRef = useRef(false);

  // =========================================================
  // 기본 알림 설정
  // =========================================================

  const ensureDefaultSettings = async () => {
    try {
      const [
        callVibrate,
        callSound,
        subtitleVibrate,
      ] = await Promise.all([
        AsyncStorage.getItem("callVibrate"),
        AsyncStorage.getItem("callSound"),
        AsyncStorage.getItem("subtitleVibrate"),
      ]);

      const valuesToSet = [];

      if (callVibrate === null) {
        valuesToSet.push([
          "callVibrate",
          "false",
        ]);
      }

      if (callSound === null) {
        valuesToSet.push([
          "callSound",
          "false",
        ]);
      }

      if (subtitleVibrate === null) {
        valuesToSet.push([
          "subtitleVibrate",
          "false",
        ]);
      }

      if (valuesToSet.length > 0) {
        await AsyncStorage.multiSet(
          valuesToSet
        );

        logResidentLogin(
          "최초 알림 기본값 생성",
          valuesToSet.map(([key]) => key)
        );
      }
    } catch (error) {
      logResidentLogin(
        "기본 알림 설정 확인 실패",
        error?.message
      );
    }
  };

  // =========================================================
  // 현재 사용자의 QR Pairing 확인
  // =========================================================

  const checkUserPairing = async (
    currentUserId
  ) => {
    try {
      if (!currentUserId) {
        return {
          isPaired: false,
          deviceUid: null,
        };
      }

      const [
        isVerifiedUser,
        deviceUid,
        pairedUserId,
      ] = await Promise.all([
        AsyncStorage.getItem(
          "isVerifiedUser"
        ),
        AsyncStorage.getItem(
          "deviceUid"
        ),
        AsyncStorage.getItem(
          "pairedUserId"
        ),
      ]);

      const isSameUser =
        Boolean(pairedUserId) &&
        String(pairedUserId) ===
          String(currentUserId);

      const isPaired =
        isVerifiedUser === "true" &&
        Boolean(deviceUid) &&
        isSameUser;

      logResidentLogin(
        "QR Pairing 확인",
        {
          currentUserId:
            String(currentUserId),

          isVerifiedUser,

          hasDeviceUid:
            Boolean(deviceUid),

          pairedUserId,

          isSameUser,

          isPaired,
        }
      );

      return {
        isPaired,

        deviceUid:
          deviceUid
            ? String(deviceUid).trim()
            : null,
      };
    } catch (error) {
      logResidentLogin(
        "QR Pairing 확인 실패",
        error?.message
      );

      return {
        isPaired: false,
        deviceUid: null,
      };
    }
  };

  // =========================================================
  // 앱 시작 시 기존 로그인 상태 확인
  //
  // accessToken + userId + 동일 사용자 Pairing
  // → MainTab
  //
  // accessToken + userId 있지만 Pairing 없음
  // → QrVerify
  //
  // accessToken 없음
  // → 이전 로그인 사용자 정보 정리 후 로그인 화면
  // =========================================================

  useEffect(() => {
    let isCancelled = false;

    const checkVerification = async () => {
      try {
        await ensureDefaultSettings();

        const [
          accessToken,
          currentUserId,
        ] = await Promise.all([
          AsyncStorage.getItem(
            "accessToken"
          ),
          AsyncStorage.getItem(
            "userId"
          ),
        ]);

        logResidentLogin(
          "기존 로그인 확인",
          {
            hasAccessToken:
              Boolean(accessToken),

            userId:
              currentUserId,
          }
        );

        if (isCancelled) {
          return;
        }

        // ===================================================
        // 토큰이 없는 경우
        //
        // 예전 userId / userName이 남아 있으면 정리
        //
        // pairedUserId / deviceUid는 유지
        // → 같은 사용자가 다시 로그인하면
        //   기존 QR Pairing을 재사용할 수 있음
        // ===================================================

        if (!accessToken) {
          await AsyncStorage.multiRemove([
            "userId",
            "userName",
          ]);

          logResidentLogin(
            "accessToken 없음 - 이전 로그인 사용자 정보 정리"
          );

          return;
        }

        /**
         * 토큰은 있는데 userId가 없다면
         * 정상 로그인 상태로 보기 어렵다.
         */
        if (!currentUserId) {
          logResidentLogin(
            "accessToken은 있으나 userId 없음 - 로그인 정보 정리"
          );

          await AsyncStorage.multiRemove([
            "accessToken",
            "userName",
          ]);

          return;
        }

        const pairing =
          await checkUserPairing(
            currentUserId
          );

        if (isCancelled) {
          return;
        }

        // ===================================================
        // 동일 사용자 + QR 인증 완료
        // ===================================================

        if (pairing.isPaired) {
          logResidentLogin(
            "기존 로그인 및 Pairing 확인 완료 → MainTab",
            {
              userId:
                currentUserId,

              deviceUid:
                pairing.deviceUid,
            }
          );

          navigation.replace(
            "MainTab"
          );

          return;
        }

        // ===================================================
        // 로그인은 되어 있지만 QR 인증 필요
        // ===================================================

        logResidentLogin(
          "로그인은 유지 중이나 Pairing 필요 → QrVerify",
          {
            userId:
              currentUserId,
          }
        );

        navigation.replace(
          "QrVerify",
          {
            token:
              accessToken,

            userId:
              String(currentUserId),
          }
        );
      } catch (error) {
        logResidentLogin(
          "기존 인증 상태 확인 실패",
          error?.message
        );
      } finally {
        if (!isCancelled) {
          setCheckingAuth(
            false
          );
        }
      }
    };

    checkVerification();

    return () => {
      isCancelled = true;
    };
  }, [navigation]);

  // =========================================================
  // 카카오 로그인 시작
  // =========================================================

  const openKakaoLogin = () => {
    logResidentLogin(
      "카카오 로그인 시작",
      {
        redirectUri:
          REDIRECT_URI,

        keyType:
          "REST API KEY",
      }
    );

    if (!CLEAN_BASE_URL) {
      Alert.alert(
        "설정 오류",
        "BASE_URL이 설정되어 있지 않습니다."
      );

      return;
    }

    if (!REST_API_KEY) {
      Alert.alert(
        "설정 오류",
        "카카오 REST API 키가 설정되어 있지 않습니다."
      );

      return;
    }

    authCodeHandledRef.current =
      false;

    setShowWebView(true);
  };

  // =========================================================
  // 카카오 WebView 닫기
  // =========================================================

  const closeKakaoLogin = () => {
    authCodeHandledRef.current =
      false;

    setShowWebView(false);
    setLoading(false);
  };

  // =========================================================
  // 백엔드 카카오 로그인
  // =========================================================

  const requestBackendKakaoLogin =
    async (
      authorizationCode
    ) => {
      const backendUrl =
        `${CLEAN_BASE_URL}/api/auth/kakao`;

      logResidentLogin(
        "백엔드 카카오 로그인 요청",
        {
          url:
            backendUrl,
        }
      );

      const response =
        await axios.post(
          backendUrl,
          {
            authorizationCode,
          },
          {
            headers: {
              "Content-Type":
                "application/json",
            },

            timeout: 15000,
          }
        );

      logResidentLogin(
        "백엔드 카카오 로그인 응답",
        {
          status:
            response.status,

          success:
            response.data
              ?.success,
        }
      );

      return response;
    };

  // =========================================================
  // 로그인 성공 후 이동
  // =========================================================

  const handleLoginSuccess = async ({
    backendJwtToken,
    userName,
    userId,
  }) => {
    // =====================================================
    // 사용자 / Token 저장
    // =====================================================

    await AsyncStorage.multiSet([
      [
        "accessToken",
        String(
          backendJwtToken
        ),
      ],

      [
        "userName",
        String(
          userName
        ),
      ],

      [
        "userId",
        String(
          userId
        ),
      ],
    ]);

    await ensureDefaultSettings();

    // =====================================================
    // 기존 QR Pairing 확인
    // =====================================================

    const pairing =
      await checkUserPairing(
        userId
      );

    logResidentLogin(
      "로그인 성공 후 이동 결정",
      {
        userId,

        isPaired:
          pairing.isPaired,

        deviceUid:
          pairing.deviceUid,
      }
    );

    // =====================================================
    // 같은 사용자 + 이미 QR 인증
    // =====================================================

    if (pairing.isPaired) {
      Alert.alert(
        "로그인 성공",
        `${userName}님 환영합니다!`,
        [
          {
            text: "확인",

            onPress: () => {
              navigation.replace(
                "MainTab"
              );
            },
          },
        ]
      );

      return;
    }

    // =====================================================
    // 최초 사용자 / 다른 사용자 / Pairing 없음
    // =====================================================

    Alert.alert(
      "로그인 성공",
      `${userName}님 환영합니다!\n기기 QR 인증을 진행해 주세요.`,
      [
        {
          text: "확인",

          onPress: () => {
            navigation.replace(
              "QrVerify",
              {
                token:
                  backendJwtToken,

                userId:
                  String(userId),
              }
            );
          },
        },
      ]
    );
  };

  // =========================================================
  // WebView URL 변화 감지
  // =========================================================

  const handleWebViewNavigationStateChange =
    async (
      newNavigationState
    ) => {
      const url =
        newNavigationState?.url;

      if (!url) {
        return;
      }

      logResidentLogin(
        "Kakao WebView URL",
        url
      );

      /**
       * 우리가 등록한 Redirect URI가 아니면 무시
       */
      if (
        !url.startsWith(
          REDIRECT_URI
        )
      ) {
        return;
      }

      // =====================================================
      // 카카오 Error 확인
      // =====================================================

      const kakaoError =
        getQueryParameter(
          url,
          "error"
        );

      const kakaoErrorDescription =
        getQueryParameter(
          url,
          "error_description"
        );

      if (kakaoError) {
        authCodeHandledRef.current =
          true;

        setShowWebView(false);
        setLoading(false);

        logResidentLogin(
          "카카오 인가 실패",
          {
            error:
              kakaoError,

            description:
              kakaoErrorDescription,
          }
        );

        Alert.alert(
          "카카오 로그인 실패",
          kakaoErrorDescription ||
            "카카오 로그인이 취소되었거나 실패했습니다."
        );

        return;
      }

      // =====================================================
      // Authorization Code
      // =====================================================

      const authorizationCode =
        getQueryParameter(
          url,
          "code"
        );

      if (
        !authorizationCode
      ) {
        return;
      }

      /**
       * WebView redirect가 여러 번 발생해도
       * 한 번만 처리
       */
      if (
        authCodeHandledRef.current
      ) {
        return;
      }

      authCodeHandledRef.current =
        true;

      setShowWebView(false);
      setLoading(true);

      try {
        logResidentLogin(
          "카카오 authorization code 수신"
        );

        const backendResponse =
          await requestBackendKakaoLogin(
            authorizationCode
          );

        const responseData =
          backendResponse?.data;

        if (
          !responseData?.success ||
          !responseData?.data
        ) {
          Alert.alert(
            "로그인 실패",
            responseData?.message ||
              "서버 로그인 응답이 올바르지 않습니다."
          );

          return;
        }

        // ===================================================
        // 서비스 JWT
        // ===================================================

        const backendJwtToken =
          responseData.data
            .accessToken ||
          responseData.data
            .token;

        // ===================================================
        // 사용자 이름
        // ===================================================

        const userName =
          responseData.data
            .name ||
          responseData.data
            .userName ||
          "사용자";

        // ===================================================
        // 서비스 User ID
        // ===================================================

        const rawUserId =
          responseData.data
            .id ??
          responseData.data
            .userId;

        const userId =
          rawUserId !==
            undefined &&
          rawUserId !== null
            ? String(rawUserId)
            : null;

        if (!backendJwtToken) {
          Alert.alert(
            "로그인 실패",
            "백엔드에서 사용자 인증 토큰을 받지 못했습니다."
          );

          return;
        }

        if (!userId) {
          Alert.alert(
            "로그인 실패",
            "백엔드에서 사용자 ID를 받지 못했습니다."
          );

          return;
        }

        // ===================================================
        // 최종 로그인 처리
        // ===================================================

        await handleLoginSuccess(
          {
            backendJwtToken,
            userName,
            userId,
          }
        );
      } catch (error) {
        const responseStatus =
          error?.response
            ?.status;

        const responseData =
          error?.response
            ?.data;

        const errorCode =
          responseData
            ?.error_code ||
          responseData?.code ||
          responseData?.error;

        const errorMessage =
          responseData
            ?.error_description ||
          responseData
            ?.message ||
          responseData?.msg ||
          error?.message;

        logResidentLogin(
          "카카오 로그인 실패",
          {
            status:
              responseStatus,

            errorCode,

            errorMessage,

            response:
              responseData,
          }
        );

        // ===================================================
        // KOE006
        // ===================================================

        if (
          errorCode ===
            "KOE006" ||
          String(
            errorMessage ||
              ""
          ).includes(
            "KOE006"
          )
        ) {
          Alert.alert(
            "Redirect URI 오류",
            `카카오디벨로퍼스에 아래 주소가 정확하게 등록되어 있는지 확인해 주세요.\n\n${REDIRECT_URI}`
          );

          return;
        }

        // ===================================================
        // KOE010
        // ===================================================

        if (
          errorCode ===
            "KOE010" ||
          String(
            errorMessage ||
              ""
          ).includes(
            "Bad client credentials"
          )
        ) {
          Alert.alert(
            "카카오 서버 설정 오류",
            "백엔드에 등록된 카카오 REST API 키와 Client Secret을 확인해 주세요."
          );

          return;
        }

        // ===================================================
        // 서버 연결 실패
        // ===================================================

        if (!error?.response) {
          Alert.alert(
            "서버 연결 실패",
            "백엔드 서버에 연결할 수 없습니다. 서버 실행 상태와 BASE_URL을 확인해 주세요."
          );

          return;
        }

        Alert.alert(
          "로그인 실패",
          errorMessage ||
            "서버 통신 중 오류가 발생했습니다."
        );
      } finally {
        setLoading(false);
      }
    };

  // =========================================================
  // 기존 로그인 상태 확인 중
  // =========================================================

  if (checkingAuth) {
    return (
      <Container
        style={{
          justifyContent:
            "center",
        }}
      >
        <ActivityIndicator
          size="large"
          color="#06F393"
        />
      </Container>
    );
  }

  // =========================================================
  // UI
  // =========================================================

  return (
    <Container>
      <HeaderSection
        style={{
          height:
            SCREEN_HEIGHT *
            0.28,
        }}
      >
        <Gradient
          colors={[
            "#06F393",
            "#79F7C8",
            "#DFFFF4",
          ]}
        >
          <Welcome>
            WELCOME!
          </Welcome>

          <SubText>
            안녕하세요, 사용자 여러분!
          </SubText>
        </Gradient>
      </HeaderSection>

      <CardSection>
        <QRInfoText>
          최초 로그인 시 QR 인증해주세요!!
        </QRInfoText>

        <CharacterArea>
          <View
            style={{
              alignItems:
                "flex-end",

              width: "80%",

              marginBottom:
                -15,

              zIndex: 10,
            }}
          >
            <HelloBubble
              source={
                helloBubbleImage
              }
              resizeMode="contain"
            />
          </View>

          <BellCharacter
            source={
              bellCharacterImage
            }
            resizeMode="contain"
          />
        </CharacterArea>

        {loading && (
          <ActivityIndicator
            size="large"
            color="#06F393"
            style={{
              marginBottom:
                10,
            }}
          />
        )}

        <ButtonArea
          style={{
            opacity:
              loading
                ? 0.6
                : 1,
          }}
        >
          <ImageButton
            onPress={
              openKakaoLogin
            }
            disabled={loading}
            activeOpacity={0.8}
          >
            <BarImageBackground
              source={
                yellowBarImage
              }
              resizeMode="stretch"
            />

            <ButtonContent>
              <Icon
                source={
                  kakaoIcon
                }
                resizeMode="contain"
              />

              <ButtonText>
                카카오로 로그인하기
              </ButtonText>
            </ButtonContent>
          </ImageButton>
        </ButtonArea>

        <AdminLink
          onPress={() =>
            navigation.navigate(
              "AdminLogin"
            )
          }
          disabled={loading}
          activeOpacity={0.7}
        >
          <AdminText>
            관리자 페이지로 가기
          </AdminText>
        </AdminLink>
      </CardSection>

      {/* ================= KAKAO WEBVIEW ================= */}

      <Modal
        visible={showWebView}
        animationType="slide"
        onRequestClose={
          closeKakaoLogin
        }
      >
        <SafeAreaContainer
          style={{
            flex: 1,
            backgroundColor:
              "#f5f5f5",
          }}
        >
          <View
            style={{
              height: 50,

              justifyContent:
                "center",

              paddingHorizontal:
                20,

              backgroundColor:
                "#f5f5f5",
            }}
          >
            <TouchableOpacity
              onPress={
                closeKakaoLogin
              }
              activeOpacity={0.7}
            >
              <Text
                style={{
                  color: "#333",

                  fontSize: 16,

                  fontWeight:
                    "bold",
                }}
              >
                취소하고 나가기
              </Text>
            </TouchableOpacity>
          </View>

          <WebView
            source={{
              uri:
                KAKAO_AUTH_URL,
            }}
            onNavigationStateChange={
              handleWebViewNavigationStateChange
            }
            startInLoadingState
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            renderLoading={() => (
              <WebViewLoadingWrapper>
                <ActivityIndicator
                  size="large"
                  color="#06F393"
                />
              </WebViewLoadingWrapper>
            )}
            onHttpError={(
              syntheticEvent
            ) => {
              const nativeEvent =
                syntheticEvent
                  ?.nativeEvent;

              logResidentLogin(
                "카카오 WebView HTTP 오류",
                {
                  statusCode:
                    nativeEvent
                      ?.statusCode,

                  description:
                    nativeEvent
                      ?.description,

                  url:
                    nativeEvent
                      ?.url,
                }
              );
            }}
            onError={(
              syntheticEvent
            ) => {
              const nativeEvent =
                syntheticEvent
                  ?.nativeEvent;

              logResidentLogin(
                "카카오 WebView 로딩 오류",
                {
                  code:
                    nativeEvent
                      ?.code,

                  description:
                    nativeEvent
                      ?.description,

                  url:
                    nativeEvent
                      ?.url,
                }
              );
            }}
          />
        </SafeAreaContainer>
      </Modal>
    </Container>
  );
}

// =========================================================
// STYLE
// =========================================================

const Container = styled.View`
  flex: 1;
  background-color: white;
`;

const HeaderSection = styled.View`
  width: 100%;
`;

const Gradient = styled(
  LinearGradient
)`
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
  color: #06f393;
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
  color: #06f393;
`;

const WebViewLoadingWrapper = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
`;