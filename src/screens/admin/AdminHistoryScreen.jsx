import React, { useState } from "react";
import { ScrollView, TouchableOpacity, View, Alert } from "react-native";
import styled from "styled-components/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

// ✅ 이미지 에셋
const bellIcon = require("../../assets/bell.png");
const iconKeyword = require("../../assets/icon_keyword.png"); 
const iconCalendar = require("../../assets/icon_calendar.png"); 
const iconUser = require("../../assets/icon_user.png"); 
const iconDeviceId = require("../../assets/icon_device_id.png"); 
const searchIcon = require("../../assets/search_icon.png"); 

export default function AdminHistoryScreen() {
  const navigation = useNavigation();

  // 1. 입력 필드 상태 관리
  const [searchParams, setSearchParams] = useState({
    keyword: "",
    dateRange: "",
    userId: "",
    deviceId: "",
  });

  // 2. 태그 선택 상태 관리
  const [selectedVisitTypes, setSelectedVisitTypes] = useState([]);
  const [selectedSituations, setSelectedSituations] = useState([]);
  const [selectedKeywords, setSelectedKeywords] = useState([]);

  const toggleTag = (tag, list, setList) => {
    if (list.includes(tag)) setList(list.filter((t) => t !== tag));
    else setList([...list, tag]);
  };

  // =========================================================
  // 🔥 [명세서 12-3] 실전 검색 실행 엔진 🚀
  // =========================================================
  const handleSearch = () => {
    // 1️⃣ 백엔드 API 규격에 맞는 데이터 포맷팅
    // (입력창에 키워드가 없으면, 선택한 세부 키워드 태그들을 쉼표로 이어서 전송)
    const finalKeyword = searchParams.keyword.trim() || selectedKeywords.join(",");
    
    // (상태 태그가 선택되었다면 API status 파라미터로 사용)
    const finalStatus = selectedSituations.length > 0 ? selectedSituations[0] : undefined;

    const apiPayload = {
      keyword: finalKeyword || undefined,
      date: searchParams.dateRange || undefined, 
      userId: searchParams.userId || undefined,
      deviceUid: searchParams.deviceId || undefined, // UI의 디바이스ID를 백엔드의 deviceUid로 매핑
      status: finalStatus,
      // 방문 유형은 프론트 단독 필터용이거나, 추가 확장을 위해 같이 넘깁니다.
      visitTypes: selectedVisitTypes.join(",") || undefined 
    };

    console.log("🚀 [검색 가동] 백엔드 전송용 파라미터 장전 완료:", apiPayload);

    // 2️⃣ 검색 결과 화면으로 워프 (UI 표기용 원본 + API 전송용 페이로드 동시 전달)
    navigation.navigate("AdminHistorySearchResult", { 
      searchParams: {
        keyword: finalKeyword || "전체",
        dateRange: searchParams.dateRange || "전체 기간",
        userId: searchParams.userId || "전체 사용자",
        deviceId: searchParams.deviceId || "전체 디바이스",
        apiPayload: apiPayload // 실제 axios 요청 시 사용할 찐 데이터
      } 
    });
  };

  return (
    <Container>
      <Header>
        <Logo source={bellIcon} resizeMode="contain" />
        <HeaderTitle>기록</HeaderTitle>
      </Header>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        
        <SearchContainer>
          <InputRow>
            <InputIcon source={iconKeyword} resizeMode="contain" />
            <StyledInput 
              placeholder="키워드" 
              placeholderTextColor="#BBB"
              value={searchParams.keyword}
              onChangeText={(txt) => setSearchParams({...searchParams, keyword: txt})}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <SearchButton activeOpacity={0.7} onPress={handleSearch}>
              <SearchBtnIcon source={searchIcon} resizeMode="contain" />
            </SearchButton>
          </InputRow>

          <InputRow>
            <InputIcon source={iconCalendar} resizeMode="contain" />
            <StyledInput 
              placeholder="날짜 범위 (예: 2026-06-05)" 
              placeholderTextColor="#BBB"
              value={searchParams.dateRange}
              onChangeText={(txt) => setSearchParams({...searchParams, dateRange: txt})}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
          </InputRow>

          <InputRow>
            <InputIcon source={iconUser} resizeMode="contain" />
            <StyledInput 
              placeholder="사용자 ID" 
              placeholderTextColor="#BBB"
              value={searchParams.userId}
              onChangeText={(txt) => setSearchParams({...searchParams, userId: txt})}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
          </InputRow>

          <InputRow style={{ borderBottomWidth: 0 }}>
            <InputIcon source={iconDeviceId} resizeMode="contain" />
            <StyledInput 
              placeholder="디바이스 UID" 
              placeholderTextColor="#BBB"
              value={searchParams.deviceId}
              onChangeText={(txt) => setSearchParams({...searchParams, deviceId: txt})}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
          </InputRow>
        </SearchContainer>

        <SectionWrapper>
          <SectionLabel>방문 유형</SectionLabel>
          <TagCloud>
            {["관리실", "택배", "배달", "방문판매", "공사/점검", "지인/가족", "미확인"].map((tag) => (
              <TagItem 
                key={tag} 
                active={selectedVisitTypes.includes(tag)}
                onPress={() => toggleTag(tag, selectedVisitTypes, setSelectedVisitTypes)}
              >
                <TagText active={selectedVisitTypes.includes(tag)}>{tag}</TagText>
              </TagItem>
            ))}
          </TagCloud>
        </SectionWrapper>

        <SectionWrapper>
          <SectionLabel>상황 성격</SectionLabel>
          <TagCloud>
            {["미응답", "긴급", "공지", "확인요청"].map((tag) => (
              <TagItem 
                key={tag} 
                active={selectedSituations.includes(tag)}
                onPress={() => toggleTag(tag, selectedSituations, setSelectedSituations)}
              >
                <TagText active={selectedSituations.includes(tag)}>{tag}</TagText>
              </TagItem>
            ))}
          </TagCloud>
        </SectionWrapper>

        <SectionWrapper>
          <SectionLabel>세부 키워드</SectionLabel>
          <TagCloud>
            {["식품", "점검", "수리", "요금/부과", "서류/카드", "안내/통지", "방문예약"].map((tag) => (
              <TagItem 
                key={tag} 
                active={selectedKeywords.includes(tag)}
                onPress={() => toggleTag(tag, selectedKeywords, setSelectedKeywords)}
              >
                <TagText active={selectedKeywords.includes(tag)}>{tag}</TagText>
              </TagItem>
            ))}
          </TagCloud>
        </SectionWrapper>

      </ScrollView>
    </Container>
  );
}

/* ================= 스타일 정의 (시안 100% 동기화 🤙) ================= */
const Container = styled(SafeAreaView)` flex: 1; background-color: #F4F5F7; `;
const Header = styled.View` flex-direction: row; align-items: center; padding: 15px 20px; background-color: #F4F5F7; `;
const Logo = styled.Image` width: 28px; height: 28px; margin-right: 10px; `;
const HeaderTitle = styled.Text` font-size: 20px; font-weight: 800; color: #333; `;

/* 🔍 검색창 통합 박스 */
const SearchContainer = styled.View` background-color: #fff; margin: 15px 20px; border-radius: 20px; padding: 5px 20px; elevation: 2; shadow-color: #000; shadow-opacity: 0.04; shadow-radius: 8px; `;
const InputRow = styled.View` flex-direction: row; align-items: center; padding: 16px 0; border-bottom-width: 1px; border-bottom-color: #F0F0F0; `;
const InputIcon = styled.Image` width: 20px; height: 20px; margin-right: 15px; tint-color: #666; `;
const StyledInput = styled.TextInput` flex: 1; font-size: 15px; color: #333; padding: 0; `;
const SearchButton = styled.TouchableOpacity` background-color: #F5F5F5; width: 36px; height: 36px; border-radius: 18px; justify-content: center; align-items: center; `;
const SearchBtnIcon = styled.Image` width: 20px; height: 20px; tint-color: #333; `;

/* 🏷️ 태그 섹션 */
const SectionWrapper = styled.View` padding: 10px 20px; `;
const SectionLabel = styled.Text` font-size: 14px; font-weight: 700; color: #888; margin-bottom: 12px; `;
const TagCloud = styled.View` flex-direction: row; flex-wrap: wrap; background-color: #fff; padding: 20px 20px 10px 20px; border-radius: 20px; elevation: 1; shadow-color: #000; shadow-opacity: 0.03; shadow-radius: 5px; `;
const TagItem = styled.TouchableOpacity` background-color: ${(props) => (props.active ? "#1EC949" : "#F4F5F7")}; padding: 10px 16px; border-radius: 12px; margin-right: 10px; margin-bottom: 10px; `;
const TagText = styled.Text` font-size: 13px; font-weight: 600; color: ${(props) => (props.active ? "#fff" : "#666")}; `;