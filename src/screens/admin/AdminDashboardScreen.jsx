import React, { useState, useEffect } from "react";
import { ScrollView, TouchableOpacity, View, Image, ActivityIndicator, Alert } from "react-native";
import styled from "styled-components/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import axios from "axios";

// 📥 관리자 전용 마스터 키 로드 및 소멸을 위한 비밀금고 부품 임포트!
import AsyncStorage from "@react-native-async-storage/async-storage";

// 🌐 config.js의 배포 주소
import BASE_URL from "../../api/config";

// ✅ 분리해둔 그래프 컴포넌트 임포트
import DashboardChart from "../../components/DashboardChart";

// ✅ 이미지 에셋
const bellIcon = require("../../assets/bell.png");
const iconSummary = require("../../assets/icon_summary.png");
const iconTime = require("../../assets/icon_time.png");
const iconCall = require("../../assets/icon_call.png");
const arrowRight = require("../../assets/arrow_right.png");
const logoutIcon = require("../../assets/logout_icon.png");

export default function AdminDashboardScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused(); 

  // 📱 백엔드 통계 장부를 담을 실시간 상태창
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // =========================================================
  // 🔥 [명세서 2-2] 라이브 대시보드 통계 수급 엔진 🚀
  // =========================================================
  const fetchDashboardStats = async () => {
    try {
      setIsLoading(true);
      const token = await AsyncStorage.getItem("adminToken");
      if (!token) {
        navigation.navigate("AdminLogin");
        return;
      }

      // 🎯 GET /api/admin/dashboard 호출
      const response = await axios.get(`${BASE_URL}/api/admin/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success && response.data.data) {
        setDashboardData(response.data.data);
      }
    } catch (error) {
      console.error("🚨 [대시보드 통신 대실패]:", error.message);
      // 통신 실패 시 화면이 터지지 않게 빈 값 세팅
      setDashboardData({
        todaySessionCount: 0,
        averageResponseSeconds: 0,
        sttAccuracy: 0
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      fetchDashboardStats();
    }
  }, [isFocused]);

  // =========================================================
  // 🧼 [클린 소멸 마감] 마스터 로그아웃 안전벨트 장치
  // =========================================================
  const handleAdminLogout = async () => {
    Alert.alert("로그아웃", "관리자 관제 시스템을 안전하게 종료하시겠습니까? 잉~ 🤙", [
      { text: "취소", style: "cancel" },
      {
        text: "로그아웃",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.removeItem("adminToken");
          navigation.navigate("AdminLogin"); 
        }
      }
    ]);
  };

  // 📈 백엔드 명세서에 차트 데이터가 없으므로 프론트에서 시연용으로 주입!
  const dummyChartData = [
    { time: '09시', count: 2 }, { time: '12시', count: 5 }, 
    { time: '15시', count: 8 }, { time: '18시', count: 3 }, { time: '21시', count: 7 }
  ];

  return (
    <Container>
      {/* 1. 상단 헤더 */}
      <Header>
        <Logo source={bellIcon} resizeMode="contain" />
        <HeaderTitle>대시보드</HeaderTitle>
      </Header>

      {isLoading ? (
        <LoadingWrapper>
          <ActivityIndicator size="large" color="#1EC949" />
          <LoadingText>기지국 실시간 관제 데이터 수급 중...</LoadingText>
        </LoadingWrapper>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
          
          {/* 2. 시스템 요약 섹션 */}
          <SectionCard>
            <SectionHeader>
              <SectionIcon source={iconSummary} resizeMode="contain" />
              <SectionHeaderText>시스템 요약</SectionHeaderText>
            </SectionHeader>
            
            <SummaryRow>
              <SummaryItem>
                <SummaryLabel>오늘의 호출 수</SummaryLabel>
                {/* 🚀 명세서 필드명 매핑: todaySessionCount */}
                <SummaryValue>{dashboardData?.todaySessionCount || 0}회</SummaryValue>
              </SummaryItem>
              <DividerVertical />
              <SummaryItem>
                <SummaryLabel>평균 응답시간</SummaryLabel>
                {/* 🚀 명세서 필드명 매핑: averageResponseSeconds (초 단위 표기) */}
                <SummaryValue>{dashboardData?.averageResponseSeconds?.toFixed(1) || "0.0"}초</SummaryValue>
              </SummaryItem>
              <DividerVertical />
              <SummaryItem>
                <SummaryLabel>STT 정확도</SummaryLabel>
                {/* 🚀 명세서 필드명 매핑: sttAccuracy (0.92 -> 92% 환산) */}
                <SummaryValue>{Math.round((dashboardData?.sttAccuracy || 0) * 100)}%</SummaryValue>
              </SummaryItem>
            </SummaryRow>
          </SectionCard>

          {/* 3. 시간대별 호출 빈도 */}
          <SectionCard>
            <SectionHeader>
              <SectionIcon source={iconTime} resizeMode="contain" />
              <SectionHeaderText>시간대별 호출 빈도</SectionHeaderText>
            </SectionHeader>
            {/* 백엔드에서 데이터를 안 주므로 시연용 프론트 더미 데이터 주입 */}
            <DashboardChart chartData={dummyChartData} /> 
          </SectionCard>

          {/* 4. 통화 관리 섹션 */}
          <SectionCard>
            <SectionHeader>
              <SectionIcon source={iconCall} resizeMode="contain" />
              <SectionHeaderText>통화 관리</SectionHeaderText>
            </SectionHeader>
            
            <LinkItem 
              activeOpacity={0.6} 
              onPress={() => navigation.navigate("AdminCallLog")}
            >
              <LinkText>호출 로그 전체 관리</LinkText>
              <ArrowIcon source={arrowRight} resizeMode="contain" />
            </LinkItem>

            <LinkItem 
              style={{ borderBottomWidth: 0 }}
              activeOpacity={0.6} 
              onPress={() => navigation.navigate("AdminBtnStat")}
            >
              <LinkText>버튼 응답 통계 분석</LinkText>
              <ArrowIcon source={arrowRight} resizeMode="contain" />
            </LinkItem>
          </SectionCard>

          {/* 5. 관리자 계정 정보 및 로그아웃 */}
          <SectionCard>
            <AccountRow>
              <AccountLabel>활성 디바이스</AccountLabel>
              {/* 명세서에 있는 추가 데이터 활용 */}
              <AccountValue>{dashboardData?.totalDeviceCount || 0}대 연동 중</AccountValue>
            </AccountRow>
            
            <LogoutItem activeOpacity={0.6} onPress={handleAdminLogout}>
              <LogoutBtnIcon source={logoutIcon} resizeMode="contain" />
              <LogoutText>관리자 안전 로그아웃</LogoutText>
            </LogoutItem>
          </SectionCard>

        </ScrollView>
      )}
    </Container>
  );
}

/* ================= 스타일 정의 (시안 철통 보존 🤙) ================= */
const Container = styled(SafeAreaView)` flex: 1; background-color: #F8F9FA; `;
const Header = styled.View` flex-direction: row; align-items: center; padding: 15px 20px; background-color: #fff; border-bottom-width: 1px; border-bottom-color: #F0F0F0; `;
const Logo = styled.Image` width: 28px; height: 28px; margin-right: 10px; `;
const HeaderTitle = styled.Text` font-size: 20px; font-weight: 800; color: #333; `;

const SectionCard = styled.View` background-color: #fff; margin: 15px 15px 0; padding: 20px; border-radius: 25px; border-width: 1.5px; border-color: #1EC949; `;
const SectionHeader = styled.View` flex-direction: row; align-items: center; margin-bottom: 20px; `;
const SectionIcon = styled.Image` width: 22px; height: 22px; margin-right: 10px; `;
const SectionHeaderText = styled.Text` font-size: 16px; font-weight: 700; color: #333; `;

const SummaryRow = styled.View` flex-direction: row; background-color: #F5F5F5; border-radius: 15px; padding: 15px 5px; `;
const SummaryItem = styled.View` flex: 1; align-items: center; `;
const SummaryLabel = styled.Text` font-size: 11px; color: #999; margin-bottom: 5px; `;
const SummaryValue = styled.Text` font-size: 16px; font-weight: 800; color: #333; `;
const DividerVertical = styled.View` width: 1px; background-color: #EEE; `;

const LinkItem = styled.TouchableOpacity` flex-direction: row; justify-content: space-between; align-items: center; padding: 15px 0; border-bottom-width: 1px; border-bottom-color: #F0F0F0; `;
const LinkText = styled.Text` font-size: 15px; color: #333; font-weight: 500; `;
const ArrowIcon = styled.Image` width: 18px; height: 18px; opacity: 0.5; `;

const AccountRow = styled.View` flex-direction: row; padding-bottom: 15px; border-bottom-width: 1px; border-bottom-color: #F0F0F0; `;
const AccountLabel = styled.Text` font-size: 14px; color: #999; width: 100px; `;
const AccountValue = styled.Text` font-size: 14px; color: #555; font-weight: 700; `;

const LogoutItem = styled.TouchableOpacity` flex-direction: row; align-items: center; padding-top: 15px; `;
const LogoutBtnIcon = styled.Image` width: 22px; height: 22px; margin-right: 10px; `;
const LogoutText = styled.Text` font-size: 15px; color: #FF4D4D; font-weight: 600; `;

const LoadingWrapper = styled.View` flex: 1; justify-content: center; align-items: center; padding: 40px; `;
const LoadingText = styled.Text` font-size: 14px; color: #718096; font-weight: 600; margin-top: 12px; `;