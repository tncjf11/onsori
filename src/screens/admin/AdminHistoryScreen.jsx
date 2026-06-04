import React, { useState } from "react";
import { ScrollView, TouchableOpacity, TextInput, View } from "react-native";
import styled from "styled-components/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

// ✅ 이미지 에셋 (수철님, 경로 확인 부탁드려요! 🤙)
const bellIcon = require("../../assets/bell.png");
const iconKeyword = require("../../assets/icon_keyword.png"); // 키워드
const iconCalendar = require("../../assets/icon_calendar.png"); // 날짜
const iconUser = require("../../assets/icon_user.png"); // 사용자 ID (신규)
const iconDeviceId = require("../../assets/icon_device_id.png"); // 디바이스 ID (신규)
const searchIcon = require("../../assets/search_icon.png"); // 돋보기

export default function AdminHistoryScreen() {
  // 1. 입력 필드 상태 관리
  const [searchParams, setSearchParams] = useState({
    keyword: "",
    dateRange: "",
    userId: "",
    deviceId: "",
  });

  // 2. 태그 선택 상태 관리 (다중 선택 가능 뽈칵! 🤙)
  const [selectedVisitTypes, setSelectedVisitTypes] = useState([]);
  const [selectedSituations, setSelectedSituations] = useState([]);
  const [selectedKeywords, setSelectedKeywords] = useState([]);

  // 태그 토글 함수
  const toggleTag = (tag, list, setList) => {
    if (list.includes(tag)) setList(list.filter((t) => t !== tag));
    else setList([...list, tag]);
  };

  return (
    <Container>
      {/* 1. 상단 헤더 */}
      <Header>
        <Logo source={bellIcon} resizeMode="contain" />
        <HeaderTitle>기록</HeaderTitle>
      </Header>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* 2. 검색 입력 섹션 (라운드 박스 스타일 뽈칵! 🤙) */}
        <SearchContainer>
          <InputRow>
            <InputIcon source={iconKeyword} />
            <StyledInput 
              placeholder="키워드" 
              value={searchParams.keyword}
              onChangeText={(txt) => setSearchParams({...searchParams, keyword: txt})}
            />
            <TouchableOpacity>
              <SearchBtnIcon source={searchIcon} />
            </TouchableOpacity>
          </InputRow>

          <InputRow>
            <InputIcon source={iconCalendar} />
            <StyledInput 
              placeholder="날짜 범위" 
              value={searchParams.dateRange}
              onChangeText={(txt) => setSearchParams({...searchParams, dateRange: txt})}
            />
          </InputRow>

          <InputRow>
            <InputIcon source={iconUser} />
            <StyledInput 
              placeholder="사용자 ID" 
              value={searchParams.userId}
              onChangeText={(txt) => setSearchParams({...searchParams, userId: txt})}
            />
          </InputRow>

          <InputRow style={{ borderBottomWidth: 0 }}>
            <InputIcon source={iconDeviceId} />
            <StyledInput 
              placeholder="디바이스 ID" 
              value={searchParams.deviceId}
              onChangeText={(txt) => setSearchParams({...searchParams, deviceId: txt})}
            />
          </InputRow>
        </SearchContainer>

        {/* 3. 방문 유형 태그 */}
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

        {/* 4. 상황 성격 태그 */}
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

        {/* 5. 세부 키워드 태그 */}
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

const Container = styled(SafeAreaView)`
  flex: 1;
  background-color: #F8F9FA;
`;

const Header = styled.View`
  flex-direction: row;
  align-items: center;
  padding: 15px 20px;
  background-color: #fff;
`;

const Logo = styled.Image`
  width: 32px;
  height: 32px;
  margin-right: 10px;
`;

const HeaderTitle = styled.Text`
  font-size: 22px;
  font-weight: 800;
  color: #333;
`;

const SearchContainer = styled.View`
  background-color: #fff;
  margin: 20px 20px 10px;
  border-radius: 20px;
  padding: 10px 20px;
  elevation: 5;
  shadow-color: #000;
  shadow-opacity: 0.05;
  shadow-radius: 10px;
`;

const InputRow = styled.View`
  flex-direction: row;
  align-items: center;
  padding: 12px 0;
  border-bottom-width: 1px;
  border-bottom-color: #F0F0F0;
`;

const InputIcon = styled.Image`
  width: 22px;
  height: 22px;
  margin-right: 15px;
  tint-color: #555;
`;

const StyledInput = styled.TextInput`
  flex: 1;
  font-size: 15px;
  color: #333;
`;

const SearchBtnIcon = styled.Image`
  width: 24px;
  height: 24px;
  tint-color: #333;
`;

const SectionWrapper = styled.View`
  padding: 20px;
`;

const SectionLabel = styled.Text`
  font-size: 15px;
  font-weight: 700;
  color: #888;
  margin-bottom: 15px;
`;

const TagCloud = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  background-color: #fff;
  padding: 15px;
  border-radius: 20px;
`;

const TagItem = styled.TouchableOpacity`
  background-color: ${(props) => (props.active ? "#06F393" : "#F5F6F8")};
  padding: 8px 15px;
  border-radius: 10px;
  margin-right: 10px;
  margin-bottom: 10px;
`;

const TagText = styled.Text`
  font-size: 13px;
  font-weight: 600;
  color: ${(props) => (props.active ? "#fff" : "#8E9197")};
`;