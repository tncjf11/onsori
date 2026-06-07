import React, { useState, useEffect } from "react";
import {
  ScrollView,
  View,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import styled from "styled-components/native";
import { SafeAreaView as SafeAreaContainer } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

import BASE_URL from "../../api/config";
import RecentCallItem from "../../components/RecentCallItem";

const backIcon = require("../../assets/back_icon.png");
const calendarIcon = require("../../assets/calendar_icon.png");
const keywordIcon = require("../../assets/keyword_icon.png");

export default function HistorySearchResultScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const {
    searchQuery = "",
    dateFilter = null,
    dateFilterLabel = null,
    keywordsFilter = [],
  } = route.params || {};

  const safeKeywordsFilter = Array.isArray(keywordsFilter)
    ? keywordsFilter
    : [];

  const keywordsFilterKey = JSON.stringify(safeKeywordsFilter);

  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState(null);

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

  const formatLocalDate = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");

    return `${yyyy}-${mm}-${dd}`;
  };

  const formatDateString = (isoString) => {
    const date = parseServerDate(isoString);

    if (!date || Number.isNaN(date.getTime())) {
      return "";
    }

    return formatLocalDate(date);
  };

  const getComparableTime = (isoString) => {
    const date = parseServerDate(isoString);

    if (!date || Number.isNaN(date.getTime())) {
      return 0;
    }

    return date.getTime();
  };

  const getTodayString = () => {
    return formatLocalDate(new Date());
  };

  const getPastString = (daysAgo) => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - daysAgo);

    return formatLocalDate(targetDate);
  };

  const formatTimeGap = (isoString) => {
    if (!isoString) return "기록 없음";

    try {
      const now = new Date();
      const logTime = parseServerDate(isoString);

      if (!logTime || Number.isNaN(logTime.getTime())) {
        return "시간 오차";
      }

      const diffMs = now.getTime() - logTime.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));

      if (diffMins < 1) return "방금 전";
      if (diffMins < 60) return `${diffMins}분 전`;

      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}시간 전`;

      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return "어제";
      if (diffDays <= 7) return `${diffDays}일 전`;

      return formatDateString(isoString);
    } catch {
      return "시간 오차";
    }
  };

  const matchDateFilter = (logDate) => {
    if (
      !dateFilter ||
      dateFilter === "전체 기간" ||
      dateFilter === "전체 조회" ||
      dateFilter === "선택 없음"
    ) {
      return true;
    }

    if (dateFilter === "오늘") {
      return logDate === getTodayString();
    }

    if (dateFilter === "최근 7일") {
      const start = getPastString(7);
      const end = getTodayString();

      return logDate >= start && logDate <= end;
    }

    if (dateFilter === "최근 1개월") {
      const start = getPastString(30);
      const end = getTodayString();

      return logDate >= start && logDate <= end;
    }

    if (typeof dateFilter === "string" && dateFilter.includes("~")) {
      const [startRaw, endRaw] = dateFilter.split("~");
      const start = startRaw.trim();
      const end = endRaw.trim();

      return logDate >= start && logDate <= end;
    }

    return logDate === dateFilter;
  };

  const normalizeText = (value) => {
    return String(value || "").trim().toLowerCase();
  };

  const getSearchTargetText = (log) => {
    return [
      log.title,
      log.summary,
      log.visitorText,
      log.residentReply,
      log.refinedText,
      log.intent,
      log.deviceUid,
      log.location,
      log.status,
    ]
      .filter(Boolean)
      .join(" ");
  };

  const mapLogToSearchItem = (log) => {
    const summary =
      log.summary && log.summary.trim() !== "내용 없음"
        ? log.summary.trim()
        : "인터폰 호출 알림";

    return {
      ...log,
      id: log.id,
      logId: log.id,
      sessionId: log.sessionId,
      title: summary,
      content: getSearchTargetText(log),
      time: formatDateString(log.createdAt),
      displayTime: formatTimeGap(log.createdAt),
      type: log.intent === "DELIVERY" ? "message" : "bell",
      tags: log.intent ? [log.intent] : ["방문"],
      deviceUid: log.deviceUid,
      createdAt: log.createdAt,
      raw: log,
    };
  };

  const fetchAllLogs = async (savedToken) => {
    const response = await axios.get(`${BASE_URL}/api/intercom-logs`, {
      headers: {
        Authorization: `Bearer ${savedToken}`,
      },
    });

    return response.data?.success && Array.isArray(response.data?.data)
      ? response.data.data
      : [];
  };

  useEffect(() => {
    const fetchAndFilterLogs = async () => {
      try {
        setIsLoading(true);

        const savedToken = await AsyncStorage.getItem("accessToken");
        setToken(savedToken);

        if (!savedToken) {
          setSearchResults([]);
          return;
        }

        const query = normalizeText(searchQuery);
        const rawLogs = await fetchAllLogs(savedToken);

        const filteredLogs = rawLogs
          .map(mapLogToSearchItem)
          .filter((log) => {
            const matchDate = matchDateFilter(log.time);

            const title = normalizeText(log.title);
            const content = normalizeText(log.content);

            const matchSearch = query
              ? title.includes(query) || content.includes(query)
              : true;

            const matchKeywords =
              safeKeywordsFilter.length > 0
                ? safeKeywordsFilter.every((keyword) => {
                    const target = normalizeText(keyword);
                    const tagText = normalizeText(log.tags.join(" "));

                    return (
                      tagText.includes(target) ||
                      title.includes(target) ||
                      content.includes(target)
                    );
                  })
                : true;

            return matchDate && matchSearch && matchKeywords;
          })
          .sort(
            (a, b) =>
              getComparableTime(b.createdAt) - getComparableTime(a.createdAt)
          );

        setSearchResults(filteredLogs);
      } catch (error) {
        console.error("검색 결과 조회 실패:", error?.message);
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAndFilterLogs();
  }, [searchQuery, dateFilter, keywordsFilterKey]);

  const getDateFilterLabel = () => {
    if (dateFilterLabel) return dateFilterLabel;
    if (!dateFilter) return "전체 기간";
    return dateFilter;
  };

  const handlePressResultItem = (item) => {
    navigation.navigate("End", {
      item,
      logId: item.logId || item.id,
      sessionId: item.sessionId,
      token,
    });
  };

  return (
    <Container>
      <Header>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <IconBtn source={backIcon} resizeMode="contain" />
        </TouchableOpacity>

        <HeaderTitle>검색 결과</HeaderTitle>

        <View style={{ width: 24 }} />
      </Header>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <SummaryCard>
          <SummaryTitleText>
            {searchQuery
              ? `'${searchQuery}' 텍스트가 포함된 결과`
              : "필터 조건별 대화 기록"}
          </SummaryTitleText>

          <FilterDetail>
            <FilterRow>
              <FilterIcon source={calendarIcon} resizeMode="contain" />
              <FilterLabel>날짜 범위 |</FilterLabel>
              <FilterValue>{getDateFilterLabel()}</FilterValue>
            </FilterRow>

            <FilterRow style={{ borderBottomWidth: 0 }}>
              <FilterIcon source={keywordIcon} resizeMode="contain" />
              <FilterLabel>키워드 |</FilterLabel>
              <FilterValue>
                {safeKeywordsFilter.length > 0
                  ? `'${safeKeywordsFilter.join(", ")}'`
                  : "'전체'"}
              </FilterValue>
            </FilterRow>
          </FilterDetail>
        </SummaryCard>

        <ResultListContainer>
          {isLoading ? (
            <LoadingWrapper>
              <ActivityIndicator size="large" color="#06F393" />
              <LoadingText>검색 중...</LoadingText>
            </LoadingWrapper>
          ) : searchResults.length > 0 ? (
            searchResults.map((item) => {
              const listItem = {
                ...item,
                time: item.displayTime,
              };

              return (
                <RecentCallItem
                  key={item.id}
                  item={listItem}
                  token={token || "READY"}
                  onPress={() => handlePressResultItem(listItem)}
                />
              );
            })
          ) : (
            <EmptyWrapper>
              <Ionicons name="search-outline" size={48} color="#DDD" />
              <EmptyMainText>검색 결과가 없습니다.</EmptyMainText>
              <EmptySubText>
                선택하신 날짜 범위나 키워드에 일치하는 대화 기록이 없습니다.
              </EmptySubText>
            </EmptyWrapper>
          )}
        </ResultListContainer>
      </ScrollView>
    </Container>
  );
}

/* ================= 스타일 정의 ================= */

const Container = styled(SafeAreaContainer)`
  flex: 1;
  background-color: #F8F9FA;
`;

const Header = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background-color: #fff;
  border-bottom-width: 1px;
  border-bottom-color: #EEE;
`;

const HeaderTitle = styled.Text`
  font-size: 18px;
  font-weight: 700;
  color: #333;
`;

const IconBtn = styled.Image`
  width: 24px;
  height: 24px;
`;

const SummaryCard = styled.View`
  background-color: #fff;
  margin: 20px;
  padding: 20px;
  border-radius: 20px;
  elevation: 5;
  shadow-color: #000;
  shadow-opacity: 0.05;
  shadow-radius: 10px;
`;

const SummaryTitleText = styled.Text`
  font-size: 15px;
  color: #666;
  text-align: center;
  margin-bottom: 20px;
  font-weight: 600;
`;

const FilterDetail = styled.View`
  border-top-width: 1px;
  border-top-color: #F0F0F0;
`;

const FilterRow = styled.View`
  flex-direction: row;
  align-items: center;
  padding: 15px 0;
  border-bottom-width: 1px;
  border-bottom-color: #F5F5F5;
`;

const FilterIcon = styled.Image`
  width: 18px;
  height: 18px;
  margin-right: 12px;
`;

const FilterLabel = styled.Text`
  font-size: 14px;
  color: #888;
  margin-right: 10px;
`;

const FilterValue = styled.Text`
  flex: 1;
  font-size: 14px;
  color: #333;
  font-weight: 600;
`;

const ResultListContainer = styled.View`
  background-color: #fff;
  border-top-left-radius: 25px;
  border-top-right-radius: 25px;
  padding-top: 10px;
  padding-bottom: 40px;
  flex: 1;
  min-height: 350px;
`;

const LoadingWrapper = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
  padding-top: 60px;
`;

const LoadingText = styled.Text`
  font-size: 13px;
  color: #999;
  font-weight: 600;
  margin-top: 10px;
`;

const EmptyWrapper = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
  padding: 60px 30px;
`;

const EmptyMainText = styled.Text`
  font-size: 16px;
  color: #666;
  font-weight: 800;
  margin-top: 15px;
`;

const EmptySubText = styled.Text`
  font-size: 13px;
  color: #BBB;
  font-weight: 500;
  text-align: center;
  margin-top: 8px;
  line-height: 20px;
`;