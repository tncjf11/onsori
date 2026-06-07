import React, { useState, useEffect } from "react";
import {
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import styled from "styled-components/native";
import { SafeAreaView as SafeAreaContainer } from "react-native-safe-area-context";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

import BASE_URL from "../../api/config";
import MonitoringItem from "../../components/MonitoringItem";

const bellIcon = require("../../assets/bell.png");

const logAdminMonitoring = (message, data) => {
  if (data !== undefined) {
    console.log(`[ADMIN_MONITORING] ${message}`, data);
  } else {
    console.log(`[ADMIN_MONITORING] ${message}`);
  }
};

export default function AdminMonitoringScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const [monitoringList, setMonitoringList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCount, setActiveCount] = useState(0);

  const parseServerDate = (isoString) => {
    if (!isoString) return null;

    try {
      const hasExplicitTimezone =
        isoString.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(isoString);

      if (hasExplicitTimezone) {
        const date = new Date(isoString);
        return Number.isNaN(date.getTime()) ? null : date;
      }

      const normalized = isoString.replace("T", " ");
      const [datePart, timePart = "00:00:00"] = normalized.split(" ");
      const [year, month, day] = datePart.split("-").map(Number);
      const [hour = 0, minute = 0, second = 0] = timePart
        .split(":")
        .map((value) => Number(String(value).split(".")[0]));

      if (!year || !month || !day) return null;

      return new Date(year, month - 1, day, hour, minute, second);
    } catch {
      return null;
    }
  };

  const formatStartedTime = (isoString) => {
    const date = parseServerDate(isoString);

    if (!date || Number.isNaN(date.getTime())) {
      return "시간 정보 없음";
    }

    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");

    return `${hh}:${mm}`;
  };

  const normalizeStatus = (statusValue) => {
    return String(statusValue || "").toUpperCase();
  };

  const getSessionId = (session = {}) => {
    return session.sessionId ?? session.id ?? session.callSessionId ?? null;
  };

  const getSessionStatus = (session = {}) => {
    return normalizeStatus(
      session.status ||
        session.sessionStatus ||
        session.callStatus ||
        session.state ||
        ""
    );
  };

  const hasEndedTime = (session = {}) => {
    return Boolean(session.endedAt || session.endTime || session.closedAt);
  };

  const isEndedSession = (session = {}) => {
    const status = getSessionStatus(session);

    return (
      hasEndedTime(session) ||
      status === "CLOSED" ||
      status === "ENDED" ||
      status === "COMPLETE" ||
      status === "COMPLETED" ||
      status === "FINISHED" ||
      status === "SUCCESS" ||
      status === "FAILED" ||
      status === "MISSED" ||
      status === "NO_ANSWER" ||
      status === "CANCELED" ||
      status === "CANCELLED"
    );
  };

  const isActiveSession = (session = {}) => {
    if (isEndedSession(session)) return false;

    const status = getSessionStatus(session);

    return (
      status === "OPEN" ||
      status === "CALLING" ||
      status === "TALKING" ||
      status === "ONGOING" ||
      status === "ACTIVE"
    );
  };

  const getStatusLabel = (session = {}) => {
    const status = getSessionStatus(session);

    if (isEndedSession(session)) {
      if (
        status === "FAILED" ||
        status === "MISSED" ||
        status === "NO_ANSWER" ||
        status === "CANCELED" ||
        status === "CANCELLED"
      ) {
        return "미응답";
      }

      return "종료";
    }

    if (status === "OPEN" || status === "CALLING") return "호출 중";
    if (status === "TALKING" || status === "ONGOING" || status === "ACTIVE") {
      return "통화 중";
    }

    return "확인 필요";
  };

  const mapMonitoringItem = (session = {}) => {
    const sessionId = getSessionId(session);

    const title = session.location
      ? `${session.deviceUid || "장치 정보 없음"} (${session.location})`
      : `${session.deviceUid || "장치 정보 없음"}`;

    return {
      ...session,
      id: sessionId,
      sessionId,
      title,
      time: formatStartedTime(session.startedAt || session.createdAt),
      status: getSessionStatus(session),
      statusLabel: getStatusLabel(session),
      startedAt: session.startedAt || session.createdAt,
      deviceUid: session.deviceUid,
      location: session.location,
    };
  };

  const fetchActiveSessions = async (isSilent = false) => {
    try {
      if (!isSilent) {
        setIsLoading(true);
        logAdminMonitoring("초기 조회 시작");
      }

      const token = await AsyncStorage.getItem("adminToken");

      if (!token) {
        logAdminMonitoring("adminToken 없음 - 로그인 화면 이동");

        setMonitoringList([]);
        setActiveCount(0);
        navigation.navigate("AdminLogin");
        return;
      }

      const response = await axios.get(`${BASE_URL}/api/admin/monitoring`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data?.success && Array.isArray(response.data?.data)) {
        const rawSessions = response.data.data;

        const activeSessions = rawSessions.filter(isActiveSession);

        const mappedList = activeSessions
          .map(mapMonitoringItem)
          .filter((item) => item.sessionId)
          .sort((a, b) => {
            const bTime = parseServerDate(b.startedAt)?.getTime() || 0;
            const aTime = parseServerDate(a.startedAt)?.getTime() || 0;

            return bTime - aTime;
          });

        const statusSummary = rawSessions.reduce((acc, item) => {
          const status = getSessionStatus(item) || "UNKNOWN";
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {});

        logAdminMonitoring("세션 조회", {
          total: rawSessions.length,
          active: mappedList.length,
          filtered: rawSessions.length - mappedList.length,
          statusSummary,
        });

        setMonitoringList(mappedList);
        setActiveCount(mappedList.length);
      } else {
        logAdminMonitoring("세션 조회 응답 확인 필요", response.data);

        setMonitoringList([]);
        setActiveCount(0);
      }
    } catch (error) {
      const serverError =
        error.response?.data?.message ||
        JSON.stringify(error.response?.data) ||
        error.message;

      logAdminMonitoring("실시간 모니터링 조회 실패", serverError);

      setMonitoringList([]);
      setActiveCount(0);
    } finally {
      if (!isSilent) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    let pollingTimer = null;

    if (isFocused) {
      logAdminMonitoring("화면 포커스 - polling 시작");

      fetchActiveSessions(false);

      pollingTimer = setInterval(() => {
        fetchActiveSessions(true);
      }, 3000);
    }

    return () => {
      if (pollingTimer) {
        clearInterval(pollingTimer);
        logAdminMonitoring("화면 이탈 - polling 중지");
      }
    };
  }, [isFocused]);

  const handlePressSession = (item) => {
    if (!item.sessionId) return;

    logAdminMonitoring("세션 상세 이동", {
      sessionId: item.sessionId,
      status: item.status,
      deviceUid: item.deviceUid,
    });

    navigation.navigate("AdminMonitoringDetail", {
      sessionId: item.sessionId,
      item,
    });
  };

  return (
    <Container>
      <Header>
        <Logo source={bellIcon} resizeMode="contain" />
        <HeaderTitle>인터폰 실시간 모니터링</HeaderTitle>
      </Header>

      {isLoading ? (
        <LoadingWrapper>
          <ActivityIndicator size="large" color="#1EC949" />
          <LoadingText>실시간 통화 정보를 불러오는 중...</LoadingText>
        </LoadingWrapper>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 30 }}
        >
          <SummarySection>
            <SummaryText>
              진행 중인 통화{" "}
              <BoldText color="#1EC949">{activeCount}</BoldText>건
            </SummaryText>
          </SummarySection>

          <ListArea>
            {monitoringList.length > 0 ? (
              monitoringList.map((item) => (
                <TouchableOpacity
                  key={item.sessionId}
                  activeOpacity={0.7}
                  onPress={() => handlePressSession(item)}
                >
                  <MonitoringItem item={item} />
                </TouchableOpacity>
              ))
            ) : (
              <EmptyWrapper>
                <Ionicons name="radio-outline" size={44} color="#DDD" />
                <EmptyText>현재 진행 중인 통화가 없습니다.</EmptyText>
              </EmptyWrapper>
            )}
          </ListArea>
        </ScrollView>
      )}
    </Container>
  );
}

const Container = styled(SafeAreaContainer)`
  flex: 1;
  background-color: #F4F5F7;
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
  padding: 20px 20px 10px;
`;

const SummaryText = styled.Text`
  font-size: 15px;
  color: #555;
  font-weight: 600;
`;

const BoldText = styled.Text`
  font-weight: 900;
  color: ${(props) => props.color};
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