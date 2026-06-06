import React, { useState } from "react";
import { ScrollView, TouchableOpacity, View, ActivityIndicator, Alert } from "react-native";
import styled from "styled-components/native";
import { SafeAreaView } from "react-native-safe-area-context";
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

export default function AdminDeviceSearchScreen() {
  const navigation = useNavigation();
  const [deviceUidSearch, setDeviceUidSearch] = useState("");
  const [statusSearch, setStatusSearch] = useState("");
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!deviceUidSearch.trim() && !statusSearch.trim()) {
      Alert.alert("입력 안내", "검색할 디바이스 UID나 상태값을 입력하십시오.");
      return;
    }

    try {
      setIsLoading(true);
      setHasSearched(true);
      const token = await AsyncStorage.getItem("adminToken");
      if (!token) {
        navigation.navigate("AdminLogin");
        return;
      }

      const response = await axios.get(`${BASE_URL}/api/admin/devices/search`, {
        params: {
          deviceUid: deviceUidSearch.trim() || null,
          status: statusSearch.trim() ? statusSearch.trim().toUpperCase() : null
        },
        headers: { Authorization: `Bearer ${token}` }
      });

      setResults(response.data.success ? response.data.data : []);
    } catch (error) {
      Alert.alert("오류", "장치 필터링 조회 중 통신 장애가 발생했습니다.");
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container>
      <Header>
        <TouchableOpacity onPress={() => navigation.goBack()}><BackIcon source={backIcon} /></TouchableOpacity>
        <HeaderTitle>디바이스 실시간 검색</HeaderTitle>
        <View style={{ width: 24 }} />
      </Header>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <SearchSection>
          <SearchLabel>하드웨어 고유 UID 검색</SearchLabel>
          <SearchInputWrapper>
            <InputIcon source={iconDeviceId} />
            <StyledInput 
              placeholder="예: device1001" 
              value={deviceUidSearch}
              onChangeText={setDeviceUidSearch}
              onSubmitEditing={handleSearch}
              placeholderTextColor="#BBB"
            />
            <TouchableOpacity onPress={handleSearch}><SearchBtnIcon source={searchIcon} /></TouchableOpacity>
          </SearchInputWrapper>

          <SearchLabel style={{ marginTop: 25 }}>장비 전원 상태 검색</SearchLabel>
          <SearchInputWrapper>
            <InputIcon source={iconUser} style={{ tintColor: "#06F393" }} />
            <StyledInput 
              placeholder="ONLINE, OFFLINE, ERROR" 
              value={statusSearch}
              onChangeText={setStatusSearch}
              onSubmitEditing={handleSearch}
              placeholderTextColor="#BBB"
              autoCapitalize="characters"
            />
            <TouchableOpacity onPress={handleSearch}><SearchBtnIcon source={searchIcon} /></TouchableOpacity>
          </SearchInputWrapper>
        </SearchSection>

        {isLoading ? <ActivityIndicator size="large" color="#06F393" style={{ marginTop: 20 }} /> : 
        results.length > 0 ? (
          <ResultArea>
            <ResultTitle>매칭 디바이스 목록 ({results.length})</ResultTitle>
            {results.map((item, idx) => (
              <TouchableOpacity key={item.id || idx} activeOpacity={0.9} onPress={() => navigation.navigate("AdminDeviceDetail", { deviceId: item.id, item })}>
                <DeviceListItem item={item} />
              </TouchableOpacity>
            ))}
          </ResultArea>
        ) : hasSearched && (
          <NoResultWrapper>
            <Ionicons name="search-outline" size={32} color="#CCC" />
            <NoResultText>검색 결과가 없습니다.</NoResultText>
          </NoResultWrapper>
        )}
      </ScrollView>
    </Container>
  );
}

const Container = styled(SafeAreaView)` flex: 1; background-color: #F8F9FA; `;
const Header = styled.View` flex-direction: row; justify-content: space-between; align-items: center; padding: 15px 20px; background-color: #fff; border-bottom-width: 1px; border-bottom-color: #F0F0F0; `;
const BackIcon = styled.Image` width: 24px; height: 24px; `;
const HeaderTitle = styled.Text` font-size: 18px; font-weight: 800; color: #333; `;
const SearchSection = styled.View` padding: 30px 20px 15px; `;
const SearchLabel = styled.Text` font-size: 14px; font-weight: 800; color: #4A5568; margin-bottom: 12px; `;
const SearchInputWrapper = styled.View` flex-direction: row; align-items: center; background-color: #fff; border-radius: 25px; padding: 5px 20px; height: 55px; border-width: 1.5px; border-color: #06F393; elevation: 3; `;
const InputIcon = styled.Image` width: 22px; height: 22px; margin-right: 15px; `;
const StyledInput = styled.TextInput` flex: 1; font-size: 15px; color: #333; padding: 0; font-weight: 600; `;
const SearchBtnIcon = styled.Image` width: 24px; height: 24px; `;
const ResultArea = styled.View` margin-top: 10px; `;
const ResultTitle = styled.Text` font-size: 15px; font-weight: 800; color: #718096; margin: 0 25px 15px; `;
const NoResultWrapper = styled.View` padding: 40px 20px; justify-content: center; align-items: center; `;
const NoResultText = styled.Text` color: #BBB; font-weight: 600; margin-top: 8px; font-size: 14px; `;