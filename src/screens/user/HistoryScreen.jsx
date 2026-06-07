import { Ionicons } from "@expo/vector-icons";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import axios from "axios";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView as SafeAreaContainer } from "react-native-safe-area-context";
import styled from "styled-components/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
      const hasExplicitTimezone =
        isoString.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(isoString);

      if (hasExplicitTimezone) {
        return new Date(isoString);
      }

      const normalized = isoString.replace("T", " ");
      const [datePart, timePart = "00:00:00"] = normalized.split(" ");
      const [year, month, day] = datePart.split("-").map(Number);
      const [hour = 0, minute = 0, second = 0] = timePart
        .split(":")
        .map((value) => Number(String(value).split(".")[0]));

      return new Date(year, month - 1, day, hour, minute, second);
    } catch (error) {
      return null;
    }
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
    const parsedDate = parseKstDate(log?.createdAt);
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

      if (response.data?.success && Array.isArray(response.data?.data)) {
        const rawLogs = response.data.data;

        const mappedLogs = [...rawLogs]
          .sort((a, b) => getLogTimeValue(b) - getLogTimeValue(a))
          .map((log) => {
            const refinedSummary =
              log.summary && log.summary.trim() !== "내용 없음"
                ? log.summary.trim()
                : "인터폰 호출 알림";

            return {
              ...log,
              id: log.id,
              logId: log.id,
              sessionId: log.sessionId,
              title: refinedSummary,
              time: formatTimeGap(log.createdAt),
              type: log.intent === "DELIVERY" ? "message" : "bell",
              tags: log.intent ? [log.intent] : ["방문"],
              raw: log,
            };
          });

        setHistoryData(mappedLogs);
      } else {
        setHistoryData([]);
      }
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

/* ================= 스타일 ================= */

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