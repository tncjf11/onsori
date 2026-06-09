import React, { useState, useEffect } from "react";
import {
  ScrollView,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
} from "react-native";
import styled from "styled-components/native";
import { SafeAreaView as SafeAreaContainer } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

import BASE_URL from "../../api/config";

const backIcon = require("../../assets/back_icon.png");
const iconKeyword = require("../../assets/recent_message.png");
const iconCalendar = require("../../assets/icon_calendar.png");
const iconUser = require("../../assets/icon_user.png");
const iconDeviceId = require("../../assets/icon_device_id.png");

export default function AdminHistorySearchResultScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const defaultSearchParams = {
    keyword: "전체",
    dateRange: "전체 기간",
    userId: "전체 사용자",
    deviceId: "전체 디바이스",
    visitTypes: [],
    situations: [],
    keywords: [],
    apiPayload: {},
  };

  const searchParams = route.params?.searchParams || defaultSearchParams;

  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSearchResults();
  }, []);

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

  const normalizeStatus = (value) => {
    return String(value || "")
      .trim()
      .toUpperCase();
  };

  const getStatusText = (item = {}) => {
    const status = normalizeStatus(
      item.status ||
        item.sessionStatus ||
        item.callStatus ||
        item.state ||
        ""
    );

    const connectionStatus = String(item.connectionStatus || "").trim();
    const sttStatus = String(item.sttStatus || "").trim();

    const hasEndedAt = Boolean(
      item.endedAt ||
        item.endTime ||
        item.closedAt ||
        item.completedAt ||
        item.finishedAt
    );

    if (
      hasEndedAt ||
      connectionStatus === "종료" ||
      sttStatus === "완료" ||
      [
        "SUCCESS",
        "CLOSED",
        "ENDED",
        "COMPLETE",
        "COMPLETED",
        "FINISHED",
      ].includes(status)
    ) {
      return "종료 / 완료";
    }

    if (
      connectionStatus === "미응답" ||
      sttStatus === "중단" ||
      ["FAILED", "MISSED", "NO_ANSWER", "CANCELED", "CANCELLED"].includes(
        status
      )
    ) {
      return "미응답 / 중단";
    }

    if (
      connectionStatus === "연결" ||
      ["ONGOING", "OPEN", "CALLING", "TALKING", "ACTIVE", "CONNECTED"].includes(
        status
      )
    ) {
      return "연결 / 진행 중";
    }

    return `${connectionStatus || "확인 필요"} / ${sttStatus || "-"}`;
  };

  const fetchSearchResults = async () => {
    try {
      setIsLoading(true);

      const token = await AsyncStorage.getItem("adminToken");

      if (!token) {
        navigation.navigate("AdminLogin");
        return;
      }

      const payload = searchParams.apiPayload || {};

      let response;

      try {
        response = await axios.get(`${BASE_URL}/api/admin/intercom-logs/search`, {
          params: payload,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (error) {
        response = await axios.get(`${BASE_URL}/api/admin/intercom-logs`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }

      const rawData = extractIntercomLogs(response.data);
      const normalizedData = rawData.map((item, index) => ({
        ...item,
        id: item.id ?? item.logId ?? item.intercomLogId ?? index,
        logId: item.logId ?? item.id ?? item.intercomLogId ?? index,
        sessionId:
          item.sessionId ??
          item.callSessionId ??
          item.intercomSessionId ??
          item.session?.id ??
          null,
      }));

      const filteredData = applyFrontendFilters(normalizedData, searchParams);

      setSearchResults(filteredData);
    } catch (error) {
      console.error("검색 결과 조회 실패:", error?.message);
      Alert.alert("오류", "검색 결과를 불러오지 못했습니다.");
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFrontendFilters = (list, params) => {
    const payload = params.apiPayload || {};

    return list.filter((item) => {
      const targetText = getSearchTargetText(item);

      if (
        payload.keyword &&
        !targetText.includes(String(payload.keyword).toLowerCase())
      ) {
        return false;
      }

      if (
        payload.userId &&
        !String(item.userId || item.providerUserId || item.residentId || "")
          .toLowerCase()
          .includes(String(payload.userId).toLowerCase())
      ) {
        return false;
      }

      if (
        payload.deviceUid &&
        !String(item.deviceUid || item.deviceId || item.device?.deviceUid || "")
          .toLowerCase()
          .includes(String(payload.deviceUid).toLowerCase())
      ) {
        return false;
      }

      if (payload.date && !isSameDate(item, payload.date)) {
        return false;
      }

      const selectedVisitTypes = Array.isArray(params.visitTypes)
        ? params.visitTypes
        : [];

      if (selectedVisitTypes.length > 0) {
        const hasVisitType = selectedVisitTypes.some((tag) =>
          targetText.includes(String(tag).toLowerCase())
        );

        if (!hasVisitType) return false;
      }

      const selectedSituations = Array.isArray(params.situations)
        ? params.situations
        : [];

      if (selectedSituations.length > 0) {
        const hasSituation = selectedSituations.some((tag) => {
          const safeTag = String(tag).toLowerCase();

          if (tag === "미응답") {
            return getStatusText(item) === "미응답 / 중단";
          }

          return targetText.includes(safeTag);
        });

        if (!hasSituation) return false;
      }

      const selectedKeywords = Array.isArray(params.keywords)
        ? params.keywords
        : [];

      if (selectedKeywords.length > 0) {
        const hasKeyword = selectedKeywords.some((tag) =>
          targetText.includes(String(tag).toLowerCase())
        );

        if (!hasKeyword) return false;
      }

      return true;
    });
  };

  const getSearchTargetText = (item) => {
    return [
      item.summary,
      item.visitorText,
      item.residentReply,
      item.refinedText,
      item.content,
      item.message,
      item.transcript,
      item.intent,
      item.category,
      item.deviceUid,
      item.deviceId,
      item.userId,
      item.providerUserId,
      item.residentId,
      item.status,
      item.sessionStatus,
      item.callStatus,
      item.connectionStatus,
      item.sttStatus,
      item.location,
      item.endedAt,
      item.endTime,
      item.closedAt,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  };

  const isSameDate = (item, selectedDate) => {
    const formattedCreatedAt = formatDateOnly(getLogDateValue(item));
    const normalizedSelectedDate = normalizeDateInput(selectedDate);

    if (!formattedCreatedAt || !normalizedSelectedDate) {
      return true;
    }

    return formattedCreatedAt === normalizedSelectedDate;
  };

  const normalizeDateInput = (value) => {
    if (!value) return "";

    const matched = String(value).match(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/);

    if (!matched) return "";

    const [year, month, day] = matched[0].split(/[-/.]/).map(Number);

    if (!year || !month || !day) return "";

    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
      2,
      "0"
    )}`;
  };

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
        .map((item) => Number(String(item).split(".")[0]));

      if (!year || !month || !day) return null;

      return new Date(year, month - 1, day, hour, minute, second);
    } catch {
      return null;
    }
  };

  const formatDateOnly = (isoString) => {
    const date = parseServerDate(isoString);

    if (!date || Number.isNaN(date.getTime())) return "";

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");

    return `${yyyy}-${mm}-${dd}`;
  };

  const formatDateTime = (isoString) => {
    const date = parseServerDate(isoString);

    if (!date || Number.isNaN(date.getTime())) return "";

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");

    return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
  };

  const getItemTitle = (item) => {
    const summary = String(item.summary || "").trim();
    const intent = String(item.intent || "").trim();
    const visitorText = String(item.visitorText || "").trim();
    const content = String(item.content || "").trim();
    const message = String(item.message || "").trim();
    const deviceUid = String(item.deviceUid || "").trim();

    if (summary && summary !== "내용 없음") return summary;
    if (intent) return intent;
    if (visitorText) return visitorText;
    if (content) return content;
    if (message) return message;
    if (deviceUid) return deviceUid;

    return "인터폰 호출 알림";
  };

  const handlePressItem = (item) => {
    navigation.navigate("AdminHistoryDetail", {
      item,
      logId: item.id || item.logId,
      sessionId: item.sessionId,
    });
  };

  return (
    <Container>
      <Header>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <BackIcon source={backIcon} resizeMode="contain" />
        </TouchableOpacity>

        <HeaderTitle>기록 검색 결과</HeaderTitle>

        <View style={{ width: 24 }} />
      </Header>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <SummaryCard>
          <SummaryRow>
            <SummaryIcon source={iconKeyword} resizeMode="contain" />
            <KeywordBadge>
              <KeywordBadgeText>{searchParams.keyword}</KeywordBadgeText>
            </KeywordBadge>
          </SummaryRow>

          <SummaryRow>
            <SummaryIcon source={iconCalendar} resizeMode="contain" />
            <SummaryText>{searchParams.dateRange}</SummaryText>
          </SummaryRow>

          <SummaryRow>
            <SummaryIcon source={iconUser} resizeMode="contain" />
            <SummaryText>{searchParams.userId}</SummaryText>
          </SummaryRow>

          <SummaryRow style={{ marginBottom: 0 }}>
            <SummaryIcon source={iconDeviceId} resizeMode="contain" />
            <SummaryText>{searchParams.deviceId}</SummaryText>
          </SummaryRow>
        </SummaryCard>

        {isLoading ? (
          <LoadingWrapper>
            <ActivityIndicator size="large" color="#1EC949" />
          </LoadingWrapper>
        ) : searchResults.length > 0 ? (
          <ResultCardContainer>
            {searchResults.map((item, index) => {
              const isLast = index === searchResults.length - 1;

              return (
                <TouchableOpacity
                  key={item.id || item.logId || index}
                  activeOpacity={0.7}
                  onPress={() => handlePressItem(item)}
                >
                  <ListItem style={isLast ? { borderBottomWidth: 0 } : {}}>
                    <IconCircle>
                      <Ionicons
                        name="call"
                        size={18}
                        color="#fff"
                        style={{ transform: [{ rotate: "135deg" }] }}
                      />
                    </IconCircle>

                    <ItemContent>
                      <ItemTopRow>
                        <ItemTitle numberOfLines={1}>
                          {getItemTitle(item)}
                        </ItemTitle>
                        <DurationText>{getStatusText(item)}</DurationText>
                      </ItemTopRow>

                      <ItemBottomRow>
                        <KeywordBadge
                          style={{ paddingVertical: 3, paddingHorizontal: 8 }}
                        >
                          <KeywordBadgeText>
                            {item.intent || "호출"}
                          </KeywordBadgeText>
                        </KeywordBadge>

                        <ItemTime>
                          {formatDateTime(getLogDateValue(item))}
                        </ItemTime>
                      </ItemBottomRow>
                    </ItemContent>
                  </ListItem>
                </TouchableOpacity>
              );
            })}
          </ResultCardContainer>
        ) : (
          <EmptyWrapper>
            <EmptyText>설정한 조건에 맞는 기록이 없습니다.</EmptyText>
          </EmptyWrapper>
        )}
      </ScrollView>
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

const SummaryCard = styled.View`
  background-color: #fff;
  margin: 15px 20px;
  padding: 20px;
  border-radius: 20px;
  elevation: 2;
  shadow-color: #000;
  shadow-opacity: 0.04;
  shadow-radius: 8px;
`;

const SummaryRow = styled.View`
  flex-direction: row;
  align-items: center;
  margin-bottom: 14px;
`;

const SummaryIcon = styled.Image`
  width: 22px;
  height: 22px;
  margin-right: 15px;
  tint-color: #666;
`;

const SummaryText = styled.Text`
  font-size: 15px;
  color: #333;
  font-weight: 600;
`;

const KeywordBadge = styled.View`
  background-color: #F4F5F7;
  padding: 4px 10px;
  border-radius: 8px;
`;

const KeywordBadgeText = styled.Text`
  font-size: 13px;
  font-weight: 700;
  color: #888;
`;

const ResultCardContainer = styled.View`
  background-color: #fff;
  margin: 0 20px;
  padding: 10px 20px;
  border-radius: 20px;
  elevation: 2;
  shadow-color: #000;
  shadow-opacity: 0.04;
  shadow-radius: 8px;
`;

const ListItem = styled.View`
  flex-direction: row;
  align-items: center;
  padding: 18px 0;
  border-bottom-width: 1px;
  border-bottom-color: #F0F0F0;
`;

const IconCircle = styled.View`
  width: 44px;
  height: 44px;
  border-radius: 22px;
  background-color: #1EC949;
  justify-content: center;
  align-items: center;
  margin-right: 15px;
`;

const ItemContent = styled.View`
  flex: 1;
`;

const ItemTopRow = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
`;

const ItemTitle = styled.Text`
  flex: 1;
  font-size: 15px;
  font-weight: 700;
  color: #333;
  margin-right: 8px;
`;

const DurationText = styled.Text`
  font-size: 13px;
  color: #A0AEC0;
  font-weight: 600;
`;

const ItemBottomRow = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;

const ItemTime = styled.Text`
  font-size: 13px;
  color: #666;
  font-weight: 500;
`;

const LoadingWrapper = styled.View`
  padding: 40px;
  align-items: center;
`;

const EmptyWrapper = styled.View`
  padding: 60px 20px;
  align-items: center;
`;

const EmptyText = styled.Text`
  font-size: 14px;
  color: #999;
  font-weight: 500;
`;