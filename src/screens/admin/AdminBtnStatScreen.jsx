import React, { useState, useEffect } from "react";
import { ScrollView, TouchableOpacity, View, ActivityIndicator, Alert } from "react-native";
import styled from "styled-components/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";

// 📥 관리자 전용 마스터 키 로드를 위한 비밀금고 부품 임포트!
import AsyncStorage from "@react-native-async-storage/async-storage";

// 🌐 config.js의 배포 주소
import BASE_URL from "../../api/config";

// ✅ 이미지 에셋 (순정 보존 🤙)
const backIcon = require("../../assets/back_icon.png");

export default function AdminBtnStatScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused(); // 📱 화면 재진입 시 강제 리프레시 센서
  
  // 1. 필터 상태 관리 (전체: 'all', 24시간: '24h', 3일: '3d') - 순정 인터페이스 유지
  const [activeFilter, setActiveFilter] = useState("all");

  // 📱 백엔드 기지국에서 수급해올 찐 상용구 통계 리스트 상태창
  const [btnStats, setBtnStats] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // 📊 실시간 하이라이트 추적용 상태창 (최대/최소 자동 산출)
  const [highestBtn, setHighestBtn] = useState(null);
  const [lowestBtn, setLowestBtn] = useState(null);

  // =========================================================
  // 🔥 [재호 찐 상용구 통계 컨트롤러 연동] 라이브 통계 분석 엔진 🚀
  // =========================================================
  const fetchStatistics = async () => {
    try {
      setIsLoading(true);
      console.log("▶️ [버튼 통계] 금고 내부 마스터 신분증 로드 중... 🔑");
      
      const token = await AsyncStorage.getItem("adminToken");
      if (!token) {
        navigation.navigate("AdminLogin");
        return;
      }

      // 🎯 [명세서 찐 연동] GET /api/admin/quick-replies/statistics 정격 타격!
      const response = await axios.get(`${BASE_URL}/api/admin/quick-replies/statistics`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log("▶️ [버튼 통계 수신 완료] 응답 원본 확인:", response.data);

      if (response.data.success && response.data.data) {
        const rawStats = response.data.data;
        
        // 🧮 [뇌지컬 실시간 통계 카운팅 및 하이라이트 연산 엔진]
        // 1. 총 선택 횟수 실시간 누적 합산 계산
        const sum = rawStats.reduce((acc, curr) => acc + (curr.count || 0), 0);
        setTotalCount(sum);
        setBtnStats(rawStats);

        if (rawStats.length > 0) {
          // count 수치 기준으로 줄 세우기 소팅 돌려서 최대/최소 자동 추출!
          const sortedList = [...rawStats].sort((a, b) => (b.count || 0) - (a.count || 0));
          setHighestBtn(sortedList[0]); // 가장 높은 수치
          setLowestBtn(sortedList[sortedList.length - 1]); // 가장 낮은 수치
        }
      }
    } catch (error) {
      console.error("🚨 [상용구 통계 수급 대실패]:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      fetchStatistics();
    }
  }, [isFocused, activeFilter]); // 필터 단추 누를 때도 연동 연전 기동!

  return (
    <Container>
      {/* 3. 헤더 영역 */}
      <Header>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <BackIcon source={backIcon} resizeMode="contain" />
        </TouchableOpacity>
        <HeaderTitle>버튼 응답 빈도 통계</HeaderTitle>
        <View style={{ width: 24 }} />
      </Header>

      {isLoading ? (
        <LoadingWrapper>
          <ActivityIndicator size="large" color="#06F393" />
          <LoadingText>기지국 상용구 선택 트래픽 장부 집계 중...</LoadingText>
        </LoadingWrapper>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* 4. 필터 토글 그룹 (순정 핏 100% 보존 뽈칵! 🤙) */}
          <FilterGroup>
            <FilterBtn active={activeFilter === "all"} onPress={() => setActiveFilter("all")}>
              <FilterText active={activeFilter === "all"}>전체</FilterText>
            </FilterBtn>
            <FilterBtn active={activeFilter === "24h"} onPress={() => setActiveFilter("24h")}>
              <FilterText active={activeFilter === "24h"}>최근 24시간</FilterText>
            </FilterBtn>
            <FilterBtn active={activeFilter === "3d"} onPress={() => setActiveFilter("3d")}>
              <FilterText active={activeFilter === "3d"}>최근 3일</FilterText>
            </FilterBtn>
          </FilterGroup>

          {/* 5. 메인 통계 카드 (실시간 동적 결합 완착! 🤙) */}
          <StatCard>
            <CardTopRow>
              <CardMainTitle>총 선택 누적 횟수</CardMainTitle>
              <CardMainCount>{totalCount}회</CardMainCount>
            </CardTopRow>
            
            <SubTitleRow>
              <Ionicons name="bar-chart-outline" size={18} color="#333" />
              <SubTitleText>버튼별 실시간 선택 명세</SubTitleText>
            </SubTitleRow>

            {/* 데이터 리스트 가변 바인딩 */}
            {btnStats.length > 0 ? (
              btnStats.map((item, idx) => (
                <StatRow key={item.quickReplyId || item.id || idx}>
                  <RowId>{item.quickReplyId || idx + 1}.</RowId>
                  <RowText>{item.text || item.content || "상용구 문구 없음"}</RowText>
                  <RowCount>{item.count || 0}회</RowCount>
                  <RowPercent>{item.percent ? item.percent.toFixed(1) : "0.0"}%</RowPercent>
                </StatRow>
              ))
            ) : (
              <EmptyText>집계된 상용구 발포 이력이 없쇼.</EmptyText>
            )}
          </StatCard>

          {/* 6. 하이라이트 카드 (수학 계산식 기반 라이브 동적 산출 대부활! 뽈칵! 🤙) */}
          <HighlightCard>
            <HighlightRow>
              <Ionicons name="checkmark-circle" size={18} color="#06F393" />
              <HighlightTitle color="#06F393">가장 많이 선택된 버튼</HighlightTitle>
            </HighlightRow>
            {highestBtn ? (
              <StatRow style={{ borderBottomWidth: 1, borderBottomColor: '#F5F5F5', marginBottom: 15, paddingBottom: 10 }}>
                <RowId>{highestBtn.quickReplyId || "★"}.</RowId>
                <RowText>{highestBtn.text || highestBtn.content}</RowText>
                <RowCount>{highestBtn.count || 0}회</RowCount>
                <RowPercent>{highestBtn.percent ? highestBtn.percent.toFixed(1) : "0.0"}%</RowPercent>
              </StatRow>
            ) : (
              <RowText style={{ color: "#BBB", marginBottom: 15 }}>데이터 수급 공백</RowText>
            )}

            <HighlightRow>
              <Ionicons name="alert-circle" size={18} color="#FF5C00" />
              <HighlightTitle color="#FF5C00">가장 적게 선택된 버튼</HighlightTitle>
            </HighlightRow>
            {lowestBtn ? (
              <StatRow style={{ borderBottomWidth: 0 }}>
                <RowId>{lowestBtn.quickReplyId || "☆"}.</RowId>
                <RowText>{lowestBtn.text || lowestBtn.content}</RowText>
                <RowCount>{lowestBtn.count || 0}회</RowCount>
                <RowPercent>{lowestBtn.percent ? lowestBtn.percent.toFixed(1) : "0.0"}%</RowPercent>
              </StatRow>
            ) : (
              <RowText style={{ color: "#BBB" }}>데이터 수급 공백</RowText>
            )}
          </HighlightCard>
        </ScrollView>
      )}
    </Container>
  );
}

/* ================= 스타일 정의 (수철님 명품 시안 컴포넌트 100% 철통 보존 🤙) ================= */
const Container = styled(SafeAreaView)` flex: 1; background-color: #F8F9FA; `;
const Header = styled.View` flex-direction: row; justify-content: space-between; align-items: center; padding: 15px 20px; background-color: #fff; border-bottom-width: 1px; border-bottom-color: #F0F0F0; `;
const BackIcon = styled.Image` width: 24px; height: 24px; `;
const HeaderTitle = styled.Text` font-size: 18px; font-weight: 800; color: #333; `;

const FilterGroup = styled.View` flex-direction: row; padding: 20px; `;
const FilterBtn = styled.TouchableOpacity` background-color: ${props => props.active ? "#06F393" : "#FFF"}; border-width: 1px; border-color: #06F393; padding: 8px 15px; border-radius: 20px; margin-right: 10px; `;
const FilterText = styled.Text` color: ${props => props.active ? "#FFF" : "#06F393"}; font-size: 14px; font-weight: 700; `;

const StatCard = styled.View` background-color: #fff; margin: 0 15px 15px; padding: 20px; border-radius: 25px; border-width: 1.5px; border-color: #06F393; `;
const CardTopRow = styled.View` flex-direction: row; justify-content: space-between; align-items: center; padding-bottom: 15px; border-bottom-width: 1px; border-bottom-color: #EEE; `;
const CardMainTitle = styled.Text` font-size: 18px; font-weight: 800; color: #333; `;
const CardMainCount = styled.Text` font-size: 18px; font-weight: 700; color: #06F393; `;

const SubTitleRow = styled.View` flex-direction: row; align-items: center; margin: 15px 0; `;
const SubTitleText = styled.Text` font-size: 16px; font-weight: 700; color: #333; margin-left: 8px; `;

const StatRow = styled.View` flex-direction: row; align-items: center; padding: 11px 0; border-bottom-width: 1px; border-bottom-color: #FAFAFA; `;
const RowId = styled.Text` width: 30px; font-size: 14px; color: #718096; font-weight: 600; `;
const RowText = styled.Text` flex: 1; font-size: 14px; color: #2D3748; font-weight: 600; `;
const RowCount = styled.Text` width: 60px; font-size: 14px; color: #333; text-align: right; font-weight: 700; `;
const RowPercent = styled.Text` width: 60px; font-size: 14px; color: #4A90E2; text-align: right; font-weight: 600; `;

const HighlightCard = styled(StatCard)` border-color: #06F393; `;
const HighlightRow = styled.View` flex-direction: row; align-items: center; margin-bottom: 10px; `;
const HighlightTitle = styled.Text` font-size: 15px; font-weight: 800; color: ${props => props.color}; margin-left: 8px; `;

const LoadingWrapper = styled.View` flex: 1; justify-content: center; align-items: center; padding-top: 100px; `;
const LoadingText = styled.Text` font-size: 13px; color: #718096; font-weight: 600; margin-top: 12px; `;
const EmptyText = styled.Text` font-size: 14px; color: #BBB; font-weight: 600; text-align: center; padding: 20px 0; `;