import React, { useState, useEffect } from "react";
import { ScrollView, TouchableOpacity, View, ActivityIndicator, Modal } from "react-native";
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

export default function AdminBtnStatScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  
  // 🕒 한국 표준시(KST) 기준 오늘 날짜 계산 유틸
  const getTodayKST = () => {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
    const kst = new Date(utc + (9 * 60 * 60 * 1000));
    return kst.toISOString().split('T')[0];
  };

  const [selectedDate, setSelectedDate] = useState(getTodayKST());
  const [isDateModalVisible, setIsDateModalVisible] = useState(false);

  // 📱 통계 리스트 및 계산용 상태창
  const [btnStats, setBtnStats] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [highestBtn, setHighestBtn] = useState(null);
  const [lowestBtn, setLowestBtn] = useState(null);

  // =========================================================
  // 🔥 [명세서 7-2] 라이브 통계 분석 엔진 🚀
  // =========================================================
  const fetchStatistics = async () => {
    try {
      setIsLoading(true);
      const token = await AsyncStorage.getItem("adminToken");
      if (!token) {
        navigation.navigate("AdminLogin");
        return;
      }

      const response = await axios.get(`${BASE_URL}/api/admin/quick-replies/statistics`, {
        params: { date: selectedDate }, // 날짜 필터가 지원될 경우를 대비
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success && response.data.data) {
        const rawStats = response.data.data;
        
        // 🧮 1. 고유 번호 맵핑 및 총합 계산 (useCount 사용!)
        let sum = 0;
        const mappedStats = rawStats.map((item, idx) => {
          // 🚀 핵심: 명세서상 횟수 필드는 'useCount' 입니다.
          const countVal = item.useCount || 0; 
          sum += countVal;
          return {
            ...item,
            displayNo: item.replyCode || item.quickReplyId || idx + 1 
          };
        });

        // 백분율(percent) 계산 로직 추가
        const finalStats = mappedStats.map(item => ({
          ...item,
          percent: sum > 0 ? ((item.useCount || 0) / sum) * 100 : 0
        }));

        setTotalCount(sum);
        setBtnStats(finalStats);

        // 🧮 2. 최대/최소 하이라이트 연산 (useCount 기준 정렬)
        if (finalStats.length > 0) {
          const sortedList = [...finalStats].sort((a, b) => (b.useCount || 0) - (a.useCount || 0));
          setHighestBtn(sortedList[0]);
          setLowestBtn(sortedList[sortedList.length - 1]);
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
  }, [isFocused, selectedDate]);

  return (
    <Container>
      {/* 1. 헤더 영역 */}
      <Header>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <BackIcon source={backIcon} resizeMode="contain" />
        </TouchableOpacity>
        <HeaderTitle>버튼 응답 빈도</HeaderTitle>
        <View style={{ width: 24 }} />
      </Header>

      {/* 2. 초록색 날짜 선택 컨트롤러 (시안 100% 반영) */}
      <DateControlSection>
        <DateDisplayBox>
          <DateDisplayText>{selectedDate.replace(/-/g, '/')}</DateDisplayText>
        </DateDisplayBox>
        <DateSelectButton onPress={() => setIsDateModalVisible(true)} activeOpacity={0.8}>
          <DateSelectButtonText>날짜 선택</DateSelectButtonText>
        </DateSelectButton>
      </DateControlSection>

      {isLoading ? (
        <LoadingWrapper>
          <ActivityIndicator size="large" color="#1EC949" />
          <LoadingText>통계 집계 중...</LoadingText>
        </LoadingWrapper>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          
          {/* 3. 메인 통계 카드 */}
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
                <StatRow key={item.displayNo || idx}>
                  <RowText>{item.displayNo}. {item.text || item.content || "상용구 문구 없음"}</RowText>
                  <RowCount>{item.useCount || 0}회</RowCount>
                  <RowPercent>{item.percent ? item.percent.toFixed(1) : "0.0"}%</RowPercent>
                </StatRow>
              ))
            ) : (
              <EmptyText>해당 날짜에 집계된 통계가 없습니다.</EmptyText>
            )}
          </StatCard>

          {/* 4. 최다/최소 하이라이트 카드 */}
          <HighlightCard>
            <HighlightSection style={{ borderBottomWidth: 1, borderBottomColor: '#F0F0F0', paddingBottom: 15, marginBottom: 15 }}>
              <HighlightRow>
                <Ionicons name="add-circle-outline" size={20} color="#1EC949" />
                <HighlightTitle color="#555">최다 선택 버튼</HighlightTitle>
              </HighlightRow>
              {highestBtn ? (
                <HighlightDataRow>
                  <RowText style={{ marginLeft: 5 }}>{highestBtn.displayNo}. {highestBtn.text || highestBtn.content}</RowText>
                  <RowCount>{highestBtn.useCount || 0}회</RowCount>
                  <RowPercent>{highestBtn.percent ? highestBtn.percent.toFixed(1) : "0.0"}%</RowPercent>
                </HighlightDataRow>
              ) : (
                <RowText style={{ color: "#BBB", marginLeft: 5 }}>데이터 없음</RowText>
              )}
            </HighlightSection>

            <HighlightSection>
              <HighlightRow>
                <Ionicons name="remove-circle-outline" size={20} color="#FF5C5C" />
                <HighlightTitle color="#555">최소 선택 버튼</HighlightTitle>
              </HighlightRow>
              {lowestBtn ? (
                <HighlightDataRow>
                  <RowText style={{ marginLeft: 5 }}>{lowestBtn.displayNo}. {lowestBtn.text || lowestBtn.content}</RowText>
                  <RowCount>{lowestBtn.useCount || 0}회</RowCount>
                  <RowPercent>{lowestBtn.percent ? lowestBtn.percent.toFixed(1) : "0.0"}%</RowPercent>
                </HighlightDataRow>
              ) : (
                <RowText style={{ color: "#BBB", marginLeft: 5 }}>데이터 없음</RowText>
              )}
            </HighlightSection>
          </HighlightCard>

        </ScrollView>
      )}

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

/* 📅 날짜 컨트롤러 UI */
const DateControlSection = styled.View` flex-direction: row; align-items: center; padding: 10px 20px 20px; `;
const DateDisplayBox = styled.View` padding: 8px 16px; border-width: 1.5px; border-color: #1EC949; border-radius: 20px; background-color: #fff; margin-right: 12px; `;
const DateDisplayText = styled.Text` font-size: 15px; font-weight: 700; color: #1EC949; `;
const DateSelectButton = styled.TouchableOpacity` padding: 9px 18px; background-color: #1EC949; border-radius: 20px; `;
const DateSelectButtonText = styled.Text` font-size: 15px; font-weight: 700; color: #fff; `;

/* 📊 카드 디자인 */
const StatCard = styled.View` background-color: #fff; margin: 0 15px 15px; padding: 20px; border-radius: 20px; elevation: 2; shadow-color: #000; shadow-opacity: 0.05; shadow-radius: 5px; `;
const CardTopRow = styled.View` flex-direction: row; justify-content: space-between; align-items: center; padding-bottom: 15px; border-bottom-width: 1px; border-bottom-color: #F0F0F0; `;
const CardMainTitle = styled.Text` font-size: 16px; font-weight: 600; color: #444; `;
const CardMainCount = styled.Text` font-size: 16px; font-weight: 600; color: #333; `;

const SubTitleRow = styled.View` flex-direction: row; align-items: center; margin: 15px 0 10px; `;
const SubTitleText = styled.Text` font-size: 15px; font-weight: 700; color: #333; margin-left: 8px; `;

const StatRow = styled.View` flex-direction: row; align-items: center; padding: 12px 0; border-bottom-width: 1px; border-bottom-color: #F0F0F0; border-style: dashed; `;
const RowText = styled.Text` flex: 1; font-size: 14px; color: #444; font-weight: 500; `;
const RowCount = styled.Text` width: 50px; font-size: 14px; color: #444; text-align: right; font-weight: 600; `;
const RowPercent = styled.Text` width: 60px; font-size: 14px; color: #4A90E2; text-align: right; font-weight: 500; `;

const HighlightCard = styled(StatCard)``;
const HighlightSection = styled.View``;
const HighlightRow = styled.View` flex-direction: row; align-items: center; margin-bottom: 8px; `;
const HighlightTitle = styled.Text` font-size: 15px; font-weight: 600; color: ${props => props.color}; margin-left: 6px; `;
const HighlightDataRow = styled.View` flex-direction: row; align-items: center; `;

const LoadingWrapper = styled.View` flex: 1; justify-content: center; align-items: center; padding-top: 50px; `;
const LoadingText = styled.Text` font-size: 13px; color: #718096; font-weight: 600; margin-top: 12px; `;
const EmptyText = styled.Text` font-size: 14px; color: #BBB; font-weight: 600; text-align: center; padding: 20px 0; `;

/* 📅 모달 및 달력 전용 스타일 */
const ModalOverlay = styled.TouchableOpacity` flex: 1; background-color: rgba(0,0,0,0.4); justify-content: center; align-items: center; `;
const CalendarContainer = styled.TouchableOpacity` width: 90%; background-color: white; border-radius: 24px; padding: 20px; overflow: hidden; `;
const CalendarHeader = styled.View` flex-direction: row; justify-content: space-between; align-items: center; margin-bottom: 10px; padding: 5px; `;
const ModalTitle = styled.Text` font-size: 18px; font-weight: 800; color: #111; `;