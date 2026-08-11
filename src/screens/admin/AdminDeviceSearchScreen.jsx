import React, { useState } from "react";
import {
  ScrollView,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
} from "react-native";
import styled from "styled-components/native";
import { SafeAreaView as SafeAreaContainer } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

import BASE_URL from "../../api/config";
import DeviceListItem from "../../components/DeviceListItem";

const backIcon = require("../../assets/back_icon.png");
const iconUser = require("../../assets/icon_user.png");
const iconDeviceId = require("../../assets/icon_device_id.png");
const searchIcon = require("../../assets/search_icon.png");

const logDeviceSearch = (message, data) => {
  if (data !== undefined) {
    console.log(`[ADMIN_DEVICE_SEARCH] ${message}`, data);
  } else {
    console.log(`[ADMIN_DEVICE_SEARCH] ${message}`);
  }
};

// =========================================================
// 화면 입력값 → 백엔드 DeviceStatus 변환
//
// 사용자에게는 이해하기 쉬운 표현을 보여주고
// API 요청에는 실제 백엔드 enum을 전달
//
// ONLINE  → ACTIVE
// OFFLINE → INACTIVE
// DELETED → DELETED
//
// 백엔드 상태값을 직접 입력해도 허용:
// ACTIVE / INACTIVE / DELETED
// =========================================================

const STATUS_MAP = {
  ONLINE: "ACTIVE",
  ACTIVE: "ACTIVE",

  OFFLINE: "INACTIVE",
  INACTIVE: "INACTIVE",

  DELETED: "DELETED",

  // 한글 입력도 허용
  온라인: "ACTIVE",
  오프라인: "INACTIVE",
  삭제: "DELETED",
  삭제됨: "DELETED",
};

export default function AdminDeviceSearchScreen() {
  const navigation = useNavigation();

  const [deviceUidSearch, setDeviceUidSearch] = useState("");
  const [statusSearch, setStatusSearch] = useState("");

  const [results, setResults] = useState([]);

  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // =========================================================
  // 상태값 변환
  // =========================================================

  const normalizeStatusSearch = (value) => {
    const input = String(value || "").trim();

    if (!input) {
      return "";
    }

    const upperInput = input.toUpperCase();

    return (
      STATUS_MAP[upperInput] ||
      STATUS_MAP[input] ||
      null
    );
  };

  // =========================================================
  // 검색 파라미터 생성
  // =========================================================

  const buildSearchParams = () => {
    const params = {};

    const deviceUid =
      deviceUidSearch.trim();

    const rawStatus =
      statusSearch.trim();

    if (deviceUid) {
      params.deviceUid =
        deviceUid;
    }

    if (rawStatus) {
      const backendStatus =
        normalizeStatusSearch(
          rawStatus
        );

      if (!backendStatus) {
        return {
          error: "INVALID_STATUS",
        };
      }

      params.status =
        backendStatus;
    }

    return params;
  };

  // =========================================================
  // 백엔드 응답 배열 추출
  // =========================================================

  const extractDeviceList = (
    response
  ) => {
    if (
      response.data?.success ===
      false
    ) {
      throw new Error(
        response.data?.message ||
          "장치 검색 실패"
      );
    }

    if (
      Array.isArray(
        response.data?.data
      )
    ) {
      return response.data.data;
    }

    if (
      Array.isArray(
        response.data
      )
    ) {
      return response.data;
    }

    if (
      Array.isArray(
        response.data?.content
      )
    ) {
      return response.data.content;
    }

    if (
      Array.isArray(
        response.data?.data
          ?.content
      )
    ) {
      return response.data
        .data.content;
    }

    return [];
  };

  // =========================================================
  // 관리자 인증 만료
  // =========================================================

  const handleAdminAuthExpired =
    async () => {
      try {
        await AsyncStorage.removeItem(
          "adminToken"
        );
      } catch (error) {
        logDeviceSearch(
          "adminToken 삭제 실패",
          error?.message
        );
      }

      Alert.alert(
        "로그인 만료",
        "관리자 로그인 정보가 만료되었습니다. 다시 로그인해 주세요.",
        [
          {
            text: "확인",

            onPress: () => {
              navigation.reset({
                index: 0,

                routes: [
                  {
                    name:
                      "AdminLogin",
                  },
                ],
              });
            },
          },
        ]
      );
    };

  // =========================================================
  // 장치 검색
  // =========================================================

  const handleSearch = async () => {
    if (isLoading) {
      return;
    }

    const params =
      buildSearchParams();

    // =====================================================
    // 상태 입력값 오류
    // =====================================================

    if (
      params.error ===
      "INVALID_STATUS"
    ) {
      Alert.alert(
        "상태 확인",
        "상태는 ONLINE, OFFLINE, DELETED 중 하나를 입력해주세요."
      );

      return;
    }

    // =====================================================
    // 검색 조건 없음
    // =====================================================

    if (
      !params.deviceUid &&
      !params.status
    ) {
      logDeviceSearch(
        "검색 중단 - 검색 조건 없음"
      );

      Alert.alert(
        "입력 안내",
        "검색할 장치 UID나 상태를 입력하세요."
      );

      return;
    }

    try {
      setIsLoading(true);
      setHasSearched(true);

      logDeviceSearch(
        "장치 검색 요청",
        {
          input: {
            deviceUid:
              deviceUidSearch,
            status:
              statusSearch,
          },

          apiParams:
            params,
        }
      );

      // =====================================================
      // 관리자 JWT
      // =====================================================

      const token =
        await AsyncStorage.getItem(
          "adminToken"
        );

      if (!token) {
        logDeviceSearch(
          "adminToken 없음 - 로그인 화면 이동"
        );

        setResults([]);

        navigation.reset({
          index: 0,

          routes: [
            {
              name:
                "AdminLogin",
            },
          ],
        });

        return;
      }

      // =====================================================
      // 검색 API
      // =====================================================

      const response =
        await axios.get(
          `${BASE_URL}/api/admin/devices/search`,
          {
            params,

            headers: {
              Authorization:
                `Bearer ${token}`,
            },

            timeout: 10000,
          }
        );

      const deviceList =
        extractDeviceList(
          response
        );

      logDeviceSearch(
        "장치 검색 완료",
        {
          params,

          count:
            deviceList.length,

          success:
            response.data
              ?.success,
        }
      );

      setResults(
        deviceList
      );
    } catch (error) {
      const status =
        error.response
          ?.status;

      const serverError =
        error.response?.data
          ?.message ||
        error.response?.data
          ?.error ||
        JSON.stringify(
          error.response?.data
        ) ||
        error.message;

      logDeviceSearch(
        "장치 검색 실패",
        {
          params,
          status,
          error:
            serverError,
        }
      );

      setResults([]);

      // =====================================================
      // 관리자 인증 오류
      // =====================================================

      if (
        status === 401 ||
        status === 403
      ) {
        await handleAdminAuthExpired();

        return;
      }

      // =====================================================
      // 검색값 오류
      // =====================================================

      if (status === 400) {
        Alert.alert(
          "검색 조건 오류",
          serverError ||
            "검색 조건을 확인해주세요."
        );

        return;
      }

      Alert.alert(
        "오류",
        serverError ||
          "장치 검색 중 오류가 발생했습니다."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // =========================================================
  // 장치 상세 이동
  // =========================================================

  const handlePressDevice = (
    item
  ) => {
    /**
     * backend AdminDeviceResponse:
     *
     * deviceId
     * deviceUid
     * location
     * status
     * lastSeenAt
     * createdAt
     * updatedAt
     */
    const targetDeviceId =
      item.deviceId ??
      item.id ??
      null;

    if (!targetDeviceId) {
      logDeviceSearch(
        "장치 상세 이동 실패 - deviceId 없음",
        item
      );

      Alert.alert(
        "오류",
        "장치 ID 정보를 확인할 수 없습니다."
      );

      return;
    }

    logDeviceSearch(
      "장치 상세 이동",
      {
        deviceId:
          targetDeviceId,

        deviceUid:
          item.deviceUid,

        status:
          item.status,
      }
    );

    navigation.navigate(
      "AdminDeviceDetail",
      {
        deviceId:
          targetDeviceId,

        item,
      }
    );
  };

  // =========================================================
  // 뒤로가기
  // =========================================================

  const handleGoBack = () => {
    logDeviceSearch(
      "뒤로가기 클릭"
    );

    navigation.goBack();
  };

  // =========================================================
  // 입력 초기화
  // =========================================================

  const handleClearDeviceUid = () => {
    setDeviceUidSearch("");
  };

  const handleClearStatus = () => {
    setStatusSearch("");
  };

  // =========================================================
  // UI
  // =========================================================

  return (
    <Container>
      {/* ================= HEADER ================= */}

      <Header>
        <TouchableOpacity
          onPress={
            handleGoBack
          }
        >
          <BackIcon
            source={backIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <HeaderTitle>
          장치 검색
        </HeaderTitle>

        <View
          style={{
            width: 24,
          }}
        />
      </Header>

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={{
          paddingBottom: 40,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ================= DEVICE UID ================= */}

        <SearchSection>
          <SearchLabel>
            장치 UID 검색
          </SearchLabel>

          <SearchInputWrapper>
            <InputIcon
              source={
                iconDeviceId
              }
              resizeMode="contain"
            />

            <StyledInput
              placeholder="예: DEVICE-001"
              value={
                deviceUidSearch
              }
              onChangeText={
                setDeviceUidSearch
              }
              onSubmitEditing={
                handleSearch
              }
              placeholderTextColor="#BBB"
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
              editable={!isLoading}
            />

            {deviceUidSearch.length >
              0 && (
              <TouchableOpacity
                onPress={
                  handleClearDeviceUid
                }
                style={{
                  marginRight: 10,
                }}
              >
                <Ionicons
                  name="close-circle"
                  size={20}
                  color="#CCC"
                />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={
                handleSearch
              }
              disabled={
                isLoading
              }
            >
              <SearchBtnIcon
                source={
                  searchIcon
                }
                resizeMode="contain"
              />
            </TouchableOpacity>
          </SearchInputWrapper>

          {/* ================= STATUS ================= */}

          <SearchLabel
            style={{
              marginTop: 25,
            }}
          >
            상태 검색
          </SearchLabel>

          <SearchInputWrapper>
            <InputIcon
              source={iconUser}
              resizeMode="contain"
              style={{
                tintColor:
                  "#06F393",
              }}
            />

            <StyledInput
              placeholder="ONLINE, OFFLINE, DELETED"
              value={
                statusSearch
              }
              onChangeText={
                setStatusSearch
              }
              onSubmitEditing={
                handleSearch
              }
              placeholderTextColor="#BBB"
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
              editable={!isLoading}
            />

            {statusSearch.length >
              0 && (
              <TouchableOpacity
                onPress={
                  handleClearStatus
                }
                style={{
                  marginRight: 10,
                }}
              >
                <Ionicons
                  name="close-circle"
                  size={20}
                  color="#CCC"
                />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={
                handleSearch
              }
              disabled={
                isLoading
              }
            >
              <SearchBtnIcon
                source={
                  searchIcon
                }
                resizeMode="contain"
              />
            </TouchableOpacity>
          </SearchInputWrapper>

          {/* 상태 설명 */}

          <StatusGuide>
            ONLINE = 활성 · OFFLINE = 비활성 · DELETED = 삭제된 장치
          </StatusGuide>
        </SearchSection>

        {/* ================= LOADING ================= */}

        {isLoading ? (
          <ActivityIndicator
            size="large"
            color="#06F393"
            style={{
              marginTop: 20,
            }}
          />
        ) : results.length >
          0 ? (
          // =================================================
          // RESULT
          // =================================================

          <ResultArea>
            <ResultTitle>
              검색 결과 (
              {results.length})
            </ResultTitle>

            {results.map(
              (
                item,
                idx
              ) => (
                <TouchableOpacity
                  key={
                    item.deviceId ??
                    item.id ??
                    item.deviceUid ??
                    idx
                  }
                  activeOpacity={
                    0.9
                  }
                  onPress={() =>
                    handlePressDevice(
                      item
                    )
                  }
                >
                  <DeviceListItem
                    item={
                      item
                    }
                  />
                </TouchableOpacity>
              )
            )}
          </ResultArea>
        ) : (
          hasSearched && (
            // =================================================
            // NO RESULT
            // =================================================

            <NoResultWrapper>
              <Ionicons
                name="search-outline"
                size={32}
                color="#CCC"
              />

              <NoResultText>
                검색 결과가 없습니다.
              </NoResultText>
            </NoResultWrapper>
          )
        )}
      </ScrollView>
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
  background-color: #f8f9fa;
`;

const Header = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background-color: #fff;
  border-bottom-width: 1px;
  border-bottom-color: #f0f0f0;
`;

const BackIcon = styled.Image`
  width: 24px;
  height: 24px;
  tint-color: #333;
`;

const HeaderTitle = styled.Text`
  flex: 1;
  margin-horizontal: 12px;
  font-size: 18px;
  font-weight: 800;
  color: #333;
  text-align: center;
`;

const SearchSection = styled.View`
  padding: 30px 20px 15px;
`;

const SearchLabel = styled.Text`
  font-size: 14px;
  font-weight: 800;
  color: #4a5568;
  margin-bottom: 12px;
`;

const SearchInputWrapper = styled.View`
  flex-direction: row;
  align-items: center;
  background-color: #fff;
  border-radius: 25px;
  padding: 5px 20px;
  height: 55px;
  border-width: 1.5px;
  border-color: #06f393;
  elevation: 3;
`;

const InputIcon = styled.Image`
  width: 22px;
  height: 22px;
  margin-right: 15px;
`;

const StyledInput = styled.TextInput`
  flex: 1;
  font-size: 15px;
  color: #333;
  padding: 0;
  font-weight: 600;
`;

const SearchBtnIcon = styled.Image`
  width: 24px;
  height: 24px;
`;

const StatusGuide = styled.Text`
  font-size: 12px;
  color: #999;
  margin-top: 10px;
  margin-left: 5px;
  line-height: 18px;
`;

const ResultArea = styled.View`
  margin-top: 10px;
`;

const ResultTitle = styled.Text`
  font-size: 15px;
  font-weight: 800;
  color: #718096;
  margin: 0 25px 15px;
`;

const NoResultWrapper = styled.View`
  padding: 40px 20px;
  justify-content: center;
  align-items: center;
`;

const NoResultText = styled.Text`
  color: #bbb;
  font-weight: 600;
  margin-top: 8px;
  font-size: 14px;
`;