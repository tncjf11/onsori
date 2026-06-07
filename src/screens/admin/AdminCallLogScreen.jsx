import React, { useState, useEffect } from "react";
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

export default function AdminCallLogScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDateModalVisible, setIsDateModalVisible] = useState(false);

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

  const getDateString = (isoString) => {
    const date = parseServerDate(isoString);

    if (!date || Number.isNaN(date.getTime())) {
      return "";
    }

    return formatLocalDate(date);
  };

  const getSortTime = (isoString) => {
    const date = parseServerDate(isoString);

    if (!date || Number.isNaN(date.getTime())) {
      return 0;
    }

    return date.getTime();
  };

  const formatLogTime = (isoString) => {
    const date = parseServerDate(isoString);

    if (!date || Number.isNaN(date.getTime())) {
      return "00:00";
    }

    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");

    return `${hh}:${mm}`;
  };

  const normalizeStatus = (value) => {
    return String(value || "").toUpperCase();
  };

  const getStatusLabels = (item = {}) => {
    const status = normalizeStatus(
      item.status ||
        item.sessionStatus ||
        item.callStatus ||
        item.connectionStatus
    );

    const sttStatus = normalizeStatus(item.sttStatus);
    const hasEndedTime = Boolean(item.endedAt || item.endTime || item.closedAt);

    const isEnded =
      hasEndedTime ||
      status === "SUCCESS" ||
      status === "CLOSED" ||
      status === "ENDED" ||
      status === "COMPLETE" ||
      status === "COMPLETED" ||
      status === "FINISHED";

    const isActive =
      status === "ONGOING" ||
      status === "OPEN" ||
      status === "CALLING" ||
      status === "TALKING" ||
      status === "ACTIVE";

    const isFailed =
      status === "FAILED" ||
      status === "MISSED" ||
      status === "NO_ANSWER" ||
      status === "CANCELED" ||
      status === "CANCELLED";

    if (isEnded) {
      return {
        connStatus: "종료",
        sttStatus: "완료",
      };
    }

    if (isFailed) {
      return {
        connStatus: "미응답",
        sttStatus: "중단",
      };
    }

    if (isActive) {
      return {
        connStatus: "연결",
        sttStatus: sttStatus === "COMPLETED" ? "완료" : "진행 중",
      };
    }

    return {
      connStatus: item.connectionStatus || "확인 필요",
      sttStatus: item.sttStatus || "-",
    };
  };

  const sortLogs = (targetLogs) => {
    return [...targetLogs].sort(
      (a, b) => getSortTime(b.createdAt) - getSortTime(a.createdAt)
    );
  };

  const fetchIntercomLogs = async () => {
    try {
      setIsLoading(true);

      const token = await AsyncStorage.getItem("adminToken");

      if (!token) {
        navigation.navigate("AdminLogin");
        return;
      }

      try {
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

        if (
          searchResponse.data?.success &&
          Array.isArray(searchResponse.data?.data)
        ) {
          setLogs(sortLogs(searchResponse.data.data));
          return;
        }
      } catch (error) {
        console.log("날짜별 호출 로그 조회 실패:", error?.message);
      }

      const fallbackResponse = await axios.get(
        `${BASE_URL}/api/admin/intercom-logs`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (
        fallbackResponse.data?.success &&
        Array.isArray(fallbackResponse.data?.data)
      ) {
        setLogs(sortLogs(fallbackResponse.data.data));
      } else {
        setLogs([]);
      }
    } catch (error) {
      console.error("호출 로그 조회 실패:", error?.message);
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      fetchIntercomLogs();
    }
  }, [isFocused, selectedDate]);

  useEffect(() => {
    const filtered = logs.filter((log) => {
      if (!log.createdAt) return false;

      const logDate = getDateString(log.createdAt);

      return logDate === selectedDate;
    });

    setFilteredLogs(filtered);
  }, [logs, selectedDate]);

  const handlePressLog = (item) => {
    navigation.navigate("AdminHistoryDetail", {
      logId: item.id,
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
                    key={item.id || idx}
                    activeOpacity={0.6}
                    onPress={() => handlePressLog(item)}
                  >
                    <TableRow>
                      <RowText style={{ flex: 1.2 }}>{reverseNo}</RowText>

                      <RowText style={{ flex: 1.5 }}>
                        {formatLogTime(item.createdAt)}
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