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

// ✅ 분리해둔 그래프 컴포넌트 임포트 (순정 보존 🤙)
import DashboardChart from "../../components/DashboardChart";

// ✅ 이미지 에셋 (벨, 화살표, 로그아웃 등 싹 다 가져왔쇼! 🤙)
const bellIcon = require("../../assets/bell.png");
const iconSummary = require("../../assets/icon_summary.png");
const iconTime = require("../../assets/icon_time.png");
const iconCall = require("../../assets/icon_call.png");
const arrowRight = require("../../assets/arrow_right.png");
const logoutIcon = require("../../assets/logout_icon.png");

export default function AdminDashboardScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused(); // 📱 화면 진입 시 실시간 강제 새로고침 센서

  // 📱 백엔드 통계 장부를 담을 실시간 상태창
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [adminId, setAdminId] = useState("admin");

  // =========================================================
  // 🔥 [재호 찐 대시보드 컨트롤러 연동] 라이브 통계 수급 엔진 🚀
  // =========================================================
  const fetchDashboardStats = async () => {
    try {
      setIsLoading(true);
      console.log("▶️ [대시보드 기지국] 금고 내부 마스터 신분증 로드 가동... 🔑");
      
      const token = await AsyncStorage.getItem("adminToken");
      if (!token) {
        console.log("❌ 관리자 토큰 유실 감지 ➔ 로그인 문전박대 가드 가동");
        navigation.navigate("AdminLogin");
        return;
      }

      // 🎯 [명세서 개편 수용] /api/admin/dashboard 경로 요격 & 헤더에 Bearer 토큰 탑재!
      const response = await axios.get(`${BASE_URL}/api/admin/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log("▶️ [대시보드 응답 수신 완료] 데이터 바인딩 슛 👇");

      // 재호 분의 ApiResponse 그릇 구조에 맞춰 정밀 바인딩
      if (response.data.success && response.data.data) {
        setDashboardData(response.data.data);
      }
    } catch (error) {
      console.error("🚨 [대시보드 통신 대실패]:", error.message);
      // 시연용 안전 방어벽 가드 임시 배포
      setDashboardData({
        todayCalls: 0,
        avgResponseTime: "0ms",
        sttSuccessRate: "0%"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 화면이 켜질 때마다 실시간으로 수치를 기지국에서 새로 당겨오쇼!
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
          console.log("🧹 [금고 청소 가동] adminToken 파쇄 소멸 처리");
          await AsyncStorage.removeItem("adminToken");
          navigation.navigate("AdminLogin"); // 성문 밖으로 완전히 사출
        }
      }
    ]);
  };

  return (
    <Container>
      {/* 1. 상단 헤더 (온소리 벨 로고 뽈칵! 🤙) */}
      <Header>
        <Logo source={bellIcon} resizeMode="contain" />
        <HeaderTitle>대시보드</HeaderTitle>
      </Header>

      {isLoading ? (
        <LoadingWrapper>
          <ActivityIndicator size="large" color="#06F393" />
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
                {/* 🎯 백엔드 찐 응답 그릇 데이터 유연 매핑 가드 */}
                <SummaryValue>{dashboardData?.todayCalls ?? dashboardData?.todayCallCount ?? 0}회</SummaryValue>
              </SummaryItem>
              <DividerVertical />
              <SummaryItem>
                <SummaryLabel>평균 응답시간</SummaryLabel>
                <SummaryValue>{dashboardData?.avgResponseTime ?? dashboardData?.averageResponseTime ?? "0ms"}</SummaryValue>
              </SummaryItem>
              <DividerVertical />
              <SummaryItem>
                <SummaryLabel>STT 처리율</SummaryLabel>
                <SummaryValue>{dashboardData?.sttSuccessRate ?? dashboardData?.sttRate ?? "0%"}</SummaryValue>
              </SummaryItem>
            </SummaryRow>
          </SectionCard>

          {/* 3. 시간대별 호출 빈도 (실시간 그래프 뽈칵! 🤙) */}
          <SectionCard>
            <SectionHeader>
              <SectionIcon source={iconTime} resizeMode="contain" />
              <SectionHeaderText>시간대별 호출 빈도</SectionHeaderText>
            </SectionHeader>
            <DashboardChart chartData={dashboardData?.hourlyData || dashboardData?.hourlyCallCounts} /> 
          </SectionCard>

          {/* 4. 통화 관리 섹션 (화살표 아이콘 포함 🤙) */}
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

          {/* 5. 관리자 계정 정보 및 로그아웃 (문 열리는 아이콘 뽈칵! 🤙) */}
          <SectionCard>
            <AccountRow>
              <AccountLabel>관제 권한 ID</AccountLabel>
              <AccountValue>{dashboardData?.adminId || "MASTER_ADMIN"}</AccountValue>
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

/* ================= 스타일 정의 (수철님 명품 시안 컴포넌트 100% 철통 보존 🤙) ================= */
const Container = styled(SafeAreaView)` flex: 1; background-color: #F8F9FA; `;
const Header = styled.View` flex-direction: row; align-items: center; padding: 15px 20px; background-color: #fff; border-bottom-width: 1px; border-bottom-color: #F0F0F0; `;
const Logo = styled.Image` width: 28px; height: 28px; margin-right: 10px; `;
const HeaderTitle = styled.Text` font-size: 20px; font-weight: 800; color: #333; `;

const SectionCard = styled.View` background-color: #fff; margin: 15px 15px 0; padding: 20px; border-radius: 25px; border-width: 1.5px; border-color: #06F393; `;
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
const AccountLabel = styled.Text` font-size: 14px; color: #999; width: 90px; `;
const AccountValue = styled.Text` font-size: 14px; color: #555; font-weight: 700; `;

const LogoutItem = styled.TouchableOpacity` flex-direction: row; align-items: center; padding-top: 15px; `;
const LogoutBtnIcon = styled.Image` width: 22px; height: 22px; margin-right: 10px; `;
const LogoutText = styled.Text` font-size: 15px; color: #FF4D4D; font-weight: 600; `;

const LoadingWrapper = styled.View` flex: 1; justify-content: center; align-items: center; padding: 40px; `;
const LoadingText = styled.Text` font-size: 14px; color: #718096; font-weight: 600; margin-top: 12px; `;