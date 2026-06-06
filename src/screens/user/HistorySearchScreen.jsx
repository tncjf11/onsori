import React, { useState, useEffect } from "react";
import { ScrollView, TouchableOpacity, TextInput, View, Alert, Modal } from "react-native";
import styled from "styled-components/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons"; 

// 📥 최근 검색어 장부를 폰 서랍장에 저축하기 위한 비밀금고 임포트! 🔑
import AsyncStorage from "@react-native-async-storage/async-storage";

// ✅ 이미지 에셋 경로 매핑 (순정 100% 보존 🤙)
const backIcon = require("../../assets/back_icon.png");
const searchIcon = require("../../assets/search_icon.png");
const calendarIcon = require("../../assets/calendar_icon.png");
const keywordIcon = require("../../assets/keyword_icon.png");
const deleteTag = require("../../assets/delete_tag.png");

export default function HistorySearchScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused(); // 📱 화면 다시 돌아왔을 때 최근 검색어 리프레시 센서

  const [searchText, setSearchText] = useState("");
  // 🚀 초기 날짜 상태는 빈 문자열로 시작 (모달에서 선택 시 채워짐)
  const [selectedDateLabel, setSelectedDateLabel] = useState("전체 기간");
  const [selectedDateRange, setSelectedDateRange] = useState(null);
  
  const [calendarModalVisible, setCalendarModalVisible] = useState(false); 
  const [selectedKeywords, setSelectedKeywords] = useState([]); 
  const [liveSavedKeywords, setLiveSavedKeywords] = useState([]);

  // 태그 데이터 목록
  const categories = [
    { title: "최근 저장된 키워드", data: liveSavedKeywords },
    { title: "방문 유형", data: ["관리실", "택배", "배달", "방문판매", "공사/점검", "지인/가족", "미확인"] },
    { title: "상황 성격", data: ["미응답", "긴급", "공지", "확인요청"] },
    { title: "세부 키워드", data: ["식품", "점검", "수리", "요금/부과", "서류/카드", "안내/통지", "방문예약"] }
  ];

  // =========================================================
  // 📅 [동적 날짜 계산 엔진] 오늘 날짜 기준으로 범위 추출!
  // =========================================================
  const getDynamicDateRange = (days) => {
    const today = new Date();
    // 시연용 강제 날짜 세팅이 필요하다면 아래 줄 주석 해제 후 사용 (현재 컨텍스트: 2026-06-04)
    // today.setFullYear(2026, 5, 4); // Month is 0-indexed (5 = June)
    
    if (days === null) return null; // "전체 기간"
    if (days === 0) return today.toISOString().split('T')[0]; // "오늘"

    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() - days);
    
    // YYYY-MM-DD ~ YYYY-MM-DD 포맷
    return `${targetDate.toISOString().split('T')[0]} ~ ${today.toISOString().split('T')[0]}`;
  };

  // 모달 안에서 보여줄 옵션 세트
  const dateOptions = [
    { label: "오늘", days: 0 },
    { label: "최근 7일", days: 7 },
    { label: "최근 1개월", days: 30 },
    { label: "전체 기간", days: null }
  ];

  // =========================================================
  // 🔒 [금고 아카이브 추적 스캔] 로컬에 세이브된 최근 검색어 꺼내오기
  // =========================================================
  const loadRecentKeywords = async () => {
    try {
      const saved = await AsyncStorage.getItem("recentKeywords");
      if (saved) {
        setLiveSavedKeywords(JSON.parse(saved));
        console.log("🔒 [검색창 금고 해독] 불러온 최근 저장 키워드 목록:", saved);
      } else {
        setLiveSavedKeywords([]);
      }
    } catch (e) {
      console.error("최근 검색어 서랍장 스캔 찐빠:", e);
    }
  };

  useEffect(() => {
    if (isFocused) {
      loadRecentKeywords();
    }
  }, [isFocused]);

  // =========================================================
  // 🎯 [필터 검색 핸들러 - 실시간 키워드 누적 저축 가드 완착! 🤙]
  // =========================================================
  const handleSearch = async () => {
    const finalKeyword = searchText.trim() || (selectedKeywords.length > 0 ? selectedKeywords[0] : "");

    // 💾 [치트키 엔진 작동] 유저가 글자를 입력해서 진짜 조회를 때렸을 때만 로컬 서랍장에 박제!
    if (searchText.trim()) {
      try {
        const textToSave = searchText.trim();
        const filteredList = liveSavedKeywords.filter(k => k !== textToSave);
        const updatedList = [textToSave, ...filteredList].slice(0, 5);
        
        setLiveSavedKeywords(updatedList);
        await AsyncStorage.setItem("recentKeywords", JSON.stringify(updatedList));
      } catch (e) {
        console.error("검색어 금고 저장 대실패:", e);
      }
    }

    console.log("▶️ [8-3번 쿼리 패킹] 결과 창으로 들고 갈 바구니 데이터 👇");
    console.log(`- 검색어: ${finalKeyword}`);
    // 실제 검색 결과창(HistorySearchResultScreen)으로 넘어갈 때는 정확한 날짜 범위 값(selectedDateRange)을 넘깁니다.
    console.log(`- 날짜필터: ${selectedDateRange}`);

    navigation.navigate("HistorySearchResult", {
      searchQuery: finalKeyword,
      dateFilter: selectedDateRange, // 🚀 라벨이 아니라 실제 계산된 범위 전달
      keywordsFilter: selectedKeywords
    });
  };

  // 🏷️ 하단 태그 단추 터치 시 핸들러
  const handleTagPress = (tag, title) => {
    if (title === "최근 저장된 키워드") {
      setSearchText(tag);
    } else {
      if (!selectedKeywords.includes(tag)) {
        setSelectedKeywords([...selectedKeywords, tag]);
      }
    }
  };

  const handleRemoveTag = (target) => {
    setSelectedKeywords(selectedKeywords.filter(k => k !== target));
  };

  // =========================================================
  // 📅 모달 내 날짜 선택 처리 핸들러
  // =========================================================
  const handleSelectDateOption = (option) => {
    setSelectedDateLabel(option.label);
    setSelectedDateRange(getDynamicDateRange(option.days));
    setCalendarModalVisible(false);
  };

  return (
    <Container>
      {/* 1. 헤더 영역 */}
      <Header>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 5 }}>
          <IconBtn source={backIcon} resizeMode="contain" />
        </TouchableOpacity>
        <HeaderTitle>히스토리 정밀 검색</HeaderTitle>
        <View style={{ width: 34 }} /> 
      </Header>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        {/* 1. 검색 바 */}
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

        {/* 2. 필터 카드 섹션 */}
        <FilterBoxGroup>
          <FilterItem activeOpacity={0.6} onPress={() => setCalendarModalVisible(true)}>
            <FilterIcon source={calendarIcon} resizeMode="contain" />
            <FilterText>날짜 범위 |</FilterText>
            {/* 🚀 화면에는 "최근 7일" 같은 예쁜 라벨 표출 */}
            <ValueText>{selectedDateLabel}</ValueText>
          </FilterItem>
          
          <FilterItem style={{ borderBottomWidth: 0, alignItems: 'flex-start' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 15 }}>
              <FilterIcon source={keywordIcon} resizeMode="contain" />
              <FilterText>상세 키워드 필터 |</FilterText>
            </View>
            
            <SelectedTagList horizontal showsHorizontalScrollIndicator={false}>
              {selectedKeywords.map((tag, idx) => (
                <SelectedTag key={idx}>
                  <SelectedTagText>{tag}</SelectedTagText>
                  <DeleteBtn activeOpacity={0.7} onPress={() => handleRemoveTag(tag)}>
                    <DeleteIcon source={deleteTag} resizeMode="contain" />
                  </DeleteBtn>
                </SelectedTag>
              ))}
            </SelectedTagList>
          </FilterItem>
        </FilterBoxGroup>

        {/* 3. 카테고리별 태그 리스트 */}
        {categories.map((section, sIdx) => (
          <SectionContainer key={sIdx}>
            <SectionTitle>{section.title}</SectionTitle>
            <TagRow>
              {section.data.length > 0 ? (
                section.data.map((tag, tIdx) => (
                  <TagBtn key={tIdx} activeOpacity={0.6} onPress={() => handleTagPress(tag, section.title)}>
                    <TagBtnText style={{ color: section.title === "최근 저장된 키워드" ? "#02D47F" : "#666", fontWeight: section.title === "최근 저장된 키워드" ? "700" : "500" }}>{tag}</TagBtnText>
                  </TagBtn>
                ))
              ) : (
                section.title === "최근 저장된 키워드" && (
                  <EmptyKeywordsGuidText>최근 직접 검색하여 저축된 단어가 없습니다.</EmptyKeywordsGuidText>
                )
              )}
            </TagRow>
          </SectionContainer>
        ))}
      </ScrollView>

      {/* 📅 [세련된 개선판] 날짜 범위 선택 모달 서랍 */}
      <Modal animationType="fade" transparent={true} visible={calendarModalVisible} onRequestClose={() => setCalendarModalVisible(false)}>
        <ModalOverlay activeOpacity={1} onPress={() => setCalendarModalVisible(false)}>
          <DateModalContainer>
            <ModalHeader>
              <ModalHeaderText>📅 검색 기간 설정</ModalHeaderText>
              <TouchableOpacity onPress={() => setCalendarModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ModalHeader>
            <ModalBody>
              {dateOptions.map((option, index) => (
                <DateOptionButton 
                  key={index}
                  activeOpacity={0.7}
                  onPress={() => handleSelectDateOption(option)}
                  isCurrent={selectedDateLabel === option.label}
                >
                  <DateLabelText isCurrent={selectedDateLabel === option.label}>{option.label}</DateLabelText>
                  {/* 옵션 버튼 우측에 실제 계산된 날짜 범위 희미하게 표출 */}
                  <DateValueText>{getDynamicDateRange(option.days) || "전체 조회"}</DateValueText>
                </DateOptionButton>
              ))}
            </ModalBody>
          </DateModalContainer>
        </ModalOverlay>
      </Modal>
    </Container>
  );
}

/* ================= 스타일 정의 (수철님 순정 스타일 100% 미크론 무결 수호 🤙) ================= */
const Container = styled(SafeAreaView)` flex: 1; background-color: #F8F9FA; `;
const Header = styled.View` flex-direction: row; justify-content: space-between; align-items: center; padding: 15px 20px; background-color: #fff; border-bottom-width: 1px; border-bottom-color: #EEE; `;
const IconBtn = styled.Image` width: 24px; height: 24px; `;
const HeaderTitle = styled.Text` font-size: 18px; font-weight: 700; color: #333; `;
const SearchSection = styled.View` padding: 20px; background-color: #fff; `;
const SearchInputBox = styled.View` flex-direction: row; align-items: center; background-color: #F8F9FA; border-radius: 25px; padding: 5px 20px; border-width: 1px; border-color: #EAEAEA; `;
const StyledInput = styled.TextInput` flex: 1; height: 45px; font-size: 16px; color: #333; fontWeight: 600; `;
const SearchIcon = styled.Image` width: 22px; height: 22px; `;
const FilterBoxGroup = styled.View` background-color: #fff; margin: 10px 20px; border-radius: 15px; border-width: 1px; border-color: #EEE; padding: 5px 15px; `;
const FilterItem = styled.TouchableOpacity` flex-direction: row; align-items: center; padding: 15px 0; border-bottom-width: 1px; border-bottom-color: #F0F0F0; `;
const FilterIcon = styled.Image` width: 20px; height: 20px; margin-right: 10px; `;
const FilterText = styled.Text` font-size: 15px; color: #666; margin-right: 10px; `;
const ValueText = styled.Text` font-size: 15px; color: #333; font-weight: 700; `;
const SelectedTagList = styled.ScrollView` flex-direction: row; margin-top: 10px; padding-bottom: 10px; min-height: 40px; `;
const SelectedTag = styled.View` background-color: #F2F4F7; padding: 6px 14px; border-radius: 15px; margin-right: 14px; position: relative; margin-top: 5px; justify-content: center; align-items: center; border-width: 0.5px; border-color: #E2E8F0; `;
const SelectedTagText = styled.Text` font-size: 13px; color: #444; font-weight: 600; marginRight: 4px; `;
const DeleteBtn = styled.TouchableOpacity` position: absolute; top: -6px; right: -8px; width: 16px; height: 16px; justify-content: center; align-items: center; z-index: 99; `;
const DeleteIcon = styled.Image` width: 14px; height: 14px; `;
const SectionContainer = styled.View` padding: 15px 20px 5px; `;
const SectionTitle = styled.Text` font-size: 13px; color: #A0AEC0; font-weight: 700; margin-bottom: 12px; text-transform: uppercase; `;
const TagRow = styled.View` flex-direction: row; flex-wrap: wrap; `;
const TagBtn = styled.TouchableOpacity` background-color: #fff; padding: 10px 16px; border-radius: 12px; margin-right: 10px; margin-bottom: 12px; border-width: 1px; border-color: #E2E8F0; `;
const TagBtnText = styled.Text` font-size: 14px; color: #666; font-weight: 600; `;
const ModalOverlay = styled.TouchableOpacity` flex: 1; background-color: rgba(0,0,0,0.4); justify-content: center; align-items: center; `;
const EmptyKeywordsGuidText = styled.Text` font-size: 13px; color: #C4C4C4; font-weight: 600; padding: 5px 0 15px; font-style: italic; `; 
const DateModalContainer = styled.View` width: 85%; background-color: #fff; border-radius: 20px; padding: 25px 20px; `;
const ModalHeader = styled.View` flex-direction: row; justify-content: space-between; align-items: center; margin-bottom: 20px; `;
const ModalHeaderText = styled.Text` font-size: 18px; font-weight: 800; color: #333; `;
const ModalBody = styled.View` width: 100%; `;
const DateOptionButton = styled.TouchableOpacity` flex-direction: row; justify-content: space-between; align-items: center; padding: 16px 20px; border-radius: 12px; margin-bottom: 10px; border-width: 1px; border-color: ${props => props.isCurrent ? "#06F393" : "#EEE"}; background-color: ${props => props.isCurrent ? "#DFFFF4" : "#F8F9FA"}; `;
const DateLabelText = styled.Text` font-size: 16px; font-weight: 700; color: ${props => props.isCurrent ? "#02D47F" : "#333"}; `;
const DateValueText = styled.Text` font-size: 13px; font-weight: 600; color: #999; `;