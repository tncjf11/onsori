import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import axios from "axios";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView as SafeAreaContainer } from "react-native-safe-area-context";
import styled from "styled-components/native";

import BASE_URL from "../../api/config";
import RecentCallItem from "../../components/RecentCallItem";

const bellIcon = require("../../assets/bell.png");
const searchIcon = require("../../assets/search_icon.png");

export default function HistoryScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const [historyData, setHistoryData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState(null);

  const parseKstDate = (isoString) => {
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
    } catch (error) {
      return null;
    }
  };

  const getLogDateValue = (log = {}) => {
    return (
      log.createdAt ||
      log.startedAt ||
      log.startTime ||
      log.endedAt ||
      log.endTime ||
      log.closedAt ||
      log.completedAt ||
      log.finishedAt ||
      log.updatedAt ||
      log.timestamp ||
      log.time ||
      ""
    );
  };

  const extractIntercomLogs = (responseData) => {
    if (Array.isArray(responseData?.data)) return responseData.data;
    if (Array.isArray(responseData)) return responseData;
    if (Array.isArray(responseData?.content)) return responseData.content;
    if (Array.isArray(responseData?.logs)) return responseData.logs;
    if (Array.isArray(responseData?.items)) return responseData.items;
    if (Array.isArray(responseData?.data?.content)) {
      return responseData.data.content;
    }
    if (Array.isArray(responseData?.data?.logs)) {
      return responseData.data.logs;
    }
    if (Array.isArray(responseData?.data?.items)) {
      return responseData.data.items;
    }
    if (Array.isArray(responseData?.result)) return responseData.result;
    if (Array.isArray(responseData?.data?.result)) {
      return responseData.data.result;
    }

    return [];
  };

  const formatTimeGap = (isoString) => {
    if (!isoString) return "기록 없음";

    try {
      const now = new Date();
      const logTime = parseKstDate(isoString);

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

      const year = logTime.getFullYear();
      const month = String(logTime.getMonth() + 1).padStart(2, "0");
      const day = String(logTime.getDate()).padStart(2, "0");

      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error("🚨 시간 포맷 에러:", error.message);
      return "시간 오차";
    }
  };

  const getLogTimeValue = (log) => {
    const parsedDate = parseKstDate(getLogDateValue(log));

    return parsedDate && !Number.isNaN(parsedDate.getTime())
      ? parsedDate.getTime()
      : 0;
  };

  const fetchAllHistoryLogs = async () => {
    try {
      setIsLoading(true);

      const savedToken = await AsyncStorage.getItem("accessToken");

      if (!savedToken) {
        setToken(null);
        setHistoryData([]);
        return;
      }

      setToken(savedToken);

      const response = await axios.get(`${BASE_URL}/api/intercom-logs`, {
        headers: {
          Authorization: `Bearer ${savedToken}`,
        },
      });

      const rawLogs = extractIntercomLogs(response.data);

      console.log("[HISTORY] 호출 이력 원본 응답", {
        success: response.data?.success,
        rawCount: rawLogs.length,
        raw: response.data,
      });

      const mappedLogs = [...rawLogs]
        .filter((log) => log)
        .sort((a, b) => getLogTimeValue(b) - getLogTimeValue(a))
        .map((log, index) => {
          const refinedSummary =
            log.summary && log.summary.trim() !== "내용 없음"
              ? log.summary.trim()
              : log.visitorText && log.visitorText.trim()
              ? log.visitorText.trim()
              : "인터폰 호출 알림";

          const logId = log.logId ?? log.id ?? log.intercomLogId ?? index;

          const sessionId =
            log.sessionId ??
            log.callSessionId ??
            log.intercomSessionId ??
            log.session?.id ??
            null;

          const logTime = getLogDateValue(log);

          return {
            ...log,
            id: logId,
            logId,
            sessionId,
            title: refinedSummary,
            time: formatTimeGap(logTime),
            type: log.intent === "DELIVERY" ? "message" : "bell",
            tags: log.intent ? [log.intent] : ["방문"],
            createdAt: logTime,
            raw: log,
          };
        });

      setHistoryData(mappedLogs);
    } catch (error) {
      console.error("🚨 History fetch 에러:", error.message);
      setHistoryData([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      fetchAllHistoryLogs();
    }
  }, [isFocused]);

  const handlePressHistoryItem = (item) => {
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
        <HeaderLeft>
          <Logo source={bellIcon} resizeMode="contain" />
          <HeaderTitle>히스토리</HeaderTitle>
        </HeaderLeft>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigation.navigate("HistorySearch")}
        >
          <SearchBtnIcon source={searchIcon} resizeMode="contain" />
        </TouchableOpacity>
      </Header>

      {isLoading ? (
        <LoadingWrapper>
          <ActivityIndicator size="large" color="#06F393" />
          <LoadingText>기록 복원 중...</LoadingText>
        </LoadingWrapper>
      ) : historyData.length > 0 ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 90 }}
        >
          {historyData.map((item) => (
            <RecentCallItem
              key={item.id}
              item={item}
              token={token || "READY"}
              onPress={() => handlePressHistoryItem(item)}
            />
          ))}
        </ScrollView>
      ) : (
        <EmptyHistoryWrapper>
          <Ionicons name="folder-open-outline" size={48} color="#DDD" />
          <EmptyHistoryMainText>최근 호출된 내역이 없습니다.</EmptyHistoryMainText>
          <EmptyHistorySubText>
            인터폰 대화 연결 시스템을 사용하시면{"\n"}
            여기에 실시간 자막 기록들이 차곡차곡 보관됩니다.
          </EmptyHistorySubText>
        </EmptyHistoryWrapper>
      )}
    </Container>
  );
}

const Container = styled(SafeAreaContainer)`
  flex: 1;
  background-color: #fff;
`;

const Header = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background-color: #fff;
  border-bottom-width: 1px;
  border-bottom-color: #f1f1f1;
`;

const HeaderLeft = styled.View`
  flex-direction: row;
  align-items: center;
`;

const Logo = styled.Image`
  width: 32px;
  height: 32px;
  margin-right: 10px;
`;

const HeaderTitle = styled.Text`
  font-size: 22px;
  font-weight: 800;
  color: #333;
  letter-spacing: -0.5px;
`;

const SearchBtnIcon = styled.Image`
  width: 26px;
  height: 26px;
`;

const LoadingWrapper = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
  padding-top: 100px;
`;

const LoadingText = styled.Text`
  font-size: 13px;
  color: #999;
  font-weight: 600;
  margin-top: 12px;
`;

const EmptyHistoryWrapper = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
  padding: 40px 30px;
  margin-top: 100px;
`;

const EmptyHistoryMainText = styled.Text`
  font-size: 16px;
  color: #666;
  font-weight: 800;
  margin-top: 15px;
`;

const EmptyHistorySubText = styled.Text`
  font-size: 13px;
  color: #BBB;
  font-weight: 500;
  text-align: center;
  margin-top: 8px;
  line-height: 20px;
`;