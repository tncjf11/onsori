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

const logAdminHistoryResult = (message, data) => {
  if (data !== undefined) {
    console.log(`[ADMIN_HISTORY_RESULT] ${message}`, data);
  } else {
    console.log(`[ADMIN_HISTORY_RESULT] ${message}`);
  }
};

export default function AdminHistorySearchResultScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  // =========================================================
  // 기본 검색 정보
  // AdminHistoryScreen 수정본과 이름 통일
  // =========================================================

  const defaultSearchParams = {
    keyword: "전체",
    date: "전체 기간",
    userId: "전체 사용자",
    deviceUid: "전체 디바이스",

    apiPayload: {},

    localFilters: {
      visitTypes: [],
      situations: [],
      keywords: [],
    },

    // 기존 값 호환
    visitTypes: [],
    situations: [],
    keywords: [],
  };

  const searchParams =
    route.params?.searchParams ||
    defaultSearchParams;

  const [searchResults, setSearchResults] =
    useState([]);

  const [isLoading, setIsLoading] =
    useState(true);

  // =========================================================
  // 응답에서 호출 기록 배열 추출
  // =========================================================

  const extractIntercomLogs = (
    responseData
  ) => {
    if (
      Array.isArray(
        responseData?.data
      )
    ) {
      return responseData.data;
    }

    if (
      Array.isArray(responseData)
    ) {
      return responseData;
    }

    if (
      Array.isArray(
        responseData?.content
      )
    ) {
      return responseData.content;
    }

    if (
      Array.isArray(
        responseData?.logs
      )
    ) {
      return responseData.logs;
    }

    if (
      Array.isArray(
        responseData?.items
      )
    ) {
      return responseData.items;
    }

    if (
      Array.isArray(
        responseData?.data?.content
      )
    ) {
      return responseData.data.content;
    }

    if (
      Array.isArray(
        responseData?.data?.logs
      )
    ) {
      return responseData.data.logs;
    }

    if (
      Array.isArray(
        responseData?.data?.items
      )
    ) {
      return responseData.data.items;
    }

    if (
      Array.isArray(
        responseData?.result
      )
    ) {
      return responseData.result;
    }

    if (
      Array.isArray(
        responseData?.data?.result
      )
    ) {
      return responseData.data.result;
    }

    return [];
  };

  // =========================================================
  // 날짜
  // =========================================================

  const getLogDateValue = (
    item = {}
  ) => {
    return (
      item.createdAt ||
      item.startedAt ||
      item.startTime ||
      item.endedAt ||
      item.endTime ||
      item.closedAt ||
      item.completedAt ||
      item.finishedAt ||
      item.updatedAt ||
      item.timestamp ||
      item.time ||
      ""
    );
  };

  const parseServerDate = (
    isoString
  ) => {
    if (!isoString) {
      return null;
    }

    try {
      const stringValue =
        String(isoString).trim();

      const hasExplicitTimezone =
        stringValue.endsWith("Z") ||
        /[+-]\d{2}:\d{2}$/.test(
          stringValue
        );

      if (hasExplicitTimezone) {
        const date =
          new Date(stringValue);

        return Number.isNaN(
          date.getTime()
        )
          ? null
          : date;
      }

      /**
       * 백엔드 LocalDateTime
       * timezone 없는 값을 기기 로컬시간으로 처리
       */
      const normalized =
        stringValue.replace(
          "T",
          " "
        );

      const [
        datePart,
        timePart = "00:00:00",
      ] = normalized.split(" ");

      const [year, month, day] =
        datePart
          .split("-")
          .map(Number);

      const [
        hour = 0,
        minute = 0,
        second = 0,
      ] = timePart
        .split(":")
        .map((item) =>
          Number(
            String(item).split(
              "."
            )[0]
          )
        );

      if (
        !year ||
        !month ||
        !day
      ) {
        return null;
      }

      return new Date(
        year,
        month - 1,
        day,
        hour,
        minute,
        second
      );
    } catch {
      return null;
    }
  };

  const formatDateTime = (
    isoString
  ) => {
    const date =
      parseServerDate(
        isoString
      );

    if (
      !date ||
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "";
    }

    const yyyy =
      date.getFullYear();

    const mm = String(
      date.getMonth() + 1
    ).padStart(2, "0");

    const dd = String(
      date.getDate()
    ).padStart(2, "0");

    const hh = String(
      date.getHours()
    ).padStart(2, "0");

    const min = String(
      date.getMinutes()
    ).padStart(2, "0");

    return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
  };

  const getSortTime = (
    item = {}
  ) => {
    const date =
      parseServerDate(
        getLogDateValue(item)
      );

    if (
      !date ||
      Number.isNaN(
        date.getTime()
      )
    ) {
      return 0;
    }

    return date.getTime();
  };

  // =========================================================
  // 상태
  // =========================================================

  const normalizeStatus = (
    value
  ) => {
    return String(
      value || ""
    )
      .trim()
      .toUpperCase();
  };

  const getStatusText = (
    item = {}
  ) => {
    const status =
      normalizeStatus(
        item.status ||
          item.sessionStatus ||
          item.callStatus ||
          item.state ||
          ""
      );

    const connectionStatus =
      String(
        item.connectionStatus ||
          ""
      ).trim();

    const sttStatus =
      String(
        item.sttStatus ||
          ""
      ).trim();

    const hasEndedAt =
      Boolean(
        item.endedAt ||
          item.endTime ||
          item.closedAt ||
          item.completedAt ||
          item.finishedAt
      );

    if (
      hasEndedAt ||
      connectionStatus ===
        "종료" ||
      sttStatus ===
        "완료" ||
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
      connectionStatus ===
        "미응답" ||
      sttStatus ===
        "중단" ||
      [
        "FAILED",
        "MISSED",
        "NO_ANSWER",
        "CANCELED",
        "CANCELLED",
      ].includes(status)
    ) {
      return "미응답 / 중단";
    }

    if (
      connectionStatus ===
        "연결" ||
      [
        "ONGOING",
        "OPEN",
        "CALLING",
        "TALKING",
        "ACTIVE",
        "CONNECTED",
      ].includes(status)
    ) {
      return "연결 / 진행 중";
    }

    return `${
      connectionStatus ||
      "확인 필요"
    } / ${
      sttStatus || "-"
    }`;
  };

  // =========================================================
  // 로컬 필터용 전체 텍스트
  // =========================================================

  const getSearchTargetText = (
    item = {}
  ) => {
    return [
      item.summary,
      item.visitorText,
      item.residentReply,
      item.refinedText,
      item.originalText,
      item.content,
      item.message,
      item.transcript,
      item.intent,
      item.category,
      item.deviceUid,
      item.status,
      item.sessionStatus,
      item.callStatus,
      item.connectionStatus,
      item.sttStatus,
      item.location,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  };

  // =========================================================
  // 서버가 지원하지 않는 UI 필터만 프론트에서 적용
  //
  // ★ 중요
  //
  // 아래 항목은 여기서 다시 필터링하지 않는다.
  //
  // keyword
  // userId
  // deviceUid
  // date
  //
  // 이미 서버 /search가 처리했기 때문.
  //
  // 특히 IntercomLogResponse에 userId가 없을 수 있으므로
  // 프론트에서 userId를 다시 검사하면 정상 결과가 전부 사라짐.
  // =========================================================

  const applyLocalFilters = (
    list
  ) => {
    const localFilters =
      searchParams.localFilters ||
      {};

    const selectedVisitTypes =
      Array.isArray(
        localFilters.visitTypes
      )
        ? localFilters.visitTypes
        : Array.isArray(
            searchParams.visitTypes
          )
          ? searchParams.visitTypes
          : [];

    const selectedSituations =
      Array.isArray(
        localFilters.situations
      )
        ? localFilters.situations
        : Array.isArray(
            searchParams.situations
          )
          ? searchParams.situations
          : [];

    const selectedKeywords =
      Array.isArray(
        localFilters.keywords
      )
        ? localFilters.keywords
        : Array.isArray(
            searchParams.keywords
          )
          ? searchParams.keywords
          : [];

    return list.filter(
      (item) => {
        const targetText =
          getSearchTargetText(
            item
          );

        // =============================================
        // 방문 유형
        // =============================================

        if (
          selectedVisitTypes.length >
          0
        ) {
          const hasVisitType =
            selectedVisitTypes.some(
              (tag) =>
                targetText.includes(
                  String(
                    tag
                  ).toLowerCase()
                )
            );

          if (!hasVisitType) {
            return false;
          }
        }

        // =============================================
        // 상황 성격
        // =============================================

        if (
          selectedSituations.length >
          0
        ) {
          const hasSituation =
            selectedSituations.some(
              (tag) => {
                const safeTag =
                  String(
                    tag
                  ).toLowerCase();

                /**
                 * 미응답은 상태값으로도 판정
                 */
                if (
                  tag === "미응답"
                ) {
                  return (
                    getStatusText(
                      item
                    ) ===
                    "미응답 / 중단"
                  );
                }

                return targetText.includes(
                  safeTag
                );
              }
            );

          if (
            !hasSituation
          ) {
            return false;
          }
        }

        // =============================================
        // 세부 키워드
        // =============================================

        if (
          selectedKeywords.length >
          0
        ) {
          /**
           * 여러 개 선택했을 경우
           * 하나라도 포함되면 표시 (OR)
           */
          const hasKeyword =
            selectedKeywords.some(
              (tag) =>
                targetText.includes(
                  String(
                    tag
                  ).toLowerCase()
                )
            );

          if (!hasKeyword) {
            return false;
          }
        }

        return true;
      }
    );
  };

  // =========================================================
  // 검색 API
  // =========================================================

  const fetchSearchResults =
    async () => {
      try {
        setIsLoading(true);

        const token =
          await AsyncStorage.getItem(
            "adminToken"
          );

        if (!token) {
          Alert.alert(
            "로그인 필요",
            "관리자 로그인이 필요합니다.",
            [
              {
                text: "확인",
                onPress: () => {
                  navigation.reset({
                    index: 0,
                    routes: [
                      {
                        name:
                          "AdminLogin",
                      },
                    ],
                  });
                },
              },
            ]
          );

          return;
        }

        /**
         * AdminHistoryScreen에서
         * 백엔드가 실제 지원하는 값만 만들어서 넘겨줌.
         *
         * 예:
         *
         * {
         *   keyword: "택배",
         *   date: "2026-08-11",
         *   userId: 3,
         *   deviceUid: "DEVICE-001"
         * }
         */
        const payload =
          searchParams.apiPayload ||
          {};

        logAdminHistoryResult(
          "검색 API 요청",
          payload
        );

        /**
         * ★ 검색 실패했다고 전체 로그 API로 fallback 하지 않는다.
         *
         * 기존 코드에서는 /search가 400이어도
         * /admin/intercom-logs 전체를 받아온 뒤
         * 프론트에서 억지로 필터링했음.
         *
         * 특히 userId는 응답 DTO에 없어서
         * 결과를 제대로 복구할 수도 없음.
         *
         * API 오류는 오류로 표시하는 게 맞음.
         */
        const response =
          await axios.get(
            `${BASE_URL}/api/admin/intercom-logs/search`,
            {
              params: payload,

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },

              timeout: 10000,
            }
          );

        logAdminHistoryResult(
          "검색 API 응답",
          {
            status:
              response.status,

            success:
              response.data
                ?.success,
          }
        );

        const rawData =
          extractIntercomLogs(
            response.data
          );

        /**
         * 화면에서 공통적으로 사용할 ID 정리
         */
        const normalizedData =
          rawData.map(
            (
              item,
              index
            ) => ({
              ...item,

              id:
                item.id ??
                item.logId ??
                item.intercomLogId ??
                index,

              logId:
                item.logId ??
                item.id ??
                item.intercomLogId ??
                index,

              sessionId:
                item.sessionId ??
                item.callSessionId ??
                item.intercomSessionId ??
                item.session
                  ?.id ??
                null,
            })
          );

        /**
         * 최신 순 정렬
         */
        const sortedData =
          normalizedData.sort(
            (a, b) =>
              getSortTime(b) -
              getSortTime(a)
          );

        /**
         * 서버가 지원하지 않는 UI 필터만 적용
         */
        const filteredData =
          applyLocalFilters(
            sortedData
          );

        logAdminHistoryResult(
          "검색 결과 처리 완료",
          {
            serverCount:
              normalizedData.length,

            displayedCount:
              filteredData.length,

            localFilters:
              searchParams.localFilters,
          }
        );

        setSearchResults(
          filteredData
        );
      } catch (error) {
        const status =
          error.response
            ?.status;

        const serverError =
          error.response?.data
            ?.message ||
          error.response?.data
            ?.error ||
          error.message;

        console.error(
          "[ADMIN_HISTORY_RESULT] 검색 결과 조회 실패:",
          {
            status,
            error:
              serverError,
          }
        );

        setSearchResults([]);

        if (
          status === 401 ||
          status === 403
        ) {
          await AsyncStorage.removeItem(
            "adminToken"
          );

          Alert.alert(
            "로그인 만료",
            "관리자 로그인 정보가 만료되었습니다.",
            [
              {
                text: "확인",

                onPress: () => {
                  navigation.reset({
                    index: 0,
                    routes: [
                      {
                        name:
                          "AdminLogin",
                      },
                    ],
                  });
                },
              },
            ]
          );

          return;
        }

        if (
          status === 400
        ) {
          Alert.alert(
            "검색 조건 오류",
            serverError ||
              "검색 조건을 확인해주세요."
          );

          return;
        }

        Alert.alert(
          "오류",
          serverError ||
            "검색 결과를 불러오지 못했습니다."
        );
      } finally {
        setIsLoading(false);
      }
    };

  // =========================================================
  // 화면 진입 / 검색조건 변경
  // =========================================================

  useEffect(() => {
    fetchSearchResults();
  }, [
    route.params?.refreshKey,
  ]);

  // =========================================================
  // 제목
  // =========================================================

  const getItemTitle = (
    item = {}
  ) => {
    const summary =
      String(
        item.summary || ""
      ).trim();

    const intent =
      String(
        item.intent || ""
      ).trim();

    const visitorText =
      String(
        item.visitorText ||
          ""
      ).trim();

    const content =
      String(
        item.content || ""
      ).trim();

    const message =
      String(
        item.message || ""
      ).trim();

    const deviceUid =
      String(
        item.deviceUid ||
          ""
      ).trim();

    if (
      summary &&
      summary !==
        "내용 없음"
    ) {
      return summary;
    }

    if (intent) {
      return intent;
    }

    if (visitorText) {
      return visitorText;
    }

    if (content) {
      return content;
    }

    if (message) {
      return message;
    }

    if (deviceUid) {
      return deviceUid;
    }

    return "인터폰 호출 알림";
  };

  // =========================================================
  // 상세 화면 이동
  // =========================================================

  const handlePressItem = (
    item
  ) => {
    logAdminHistoryResult(
      "상세 화면 이동",
      {
        logId:
          item.logId ||
          item.id,

        sessionId:
          item.sessionId,
      }
    );

    navigation.navigate(
      "AdminHistoryDetail",
      {
        item,

        logId:
          item.logId ||
          item.id,

        sessionId:
          item.sessionId,
      }
    );
  };

  // =========================================================
  // 화면
  // =========================================================

  return (
    <Container>
      {/* ================= HEADER ================= */}

      <Header>
        <TouchableOpacity
          onPress={() =>
            navigation.goBack()
          }
        >
          <BackIcon
            source={backIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <HeaderTitle>
          기록 검색 결과
        </HeaderTitle>

        <View
          style={{
            width: 24,
          }}
        />
      </Header>

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={{
          paddingBottom: 40,
        }}
      >
        {/* ================= 검색 조건 ================= */}

        <SummaryCard>
          {/* 키워드 */}

          <SummaryRow>
            <SummaryIcon
              source={
                iconKeyword
              }
              resizeMode="contain"
            />

            <KeywordBadge>
              <KeywordBadgeText>
                {searchParams.keyword ||
                  "전체"}
              </KeywordBadgeText>
            </KeywordBadge>
          </SummaryRow>

          {/* 날짜 */}

          <SummaryRow>
            <SummaryIcon
              source={
                iconCalendar
              }
              resizeMode="contain"
            />

            <SummaryText>
              {searchParams.date ||
                "전체 기간"}
            </SummaryText>
          </SummaryRow>

          {/* 사용자 ID */}

          <SummaryRow>
            <SummaryIcon
              source={
                iconUser
              }
              resizeMode="contain"
            />

            <SummaryText>
              {searchParams.userId ||
                "전체 사용자"}
            </SummaryText>
          </SummaryRow>

          {/* Device UID */}

          <SummaryRow
            style={{
              marginBottom: 0,
            }}
          >
            <SummaryIcon
              source={
                iconDeviceId
              }
              resizeMode="contain"
            />

            <SummaryText>
              {searchParams.deviceUid ||
                "전체 디바이스"}
            </SummaryText>
          </SummaryRow>
        </SummaryCard>

        {/* ================= RESULT ================= */}

        {isLoading ? (
          <LoadingWrapper>
            <ActivityIndicator
              size="large"
              color="#1EC949"
            />
          </LoadingWrapper>
        ) : searchResults.length >
          0 ? (
          <ResultCardContainer>
            {searchResults.map(
              (
                item,
                index
              ) => {
                const isLast =
                  index ===
                  searchResults.length -
                    1;

                return (
                  <TouchableOpacity
                    key={
                      item.logId ??
                      item.id ??
                      index
                    }
                    activeOpacity={
                      0.7
                    }
                    onPress={() =>
                      handlePressItem(
                        item
                      )
                    }
                  >
                    <ListItem
                      style={
                        isLast
                          ? {
                              borderBottomWidth: 0,
                            }
                          : {}
                      }
                    >
                      <IconCircle>
                        <Ionicons
                          name="call"
                          size={18}
                          color="#fff"
                          style={{
                            transform: [
                              {
                                rotate:
                                  "135deg",
                              },
                            ],
                          }}
                        />
                      </IconCircle>

                      <ItemContent>
                        <ItemTopRow>
                          <ItemTitle
                            numberOfLines={
                              1
                            }
                          >
                            {getItemTitle(
                              item
                            )}
                          </ItemTitle>

                          <DurationText>
                            {getStatusText(
                              item
                            )}
                          </DurationText>
                        </ItemTopRow>

                        <ItemBottomRow>
                          <KeywordBadge
                            style={{
                              paddingVertical: 3,
                              paddingHorizontal: 8,
                            }}
                          >
                            <KeywordBadgeText>
                              {item.intent ||
                                "호출"}
                            </KeywordBadgeText>
                          </KeywordBadge>

                          <ItemTime>
                            {formatDateTime(
                              getLogDateValue(
                                item
                              )
                            )}
                          </ItemTime>
                        </ItemBottomRow>
                      </ItemContent>
                    </ListItem>
                  </TouchableOpacity>
                );
              }
            )}
          </ResultCardContainer>
        ) : (
          <EmptyWrapper>
            <Ionicons
              name="search-outline"
              size={38}
              color="#CCC"
            />

            <EmptyText>
              설정한 조건에 맞는 기록이 없습니다.
            </EmptyText>
          </EmptyWrapper>
        )}
      </ScrollView>
    </Container>
  );
}

// =========================================================
// STYLE
// =========================================================

const Container = styled(
  SafeAreaContainer
)`
  flex: 1;
  background-color: #f4f5f7;
`;

const Header = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background-color: #f4f5f7;
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
  background-color: #f4f5f7;
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
  border-bottom-color: #f0f0f0;
`;

const IconCircle = styled.View`
  width: 44px;
  height: 44px;
  border-radius: 22px;
  background-color: #1ec949;
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
  color: #a0aec0;
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
  margin-top: 12px;
  text-align: center;
`;