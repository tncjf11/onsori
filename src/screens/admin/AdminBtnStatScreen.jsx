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
import { Calendar, LocaleConfig } from "react-native-calendars";

import BASE_URL from "../../api/config";

const backIcon = require("../../assets/back_icon.png");

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

const logBtnStat = (message, data) => {
  if (data !== undefined) {
    console.log(`[ADMIN_BTN_STAT] ${message}`, data);
  } else {
    console.log(`[ADMIN_BTN_STAT] ${message}`);
  }
};

export default function AdminBtnStatScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const formatLocalDate = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");

    return `${yyyy}-${mm}-${dd}`;
  };

  const getTodayDate = () => {
    return formatLocalDate(new Date());
  };

  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [filterMode, setFilterMode] = useState("today");
  const [isDateModalVisible, setIsDateModalVisible] = useState(false);
  const [btnStats, setBtnStats] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [highestBtn, setHighestBtn] = useState(null);
  const [lowestBtn, setLowestBtn] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const getCount = (item) => {
    return Number(item?.useCount ?? item?.count ?? 0);
  };

  const getButtonText = (item) => {
    return item?.text || item?.content || item?.replyText || "문구 없음";
  };

  const resetStatistics = () => {
    setBtnStats([]);
    setTotalCount(0);
    setHighestBtn(null);
    setLowestBtn(null);
  };

  const normalizeStats = (rawStats) => {
    const sum = rawStats.reduce((acc, item) => acc + getCount(item), 0);

    const mappedStats = rawStats.map((item, idx) => {
      const count = getCount(item);

      return {
        ...item,
        useCount: count,
        displayNo: item.replyCode || item.quickReplyId || item.id || idx + 1,
        displayText: getButtonText(item),
        percent: sum > 0 ? (count / sum) * 100 : 0,
      };
    });

    const sortedStats = [...mappedStats].sort((a, b) => {
      const countDiff = getCount(b) - getCount(a);

      if (countDiff !== 0) return countDiff;

      return Number(a.displayNo) - Number(b.displayNo);
    });

    setTotalCount(sum);
    setBtnStats(sortedStats);

    if (sum > 0 && sortedStats.length > 0) {
      setHighestBtn(sortedStats[0]);
      setLowestBtn(sortedStats[sortedStats.length - 1]);
    } else {
      setHighestBtn(null);
      setLowestBtn(null);
    }

    logBtnStat("통계 정규화 완료", {
      rawCount: rawStats.length,
      totalCount: sum,
      highest: sortedStats[0]
        ? {
            displayNo: sortedStats[0].displayNo,
            text: sortedStats[0].displayText,
            count: sortedStats[0].useCount,
          }
        : null,
      lowest:
        sortedStats.length > 0
          ? {
              displayNo: sortedStats[sortedStats.length - 1].displayNo,
              text: sortedStats[sortedStats.length - 1].displayText,
              count: sortedStats[sortedStats.length - 1].useCount,
            }
          : null,
    });
  };

  const extractStatsData = (response) => {
    if (response.data?.success === false) {
      throw new Error(response.data?.message || "통계 조회 실패");
    }

    if (Array.isArray(response.data?.data)) {
      return response.data.data;
    }

    if (Array.isArray(response.data)) {
      return response.data;
    }

    return [];
  };

  const requestStatistics = async (token) => {
    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    if (filterMode === "date") {
      config.params = {
        date: selectedDate,
      };
    }

    logBtnStat("빠른 응답 통계 조회 요청", {
      endpoint: "/api/admin/quick-replies/statistics",
      mode: filterMode,
      dateParam: filterMode === "date" ? selectedDate : "없음 - 오늘 기준",
    });

    return axios.get(`${BASE_URL}/api/admin/quick-replies/statistics`, config);
  };

  const fetchStatistics = async () => {
    try {
      setIsLoading(true);

      logBtnStat("통계 화면 조회 시작", {
        filterMode,
        selectedDate,
      });

      const token = await AsyncStorage.getItem("adminToken");

      if (!token) {
        logBtnStat("adminToken 없음 - 로그인 화면 이동");

        resetStatistics();
        navigation.navigate("AdminLogin");
        return;
      }

      const response = await requestStatistics(token);
      const rawStats = extractStatsData(response);

      if (rawStats.length === 0) {
        logBtnStat("통계 데이터 없음", {
          filterMode,
          selectedDate,
        });

        resetStatistics();
        return;
      }

      normalizeStats(rawStats);
    } catch (error) {
      const serverError =
        error.response?.data?.message ||
        JSON.stringify(error.response?.data) ||
        error.message;

      logBtnStat("빠른 응답 통계 조회 실패", serverError);
      resetStatistics();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      logBtnStat("화면 포커스", {
        filterMode,
        selectedDate,
      });

      fetchStatistics();
    }
  }, [isFocused, selectedDate, filterMode]);

  const handleSelectToday = () => {
    logBtnStat("오늘 통계 선택", {
      previousMode: filterMode,
    });

    setFilterMode("today");
    setSelectedDate(getTodayDate());
    setIsDateModalVisible(false);
  };

  const handleSelectDate = (day) => {
    logBtnStat("날짜 선택", {
      previousDate: selectedDate,
      nextDate: day.dateString,
    });

    setSelectedDate(day.dateString);
    setFilterMode("date");
    setIsDateModalVisible(false);
  };

  const getEmptyMessage = () => {
    if (filterMode === "today") {
      return "오늘 집계된 통계가 없습니다.";
    }

    return "해당 날짜에 집계된 통계가 없습니다.";
  };

  return (
    <Container>
      <Header>
        <TouchableOpacity
          onPress={() => {
            logBtnStat("뒤로가기 클릭");
            navigation.goBack();
          }}
        >
          <BackIcon source={backIcon} resizeMode="contain" />
        </TouchableOpacity>

        <HeaderTitle>버튼 응답 빈도</HeaderTitle>

        <View style={{ width: 24 }} />
      </Header>

      <DateControlSection>
        <TodaySelectButton
          isActive={filterMode === "today"}
          onPress={handleSelectToday}
          activeOpacity={0.8}
        >
          <TodaySelectButtonText isActive={filterMode === "today"}>
            오늘
          </TodaySelectButtonText>
        </TodaySelectButton>

        <DateDisplayBox isActive={filterMode === "date"}>
          <DateDisplayText isActive={filterMode === "date"}>
            {selectedDate.replace(/-/g, "/")}
          </DateDisplayText>
        </DateDisplayBox>

        <DateSelectButton
          isActive={filterMode === "date"}
          onPress={() => {
            logBtnStat("날짜 선택 모달 열기");
            setIsDateModalVisible(true);
          }}
          activeOpacity={0.8}
        >
          <DateSelectButtonText>날짜 선택</DateSelectButtonText>
        </DateSelectButton>
      </DateControlSection>

      {isLoading ? (
        <LoadingWrapper>
          <ActivityIndicator size="large" color="#1EC949" />
          <LoadingText>통계를 불러오는 중...</LoadingText>
        </LoadingWrapper>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <StatCard>
            <CardTopRow>
              <CardMainTitle>총 선택 횟수</CardMainTitle>
              <CardMainCount>{totalCount}회</CardMainCount>
            </CardTopRow>

            <SubTitleRow>
              <Ionicons name="bar-chart-outline" size={20} color="#333" />
              <SubTitleText>버튼 별 선택 횟수</SubTitleText>
            </SubTitleRow>

            {btnStats.length > 0 ? (
              btnStats.map((item, idx) => (
                <StatRow key={`${item.displayNo}-${idx}`}>
                  <RowText>
                    {item.displayNo}. {item.displayText}
                  </RowText>
                  <RowCount>{item.useCount}회</RowCount>
                  <RowPercent>{item.percent.toFixed(1)}%</RowPercent>
                </StatRow>
              ))
            ) : (
              <EmptyText>{getEmptyMessage()}</EmptyText>
            )}
          </StatCard>

          <HighlightCard>
            <HighlightSection
              style={{
                borderBottomWidth: 1,
                borderBottomColor: "#F0F0F0",
                paddingBottom: 15,
                marginBottom: 15,
              }}
            >
              <HighlightRow>
                <Ionicons name="add-circle-outline" size={20} color="#1EC949" />
                <HighlightTitle>최다 선택 버튼</HighlightTitle>
              </HighlightRow>

              {highestBtn ? (
                <HighlightDataRow>
                  <RowText style={{ marginLeft: 5 }}>
                    {highestBtn.displayNo}. {highestBtn.displayText}
                  </RowText>
                  <RowCount>{highestBtn.useCount}회</RowCount>
                  <RowPercent>{highestBtn.percent.toFixed(1)}%</RowPercent>
                </HighlightDataRow>
              ) : (
                <RowText style={{ color: "#BBB", marginLeft: 5 }}>
                  데이터 없음
                </RowText>
              )}
            </HighlightSection>

            <HighlightSection>
              <HighlightRow>
                <Ionicons
                  name="remove-circle-outline"
                  size={20}
                  color="#FF5C5C"
                />
                <HighlightTitle>최소 선택 버튼</HighlightTitle>
              </HighlightRow>

              {lowestBtn ? (
                <HighlightDataRow>
                  <RowText style={{ marginLeft: 5 }}>
                    {lowestBtn.displayNo}. {lowestBtn.displayText}
                  </RowText>
                  <RowCount>{lowestBtn.useCount}회</RowCount>
                  <RowPercent>{lowestBtn.percent.toFixed(1)}%</RowPercent>
                </HighlightDataRow>
              ) : (
                <RowText style={{ color: "#BBB", marginLeft: 5 }}>
                  데이터 없음
                </RowText>
              )}
            </HighlightSection>
          </HighlightCard>
        </ScrollView>
      )}

      <Modal
        transparent
        visible={isDateModalVisible}
        animationType="fade"
        onRequestClose={() => {
          logBtnStat("날짜 선택 모달 닫기");
          setIsDateModalVisible(false);
        }}
      >
        <ModalOverlay
          activeOpacity={1}
          onPress={() => {
            logBtnStat("날짜 선택 모달 배경 클릭 닫기");
            setIsDateModalVisible(false);
          }}
        >
          <CalendarContainer activeOpacity={1}>
            <CalendarHeader>
              <ModalTitle>날짜 선택</ModalTitle>

              <TouchableOpacity
                onPress={() => {
                  logBtnStat("날짜 선택 모달 닫기 버튼 클릭");
                  setIsDateModalVisible(false);
                }}
              >
                <Ionicons name="close" size={26} color="#333" />
              </TouchableOpacity>
            </CalendarHeader>

            <Calendar
              current={selectedDate}
              onDayPress={handleSelectDate}
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
  flex: 1;
  margin-horizontal: 12px;
  font-size: 20px;
  font-weight: 800;
  color: #333;
  text-align: center;
`;

const DateControlSection = styled.View`
  flex-direction: row;
  align-items: center;
  padding: 10px 20px 20px;
`;

const TodaySelectButton = styled.TouchableOpacity`
  padding: 8px 15px;
  border-width: 1.5px;
  border-color: #1EC949;
  border-radius: 20px;
  background-color: ${(props) => (props.isActive ? "#1EC949" : "#fff")};
  margin-right: 8px;
`;

const TodaySelectButtonText = styled.Text`
  font-size: 14px;
  font-weight: 700;
  color: ${(props) => (props.isActive ? "#fff" : "#1EC949")};
`;

const DateDisplayBox = styled.View`
  padding: 8px 14px;
  border-width: 1.5px;
  border-color: #1EC949;
  border-radius: 20px;
  background-color: ${(props) => (props.isActive ? "#fff" : "#F8F8F8")};
  margin-right: 8px;
`;

const DateDisplayText = styled.Text`
  font-size: 14px;
  font-weight: 700;
  color: ${(props) => (props.isActive ? "#1EC949" : "#999")};
`;

const DateSelectButton = styled.TouchableOpacity`
  padding: 9px 16px;
  background-color: ${(props) => (props.isActive ? "#1EC949" : "#D1D5DB")};
  border-radius: 20px;
`;

const DateSelectButtonText = styled.Text`
  font-size: 14px;
  font-weight: 700;
  color: #fff;
`;

const StatCard = styled.View`
  background-color: #fff;
  margin: 0 15px 15px;
  padding: 20px;
  border-radius: 20px;
  elevation: 2;
  shadow-color: #000;
  shadow-opacity: 0.05;
  shadow-radius: 5px;
`;

const CardTopRow = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 15px;
  border-bottom-width: 1px;
  border-bottom-color: #F0F0F0;
`;

const CardMainTitle = styled.Text`
  font-size: 16px;
  font-weight: 600;
  color: #444;
`;

const CardMainCount = styled.Text`
  font-size: 16px;
  font-weight: 600;
  color: #333;
`;

const SubTitleRow = styled.View`
  flex-direction: row;
  align-items: center;
  margin: 15px 0 10px;
`;

const SubTitleText = styled.Text`
  font-size: 15px;
  font-weight: 700;
  color: #333;
  margin-left: 8px;
`;

const StatRow = styled.View`
  flex-direction: row;
  align-items: center;
  padding: 7px 0;
  border-bottom-width: 1px;
  border-bottom-color: #F0F0F0;
  border-style: dashed;
`;

const RowText = styled.Text`
  flex: 1;
  font-size: 14px;
  color: #444;
  font-weight: 500;
`;

const RowCount = styled.Text`
  width: 50px;
  font-size: 14px;
  color: #444;
  text-align: right;
  font-weight: 600;
`;

const RowPercent = styled.Text`
  width: 60px;
  font-size: 14px;
  color: #2F80ED;
  text-align: right;
  font-weight: 500;
`;

const HighlightCard = styled(StatCard)``;

const HighlightSection = styled.View``;

const HighlightRow = styled.View`
  flex-direction: row;
  align-items: center;
  margin-bottom: 8px;
`;

const HighlightTitle = styled.Text`
  font-size: 15px;
  font-weight: 600;
  color: #555;
  margin-left: 6px;
`;

const HighlightDataRow = styled.View`
  flex-direction: row;
  align-items: center;
`;

const LoadingWrapper = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
  padding-top: 50px;
`;

const LoadingText = styled.Text`
  font-size: 13px;
  color: #718096;
  font-weight: 600;
  margin-top: 12px;
`;

const EmptyText = styled.Text`
  font-size: 14px;
  color: #BBB;
  font-weight: 600;
  text-align: center;
  padding: 20px 0;
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