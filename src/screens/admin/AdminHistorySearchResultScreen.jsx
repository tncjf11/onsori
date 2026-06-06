import React, { useState, useEffect } from "react";
import { ScrollView, TouchableOpacity, View, ActivityIndicator, Alert } from "react-native";
import styled from "styled-components/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BASE_URL from "../../api/config";

// ✅ 이미지 에셋
const backIcon = require("../../assets/back_icon.png");
const iconKeyword = require("../../assets/recent_message.png"); 
const iconCalendar = require("../../assets/icon_calendar.png"); 
const iconUser = require("../../assets/icon_user.png"); 
const iconDeviceId = require("../../assets/icon_device_id.png"); 

export default function AdminHistorySearchResultScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  // 🤙 이전 검색 페이지에서 넘어온 파라미터 
  const { searchParams } = route.params || {
    searchParams: {
      keyword: "전체",
      dateRange: "전체 기간",
      userId: "전체 사용자",
      deviceId: "전체 디바이스",
      apiPayload: {} // 실제 통신용 페이로드
    }
  };

  // 📱 서버에서 받아올 찐 데이터 상태창
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // =========================================================
  // 🔥 [명세서 12-3] 관리자 인터폰 로그 검색 API 연동
  // =========================================================
  const fetchSearchResults = async () => {
    try {
      setIsLoading(true);
      const token = await AsyncStorage.getItem("adminToken");
      
      const payload = searchParams.apiPayload || {};

      // 🎯 GET /api/admin/intercom-logs/search
      const response = await axios.get(`${BASE_URL}/api/admin/intercom-logs/search`, {
        params: payload,
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success && response.data.data) {
        setSearchResults(response.data.data);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error("🚨 검색 결과 조회 실패:", error.message);
      // 통신 실패 시 터지지 않게 빈 배열 세팅
      setSearchResults([]); 
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSearchResults();
  }, []);

  // 🕒 시간 포맷터 유틸 (예: 2026/05/03 19:20)
  const formatDateTime = (isoString) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      const isUtc = !isoString.includes("+09") && (isoString.endsWith("Z") || isoString.includes("T"));
      const kstDate = isUtc ? new Date(date.getTime() + 9 * 60 * 60 * 1000) : date;
      const yyyy = kstDate.getFullYear();
      const mm = String(kstDate.getMonth() + 1).padStart(2, '0');
      const dd = String(kstDate.getDate()).padStart(2, '0');
      const hh = String(kstDate.getHours()).padStart(2, '0');
      const min = String(kstDate.getMinutes()).padStart(2, '0');
      return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
    } catch { return ""; }
  };

  return (
    <Container>
      {/* 1. 헤더 영역 */}
      <Header>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <BackIcon source={backIcon} resizeMode="contain" />
        </TouchableOpacity>
        <HeaderTitle>기록 검색 결과</HeaderTitle>
        <View style={{ width: 24 }} />
      </Header>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* 2. 상단 검색 조건 요약 카드 */}
        <SummaryCard>
          <SummaryRow>
            <SummaryIcon source={iconKeyword} resizeMode="contain" />
            <KeywordBadge>
              <KeywordBadgeText>{searchParams.keyword}</KeywordBadgeText>
            </KeywordBadge>
          </SummaryRow>
          <SummaryRow>
            <SummaryIcon source={iconCalendar} resizeMode="contain" />
            <SummaryText>{searchParams.dateRange}</SummaryText>
          </SummaryRow>
          <SummaryRow>
            <SummaryIcon source={iconUser} resizeMode="contain" />
            <SummaryText>{searchParams.userId}</SummaryText>
          </SummaryRow>
          <SummaryRow style={{ marginBottom: 0 }}>
            <SummaryIcon source={iconDeviceId} resizeMode="contain" />
            <SummaryText>{searchParams.deviceId}</SummaryText>
          </SummaryRow>
        </SummaryCard>

        {/* 3. 로딩 및 검색 결과 리스트 */}
        {isLoading ? (
          <LoadingWrapper>
            <ActivityIndicator size="large" color="#1EC949" />
          </LoadingWrapper>
        ) : searchResults.length > 0 ? (
          <ResultCardContainer>
            {searchResults.map((item, index) => {
              const isLast = index === searchResults.length - 1;
              return (
                <TouchableOpacity 
                  key={item.id} 
                  activeOpacity={0.7} 
                  onPress={() => navigation.navigate("AdminHistoryDetail", { item: item })}
                >
                  <ListItem style={isLast ? { borderBottomWidth: 0 } : {}}>
                    <IconCircle>
                      <Ionicons name="call" size={18} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                    </IconCircle>
                    
                    <ItemContent>
                      <ItemTopRow>
                        <ItemTitle>{item.summary || "인터폰 호출 알림"}</ItemTitle>
                        {/* 백엔드 응답에 duration이 없다면 기본 안내 문구 처리 */}
                        <DurationText>{item.duration || "종료됨"}</DurationText>
                      </ItemTopRow>
                      
                      <ItemBottomRow>
                        <KeywordBadge style={{ paddingVertical: 3, paddingHorizontal: 8 }}>
                          <KeywordBadgeText>{item.intent || "호출"}</KeywordBadgeText>
                        </KeywordBadge>
                        <ItemTime>{formatDateTime(item.createdAt)}</ItemTime>
                      </ItemBottomRow>
                    </ItemContent>
                  </ListItem>
                </TouchableOpacity>
              );
            })}
          </ResultCardContainer>
        ) : (
          <EmptyWrapper>
            <EmptyText>설정한 조건에 맞는 기록이 없습니다.</EmptyText>
          </EmptyWrapper>
        )}

      </ScrollView>
    </Container>
  );
}

/* ================= 스타일 정의 (시안 100% 동기화 🤙) ================= */

const Container = styled(SafeAreaView)`
  flex: 1;
  background-color: #F4F5F7; 
`;

const Header = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background-color: #F4F5F7;
`;

const BackIcon = styled.Image`
  width: 24px;
  height: 24px;
  tint-color: #333;
`;

const HeaderTitle = styled.Text`
  font-size: 20px;
  font-weight: 800;
  color: #333;
`;

const SummaryCard = styled.View`
  background-color: #fff;
  margin: 15px 20px;
  padding: 20px;
  border-radius: 20px;
  elevation: 2;
  shadow-color: #000;
  shadow-opacity: 0.04;
  shadow-radius: 8px;
`;

const SummaryRow = styled.View`
  flex-direction: row;
  align-items: center;
  margin-bottom: 14px;
`;

const SummaryIcon = styled.Image`
  width: 22px;
  height: 22px;
  margin-right: 15px;
  tint-color: #666;
`;

const SummaryText = styled.Text`
  font-size: 15px;
  color: #333;
  font-weight: 600;
`;

const KeywordBadge = styled.View`
  background-color: #F4F5F7;
  padding: 4px 10px;
  border-radius: 8px;
`;

const KeywordBadgeText = styled.Text`
  font-size: 13px;
  font-weight: 700;
  color: #888;
`;

const ResultCardContainer = styled.View`
  background-color: #fff;
  margin: 0 20px;
  padding: 10px 20px;
  border-radius: 20px;
  elevation: 2;
  shadow-color: #000;
  shadow-opacity: 0.04;
  shadow-radius: 8px;
`;

const ListItem = styled.View`
  flex-direction: row;
  align-items: center;
  padding: 18px 0;
  border-bottom-width: 1px; 
  border-bottom-color: #F0F0F0;
`;

const IconCircle = styled.View`
  width: 44px;
  height: 44px;
  border-radius: 22px;
  background-color: #1EC949; 
  justify-content: center;
  align-items: center;
  margin-right: 15px;
`;

const ItemContent = styled.View`
  flex: 1;
`;

const ItemTopRow = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
`;

const ItemTitle = styled.Text`
  font-size: 15px;
  font-weight: 700;
  color: #333;
`;

const DurationText = styled.Text`
  font-size: 13px;
  color: #A0AEC0;
  font-weight: 600;
`;

const ItemBottomRow = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;

const ItemTime = styled.Text`
  font-size: 13px;
  color: #666;
  font-weight: 500;
`;

const LoadingWrapper = styled.View`
  padding: 40px;
  align-items: center;
`;

const EmptyWrapper = styled.View`
  padding: 60px 20px;
  align-items: center;
`;

const EmptyText = styled.Text`
  font-size: 14px;
  color: #999;
  font-weight: 500;
`;