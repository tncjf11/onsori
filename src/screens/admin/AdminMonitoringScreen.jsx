import React, { useState, useEffect } from "react";
import { ScrollView, View, ActivityIndicator, Alert } from "react-native";
import styled from "styled-components/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BASE_URL from "../../api/config";

// ✅ 리스트 부품 임포트
import MonitoringItem from "../../components/MonitoringItem";

const bellIcon = require("../../assets/bell.png");

export default function AdminMonitoringScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const [monitoringList, setMonitoringList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ openCount: 0, closedCount: 0 });

  // =========================================================
  // 🔥 [명세서 13-1] 활성 세션 목록 조회 API 연동
  // =========================================================
  const fetchActiveSessions = async (isSilent = false) => {
    try {
      if (!isSilent) setIsLoading(true);
      const token = await AsyncStorage.getItem("adminToken");
      if (!token) {
        navigation.navigate("AdminLogin");
        return;
      }

      // 🎯 GET /api/admin/monitoring
      const response = await axios.get(`${BASE_URL}/api/admin/monitoring`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success && response.data.data) {
        const sessionList = response.data.data;
        
        // 🚀 자식 부품(MonitoringItem)이 에러 없이 렌더링하도록 명세서 규격에 맞게 매핑 호환성 추가
        const mappedList = sessionList.map(session => ({
          ...session,
          id: session.sessionId, // 명세서의 sessionId를 고유 id로도 쓸 수 있게 복제
          title: session.location ? `${session.deviceUid} (${session.location})` : `${session.deviceUid} 통화`,
          time: session.startedAt
        }));

        setMonitoringList(mappedList);
        
        // OPEN 상태인 세션 카운트
        const openCount = sessionList.filter(s => s.status?.toUpperCase() === "OPEN").length;
        setStats({ openCount, closedCount: sessionList.length - openCount });
      } else {
        setMonitoringList([]);
        setStats({ openCount: 0, closedCount: 0 });
      }
    } catch (error) {
      console.error("🚨 실시간 관제 연동 실패:", error.message);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  // ⚡ 3초 주기 실시간 레이더(폴링) 가동
  useEffect(() => {
    let pollingTimer = null;
    if (isFocused) {
      fetchActiveSessions(false); // 최초 진입 시 로딩 표시 O
      pollingTimer = setInterval(() => fetchActiveSessions(true), 3000); // 이후 백그라운드 조용한 스캔
    }
    return () => clearInterval(pollingTimer);
  }, [isFocused]);

  return (
    <Container>
      {/* 1. 헤더 영역 */}
      <Header>
        <Logo source={bellIcon} resizeMode="contain" />
        <HeaderTitle>인터폰 실시간 관제</HeaderTitle>
      </Header>

      {isLoading ? (
        <LoadingWrapper>
          <ActivityIndicator size="large" color="#1EC949" />
          <LoadingText>관제 데이터 동기화 중...</LoadingText>
        </LoadingWrapper>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
          
          {/* 2. 상태 요약 섹션 */}
          <SummarySection>
            <SummaryText>
              통화 중 <BoldText color="#1EC949">{stats.openCount}</BoldText> | 대기/종료 <BoldText color="#999">{stats.closedCount}</BoldText>
            </SummaryText>
          </SummarySection>

          {/* 3. 활성 세션 리스트 */}
          <ListArea>
            {monitoringList.length > 0 ? (
              monitoringList.map((item) => (
                <MonitoringItem key={item.sessionId} item={item} />
              ))
            ) : (
              <EmptyWrapper>
                <Ionicons name="radio-outline" size={44} color="#DDD" />
                <EmptyText>현재 활성화된 통화 세션이 없습니다.</EmptyText>
              </EmptyWrapper>
            )}
          </ListArea>
          
        </ScrollView>
      )}
    </Container>
  );
}

/* ================= 스타일 정의 (시안 철통 보존 🤙) ================= */
const Container = styled(SafeAreaView)` 
  flex: 1; 
  background-color: #F4F5F7; /* 이전 페이지들과 톤앤매너 통일 */
`;

const Header = styled.View` 
  flex-direction: row; 
  align-items: center; 
  padding: 15px 20px; 
  background-color: #fff; 
  border-bottom-width: 1px; 
  border-bottom-color: #F0F0F0; 
`;

const Logo = styled.Image` 
  width: 28px; 
  height: 28px; 
  margin-right: 10px; 
`;

const HeaderTitle = styled.Text` 
  font-size: 20px; 
  font-weight: 800; 
  color: #333; 
`;

const SummarySection = styled.View` 
  padding: 20px 20px 10px 20px; 
`;

const SummaryText = styled.Text` 
  font-size: 15px; 
  color: #555; 
  font-weight: 600; 
`;

const BoldText = styled.Text` 
  font-weight: 900; 
  color: ${props => props.color}; 
  font-size: 17px; 
`;

const ListArea = styled.View` 
  width: 100%; 
  padding: 0 15px;
`;

const LoadingWrapper = styled.View` 
  flex: 1; 
  justify-content: center; 
  align-items: center; 
  padding-top: 100px; 
`;

const LoadingText = styled.Text` 
  font-size: 13px; 
  color: #718096; 
  margin-top: 12px; 
  font-weight: 600;
`;

const EmptyWrapper = styled.View` 
  padding: 80px 20px; 
  align-items: center; 
`;

const EmptyText = styled.Text` 
  font-size: 14px; 
  color: #BBB; 
  font-weight: 600; 
  margin-top: 15px; 
  text-align: center; 
`;