import React, { useState, useEffect, useRef } from "react";
import {
  ScrollView,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Modal,
} from "react-native";
import styled from "styled-components/native";
import { SafeAreaView as SafeAreaContainer } from "react-native-safe-area-context";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BASE_URL from "../../api/config";

import { Calendar, LocaleConfig } from "react-native-calendars";

LocaleConfig.locales.kr = {
  monthNames: [
    "1월",
    "2월",
    "3월",
    "4월",
    "5월",
    "6월",
    "7월",
    "8월",
    "9월",
    "10월",
    "11월",
    "12월",
  ],
  monthNamesShort: [
    "1월",
    "2월",
    "3월",
    "4월",
    "5월",
    "6월",
    "7월",
    "8월",
    "9월",
    "10월",
    "11월",
    "12월",
  ],
  dayNames: ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"],
  dayNamesShort: ["일", "월", "화", "수", "목", "금", "토"],
  today: "오늘",
};

LocaleConfig.defaultLocale = "kr";

const backIcon = require("../../assets/back_icon.png");

const ENDED_SESSION_STATUSES = new Set([
  "SUCCESS",
  "CLOSED",
  "ENDED",
  "COMPLETE",
  "COMPLETED",
  "FINISHED",
]);

const ACTIVE_SESSION_STATUSES = new Set([
  "ONGOING",
  "OPEN",
  "CALLING",
  "TALKING",
  "ACTIVE",
  "CONNECTED",
  "INCOMING",
]);

const FAILED_SESSION_STATUSES = new Set([
  "FAILED",
  "MISSED",
  "NO_ANSWER",
  "CANCELED",
  "CANCELLED",
]);

const logAdminCallLog = (message, data) => {
  if (data !== undefined) {
    console.log(`[ADMIN_CALL_LOG] ${message}`, data);
  } else {
    console.log(`[ADMIN_CALL_LOG] ${message}`);
  }
};

export default function AdminCallLogScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDateModalVisible, setIsDateModalVisible] = useState(false);

  const isMountedRef = useRef(true);

  const formatLocalDate = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");

    return `${yyyy}-${mm}-${dd}`;
  };

  const getTodayKST = () => {
    return formatLocalDate(new Date());
  };

  const [selectedDate, setSelectedDate] = useState(getTodayKST());

  const parseServerDate = (isoString) => {
    if (!isoString) return null;

    try {
      const stringValue = String(isoString).trim();

      const hasExplicitTimezone =
        stringValue.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(stringValue);

      if (hasExplicitTimezone) {
        const date = new Date(stringValue);
        return Number.isNaN(date.getTime()) ? null : date;
      }

      const normalized = stringValue.replace("T", " ");
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

  const getLogDateValue = (item = {}) => {
    return (
      item.createdAt ||
      item.startedAt ||
      item.startTime ||
      item.endedAt ||
      item.endTime ||
      item.closedAt ||
      item.completedAt ||
      item.finishedAt ||
      item.timestamp ||
      item.time ||
      ""
    );
  };

  const getDateString = (item = {}) => {
    const date = parseServerDate(getLogDateValue(item));

    if (!date || Number.isNaN(date.getTime())) {
      return "";
    }

    return formatLocalDate(date);
  };

  const getSortTime = (item = {}) => {
    const date = parseServerDate(getLogDateValue(item));

    if (!date || Number.isNaN(date.getTime())) {
      return 0;
    }

    return date.getTime();
  };

  const formatLogTime = (item = {}) => {
    const date = parseServerDate(getLogDateValue(item));

    if (!date || Number.isNaN(date.getTime())) {
      return "00:00";
    }

    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");

    return `${hh}:${mm}`;
  };

  const normalizeStatus = (value) => {
    return String(value || "")
      .trim()
      .toUpperCase();
  };

  const normalizeKoreanStatus = (value) => {
    return String(value || "").trim();
  };

  const getStatusCandidates = (item = {}) => {
    return [
      item.status,
      item.sessionStatus,
      item.callStatus,
      item.state,
      item.connectionState,
    ]
      .map(normalizeStatus)
      .filter(Boolean);
  };

  const hasEndedTime = (item = {}) => {
    return Boolean(
      item.endedAt ||
        item.endTime ||
        item.closedAt ||
        item.completedAt ||
        item.finishedAt
    );
  };

  const isEndedLog = (item = {}) => {
    const statuses = getStatusCandidates(item);

    if (hasEndedTime(item)) return true;
    if (statuses.some((status) => ENDED_SESSION_STATUSES.has(status))) {
      return true;
    }

    const connectionStatus = normalizeKoreanStatus(item.connectionStatus);
    const sttStatus = normalizeKoreanStatus(item.sttStatus);

    if (connectionStatus === "종료" || sttStatus === "완료") {
      return true;
    }

    return false;
  };

  const isFailedLog = (item = {}) => {
    const statuses = getStatusCandidates(item);

    if (statuses.some((status) => FAILED_SESSION_STATUSES.has(status))) {
      return true;
    }

    const connectionStatus = normalizeKoreanStatus(item.connectionStatus);
    const sttStatus = normalizeKoreanStatus(item.sttStatus);

    if (connectionStatus === "미응답" || sttStatus === "중단") {
      return true;
    }

    return false;
  };

  const isActiveLog = (item = {}) => {
    const statuses = getStatusCandidates(item);

    if (statuses.some((status) => ACTIVE_SESSION_STATUSES.has(status))) {
      return true;
    }

    const connectionStatus = normalizeKoreanStatus(item.connectionStatus);
    const sttStatus = normalizeKoreanStatus(item.sttStatus);

    if (connectionStatus === "연결" || sttStatus === "진행 중" || sttStatus === "진행중") {
      return true;
    }

    return false;
  };

  const getStatusLabels = (item = {}) => {
    if (isEndedLog(item)) {
      return {
        connStatus: "종료",
        sttStatus: "완료",
      };
    }

    if (isFailedLog(item)) {
      return {
        connStatus: "미응답",
        sttStatus: "중단",
      };
    }

    if (isActiveLog(item)) {
      const backendSttStatus = normalizeKoreanStatus(item.sttStatus);

      return {
        connStatus: "연결",
        sttStatus:
          backendSttStatus === "완료"
            ? "완료"
            : backendSttStatus === "진행중"
            ? "진행 중"
            : "진행 중",
      };
    }

    return {
      connStatus: normalizeKoreanStatus(item.connectionStatus) || "확인 필요",
      sttStatus: normalizeKoreanStatus(item.sttStatus) || "-",
    };
  };

  const extractIntercomLogs = (responseData) => {
    if (Array.isArray(responseData?.data)) {
      return responseData.data;
    }

    if (Array.isArray(responseData)) {
      return responseData;
    }

    if (Array.isArray(responseData?.content)) {
      return responseData.content;
    }

    if (Array.isArray(responseData?.logs)) {
      return responseData.logs;
    }

    if (Array.isArray(responseData?.items)) {
      return responseData.items;
    }

    if (Array.isArray(responseData?.data?.content)) {
      return responseData.data.content;
    }

    if (Array.isArray(responseData?.data?.logs)) {
      return responseData.data.logs;
    }

    if (Array.isArray(responseData?.data?.items)) {
      return responseData.data.items;
    }

    if (Array.isArray(responseData?.result)) {
      return responseData.result;
    }

    if (Array.isArray(responseData?.data?.result)) {
      return responseData.data.result;
    }

    return [];
  };

  const getLogId = (item = {}, index = 0) => {
    return item.logId ?? item.id ?? item.intercomLogId ?? index;
  };

  const getSessionId = (item = {}) => {
    return (
      item.sessionId ??
      item.callSessionId ??
      item.intercomSessionId ??
      item.session?.id ??
      null
    );
  };

  const getDeviceUid = (item = {}) => {
    return (
      item.deviceUid ||
      item.deviceId ||
      item.device?.deviceUid ||
      item.device?.id ||
      "알 수 없음"
    );
  };

  const normalizeLogItem = (item = {}, index = 0) => {
    const logId = getLogId(item, index);
    const sessionId = getSessionId(item);

    return {
      ...item,
      id: logId,
      logId,
      sessionId,
      deviceUid: getDeviceUid(item),
      createdAt: getLogDateValue(item),
      raw: item,
    };
  };

  const sortLogs = (targetLogs) => {
    return [...targetLogs]
      .map(normalizeLogItem)
      .sort((a, b) => getSortTime(b) - getSortTime(a));
  };

  const fetchSearchLogs = async (token) => {
    const searchResponse = await axios.get(
      `${BASE_URL}/api/admin/intercom-logs/search`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          date: selectedDate,
        },
      }
    );

    const rawLogs = extractIntercomLogs(searchResponse.data);

    logAdminCallLog("날짜별 호출 로그 응답", {
      success: searchResponse.data?.success,
      rawCount: rawLogs.length,
      selectedDate,
    });

    return rawLogs;
  };

  const fetchFallbackLogs = async (token) => {
    const fallbackResponse = await axios.get(
      `${BASE_URL}/api/admin/intercom-logs`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const rawLogs = extractIntercomLogs(fallbackResponse.data);

    logAdminCallLog("전체 호출 로그 응답", {
      success: fallbackResponse.data?.success,
      rawCount: rawLogs.length,
    });

    return rawLogs;
  };

  const fetchIntercomLogs = async () => {
    try {
      if (isMountedRef.current) {
        setIsLoading(true);
      }

      const token = await AsyncStorage.getItem("adminToken");

      if (!token) {
        logAdminCallLog("adminToken 없음 - 로그인 화면 이동");
        navigation.navigate("AdminLogin");
        return;
      }

      let rawLogs = [];

      try {
        rawLogs = await fetchSearchLogs(token);
      } catch (error) {
        const serverError =
          error.response?.data?.message ||
          JSON.stringify(error.response?.data) ||
          error.message;

        logAdminCallLog("날짜별 호출 로그 조회 실패 - fallback 진행", serverError);
        rawLogs = await fetchFallbackLogs(token);
      }

      const sortedLogs = sortLogs(rawLogs);

      if (isMountedRef.current) {
        setLogs(sortedLogs);
      }
    } catch (error) {
      const serverError =
        error.response?.data?.message ||
        JSON.stringify(error.response?.data) ||
        error.message;

      logAdminCallLog("호출 로그 조회 실패", serverError);

      if (isMountedRef.current) {
        setLogs([]);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isFocused) {
      fetchIntercomLogs();
    }
  }, [isFocused, selectedDate]);

  useEffect(() => {
    const filtered = logs.filter((log) => {
      const logDate = getDateString(log);

      return logDate === selectedDate;
    });

    setFilteredLogs(filtered);

    const statusSummary = filtered.reduce((acc, item) => {
      const labels = getStatusLabels(item);
      const key = `${labels.connStatus}/${labels.sttStatus}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    logAdminCallLog("호출 로그 필터링", {
      selectedDate,
      total: logs.length,
      filtered: filtered.length,
      statusSummary,
    });
  }, [logs, selectedDate]);

  const handlePressLog = (item) => {
    navigation.navigate("AdminHistoryDetail", {
      logId: item.logId || item.id,
      sessionId: item.sessionId,
      item,
    });
  };

  return (
    <Container>
      <Header>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <BackIcon source={backIcon} resizeMode="contain" />
        </TouchableOpacity>

        <HeaderTitle>호출 로그</HeaderTitle>

        <View style={{ width: 24 }} />
      </Header>

      <DateControlSection>
        <DateDisplayBox>
          <DateDisplayText>{selectedDate.replace(/-/g, "/")}</DateDisplayText>
        </DateDisplayBox>

        <DateSelectButton
          onPress={() => setIsDateModalVisible(true)}
          activeOpacity={0.8}
        >
          <DateSelectButtonText>날짜 선택</DateSelectButtonText>
        </DateSelectButton>
      </DateControlSection>

      <ScrollView showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <ActivityIndicator
            size="large"
            color="#1EC949"
            style={{ marginTop: 50 }}
          />
        ) : (
          <LogCard>
            <LogCardHeader>
              <SummaryTitle>
                {selectedDate === getTodayKST() ? "오늘 호출 수" : "호출 수"}
              </SummaryTitle>
              <SummaryCount>{filteredLogs.length}회</SummaryCount>
            </LogCardHeader>

            <TableHeader>
              <HeaderText style={{ flex: 1.2 }}>No.</HeaderText>
              <HeaderText style={{ flex: 1.5 }}>시간</HeaderText>
              <HeaderText style={{ flex: 2.8 }}>장치 ID</HeaderText>
              <HeaderText style={{ flex: 1.8 }}>연결 상태</HeaderText>
              <HeaderText style={{ flex: 1.5 }}>STT</HeaderText>
            </TableHeader>

            {filteredLogs.length > 0 ? (
              filteredLogs.map((item, idx) => {
                const reverseNo = String(filteredLogs.length - idx).padStart(
                  3,
                  "0"
                );

                const { connStatus, sttStatus } = getStatusLabels(item);

                return (
                  <TouchableOpacity
                    key={item.logId || item.id || idx}
                    activeOpacity={0.6}
                    onPress={() => handlePressLog(item)}
                  >
                    <TableRow>
                      <RowText style={{ flex: 1.2 }}>{reverseNo}</RowText>

                      <RowText style={{ flex: 1.5 }}>
                        {formatLogTime(item)}
                      </RowText>

                      <RowText style={{ flex: 2.8 }}>
                        {item.deviceUid || "알 수 없음"}
                      </RowText>

                      <RowText style={{ flex: 1.8 }}>{connStatus}</RowText>

                      <RowText style={{ flex: 1.5 }}>{sttStatus}</RowText>
                    </TableRow>
                  </TouchableOpacity>
                );
              })
            ) : (
              <EmptyWrapper>
                <Ionicons name="calendar-outline" size={36} color="#DDD" />
                <EmptyText>해당 날짜의 기록이 없습니다.</EmptyText>
              </EmptyWrapper>
            )}
          </LogCard>
        )}
      </ScrollView>

      <Modal
        transparent
        visible={isDateModalVisible}
        animationType="fade"
        onRequestClose={() => setIsDateModalVisible(false)}
      >
        <ModalOverlay
          activeOpacity={1}
          onPress={() => setIsDateModalVisible(false)}
        >
          <CalendarContainer activeOpacity={1}>
            <CalendarHeader>
              <ModalTitle>날짜 선택</ModalTitle>

              <TouchableOpacity onPress={() => setIsDateModalVisible(false)}>
                <Ionicons name="close" size={26} color="#333" />
              </TouchableOpacity>
            </CalendarHeader>

            <Calendar
              current={selectedDate}
              onDayPress={(day) => {
                setSelectedDate(day.dateString);
                setIsDateModalVisible(false);
              }}
              markedDates={{
                [selectedDate]: {
                  selected: true,
                  disableTouchEvent: true,
                },
              }}
              theme={{
                backgroundColor: "#ffffff",
                calendarBackground: "#ffffff",
                textSectionTitleColor: "#b6c1cd",
                selectedDayBackgroundColor: "#1EC949",
                selectedDayTextColor: "#ffffff",
                todayTextColor: "#1EC949",
                dayTextColor: "#2d4150",
                textDisabledColor: "#d9e1e8",
                arrowColor: "#1EC949",
                monthTextColor: "#333",
                textMonthFontWeight: "bold",
                textDayFontSize: 15,
                textMonthFontSize: 18,
                textDayHeaderFontSize: 14,
              }}
            />
          </CalendarContainer>
        </ModalOverlay>
      </Modal>
    </Container>
  );
}

const Container = styled(SafeAreaContainer)`
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

const DateControlSection = styled.View`
  flex-direction: row;
  align-items: center;
  padding: 10px 20px 20px;
`;

const DateDisplayBox = styled.View`
  padding: 8px 16px;
  border-width: 1.5px;
  border-color: #1EC949;
  border-radius: 20px;
  background-color: #fff;
  margin-right: 12px;
`;

const DateDisplayText = styled.Text`
  font-size: 15px;
  font-weight: 700;
  color: #1EC949;
`;

const DateSelectButton = styled.TouchableOpacity`
  padding: 9px 18px;
  background-color: #1EC949;
  border-radius: 20px;
`;

const DateSelectButtonText = styled.Text`
  font-size: 15px;
  font-weight: 700;
  color: #fff;
`;

const LogCard = styled.View`
  background-color: #fff;
  margin: 0 15px 30px;
  padding: 25px 20px;
  border-radius: 20px;
  elevation: 2;
  shadow-color: #000;
  shadow-opacity: 0.05;
  shadow-radius: 5px;
`;

const LogCardHeader = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom-width: 1px;
  border-bottom-color: #F0F0F0;
`;

const SummaryTitle = styled.Text`
  font-size: 16px;
  font-weight: 600;
  color: #444;
`;

const SummaryCount = styled.Text`
  font-size: 16px;
  font-weight: 600;
  color: #444;
`;

const TableHeader = styled.View`
  flex-direction: row;
  padding-bottom: 15px;
  border-bottom-width: 1px;
  border-bottom-color: #F0F0F0;
  margin-bottom: 5px;
`;

const HeaderText = styled.Text`
  font-size: 13px;
  color: #888;
  text-align: center;
  font-weight: 600;
`;

const TableRow = styled.View`
  flex-direction: row;
  padding: 16px 0;
  border-bottom-width: 1px;
  border-bottom-color: #F0F0F0;
  border-style: dashed;
  align-items: center;
`;

const RowText = styled.Text`
  font-size: 14px;
  color: #333;
  text-align: center;
  font-weight: 500;
`;

const EmptyWrapper = styled.View`
  padding: 50px 20px;
  align-items: center;
  justify-content: center;
`;

const EmptyText = styled.Text`
  font-size: 14px;
  color: #999;
  font-weight: 600;
  margin-top: 12px;
`;

const ModalOverlay = styled.TouchableOpacity`
  flex: 1;
  background-color: rgba(0, 0, 0, 0.4);
  justify-content: center;
  align-items: center;
`;

const CalendarContainer = styled.TouchableOpacity`
  width: 90%;
  background-color: white;
  border-radius: 24px;
  padding: 20px;
  overflow: hidden;
`;

const CalendarHeader = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding: 5px;
`;

const ModalTitle = styled.Text`
  font-size: 18px;
  font-weight: 800;
  color: #111;
`;