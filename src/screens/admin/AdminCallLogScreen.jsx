import React, { useState, useEffect } from "react";
import { ScrollView, TouchableOpacity, View, ActivityIndicator, Text, Modal } from "react-native";
import styled from "styled-components/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BASE_URL from "../../api/config";

// 📅 찐 달력 부품 및 한국어 패치 세팅
import { Calendar, LocaleConfig } from 'react-native-calendars';

LocaleConfig.locales['kr'] = {
  monthNames: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
  monthNamesShort: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
  dayNames: ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'],
  dayNamesShort: ['일','월','화','수','목','금','토'],
  today: '오늘'
};
LocaleConfig.defaultLocale = 'kr';

const backIcon = require("../../assets/back_icon.png");

export default function AdminCallLogScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 🕒 한국 표준시(KST) 기준 오늘 날짜 계산 유틸
  const getTodayKST = () => {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
    const kst = new Date(utc + (9 * 60 * 60 * 1000));
    return kst.toISOString().split('T')[0];
  };

  const [selectedDate, setSelectedDate] = useState(getTodayKST());
  const [isDateModalVisible, setIsDateModalVisible] = useState(false);

  const fetchIntercomLogs = async () => {
    try {
      setIsLoading(true);
      const token = await AsyncStorage.getItem("adminToken");
      if (!token) {
        navigation.navigate("AdminLogin");
        return;
      }

      // 전체 로그를 불러온 후 프론트에서 날짜별로 필터링합니다.
      const response = await axios.get(`${BASE_URL}/api/admin/intercom-logs/search`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success && response.data.data) {
        // 최신순 정렬 (내림차순)
        const sortedLogs = response.data.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setLogs(sortedLogs);
      } else {
        setLogs([]);
      }
    } catch (error) {
      console.error("🚨 로그 수급 실패:", error.message);
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) fetchIntercomLogs();
  }, [isFocused]);

  // 🎯 선택된 날짜에 맞게 로그 필터링 (프론트 단독 처리)
  useEffect(() => {
    const filtered = logs.filter(log => {
      if (!log.createdAt) return false;
      try {
        const logDate = new Date(log.createdAt);
        const isUtc = !log.createdAt.includes("+09") && (log.createdAt.endsWith("Z") || log.createdAt.includes("T"));
        const kstLogTime = isUtc ? new Date(logDate.getTime() + 9 * 60 * 60 * 1000) : logDate;
        const logDateStr = kstLogTime.toISOString().split('T')[0];
        return logDateStr === selectedDate;
      } catch {
        return false;
      }
    });
    setFilteredLogs(filtered);
  }, [logs, selectedDate]);

  const formatLogTime = (isoString) => {
    if (!isoString) return "00:00";
    try {
      const logDate = new Date(isoString);
      const isUtc = !isoString.includes("+09") && (isoString.endsWith("Z") || isoString.includes("T"));
      const kstLogTime = isUtc ? new Date(logDate.getTime() + 9 * 60 * 60 * 1000) : logDate;
      return `${String(kstLogTime.getHours()).padStart(2, '0')}:${String(kstLogTime.getMinutes()).padStart(2, '0')}`;
    } catch { return "00:00"; }
  };

  return (
    <Container>
      <Header>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <BackIcon source={backIcon} />
        </TouchableOpacity>
        <HeaderTitle>호출 로그</HeaderTitle>
        <View style={{ width: 24 }} />
      </Header>

      <DateControlSection>
        <DateDisplayBox>
          <DateDisplayText>{selectedDate.replace(/-/g, '/')}</DateDisplayText>
        </DateDisplayBox>
        <DateSelectButton onPress={() => setIsDateModalVisible(true)} activeOpacity={0.8}>
          <DateSelectButtonText>날짜 선택</DateSelectButtonText>
        </DateSelectButton>
      </DateControlSection>

      <ScrollView showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#1EC949" style={{ marginTop: 50 }} />
        ) : (
          <LogCard>
            <LogCardHeader>
              <SummaryTitle>{selectedDate === getTodayKST() ? "오늘 호출 수" : "호출 수"}</SummaryTitle>
              <SummaryCount>{filteredLogs.length}회</SummaryCount>
            </LogCardHeader>

            <TableHeader>
              <HeaderText style={{ flex: 1.2 }}>No.</HeaderText>
              <HeaderText style={{ flex: 1.5 }}>시간</HeaderText>
              <HeaderText style={{ flex: 2.8 }}>디바이스 ID</HeaderText>
              <HeaderText style={{ flex: 1.8 }}>통화 연결</HeaderText>
              <HeaderText style={{ flex: 1.5 }}>STT</HeaderText>
            </TableHeader>

            {filteredLogs.length > 0 ? filteredLogs.map((item, idx) => {
              // 역순 No. 생성 및 3자리 '0' 채우기 (예: 024, 023...)
              const reverseNo = String(filteredLogs.length - idx).padStart(3, '0');
              
              let connStatus = "미응답";
              let sttStatus = "-";

              if (item.status === "SUCCESS") {
                connStatus = "연결";
                sttStatus = "완료";
              } else if (item.status === "ENDED") {
                connStatus = "종료";
                sttStatus = "완료";
              } else if (item.status === "ONGOING") {
                connStatus = "연결";
                sttStatus = "진행중";
              }

              return (
                <TouchableOpacity 
                  key={item.id || idx} 
                  activeOpacity={0.6} 
                  onPress={() => navigation.navigate("AdminMonitoringDetail", { logId: item.id, item })}
                >
                  <TableRow>
                    <RowText style={{ flex: 1.2 }}>{reverseNo}</RowText>
                    <RowText style={{ flex: 1.5 }}>{formatLogTime(item.createdAt)}</RowText>
                    <RowText style={{ flex: 2.8 }}>{item.deviceUid || "알수없음"}</RowText>
                    <RowText style={{ flex: 1.8 }}>{connStatus}</RowText>
                    <RowText style={{ flex: 1.5 }}>{sttStatus}</RowText>
                  </TableRow>
                </TouchableOpacity>
              );
            }) : (
              <EmptyWrapper>
                <Ionicons name="calendar-outline" size={36} color="#DDD" />
                <EmptyText>해당 날짜의 기록이 없습니다.</EmptyText>
              </EmptyWrapper>
            )}
          </LogCard>
        )}
      </ScrollView>

      {/* 📅 달력 격자판 팝업 모달 */}
      <Modal transparent={true} visible={isDateModalVisible} animationType="fade" onRequestClose={() => setIsDateModalVisible(false)}>
        <ModalOverlay activeOpacity={1} onPress={() => setIsDateModalVisible(false)}>
          <CalendarContainer activeOpacity={1}>
            <CalendarHeader>
              <ModalTitle>📅 날짜 선택</ModalTitle>
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
                [selectedDate]: { selected: true, disableTouchEvent: true }
              }}
              theme={{
                backgroundColor: '#ffffff',
                calendarBackground: '#ffffff',
                textSectionTitleColor: '#b6c1cd',
                selectedDayBackgroundColor: '#1EC949',
                selectedDayTextColor: '#ffffff',
                todayTextColor: '#1EC949',
                dayTextColor: '#2d4150',
                textDisabledColor: '#d9e1e8',
                arrowColor: '#1EC949',
                monthTextColor: '#333',
                textMonthFontWeight: 'bold',
                textDayFontSize: 15,
                textMonthFontSize: 18,
                textDayHeaderFontSize: 14
              }}
            />
          </CalendarContainer>
        </ModalOverlay>
      </Modal>

    </Container>
  );
}

/* ================= 스타일 정의 (시안 100% 반영) ================= */
const Container = styled(SafeAreaView)` flex: 1; background-color: #F4F5F7; `;
const Header = styled.View` flex-direction: row; justify-content: space-between; align-items: center; padding: 15px 20px; background-color: #F4F5F7; `;
const BackIcon = styled.Image` width: 24px; height: 24px; `;
const HeaderTitle = styled.Text` font-size: 20px; font-weight: 800; color: #333; `;

const DateControlSection = styled.View` flex-direction: row; align-items: center; padding: 10px 20px 20px; `;
const DateDisplayBox = styled.View` padding: 8px 16px; border-width: 1.5px; border-color: #1EC949; border-radius: 20px; background-color: #fff; margin-right: 12px; `;
const DateDisplayText = styled.Text` font-size: 15px; font-weight: 700; color: #1EC949; `;
const DateSelectButton = styled.TouchableOpacity` padding: 9px 18px; background-color: #1EC949; border-radius: 20px; `;
const DateSelectButtonText = styled.Text` font-size: 15px; font-weight: 700; color: #fff; `;

const LogCard = styled.View` background-color: #fff; margin: 0 15px 30px; padding: 25px 20px; border-radius: 20px; elevation: 2; shadow-color: #000; shadow-opacity: 0.05; shadow-radius: 5px; `;
const LogCardHeader = styled.View` flex-direction: row; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; padding-bottom: 15px; border-bottom-width: 1px; border-bottom-color: #F0F0F0; `;
const SummaryTitle = styled.Text` font-size: 16px; font-weight: 600; color: #444; `;
const SummaryCount = styled.Text` font-size: 16px; font-weight: 600; color: #444; `;

const TableHeader = styled.View` flex-direction: row; padding-bottom: 15px; border-bottom-width: 1px; border-bottom-color: #F0F0F0; margin-bottom: 5px; `;
const HeaderText = styled.Text` font-size: 13px; color: #888; text-align: center; font-weight: 600; `;

const TableRow = styled.View` flex-direction: row; padding: 16px 0; border-bottom-width: 1px; border-bottom-color: #F0F0F0; border-style: dashed; align-items: center; `;
const RowText = styled.Text` font-size: 14px; color: #333; text-align: center; font-weight: 500; `;

const EmptyWrapper = styled.View` padding: 50px 20px; align-items: center; justify-content: center; `;
const EmptyText = styled.Text` font-size: 14px; color: #999; font-weight: 600; margin-top: 12px; `;

/* 📅 모달 및 달력 전용 스타일 */
const ModalOverlay = styled.TouchableOpacity` flex: 1; background-color: rgba(0,0,0,0.4); justify-content: center; align-items: center; `;
const CalendarContainer = styled.TouchableOpacity` width: 90%; background-color: white; border-radius: 24px; padding: 20px; overflow: hidden; `;
const CalendarHeader = styled.View` flex-direction: row; justify-content: space-between; align-items: center; margin-bottom: 10px; padding: 5px; `;
const ModalTitle = styled.Text` font-size: 18px; font-weight: 800; color: #111; `;