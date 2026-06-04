import React, { useState } from "react";
import { ScrollView, TouchableOpacity, View, TextInput, ActivityIndicator, Alert } from "react-native";
import styled from "styled-components/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";

// 📥 관리자 전용 마스터 키 로드를 위한 비밀금고 부품 임포트!
import AsyncStorage from "@react-native-async-storage/async-storage";

// 🌐 config.js의 배포 주소
import BASE_URL from "../../api/config";

// ✅ 1. 부품 재사용 (대소문자 대형 가드가 완착된 마스터 리스트 카드 부품 🤙)
import DeviceListItem from "../../components/DeviceListItem";

// ✅ 2. 이미지 에셋 (시안 100% 동기화 🤙 순정 보존)
const backIcon = require("../../assets/back_icon.png");
const iconUser = require("../../assets/icon_user.png");       // 사용자 아이콘
const iconDeviceId = require("../../assets/icon_device_id.png"); // 디바이스 아이콘
const searchIcon = require("../../assets/search_icon.png");     // 돋보기 아이콘

export default function AdminDeviceSearchScreen() {
  const navigation = useNavigation();

  // 3. 📱 실시간 기기 검색 결과 상태 관리 관제창
  const [deviceUidSearch, setDeviceUidSearch] = useState(""); // 백엔드 deviceUid 규격 타겟창
  const [statusSearch, setStatusSearch] = useState(""); // 상태 필터 보강창 (ONLINE, OFFLINE, ERROR)
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false); // 결과 공백 팝업 가드 벨트

  // =========================================================
  // 🔥 [재호 찐 디바이스 검색 컨트롤러 연동] 라이브 기기 레이더 엔진 🚀
  // =========================================================
  const handleSearch = async () => {
    if (!deviceUidSearch.trim() && !statusSearch.trim()) {
      Alert.alert("입력 안내", "검색할 디바이스 UID 문구나 상태값을 입력해 주셔요! 🤙");
      return;
    }

    try {
      setIsLoading(true);
      setHasSearched(true);
      console.log(`▶️ [기기 레이더 발포] UID 키워드: ${deviceUidSearch.trim()}`);

      const token = await AsyncStorage.getItem("adminToken");
      if (!token) {
        navigation.navigate("AdminLogin");
        return;
      }

      // 🎯 [명세서 찐 연동] GET /api/admin/devices/search 정밀 노크!
      // 재호 분이 명시한 파라미터 명찰 구조인 deviceUid, status 배낭 세팅!
      const response = await axios.get(`${BASE_URL}/api/admin/devices/search`, {
        params: {
          deviceUid: deviceUidSearch.trim() || null,
          status: statusSearch.trim() ? statusSearch.trim().toUpperCase() : null
        },
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log("▶️ [기기 검색 레이더 수신 완료] 결과 명단:", response.data);

      if (response.data.success && response.data.data) {
        setResults(response.data.data);
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error("🚨 [하드웨어 검색 통신 실패]:", error.message);
      Alert.alert("오류", "백엔드 전산실 장치 필터링 조회 중 찐빠가 발생했쇼.");
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container>
      {/* 5. 헤더 영역 */}
      <Header>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <BackIcon source={backIcon} resizeMode="contain" />
        </TouchableOpacity>
        <HeaderTitle>디바이스 실시간 검색</HeaderTitle>
        <View style={{ width: 24 }} />
      </Header>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* 6. 검색 입력 섹션 (백엔드 찐 명찰 파라미터 가이드 완착! 뽈칵! 🤙) */}
        <SearchSection>
          {/* 디바이스 UID 상세 검색 */}
          <SearchLabel>하드웨어 고유 UID 문구로 검색</SearchLabel>
          <SearchInputWrapper>
            <InputIcon source={iconDeviceId} />
            <StyledInput 
              placeholder="예: sori0074, device1001 등 입력" 
              value={deviceUidSearch}
              onChangeText={setDeviceUidSearch}
              onSubmitEditing={handleSearch} // 엔터 타격 시 자동 추적 발포!
              placeholderTextColor="#BBB"
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={handleSearch}>
              <SearchBtnIcon source={searchIcon} />
            </TouchableOpacity>
          </SearchInputWrapper>

          {/* 디바이스 전원 상태별 보강 검색 */}
          <SearchLabel style={{ marginTop: 25 }}>장비 전원 상태 코드로 보강 검색</SearchLabel>
          <SearchInputWrapper>
            <InputIcon source={iconUser} style={{ tintColor: "#06F393" }} />
            <StyledInput 
              placeholder="ONLINE, OFFLINE, ERROR 중 입력" 
              value={statusSearch}
              onChangeText={setStatusSearch}
              onSubmitEditing={handleSearch}
              placeholderTextColor="#BBB"
              autoCapitalize="characters" // 대문자 자동 가이드 안전벨트
            />
            <TouchableOpacity onPress={handleSearch}>
              <SearchBtnIcon source={searchIcon} />
            </TouchableOpacity>
          </SearchInputWrapper>
        </SearchSection>

        {/* 7. 검색 결과 리스트 (결과 유무에 따른 가변 안전 동기화 블록 슛! 🤙) */}
        {isLoading ? (
          <ActivityIndicator size="large" color="#06F393" style={{ marginTop: 20 }} />
        ) : results.length > 0 ? (
          <ResultArea>
            <ResultTitle>검색 매칭 디바이스 목록 ({results.length})</ResultTitle>
            {results.map((item) => (
              /* 🎯 검색된 카드를 터치하면 개별 기기를 통제하는 차단/삭제방으로 고유 ID를 업고 즉시 하이패스 워프! */
              <TouchableOpacity 
                key={item.id || item.deviceUid}
                activeOpacity={0.9}
                onPress={() => navigation.navigate("AdminDeviceDetail", { deviceId: item.id, item: item })}
              >
                <DeviceListItem item={item} />
              </TouchableOpacity>
            ))}
          </ResultArea>
        ) : (
          hasSearched && (
            <NoResultWrapper>
              <Ionicons name="search-heading" size={32} color="#CCC" />
              <NoResultText>백엔드 기지국 장부에 매칭되는 인터폰 장치가 없쇼. 잉~ 🤙</NoResultText>
            </NoResultWrapper>
          )
        )}
      </ScrollView>
    </Container>
  );
}

/* ================= 스타일 정의 (수철님 명품 시안 컴포넌트 100% 철통 보존 🤙) ================= */
const Container = styled(SafeAreaView)` flex: 1; background-color: #F8F9FA; `;
const Header = styled.View` flex-direction: row; justify-content: space-between; align-items: center; padding: 15px 20px; background-color: #fff; border-bottom-width: 1px; border-bottom-color: #F0F0F0; `;
const BackIcon = styled.Image` width: 24px; height: 24px; `;
const HeaderTitle = styled.Text` font-size: 18px; font-weight: 800; color: #333; `;

const SearchSection = styled.View` padding: 30px 20px 15px; `;
const SearchLabel = styled.Text` font-size: 14px; font-weight: 800; color: #4A5568; margin-bottom: 12px; `;
const SearchInputWrapper = styled.View` flex-direction: row; align-items: center; background-color: #fff; border-radius: 25px; padding: 5px 20px; height: 55px; border-width: 1.5px; border-color: #06F393; elevation: 3; shadow-color: #000; shadow-opacity: 0.05; shadow-radius: 5px; `;
const InputIcon = styled.Image` width: 22px; height: 22px; margin-right: 15px; `;
const StyledTextInput = styled.TextInput` flex: 1; font-size: 15px; color: #333; padding: 0; font-weight: 600; `;
const SearchBtnIcon = styled.Image` width: 24px; height: 24px; `;

const ResultArea = styled.View` margin-top: 10px; `;
const ResultTitle = styled.Text` font-size: 15px; font-weight: 800; color: #718096; margin: 0 25px 15px; `;
const NoResultWrapper = styled.View` padding: 40px 20px; justify-content: center; align-items: center; `;
const NoResultText = styled.Text` text-align: center; color: #BBB; font-weight: 600; margin-top: 8px; font-size: 14px; `;