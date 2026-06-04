import React, { useState, useEffect } from "react";
import { ScrollView, View, ActivityIndicator, Alert } from "react-native";
import styled from "styled-components/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import axios from "axios";

// 📥 관리자 마스터 키 수급을 위한 비밀금고 부품 임포트!
import AsyncStorage from "@react-native-async-storage/async-storage";

// 🌐 config.js의 배포 주소
import BASE_URL from "../../api/config";

// ✅ 1. 우리가 아까 완착 개조해둔 실시간 리스트 아이템 부품 임포트 뽈칵! 🤙
import MonitoringItem from "../../components/MonitoringItem";

// ✅ 2. 이미지 에셋 (벨 로고 재사용)
const bellIcon = require("../../assets/bell.png");

export default function AdminMonitoringScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused(); // 📱 화면 이탈 감지 센서

  // 📱 백엔드 기지국에서 실시간으로 긁어올 라이브 세션 리스트 상태창
  const [monitoringList, setMonitoringList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 📊 상단 실시간 관제 현황 카운팅 상태창
  const [stats, setStats] = useState({ openCount: 0, closedCount: 0 });

  // =========================================================
  // 🔥 [재호 찐 모니터링 컨트롤러 연동] 라이브 세션 수급 엔진 🚀
  // =========================================================
  const fetchActiveSessions = async (isSilent = false) => {
    try {
      // 3초 주기 반복 스캔 시에는 사용자 눈 안 아프게 스피너 로딩창을 숨깁니다(isSilent)
      if (!isSilent) setIsLoading(true);

      const token = await AsyncStorage.getItem("adminToken");
      if (!token) {
        console.log("❌ 관리자 토큰 누락 ➔ 로그인방 자동 사출");
        navigation.navigate("AdminLogin");
        return;
      }

      // 🎯 [명세서 개편 수용] GET /api/admin/monitoring 타격 및 마스터 토큰 주입!
      const response = await axios.get(`${BASE_URL}/api/admin/monitoring`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success && response.data.data) {
        const sessionList = response.data.data;
        setMonitoringList(sessionList);

        // 🧮 [뇌지컬 실시간 관제 수치 계산 엔진]
        // 대문자 "OPEN" 상태 필터링 ➔ 통화 중 수치 계산
        const openCount = sessionList.filter(s => s.status?.toUpperCase() === "OPEN").length;
        const closedCount = sessionList.length - openCount;

        setStats({ openCount, closedCount });
      }
    } catch (error) {
      console.error("🚨 [실시간 관제탑 통신 실패]:", error.message);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  // =========================================================
  // ⚡ [🚨 라이브 감시 추적 엔진] 3초 주기 화면 한정 폴링 스타트!
  // =========================================================
  useEffect(() => {
    let pollingTimer = null;

    if (isFocused) {
      // 1. 화면 처음 들어왔을 때는 정밀 로딩 스캔 기동!
      fetchActiveSessions(false);

      // 2. 수철님이 이 감시 모니터를 쳐다보고 있는 동안에만 3초 간격으로 백엔드 신호 자동 갱신!
      pollingTimer = setInterval(() => {
        console.log("🛰️ [관제탑 감시 중] 실시간 인터폰 통화 세션 흐름 추적 중...");
        fetchActiveSessions(true); // 조용한 백그라운드 폴링
      }, 3000);
    }

    // 3. 🧼 다른 화면으로 넘어가면 폰과 서버 과부하를 막기 위해 타이머 즉시 파쇄!
    return () => {
      if (pollingTimer) {
        console.log("🧹 관제탑 화면 이탈 감지 ➔ 실시간 감시 엔진 안전 일시정지");
        clearInterval(pollingTimer);
      }
    };
  }, [isFocused]);

  return (
    <Container>
      {/* 1. 상단 헤더 영역 */}
      <Header>
        <Logo source={bellIcon} resizeMode="contain" />
        <HeaderTitle>인터폰 실시간 관제</HeaderTitle>
      </Header>

      {isLoading ? (
        <LoadingWrapper>
          <ActivityIndicator size="large" color="#06F393" />
          <LoadingText>백엔드 실시간 통화 스트리밍 선로 스캔 중...</LoadingText>
        </LoadingWrapper>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
          
          {/* 2. 실시간 현황 요약 (실시간 수학 계산 동적 연동 완료! 뽈칵! 🤙) */}
          <SummarySection>
            <SummaryText>
              현재 통화 중 <BoldText color="#06F393">{stats.openCount}</BoldText>      대기/종료 <BoldText color="#999">{stats.closedCount}</BoldText>
            </SummaryText>
          </SummarySection>

          {/* 3. 모니터링 리스트 (부품으로 라이브 슛! 🤙) */}
          <ListArea>
            {monitoringList.length > 0 ? (
              monitoringList.map((item) => (
                <MonitoringItem key={item.id || item.sessionId} item={item} />
              ))
            ) : (
              <EmptyWrapper>
                <Ionicons name="radio-outline" size={44} color="#DDD" />
                <EmptyText>현재 네트워크 상에서 소통 중인 라이브 인터폰 세션이 없쇼.</EmptyText>
              </EmptyWrapper>
            )}
          </ListArea>

        </ScrollView>
      )}
    </Container>
  );
}

/* ================= 스타일 정의 (수철님 명품 시안 컴포넌트 100% 철통 보존 🤙) ================= */
const Container = styled(SafeAreaView)` flex: 1; background-color: #F8F9FA; `;
const Header = styled.View` flex-direction: row; align-items: center; padding: 15px 20px; background-color: #fff; border-bottom-width: 1px; border-bottom-color: #F0F0F0; `;
const Logo = styled.Image` width: 32px; height: 32px; margin-right: 10px; `;
const HeaderTitle = styled.Text` font-size: 20px; font-weight: 800; color: #333; `;

const SummarySection = styled.View` padding: 20px 25px; `;
const SummaryText = styled.Text` font-size: 15px; color: #555; font-weight: 600; `;
const BoldText = styled.Text` font-weight: 900; color: ${props => props.color || "#333"}; font-size: 17px; `;
const ListArea = styled.View` width: 100%; `;

const LoadingWrapper = styled.View` flex: 1; justify-content: center; align-items: center; padding-top: 100px; `;
const LoadingText = styled.Text` font-size: 13px; color: #718096; font-weight: 600; margin-top: 12px; `;
const EmptyWrapper = styled.View` padding: 80px 20px; justify-content: center; align-items: center; `;
const EmptyText = styled.Text` font-size: 14px; color: #BBB; font-weight: 600; margin-top: 10px; text-align: center; line-height: 20px; `;