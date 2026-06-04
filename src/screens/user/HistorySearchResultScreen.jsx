import React, { useState, useEffect } from "react";
import { ScrollView, View, ActivityIndicator, TouchableOpacity } from "react-native";
import styled from "styled-components/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons"; 
import axios from "axios";

// 📥 [재호 지침 전격 이식] 기기 저장소 마스터 금고 임포트!
import AsyncStorage from "@react-native-async-storage/async-storage";

// 🌐 config.js의 배포 주소
import BASE_URL from "../../api/config";

// ✅ 공용 리스트 부품 임포트
import RecentCallItem from "../../components/RecentCallItem";

// ✅ 이미지 에셋 (철통 보존 🤙)
const backIcon = require("../../assets/back_icon.png");
const calendarIcon = require("../../assets/calendar_icon.png");
const keywordIcon = require("../../assets/keyword_icon.png");

export default function HistorySearchResultScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  // 📥 1단계: 앞 허브 화면에서 넘겨준 필터 바구니 파라미터 가로채기
  const { searchQuery = "", dateFilter = "2026-05-15", keywordsFilter = [] } = route.params || {};

  // 📱 백엔드 통신용 상태 관리 장치들
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 📥 [🆕 401 격파 마감] 하단 호출 이력 부품에 바톤 터치해 줄 진짜 토큰 상태창 개통!
  const [token, setToken] = useState(null);

  // =========================================================
  // 🕒 [🚨 수철님 9시간 시차 요격 완착 유틸] 한국 시차 상쇄 상대시간 엔진 🤙
  // =========================================================
  const formatTimeGap = (isoString) => {
    if (!isoString) return "기록 없음";
    
    try {
      const now = new Date();
      const logTime = new Date(isoString);
      
      const isUtc = !isoString.includes("+09") && isoString.endsWith("Z");
      const kstLogTime = isUtc ? new Date(logTime.getTime() + 9 * 60 * 60 * 1000) : logTime;

      const diffMs = now - kstLogTime;
      const diffMins = Math.floor(diffMs / (1000 * 60));

      if (diffMins < 1) return "방금 전";
      if (diffMins < 60) return `${diffMins}분 전`;
      
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}시간 전`;
      
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return "어제";
      if (diffDays <= 7) return `${diffDays}일 전`;
      
      return kstLogTime.toISOString().split("T")[0];
    } catch (error) {
      return "시간 오차";
    }
  };

  // 🗓️ 한국 시차를 고려하여 비교용 YYYY-MM-DD 날짜를 추출하는 안전 도구쇼
  const getKstDateString = (isoString) => {
    if (!isoString) return "";
    try {
      const logTime = new Date(isoString);
      const isUtc = !isoString.includes("+09") && isoString.endsWith("Z");
      const kstLogTime = isUtc ? new Date(logTime.getTime() + 9 * 60 * 60 * 1000) : logTime;
      
      const yyyy = kstLogTime.getFullYear();
      const mm = String(kstLogTime.getMonth() + 1).padStart(2, '0');
      const dd = String(kstLogTime.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch {
      return isoString.split("T")[0];
    }
  };

  useEffect(() => {
    const fetchAndLocalFilterLogs = async () => {
      try {
        setIsLoading(true);
        
        // 📥 [비밀금고 개방] 가방 릴레이 다 깨부수고 기기 자체 금고에서 찐 신분증 수색!
        console.log("▶️ [결과창 내부 요격] AsyncStorage에서 마스터 신분증 로드... 🔑");
        const savedToken = await AsyncStorage.getItem("accessToken");
        setToken(savedToken); // 하단 리스트 부품 조립용 연료 인계!

        if (!savedToken) {
          console.log("❌ 결과창 가드 발동 ➔ 유효한 토큰이 잡히지 않아 검색을 거절합니다.");
          setSearchResults([]);
          setIsLoading(false);
          return;
        }

        console.log("▶️ [결과창] 백엔드 전체 원문 데이터 덤프 수집 진행 중... 🚀");
        
        // 🤙 가짜 dummyJwt 영구 소멸 완료! 금고에서 꺼낸 savedToken 헤더에 실어 덤프 요청 슛!
        const response = await axios.get(`${BASE_URL}/api/intercom-logs`, {
          headers: { Authorization: `Bearer ${savedToken}` }
        });
        
        console.log("▶️ [덤프 수신 완료] 프론트 단독 3중 결합 필터링 시동 👇");

        if (response.data.success && response.data.data) {
          const allLogs = response.data.data;

          // 2. ⚡ 자바스크립트 내장 고속 필터 함수로 프론트 노가다 수동 리드 개통!
          const localFiltered = allLogs
            .map(log => ({
              id: log.id,
              title: log.summary || "인터폰 호출 알림",
              content: log.visitorText || "", // 대화 본문 텍스트 포함 여부 검사용
              time: getKstDateString(log.createdAt), // 🎯 [시차 격파 완료] 한국 타임스탬프 기준으로 날짜 추출!
              displayTime: formatTimeGap(log.createdAt), // 우측 표출 시간 매칭
              type: log.intent === "DELIVERY" ? "message" : "bell", 
              tags: log.intent ? [log.intent] : ["방문"]
            }))
            .filter(log => {
              // 📅 2-A) 수철님이 모달로 고른 날짜 범위 체크 (한국 시간대 보정본 날짜와 100% 매칭)
              const matchDate = dateFilter ? log.time === dateFilter : true;

              // 💬 2-B) 상단 인풋 텍스트 창에 입력한 검색어 필터링 체크
              const matchSearch = searchQuery
                ? log.title.includes(searchQuery) || log.content.includes(searchQuery)
                : true;

              // 🏷️ 2-C) 하단 바둑판에서 누른 누적 선택 키워드 필터링 체크
              const matchKeywords = keywordsFilter.length > 0
                ? keywordsFilter.every(kTag => log.tags.includes(kTag) || log.title.includes(kTag) || log.content.includes(kTag))
                : true;

              return matchDate && matchSearch && matchKeywords;
            });

          console.log(`✅ [필터링 종결] 총 ${allLogs.length}개 중 ${localFiltered.length}개 조건 일치 생존!`);
          setSearchResults(localFiltered);
        } else {
          setSearchResults([]);
        }
      } catch (error) {
        console.error("🚨 [로컬 필터 런타임 찐빠] 에러 발생 -> 수동 백지 마감:", error.message);
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAndLocalFilterLogs();
  }, [searchQuery, dateFilter, keywordsFilter]);

  return (
    <Container>
      {/* 1. 헤더 영역 */}
      <Header>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <IconBtn source={backIcon} resizeMode="contain" />
        </TouchableOpacity>
        <HeaderTitle>검색 결과</HeaderTitle>
        <View style={{ width: 24 }} />
      </Header>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        {/* 2. 상단 검색 요약 카드 (동적 연동 마감 완비 🤙) */}
        <SummaryCard>
          <SummaryTitleText>
            {searchQuery ? `'${searchQuery}' 텍스트가 포함된 결과` : "필터 조건별 대화 히스토리"}
          </SummaryTitleText>
          
          <FilterDetail>
            <FilterRow>
              <FilterIcon source={calendarIcon} resizeMode="contain" />
              <FilterLabel>날짜 범위 |</FilterLabel>
              <FilterValue>{dateFilter || "선택 없음"}</FilterValue>
            </FilterRow>
            
            <FilterRow style={{ borderBottomWidth: 0 }}>
              <FilterIcon source={keywordIcon} resizeMode="contain" />
              <FilterLabel>키워드 |</FilterLabel>
              <FilterValue>
                {keywordsFilter.length > 0 ? `'${keywordsFilter.join(", ")}'` : "'전체'"}
              </FilterValue>
            </FilterRow>
          </FilterDetail>
        </SummaryCard>

        {/* 3. 검색 결과 목록 혹은 결과 없음 동적 체결 구역쇼! */}
        <ResultListContainer>
          {isLoading ? (
            <LoadingWrapper>
              <ActivityIndicator size="large" color="#06F393" />
              <LoadingText>가동 중...</LoadingText>
            </LoadingWrapper>
          ) : searchResults.length > 0 ? (
            // 찐 결과가 존재할 때만 리스트 순회 뽈칵!
            searchResults.map((item) => (
              /* 🤙 [🚨 401 차단벽 전면 파괴] 개조해놓은 리스트 부품에 금고에서 꺼낸 진짜 찐 token 전달! */
              <RecentCallItem 
                key={item.id} 
                item={{
                  ...item,
                  time: item.displayTime // 부품 우측에 이쁜 한국 보정 상대 시간이 뜨도록 치환 바인딩!
                }} 
                token={token} 
                onPress={() => navigation.navigate("End", { item: item, logId: item.id, token: token })}
              />
            ))
          ) : (
            // 🚨 아무 결과도 없을 때 우아하게 켜지는 빈 화면 배너!
            <EmptyWrapper>
              <Ionicons name="search-outline" size={48} color="#DDD" />
              <EmptyMainText>검색 결과가 없습니다.</EmptyMainText>
              <EmptySubText>선택하신 날짜 범위나 키워드에 일치하는 대화 자막 기록이 비어있습니다.</EmptySubText>
            </EmptyWrapper>
          )}
        </ResultListContainer>
      </ScrollView>
    </Container>
  );
}

/* ================= 스타일 정의 (수철님 명품 시안 100% 철통 보존 🤙) ================= */
const Container = styled(SafeAreaView)` flex: 1; background-color: #F8F9FA; `;
const Header = styled.View` flex-direction: row; justify-content: space-between; align-items: center; padding: 15px 20px; background-color: #fff; border-bottom-width: 1px; border-bottom-color: #EEE; `;
const HeaderTitle = styled.Text` font-size: 18px; font-weight: 700; color: #333; `;
const IconBtn = styled.Image` width: 24px; height: 24px; `;

const SummaryCard = styled.View` background-color: #fff; margin: 20px; padding: 20px; border-radius: 20px; elevation: 5; shadow-color: #000; shadow-opacity: 0.05; shadow-radius: 10px; `;
const SummaryTitleText = styled.Text` font-size: 15px; color: #666; text-align: center; margin-bottom: 20px; font-weight: 600; `;
const FilterDetail = styled.View` border-top-width: 1px; border-top-color: #F0F0F0; `;
const FilterRow = styled.View` flex-direction: row; align-items: center; padding: 15px 0; border-bottom-width: 1px; border-bottom-color: #F5F5F5; `;
const FilterIcon = styled.Image` width: 18px; height: 18px; margin-right: 12px; `;
const FilterLabel = styled.Text` font-size: 14px; color: #888; margin-right: 10px; `;
const FilterValue = styled.Text` font-size: 14px; color: #333; font-weight: 600; `;

const ResultListContainer = styled.View` background-color: #fff; border-top-left-radius: 25px; border-top-right-radius: 25px; padding-top: 10px; padding-bottom: 40px; flex: 1; min-height: 350px; `;

const LoadingWrapper = styled.View` flex: 1; justify-content: center; align-items: center; padding-top: 60px; `;
const LoadingText = styled.Text` font-size: 13px; color: #999; font-weight: 600; margin-top: 10px; `;

const EmptyWrapper = styled.View` flex: 1; justify-content: center; align-items: center; padding: 60px 30px; `;
const EmptyMainText = styled.Text` font-size: 16px; color: #666; font-weight: 800; margin-top: 15px; `;
const EmptySubText = styled.Text` font-size: 13px; color: #BBB; font-weight: 500; text-align: center; margin-top: 8px; line-height: 20px; `;