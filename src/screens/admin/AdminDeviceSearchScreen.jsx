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

export default function AdminDeviceSearchScreen() {
  const navigation = useNavigation();

  const [deviceUidSearch, setDeviceUidSearch] = useState("");
  const [statusSearch, setStatusSearch] = useState("");
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const buildSearchParams = () => {
    const params = {};

    const deviceUid = deviceUidSearch.trim();
    const status = statusSearch.trim();

    if (deviceUid) {
      params.deviceUid = deviceUid;
    }

    if (status) {
      params.status = status.toUpperCase();
    }

    return params;
  };

  const extractDeviceList = (response) => {
    if (response.data?.success === false) {
      throw new Error(response.data?.message || "장치 검색 실패");
    }

    if (Array.isArray(response.data?.data)) {
      return response.data.data;
    }

    if (Array.isArray(response.data)) {
      return response.data;
    }

    return [];
  };

  const handleSearch = async () => {
    const params = buildSearchParams();

    if (!params.deviceUid && !params.status) {
      logDeviceSearch("검색 중단 - 검색 조건 없음");

      Alert.alert("입력 안내", "검색할 장치 UID나 상태를 입력하세요.");
      return;
    }

    try {
      setIsLoading(true);
      setHasSearched(true);

      logDeviceSearch("장치 검색 요청", params);

      const token = await AsyncStorage.getItem("adminToken");

      if (!token) {
        logDeviceSearch("adminToken 없음 - 로그인 화면 이동");

        setResults([]);
        navigation.navigate("AdminLogin");
        return;
      }

      const response = await axios.get(`${BASE_URL}/api/admin/devices/search`, {
        params,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const deviceList = extractDeviceList(response);

      logDeviceSearch("장치 검색 완료", {
        params,
        count: deviceList.length,
      });

      setResults(deviceList);
    } catch (error) {
      const serverError =
        error.response?.data?.message ||
        JSON.stringify(error.response?.data) ||
        error.message;

      logDeviceSearch("장치 검색 실패", {
        params,
        error: serverError,
      });

      Alert.alert("오류", "장치 검색 중 오류가 발생했습니다.");
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePressDevice = (item) => {
    const targetDeviceId = item.id || item.deviceId;

    logDeviceSearch("장치 상세 이동", {
      deviceId: targetDeviceId,
      deviceUid: item.deviceUid,
      status: item.status,
    });

    navigation.navigate("AdminDeviceDetail", {
      deviceId: targetDeviceId,
      item,
    });
  };

  const handleGoBack = () => {
    logDeviceSearch("뒤로가기 클릭");
    navigation.goBack();
  };

  return (
    <Container>
      <Header>
        <TouchableOpacity onPress={handleGoBack}>
          <BackIcon source={backIcon} resizeMode="contain" />
        </TouchableOpacity>

        <HeaderTitle>장치 검색</HeaderTitle>

        <View style={{ width: 24 }} />
      </Header>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <SearchSection>
          <SearchLabel>장치 UID 검색</SearchLabel>

          <SearchInputWrapper>
            <InputIcon source={iconDeviceId} resizeMode="contain" />

            <StyledInput
              placeholder="예: DEVICE-001"
              value={deviceUidSearch}
              onChangeText={setDeviceUidSearch}
              onSubmitEditing={handleSearch}
              placeholderTextColor="#BBB"
              autoCapitalize="characters"
              returnKeyType="search"
            />

            <TouchableOpacity onPress={handleSearch}>
              <SearchBtnIcon source={searchIcon} resizeMode="contain" />
            </TouchableOpacity>
          </SearchInputWrapper>

          <SearchLabel style={{ marginTop: 25 }}>상태 검색</SearchLabel>

          <SearchInputWrapper>
            <InputIcon
              source={iconUser}
              resizeMode="contain"
              style={{ tintColor: "#06F393" }}
            />

            <StyledInput
              placeholder="ONLINE, OFFLINE, ERROR"
              value={statusSearch}
              onChangeText={setStatusSearch}
              onSubmitEditing={handleSearch}
              placeholderTextColor="#BBB"
              autoCapitalize="characters"
              returnKeyType="search"
            />

            <TouchableOpacity onPress={handleSearch}>
              <SearchBtnIcon source={searchIcon} resizeMode="contain" />
            </TouchableOpacity>
          </SearchInputWrapper>
        </SearchSection>

        {isLoading ? (
          <ActivityIndicator
            size="large"
            color="#06F393"
            style={{ marginTop: 20 }}
          />
        ) : results.length > 0 ? (
          <ResultArea>
            <ResultTitle>검색 결과 ({results.length})</ResultTitle>

            {results.map((item, idx) => (
              <TouchableOpacity
                key={item.id || item.deviceId || item.deviceUid || idx}
                activeOpacity={0.9}
                onPress={() => handlePressDevice(item)}
              >
                <DeviceListItem item={item} />
              </TouchableOpacity>
            ))}
          </ResultArea>
        ) : (
          hasSearched && (
            <NoResultWrapper>
              <Ionicons name="search-outline" size={32} color="#CCC" />
              <NoResultText>검색 결과가 없습니다.</NoResultText>
            </NoResultWrapper>
          )
        )}
      </ScrollView>
    </Container>
  );
}

const Container = styled(SafeAreaContainer)`
  flex: 1;
  background-color: #F8F9FA;
`;

const Header = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background-color: #fff;
  border-bottom-width: 1px;
  border-bottom-color: #F0F0F0;
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
  color: #4A5568;
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
  border-color: #06F393;
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
  color: #BBB;
  font-weight: 600;
  margin-top: 8px;
  font-size: 14px;
`;