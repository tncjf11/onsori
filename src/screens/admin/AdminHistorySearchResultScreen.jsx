import React from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";
import styled from "styled-components/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";

// ✅ 1. 부품 재사용 (수정된 RecentCallItem을 쓴다고 가정! 🤙)
import RecentCallItem from "../../components/RecentCallItem";

// ✅ 2. 이미지 에셋 (기록 페이지에서 쓴 것들 뽈칵! 재사용 🤙)
const backIcon = require("../../assets/back_icon.png");
const iconKeyword = require("../../assets/recent_message.png"); // 키워드 (말풍선)
const iconCalendar = require("../../assets/icon_calendar.png"); // 날짜
const iconUser = require("../../assets/icon_user.png"); // 사용자 ID
const iconDeviceId = require("../../assets/icon_device_id.png"); // 디바이스 ID

export default function AdminHistorySearchResultScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  // 🤙 이전 검색 페이지에서 넘어온 파라미터 (없으면 시안용 가짜 데이터)
  const { searchParams } = route.params || {
    searchParams: {
      keyword: "택배",
      dateRange: "2026년 5월 1일 ~ 2026년 5월 3일",
      userId: "user000123",
      deviceId: "device1001",
    }
  };

  // 🤙 검색 결과 샘플 데이터
  const searchResults = [
    { id: 1, title: "택배 수령", time: "2026-05-03 19:20", duration: "3m 50s", tags: ["택배"], type: "bell" },
    { id: 2, title: "택배 수령", time: "2026-05-02 09:20", duration: "1m 10s", tags: ["택배"], type: "bell" },
    { id: 3, title: "택배 수령", time: "2026-05-01 12:00", duration: "5m 11s", tags: ["택배"], type: "bell" },
  ];

  return (
    <Container>
      {/* 3. 헤더 영역 */}
      <Header>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <BackIcon source={backIcon} resizeMode="contain" />
        </TouchableOpacity>
        <HeaderTitle>기록 검색 결과</HeaderTitle>
        <View style={{ width: 24 }} />
      </Header>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        
        {/* 4. 상단 검색 조건 요약 카드 (시안 뽈칵! 🤙) */}
        <SummaryCard>
          <SummaryRow>
            <SummaryIcon source={iconKeyword} />
            <SummaryText>{searchParams.keyword}</SummaryText>
          </SummaryRow>
          <SummaryRow>
            <SummaryIcon source={iconCalendar} />
            <SummaryText>{searchParams.dateRange}</SummaryText>
          </SummaryRow>
          <SummaryRow>
            <SummaryIcon source={iconUser} />
            <SummaryText>{searchParams.userId}</SummaryText>
          </SummaryRow>
          <SummaryRow style={{ marginBottom: 0 }}>
            <SummaryIcon source={iconDeviceId} />
            <SummaryText>{searchParams.deviceId}</SummaryText>
          </SummaryRow>
        </SummaryCard>

        {/* 5. 검색 결과 리스트 */}
        <ResultListContainer>
          {searchResults.map((item) => (
            <CardWrapper key={item.id}>
              {/* 🤙 RecentCallItem 부품에 isAdmin 속성을 줘서 관리자 상세로 보내기! */}
              <RecentCallItem 
                item={item} 
                onPress={() => navigation.navigate("AdminHistoryDetail", { item: item })} 
              />
              <DurationText>{item.duration}</DurationText>
            </CardWrapper>
          ))}
        </ResultListContainer>

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
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background-color: #fff;
`;

const BackIcon = styled.Image`
  width: 24px;
  height: 24px;
`;

const HeaderTitle = styled.Text`
  font-size: 18px;
  font-weight: 800;
  color: #333;
`;

const SummaryCard = styled.View`
  background-color: #fff;
  margin: 20px;
  padding: 20px;
  border-radius: 25px;
  border-width: 1.5px;
  border-color: #06F393; /* 시안의 시그니처 그린 테두리 뽈칵! 🤙 */
`;

const SummaryRow = styled.View`
  flex-direction: row;
  align-items: center;
  margin-bottom: 12px;
`;

const SummaryIcon = styled.Image`
  width: 20px;
  height: 20px;
  margin-right: 12px;
  tint-color: #555;
`;

const SummaryText = styled.Text`
  font-size: 15px;
  color: #333;
  font-weight: 600;
`;

const ResultListContainer = styled.View`
  padding: 0 20px;
`;

const CardWrapper = styled.View`
  background-color: #fff;
  border-radius: 20px;
  margin-bottom: 15px;
  overflow: hidden;
  elevation: 3;
  shadow-color: #000;
  shadow-opacity: 0.05;
  shadow-radius: 5px;
  position: relative;
`;

const DurationText = styled.Text`
  position: absolute;
  top: 15px;
  right: 20px;
  font-size: 13px;
  color: #999;
  font-weight: 600;
`;