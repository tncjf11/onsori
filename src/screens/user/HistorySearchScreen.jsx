import React, { useState, useEffect } from "react";
import { ScrollView, TouchableOpacity, TextInput, View, Alert, Modal } from "react-native";
import styled from "styled-components/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons"; 

// 📥 [수철님 지령 완벽 해소] 최근 검색어 장부를 폰 서랍장에 저축하기 위한 비밀금고 임포트! 🔑
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
  const [selectedDate, setSelectedDate] = useState("2026-05-15"); 
  const [calendarModalVisible, setCalendarModalVisible] = useState(false); 
  
  // 🤙 초기 선택 키워드는 아무것도 없는 깨끗한 상태로 대기!
  const [selectedKeywords, setSelectedKeywords] = useState([]); 

  // 💾 [실전 프론트 동적 키워드 보관창] - 처음엔 당연히 깨끗하게 빈 배열로 시동 대기! 🤙
  const [liveSavedKeywords, setLiveSavedKeywords] = useState([]);

  // 태그 데이터 목록 (첫 번째 '최근 저장된 키워드'는 liveSavedKeywords 가변 데이터로 동적 교체 작동!)
  const categories = [
    { title: "최근 저장된 키워드", data: liveSavedKeywords }, // 🎯 가변 엔진 락인!
    { title: "방문 유형", data: ["관리실", "택배", "배달", "방문판매", "공사/점검", "지인/가족", "미확인"] },
    { title: "상황 성격", data: ["미응답", "긴급", "공지", "확인요청"] },
    { title: "세부 키워드", data: ["식품", "점검", "수리", "요금/부과", "서류/카드", "안내/통지", "방문예약"] }
  ];

  // 졸작 시연 발표용 가변형 날짜 세트
  const dummyDates = ["2026-05-15", "2026-05-20", "2026-05-25", "2026-05-26"];

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
        // 장부가 아예 없으면 깨끗하게 빈 채로 파킹!
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
        // 중복 단어 방어벽 필터 필터링 (Set 쉴드)
        const filteredList = liveSavedKeywords.filter(k => k !== textToSave);
        // 최신 단어를 가방 맨 앞으로 집어넣고 최대 5개 커트라인 컷!
        const updatedList = [textToSave, ...filteredList].slice(0, 5);
        
        setLiveSavedKeywords(updatedList);
        await AsyncStorage.setItem("recentKeywords", JSON.stringify(updatedList));
        console.log("🔒 [검색어 저축 성공] 기기 서랍장 아카이브 갱신 완료:", updatedList);
      } catch (e) {
        console.error("검색어 금고 저장 대실패:", e);
      }
    }

    console.log("▶️ [8-3번 쿼리 패킹] 결과 창으로 들고 갈 바구니 데이터 👇");
    console.log(`- 검색어: ${finalKeyword}`);
    console.log(`- 날짜필터: ${selectedDate}`);

    navigation.navigate("HistorySearchResult", {
      searchQuery: finalKeyword,
      dateFilter: selectedDate,
      keywordsFilter: selectedKeywords
    });
  };

  // 🏷️ 하단 태그 단추 터치 시 핸들러
  const handleTagPress = (tag, title) => {
    if (title === "최근 저장된 키워드") {
      // 🎯 최근 저장 키워드를 누르면 검색어 입력창에 바로 글자가 뽈칵 복사 주입되는 최첨단 UX 이식!
      setSearchText(tag);
    } else {
      // 나머지 카테고리는 기존 기획대로 상단 멀티 태그 가방에 차곡차곡 축적!
      if (!selectedKeywords.includes(tag)) {
        setSelectedKeywords([...selectedKeywords, tag]);
      }
    }
  };

  const handleAddTag = (tag) => {
    if (!selectedKeywords.includes(tag)) {
      setSelectedKeywords([...selectedKeywords, tag]);
    }
  };

  const handleRemoveTag = (target) => {
    setSelectedKeywords(selectedKeywords.filter(k => k !== target));
  };

  const handleCalendarPress = () => {
    setCalendarModalVisible(true);
  };

  const handleSelectDateFromModal = (date) => {
    setSelectedDate(date);
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
          <FilterItem activeOpacity={0.6} onPress={handleCalendarPress}>
            <FilterIcon source={calendarIcon} resizeMode="contain" />
            <FilterText>날짜 범위 |</FilterText>
            <ValueText>{selectedDate}</ValueText>
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

        {/* 3. 카테고리별 태그 리스트 (가변형 가동 킷 완료! 🤙) */}
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

      {/* 📅 달력 범위 선택 모달 서랍 */}
      <Modal animationType="fade" transparent={true} visible={calendarModalVisible} onRequestClose={() => setCalendarModalVisible(false)}>
        <ModalOverlay activeOpacity={1} onPress={() => setCalendarModalVisible(false)}>
          <ModalContent>
            <ModalHeader>
              <ModalHeaderText>📅 시연용 날짜 범위 선택</ModalHeaderText>
              <TouchableOpacity onPress={() => setCalendarModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ModalHeader>
            <ModalInfoText>발표 시나리오에 맞게 범위를 터치하세요!</ModalInfoText>
            <DateGrid>
              {dummyDates.map((date, index) => (
                <DateRowButton key={index} isCurrent={selectedDate === date} onPress={() => handleSelectDateFromModal(date)}>
                  <Ionicons name="calendar-outline" size={18} color={selectedDate === date ? "#06F393" : "#666"} style={{ marginRight: 10 }} />
                  <DateButtonText isCurrent={selectedDate === date}>{date}</DateButtonText>
                </DateRowButton>
              ))}
            </DateGrid>
          </ModalContent>
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
const ModalContent = styled.View` width: 85%; background-color: white; border-radius: 24px; padding: 25px; `;
const ModalHeader = styled.View` flex-direction: row; justify-content: space-between; align-items: center; margin-bottom: 10px; `;
const ModalHeaderText = styled.Text` font-size: 17px; font-weight: 800; color: #111; `;
const ModalInfoText = styled.Text` font-size: 13px; color: #999; font-weight: 500; margin-bottom: 20px; `;
const DateGrid = styled.View` width: 100%; `;
const DateRowButton = styled.TouchableOpacity` width: 100%; flex-direction: row; align-items: center; padding: 14px 18px; border-radius: 12px; margin-bottom: 8px; border-width: 1px; border-color: ${props => props.isCurrent ? "#06F393" : "#F0F0F0"}; background-color: ${props => props.isCurrent ? "#DFFFF4" : "#F8F9FA"}; `;
const DateButtonText = styled.Text` font-size: 15px; font-weight: ${props => props.isCurrent ? "800" : "600"}; color: ${props => props.isCurrent ? "#02D47F" : "#444"}; `;

const EmptyKeywordsGuidText = styled.Text` font-size: 13px; color: #C4C4C4; font-weight: 600; padding: 5px 0 15px; font-style: italic; `;