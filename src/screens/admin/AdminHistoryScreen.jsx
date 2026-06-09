import React, { useState } from "react";
import { ScrollView, TouchableOpacity } from "react-native";
import styled from "styled-components/native";
import { SafeAreaView as SafeAreaContainer } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";

const bellIcon = require("../../assets/bell.png");
const iconKeyword = require("../../assets/icon_keyword.png");
const iconCalendar = require("../../assets/icon_calendar.png");
const iconUser = require("../../assets/icon_user.png");
const iconDeviceId = require("../../assets/icon_device_id.png");
const searchIcon = require("../../assets/search_icon.png");

const VISIT_TYPES = [
  "관리실",
  "택배",
  "배달",
  "방문판매",
  "공사/점검",
  "지인/가족",
  "미확인",
];

const SITUATIONS = ["미응답", "긴급", "공지", "확인요청"];

const DETAIL_KEYWORDS = [
  "식품",
  "점검",
  "수리",
  "요금/부과",
  "서류/카드",
  "안내/통지",
  "방문예약",
];

const logAdminHistory = (message, data) => {
  if (data !== undefined) {
    console.log(`[ADMIN_HISTORY] ${message}`, data);
  } else {
    console.log(`[ADMIN_HISTORY] ${message}`);
  }
};

export default function AdminHistoryScreen() {
  const navigation = useNavigation();

  const [searchParams, setSearchParams] = useState({
    keyword: "",
    dateRange: "",
    userId: "",
    deviceId: "",
  });

  const [selectedVisitTypes, setSelectedVisitTypes] = useState([]);
  const [selectedSituations, setSelectedSituations] = useState([]);
  const [selectedKeywords, setSelectedKeywords] = useState([]);

  const trimValue = (value) => String(value || "").trim();

  const toggleTag = (tag, list, setList) => {
    if (list.includes(tag)) {
      setList(list.filter((item) => item !== tag));
      return;
    }

    setList([...list, tag]);
  };

  const updateSearchParam = (key, value) => {
    setSearchParams((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const getSituationStatusCandidates = (situation) => {
    if (situation === "미응답") {
      return ["FAILED", "MISSED", "NO_ANSWER", "CANCELED", "CANCELLED"];
    }

    if (situation === "긴급") {
      return ["URGENT"];
    }

    if (situation === "공지") {
      return ["NOTICE"];
    }

    if (situation === "확인요청") {
      return ["CHECK_REQUEST", "CONFIRM_REQUEST"];
    }

    return [];
  };

  const buildApiPayload = ({
    keywordInput,
    finalKeyword,
    dateRange,
    userId,
    deviceId,
  }) => {
    const apiPayload = {};

    if (finalKeyword) {
      apiPayload.keyword = finalKeyword;
    }

    if (dateRange) {
      apiPayload.date = dateRange;
      apiPayload.dateRange = dateRange;
    }

    if (userId) {
      apiPayload.userId = userId;
    }

    if (deviceId) {
      apiPayload.deviceUid = deviceId;
      apiPayload.deviceId = deviceId;
    }

    if (selectedVisitTypes.length > 0) {
      apiPayload.visitTypes = selectedVisitTypes;
      apiPayload.categories = selectedVisitTypes;
    }

    if (selectedSituations.length > 0) {
      apiPayload.situations = selectedSituations;

      const statusCandidates = selectedSituations.flatMap(
        getSituationStatusCandidates
      );

      if (statusCandidates.length > 0) {
        apiPayload.statuses = statusCandidates;
        apiPayload.status = statusCandidates[0];
      } else {
        apiPayload.status = selectedSituations[0];
      }
    }

    if (selectedKeywords.length > 0) {
      apiPayload.keywords = selectedKeywords;

      if (!keywordInput) {
        apiPayload.keyword = selectedKeywords.join(",");
      }
    }

    return apiPayload;
  };

  const handleSearch = () => {
    const keywordInput = trimValue(searchParams.keyword);
    const dateRange = trimValue(searchParams.dateRange);
    const userId = trimValue(searchParams.userId);
    const deviceId = trimValue(searchParams.deviceId);

    const tagKeyword = selectedKeywords.join(",");
    const finalKeyword = keywordInput || tagKeyword;

    const apiPayload = buildApiPayload({
      keywordInput,
      finalKeyword,
      dateRange,
      userId,
      deviceId,
    });

    const nextSearchParams = {
      keyword: finalKeyword || "전체",
      dateRange: dateRange || "전체 기간",
      userId: userId || "전체 사용자",
      deviceId: deviceId || "전체 디바이스",
      visitTypes: selectedVisitTypes,
      situations: selectedSituations,
      keywords: selectedKeywords,
      apiPayload,
    };

    logAdminHistory("검색 실행", nextSearchParams);

    navigation.navigate("AdminHistorySearchResult", {
      searchParams: nextSearchParams,
      refreshKey: Date.now(),
    });
  };

  return (
    <Container>
      <Header>
        <Logo source={bellIcon} resizeMode="contain" />
        <HeaderTitle>기록</HeaderTitle>
      </Header>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <SearchContainer>
          <InputRow>
            <InputIcon source={iconKeyword} resizeMode="contain" />
            <StyledInput
              placeholder="키워드"
              placeholderTextColor="#BBB"
              value={searchParams.keyword}
              onChangeText={(text) => updateSearchParam("keyword", text)}
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
              placeholder="날짜 범위"
              placeholderTextColor="#BBB"
              value={searchParams.dateRange}
              onChangeText={(text) => updateSearchParam("dateRange", text)}
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
              onChangeText={(text) => updateSearchParam("userId", text)}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
          </InputRow>

          <InputRow style={{ borderBottomWidth: 0 }}>
            <InputIcon source={iconDeviceId} resizeMode="contain" />
            <StyledInput
              placeholder="디바이스 ID"
              placeholderTextColor="#BBB"
              value={searchParams.deviceId}
              onChangeText={(text) => updateSearchParam("deviceId", text)}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
          </InputRow>
        </SearchContainer>

        <SectionWrapper>
          <SectionLabel>방문 유형</SectionLabel>
          <TagCloud>
            {VISIT_TYPES.map((tag) => (
              <TagItem
                key={tag}
                active={selectedVisitTypes.includes(tag)}
                onPress={() =>
                  toggleTag(tag, selectedVisitTypes, setSelectedVisitTypes)
                }
              >
                <TagText active={selectedVisitTypes.includes(tag)}>
                  {tag}
                </TagText>
              </TagItem>
            ))}
          </TagCloud>
        </SectionWrapper>

        <SectionWrapper>
          <SectionLabel>상황 성격</SectionLabel>
          <TagCloud>
            {SITUATIONS.map((tag) => (
              <TagItem
                key={tag}
                active={selectedSituations.includes(tag)}
                onPress={() =>
                  toggleTag(tag, selectedSituations, setSelectedSituations)
                }
              >
                <TagText active={selectedSituations.includes(tag)}>
                  {tag}
                </TagText>
              </TagItem>
            ))}
          </TagCloud>
        </SectionWrapper>

        <SectionWrapper>
          <SectionLabel>세부 키워드</SectionLabel>
          <TagCloud>
            {DETAIL_KEYWORDS.map((tag) => (
              <TagItem
                key={tag}
                active={selectedKeywords.includes(tag)}
                onPress={() =>
                  toggleTag(tag, selectedKeywords, setSelectedKeywords)
                }
              >
                <TagText active={selectedKeywords.includes(tag)}>
                  {tag}
                </TagText>
              </TagItem>
            ))}
          </TagCloud>
        </SectionWrapper>
      </ScrollView>
    </Container>
  );
}

const Container = styled(SafeAreaContainer)`
  flex: 1;
  background-color: #F4F5F7;
`;

const Header = styled.View`
  flex-direction: row;
  align-items: center;
  padding: 15px 20px;
  background-color: #F4F5F7;
`;

const Logo = styled.Image`
  width: 28px;
  height: 28px;
  margin-right: 10px;
`;

const HeaderTitle = styled.Text`
  font-size: 20px;
  font-weight: 800;
  color: #333;
`;

const SearchContainer = styled.View`
  background-color: #fff;
  margin: 15px 20px;
  border-radius: 20px;
  padding: 5px 20px;
  elevation: 2;
  shadow-color: #000;
  shadow-opacity: 0.04;
  shadow-radius: 8px;
`;

const InputRow = styled.View`
  flex-direction: row;
  align-items: center;
  padding: 16px 0;
  border-bottom-width: 1px;
  border-bottom-color: #F0F0F0;
`;

const InputIcon = styled.Image`
  width: 20px;
  height: 20px;
  margin-right: 15px;
  tint-color: #666;
`;

const StyledInput = styled.TextInput`
  flex: 1;
  font-size: 15px;
  color: #333;
  padding: 0;
`;

const SearchButton = styled.TouchableOpacity`
  background-color: #F5F5F5;
  width: 36px;
  height: 36px;
  border-radius: 18px;
  justify-content: center;
  align-items: center;
`;

const SearchBtnIcon = styled.Image`
  width: 20px;
  height: 20px;
  tint-color: #333;
`;

const SectionWrapper = styled.View`
  padding: 10px 20px;
`;

const SectionLabel = styled.Text`
  font-size: 14px;
  font-weight: 700;
  color: #888;
  margin-bottom: 12px;
`;

const TagCloud = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  background-color: #fff;
  padding: 20px 20px 10px 20px;
  border-radius: 20px;
  elevation: 1;
  shadow-color: #000;
  shadow-opacity: 0.03;
  shadow-radius: 5px;
`;

const TagItem = styled.TouchableOpacity`
  background-color: ${(props) => (props.active ? "#1EC949" : "#F4F5F7")};
  padding: 10px 16px;
  border-radius: 12px;
  margin-right: 10px;
  margin-bottom: 10px;
`;

const TagText = styled.Text`
  font-size: 13px;
  font-weight: 600;
  color: ${(props) => (props.active ? "#fff" : "#666")};
`;