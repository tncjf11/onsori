import React, { useState, useEffect } from "react";
import {
  ScrollView,
  TouchableOpacity,
  TextInput,
  View,
  Modal,
} from "react-native";
import styled from "styled-components/native";
import { SafeAreaView as SafeAreaContainer } from "react-native-safe-area-context";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

const backIcon = require("../../assets/back_icon.png");
const searchIcon = require("../../assets/search_icon.png");
const calendarIcon = require("../../assets/calendar_icon.png");
const keywordIcon = require("../../assets/keyword_icon.png");
const deleteTag = require("../../assets/delete_tag.png");

export default function HistorySearchScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const [searchText, setSearchText] = useState("");
  const [selectedDateLabel, setSelectedDateLabel] = useState("전체 기간");
  const [selectedDateRange, setSelectedDateRange] = useState(null);

  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const [selectedKeywords, setSelectedKeywords] = useState([]);
  const [liveSavedKeywords, setLiveSavedKeywords] = useState([]);

  const categories = [
    { title: "최근 저장된 키워드", data: liveSavedKeywords },
    {
      title: "방문 유형",
      data: ["관리실", "택배", "배달", "방문판매", "공사/점검", "지인/가족", "미확인"],
    },
    { title: "상황 성격", data: ["미응답", "긴급", "공지", "확인요청"] },
    {
      title: "세부 키워드",
      data: ["식품", "점검", "수리", "요금/부과", "서류/카드", "안내/통지", "방문예약"],
    },
  ];

  const dateOptions = [
    { label: "오늘", days: 0 },
    { label: "최근 7일", days: 7 },
    { label: "최근 1개월", days: 30 },
    { label: "전체 기간", days: null },
  ];

  const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const getDynamicDateRange = (days) => {
    const today = new Date();

    if (days === null) return null;

    if (days === 0) {
      return formatLocalDate(today);
    }

    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() - days);

    return `${formatLocalDate(targetDate)} ~ ${formatLocalDate(today)}`;
  };

  const loadRecentKeywords = async () => {
    try {
      const saved = await AsyncStorage.getItem("recentKeywords");

      if (saved) {
        const parsed = JSON.parse(saved);
        setLiveSavedKeywords(Array.isArray(parsed) ? parsed : []);
      } else {
        setLiveSavedKeywords([]);
      }
    } catch (error) {
      console.error("최근 검색어 불러오기 실패:", error?.message);
      setLiveSavedKeywords([]);
    }
  };

  useEffect(() => {
    if (isFocused) {
      loadRecentKeywords();
    }
  }, [isFocused]);

  const saveRecentKeyword = async (keyword) => {
    if (!keyword) return;

    try {
      const filteredList = liveSavedKeywords.filter((item) => item !== keyword);
      const updatedList = [keyword, ...filteredList].slice(0, 5);

      setLiveSavedKeywords(updatedList);
      await AsyncStorage.setItem("recentKeywords", JSON.stringify(updatedList));
    } catch (error) {
      console.error("최근 검색어 저장 실패:", error?.message);
    }
  };

  const handleSearch = async () => {
    const trimmedSearchText = searchText.trim();

    const finalKeyword =
      trimmedSearchText ||
      (selectedKeywords.length > 0 ? selectedKeywords[0] : "");

    if (trimmedSearchText) {
      await saveRecentKeyword(trimmedSearchText);
    }

    navigation.navigate("HistorySearchResult", {
      searchQuery: finalKeyword,
      dateFilter: selectedDateRange,
      dateFilterLabel: selectedDateLabel,
      keywordsFilter: selectedKeywords,
    });
  };

  const handleTagPress = (tag, title) => {
    if (title === "최근 저장된 키워드") {
      setSearchText(tag);
      return;
    }

    if (!selectedKeywords.includes(tag)) {
      setSelectedKeywords((prev) => [...prev, tag]);
    }
  };

  const handleRemoveTag = (target) => {
    setSelectedKeywords((prev) => prev.filter((keyword) => keyword !== target));
  };

  const handleSelectDateOption = (option) => {
    setSelectedDateLabel(option.label);
    setSelectedDateRange(getDynamicDateRange(option.days));
    setCalendarModalVisible(false);
  };

  return (
    <Container>
      <Header>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ padding: 5 }}
        >
          <IconBtn source={backIcon} resizeMode="contain" />
        </TouchableOpacity>

        <HeaderTitle>히스토리 정밀 검색</HeaderTitle>

        <View style={{ width: 34 }} />
      </Header>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        <SearchSection>
          <SearchInputBox>
            <StyledInput
              placeholder="대화 내용 검색 (예: 택배, 공지 등)"
              value={searchText}
              onChangeText={setSearchText}
              placeholderTextColor="#BBB"
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />

            <TouchableOpacity onPress={handleSearch} style={{ padding: 5 }}>
              <SearchIcon source={searchIcon} resizeMode="contain" />
            </TouchableOpacity>
          </SearchInputBox>
        </SearchSection>

        <FilterBoxGroup>
          <FilterItem
            activeOpacity={0.6}
            onPress={() => setCalendarModalVisible(true)}
          >
            <FilterIcon source={calendarIcon} resizeMode="contain" />
            <FilterText>날짜 범위 |</FilterText>
            <ValueText>{selectedDateLabel}</ValueText>
          </FilterItem>

          <FilterItem style={{ borderBottomWidth: 0, alignItems: "flex-start" }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 15,
              }}
            >
              <FilterIcon source={keywordIcon} resizeMode="contain" />
              <FilterText>상세 키워드 필터 |</FilterText>
            </View>

            <SelectedTagList horizontal showsHorizontalScrollIndicator={false}>
              {selectedKeywords.map((tag) => (
                <SelectedTag key={tag}>
                  <SelectedTagText>{tag}</SelectedTagText>
                  <DeleteBtn
                    activeOpacity={0.7}
                    onPress={() => handleRemoveTag(tag)}
                  >
                    <DeleteIcon source={deleteTag} resizeMode="contain" />
                  </DeleteBtn>
                </SelectedTag>
              ))}
            </SelectedTagList>
          </FilterItem>
        </FilterBoxGroup>

        {categories.map((section) => (
          <SectionContainer key={section.title}>
            <SectionTitle>{section.title}</SectionTitle>

            <TagRow>
              {section.data.length > 0 ? (
                section.data.map((tag) => (
                  <TagBtn
                    key={`${section.title}-${tag}`}
                    activeOpacity={0.6}
                    onPress={() => handleTagPress(tag, section.title)}
                  >
                    <TagBtnText
                      style={{
                        color:
                          section.title === "최근 저장된 키워드"
                            ? "#02D47F"
                            : "#666",
                        fontWeight:
                          section.title === "최근 저장된 키워드" ? "700" : "500",
                      }}
                    >
                      {tag}
                    </TagBtnText>
                  </TagBtn>
                ))
              ) : (
                section.title === "최근 저장된 키워드" && (
                  <EmptyKeywordsGuidText>
                    최근 직접 검색하여 저장된 단어가 없습니다.
                  </EmptyKeywordsGuidText>
                )
              )}
            </TagRow>
          </SectionContainer>
        ))}
      </ScrollView>

      <Modal
        animationType="fade"
        transparent
        visible={calendarModalVisible}
        onRequestClose={() => setCalendarModalVisible(false)}
      >
        <ModalOverlay
          activeOpacity={1}
          onPress={() => setCalendarModalVisible(false)}
        >
          <DateModalContainer>
            <ModalHeader>
              <ModalHeaderText>📅 검색 기간 설정</ModalHeaderText>

              <TouchableOpacity onPress={() => setCalendarModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ModalHeader>

            <ModalBody>
              {dateOptions.map((option) => {
                const isCurrent = selectedDateLabel === option.label;

                return (
                  <DateOptionButton
                    key={option.label}
                    activeOpacity={0.7}
                    onPress={() => handleSelectDateOption(option)}
                    isCurrent={isCurrent}
                  >
                    <DateLabelText isCurrent={isCurrent}>
                      {option.label}
                    </DateLabelText>

                    <DateValueText>
                      {getDynamicDateRange(option.days) || "전체 조회"}
                    </DateValueText>
                  </DateOptionButton>
                );
              })}
            </ModalBody>
          </DateModalContainer>
        </ModalOverlay>
      </Modal>
    </Container>
  );
}

/* ================= 스타일 정의 ================= */

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
  border-bottom-color: #EEE;
`;

const IconBtn = styled.Image`
  width: 24px;
  height: 24px;
`;

const HeaderTitle = styled.Text`
  font-size: 18px;
  font-weight: 700;
  color: #333;
`;

const SearchSection = styled.View`
  padding: 20px;
  background-color: #fff;
`;

const SearchInputBox = styled.View`
  flex-direction: row;
  align-items: center;
  background-color: #F8F9FA;
  border-radius: 25px;
  padding: 5px 20px;
  border-width: 1px;
  border-color: #EAEAEA;
`;

const StyledInput = styled(TextInput)`
  flex: 1;
  height: 45px;
  font-size: 16px;
  color: #333;
  font-weight: 600;
`;

const SearchIcon = styled.Image`
  width: 22px;
  height: 22px;
`;

const FilterBoxGroup = styled.View`
  background-color: #fff;
  margin: 10px 20px;
  border-radius: 15px;
  border-width: 1px;
  border-color: #EEE;
  padding: 5px 15px;
`;

const FilterItem = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  padding: 15px 0;
  border-bottom-width: 1px;
  border-bottom-color: #F0F0F0;
`;

const FilterIcon = styled.Image`
  width: 20px;
  height: 20px;
  margin-right: 10px;
`;

const FilterText = styled.Text`
  font-size: 15px;
  color: #666;
  margin-right: 10px;
`;

const ValueText = styled.Text`
  font-size: 15px;
  color: #333;
  font-weight: 700;
`;

const SelectedTagList = styled.ScrollView`
  flex-direction: row;
  margin-top: 10px;
  padding-bottom: 10px;
  min-height: 40px;
`;

const SelectedTag = styled.View`
  background-color: #F2F4F7;
  padding: 6px 14px;
  border-radius: 15px;
  margin-right: 14px;
  position: relative;
  margin-top: 5px;
  justify-content: center;
  align-items: center;
  border-width: 0.5px;
  border-color: #E2E8F0;
`;

const SelectedTagText = styled.Text`
  font-size: 13px;
  color: #444;
  font-weight: 600;
  margin-right: 4px;
`;

const DeleteBtn = styled.TouchableOpacity`
  position: absolute;
  top: -6px;
  right: -8px;
  width: 16px;
  height: 16px;
  justify-content: center;
  align-items: center;
  z-index: 99;
`;

const DeleteIcon = styled.Image`
  width: 14px;
  height: 14px;
`;

const SectionContainer = styled.View`
  padding: 15px 20px 5px;
`;

const SectionTitle = styled.Text`
  font-size: 13px;
  color: #A0AEC0;
  font-weight: 700;
  margin-bottom: 12px;
  text-transform: uppercase;
`;

const TagRow = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
`;

const TagBtn = styled.TouchableOpacity`
  background-color: #fff;
  padding: 10px 16px;
  border-radius: 12px;
  margin-right: 10px;
  margin-bottom: 12px;
  border-width: 1px;
  border-color: #E2E8F0;
`;

const TagBtnText = styled.Text`
  font-size: 14px;
  color: #666;
  font-weight: 600;
`;

const ModalOverlay = styled.TouchableOpacity`
  flex: 1;
  background-color: rgba(0, 0, 0, 0.4);
  justify-content: center;
  align-items: center;
`;

const EmptyKeywordsGuidText = styled.Text`
  font-size: 13px;
  color: #C4C4C4;
  font-weight: 600;
  padding: 5px 0 15px;
  font-style: italic;
`;

const DateModalContainer = styled.View`
  width: 85%;
  background-color: #fff;
  border-radius: 20px;
  padding: 25px 20px;
`;

const ModalHeader = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const ModalHeaderText = styled.Text`
  font-size: 18px;
  font-weight: 800;
  color: #333;
`;

const ModalBody = styled.View`
  width: 100%;
`;

const DateOptionButton = styled.TouchableOpacity`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-radius: 12px;
  margin-bottom: 10px;
  border-width: 1px;
  border-color: ${(props) => (props.isCurrent ? "#06F393" : "#EEE")};
  background-color: ${(props) => (props.isCurrent ? "#DFFFF4" : "#F8F9FA")};
`;

const DateLabelText = styled.Text`
  font-size: 16px;
  font-weight: 700;
  color: ${(props) => (props.isCurrent ? "#02D47F" : "#333")};
`;

const DateValueText = styled.Text`
  font-size: 13px;
  font-weight: 600;
  color: #999;
`;