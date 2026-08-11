import React, { useState, useEffect, useRef } from "react";
import {
  ScrollView,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Modal,
  Alert,
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

// =========================================================
// Calendar locale
// =========================================================

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

  dayNames: [
    "일요일",
    "월요일",
    "화요일",
    "수요일",
    "목요일",
    "금요일",
    "토요일",
  ],

  dayNamesShort: [
    "일",
    "월",
    "화",
    "수",
    "목",
    "금",
    "토",
  ],

  today: "오늘",
};

LocaleConfig.defaultLocale = "kr";

// =========================================================
// Session status
// =========================================================

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
  const [isLoading, setIsLoading] = useState(true);

  const [isDateModalVisible, setIsDateModalVisible] =
    useState(false);

  /**
   * today
   * date
   */
  const [filterMode, setFilterMode] = useState("today");

  const isMountedRef = useRef(true);

  // =========================================================
  // 날짜
  // =========================================================

  const formatLocalDate = (date) => {
    const yyyy = date.getFullYear();

    const mm = String(
      date.getMonth() + 1
    ).padStart(2, "0");

    const dd = String(
      date.getDate()
    ).padStart(2, "0");

    return `${yyyy}-${mm}-${dd}`;
  };

  /**
   * 현재 기기 기준 오늘 날짜
   *
   * 한국에서 앱을 사용한다는 전제에서는
   * YYYY-MM-DD 형태의 오늘 날짜가 들어감.
   */
  const getTodayKST = () => {
    return formatLocalDate(
      new Date()
    );
  };

  const [selectedDate, setSelectedDate] =
    useState(getTodayKST());

  // =========================================================
  // 서버 날짜 파싱
  // =========================================================

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
       * 서버 LocalDateTime
       *
       * timezone 없는 값을
       * 현재 기기 로컬시간으로 처리
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
        .map((value) =>
          Number(
            String(value).split(
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

  const formatLogTime = (
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
      return "--:--";
    }

    const hh = String(
      date.getHours()
    ).padStart(2, "0");

    const mm = String(
      date.getMinutes()
    ).padStart(2, "0");

    return `${hh}:${mm}`;
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

  const normalizeKoreanStatus = (
    value
  ) => {
    return String(
      value || ""
    ).trim();
  };

  const getStatusCandidates = (
    item = {}
  ) => {
    return [
      item.status,
      item.sessionStatus,
      item.callStatus,
      item.state,
      item.connectionState,
    ]
      .map(
        normalizeStatus
      )
      .filter(Boolean);
  };

  const hasEndedTime = (
    item = {}
  ) => {
    return Boolean(
      item.endedAt ||
        item.endTime ||
        item.closedAt ||
        item.completedAt ||
        item.finishedAt
    );
  };

  const isEndedLog = (
    item = {}
  ) => {
    const statuses =
      getStatusCandidates(
        item
      );

    if (hasEndedTime(item)) {
      return true;
    }

    if (
      statuses.some(
        (status) =>
          ENDED_SESSION_STATUSES.has(
            status
          )
      )
    ) {
      return true;
    }

    const connectionStatus =
      normalizeKoreanStatus(
        item.connectionStatus
      );

    const sttStatus =
      normalizeKoreanStatus(
        item.sttStatus
      );

    if (
      connectionStatus ===
        "종료" ||
      sttStatus === "완료"
    ) {
      return true;
    }

    return false;
  };

  const isFailedLog = (
    item = {}
  ) => {
    const statuses =
      getStatusCandidates(
        item
      );

    if (
      statuses.some(
        (status) =>
          FAILED_SESSION_STATUSES.has(
            status
          )
      )
    ) {
      return true;
    }

    const connectionStatus =
      normalizeKoreanStatus(
        item.connectionStatus
      );

    const sttStatus =
      normalizeKoreanStatus(
        item.sttStatus
      );

    if (
      connectionStatus ===
        "미응답" ||
      sttStatus === "중단"
    ) {
      return true;
    }

    return false;
  };

  const isActiveLog = (
    item = {}
  ) => {
    const statuses =
      getStatusCandidates(
        item
      );

    if (
      statuses.some(
        (status) =>
          ACTIVE_SESSION_STATUSES.has(
            status
          )
      )
    ) {
      return true;
    }

    const connectionStatus =
      normalizeKoreanStatus(
        item.connectionStatus
      );

    const sttStatus =
      normalizeKoreanStatus(
        item.sttStatus
      );

    if (
      connectionStatus ===
        "연결" ||
      sttStatus ===
        "진행 중" ||
      sttStatus ===
        "진행중"
    ) {
      return true;
    }

    return false;
  };

  const getStatusLabels = (
    item = {}
  ) => {
    /**
     * 종료 우선
     */
    if (isEndedLog(item)) {
      return {
        connStatus: "종료",
        sttStatus: "완료",
      };
    }

    /**
     * 실패 / 미응답
     */
    if (isFailedLog(item)) {
      return {
        connStatus: "미응답",
        sttStatus: "중단",
      };
    }

    /**
     * 진행 중
     */
    if (isActiveLog(item)) {
      const backendSttStatus =
        normalizeKoreanStatus(
          item.sttStatus
        );

      return {
        connStatus: "연결",

        sttStatus:
          backendSttStatus ===
          "완료"
            ? "완료"
            : "진행 중",
      };
    }

    /**
     * 그 외에는 서버 값을 그대로 사용
     */
    return {
      connStatus:
        normalizeKoreanStatus(
          item.connectionStatus
        ) ||
        "확인 필요",

      sttStatus:
        normalizeKoreanStatus(
          item.sttStatus
        ) ||
        "-",
    };
  };

  // =========================================================
  // 응답 배열 추출
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
  // ID
  // =========================================================

  const getLogId = (
    item = {},
    index = 0
  ) => {
    return (
      item.logId ??
      item.id ??
      item.intercomLogId ??
      index
    );
  };

  const getSessionId = (
    item = {}
  ) => {
    return (
      item.sessionId ??
      item.callSessionId ??
      item.intercomSessionId ??
      item.session?.id ??
      null
    );
  };

  const getDeviceUid = (
    item = {}
  ) => {
    /**
     * 가능하면 deviceUid만 사용.
     *
     * deviceId는 DB 숫자 ID일 수도 있어서
     * fallback 정도로만 둔다.
     */
    return (
      item.deviceUid ||
      item.device?.deviceUid ||
      item.deviceId ||
      "알 수 없음"
    );
  };

  // =========================================================
  // 로그 normalize
  // =========================================================

  const normalizeLogItem = (
    item = {},
    index = 0
  ) => {
    const logId =
      getLogId(
        item,
        index
      );

    const sessionId =
      getSessionId(
        item
      );

    return {
      ...item,

      id: logId,

      logId,

      sessionId,

      deviceUid:
        getDeviceUid(item),

      createdAt:
        getLogDateValue(
          item
        ),

      raw: item,
    };
  };

  const sortLogs = (
    targetLogs
  ) => {
    return [
      ...targetLogs,
    ]
      .map(
        normalizeLogItem
      )
      .sort(
        (a, b) =>
          getSortTime(b) -
          getSortTime(a)
      );
  };

  // =========================================================
  // 관리자 인증 만료
  // =========================================================

  const handleAdminAuthExpired =
    async () => {
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
    };

  // =========================================================
  // 호출 로그 조회
  // =========================================================

  const fetchIntercomLogs =
    async () => {
      try {
        if (
          isMountedRef.current
        ) {
          setIsLoading(true);
        }

        const token =
          await AsyncStorage.getItem(
            "adminToken"
          );

        if (!token) {
          logAdminCallLog(
            "adminToken 없음 - 로그인 화면 이동"
          );

          navigation.reset({
            index: 0,

            routes: [
              {
                name:
                  "AdminLogin",
              },
            ],
          });

          return;
        }

        /**
         * ★ 핵심 수정
         *
         * today 모드일 때도 반드시 date를 보낸다.
         *
         * 기존:
         *
         * filterMode === "date" 일 때만 date 전송
         *
         * → today면 params 없음
         * → 백엔드가 전체 로그를 반환할 수 있음.
         *
         * 수정:
         *
         * today → 오늘 날짜
         * date  → selectedDate
         */
        const requestDate =
          filterMode ===
          "today"
            ? getTodayKST()
            : selectedDate;

        const config = {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },

          params: {
            date:
              requestDate,
          },

          timeout: 10000,
        };

        logAdminCallLog(
          "호출 로그 조회 요청",
          {
            endpoint:
              "/api/admin/intercom-logs/search",

            mode:
              filterMode,

            dateParam:
              requestDate,
          }
        );

        const response =
          await axios.get(
            `${BASE_URL}/api/admin/intercom-logs/search`,
            config
          );

        const rawLogs =
          extractIntercomLogs(
            response.data
          );

        const sortedLogs =
          sortLogs(
            rawLogs
          );

        logAdminCallLog(
          "호출 로그 조회 성공",
          {
            success:
              response.data
                ?.success,

            mode:
              filterMode,

            requestDate,

            selectedDate,

            rawCount:
              rawLogs.length,

            sortedCount:
              sortedLogs.length,
          }
        );

        if (
          isMountedRef.current
        ) {
          setLogs(
            sortedLogs
          );
        }
      } catch (error) {
        const status =
          error.response
            ?.status;

        const serverError =
          error.response?.data
            ?.message ||
          error.response?.data
            ?.error ||
          JSON.stringify(
            error.response?.data
          ) ||
          error.message;

        logAdminCallLog(
          "호출 로그 조회 실패",
          {
            status,
            error:
              serverError,
          }
        );

        if (
          isMountedRef.current
        ) {
          setLogs([]);
        }

        if (
          status === 401 ||
          status === 403
        ) {
          await handleAdminAuthExpired();

          return;
        }

        if (
          status === 400
        ) {
          Alert.alert(
            "조회 조건 오류",
            serverError ||
              "날짜 정보를 확인해주세요."
          );

          return;
        }

        Alert.alert(
          "조회 실패",
          serverError ||
            "호출 기록을 불러오지 못했습니다."
        );
      } finally {
        if (
          isMountedRef.current
        ) {
          setIsLoading(false);
        }
      }
    };

  // =========================================================
  // Mount / Unmount
  // =========================================================

  useEffect(() => {
    isMountedRef.current =
      true;

    return () => {
      isMountedRef.current =
        false;
    };
  }, []);

  // =========================================================
  // 화면 진입 / 날짜 변경
  // =========================================================

  useEffect(() => {
    if (isFocused) {
      fetchIntercomLogs();
    }
  }, [
    isFocused,
    selectedDate,
    filterMode,
  ]);

  // =========================================================
  // 오늘
  // =========================================================

  const handleSelectToday = () => {
    const today =
      getTodayKST();

    logAdminCallLog(
      "오늘 호출 로그 선택",
      {
        previousMode:
          filterMode,

        previousDate:
          selectedDate,

        nextDate:
          today,
      }
    );

    setFilterMode(
      "today"
    );

    setSelectedDate(
      today
    );

    setIsDateModalVisible(
      false
    );
  };

  // =========================================================
  // 특정 날짜
  // =========================================================

  const handleSelectDate = (
    day
  ) => {
    if (!day?.dateString) {
      return;
    }

    logAdminCallLog(
      "날짜 선택",
      {
        previousDate:
          selectedDate,

        nextDate:
          day.dateString,
      }
    );

    setSelectedDate(
      day.dateString
    );

    setFilterMode(
      "date"
    );

    setIsDateModalVisible(
      false
    );
  };

  // =========================================================
  // 상세 페이지
  // =========================================================

  const handlePressLog = (
    item
  ) => {
    logAdminCallLog(
      "호출 상세 이동",
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
        logId:
          item.logId ||
          item.id,

        sessionId:
          item.sessionId,

        item,
      }
    );
  };

  // =========================================================
  // UI 문구
  // =========================================================

  const getSummaryTitle = () => {
    if (
      filterMode ===
      "today"
    ) {
      return "오늘 호출 수";
    }

    return `${selectedDate.replace(
      /-/g,
      "."
    )} 호출 수`;
  };

  const getEmptyMessage = () => {
    if (
      filterMode ===
      "today"
    ) {
      return "오늘 기록이 없습니다.";
    }

    return "해당 날짜의 기록이 없습니다.";
  };

  // =========================================================
  // UI
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
          호출 로그
        </HeaderTitle>

        <View
          style={{
            width: 24,
          }}
        />
      </Header>

      {/* ================= DATE CONTROL ================= */}

      <DateControlSection>
        <TodaySelectButton
          isActive={
            filterMode ===
            "today"
          }
          onPress={
            handleSelectToday
          }
          activeOpacity={0.8}
        >
          <TodaySelectButtonText
            isActive={
              filterMode ===
              "today"
            }
          >
            오늘
          </TodaySelectButtonText>
        </TodaySelectButton>

        <DateDisplayBox
          isActive={
            filterMode ===
            "date"
          }
        >
          <DateDisplayText
            isActive={
              filterMode ===
              "date"
            }
          >
            {selectedDate.replace(
              /-/g,
              "/"
            )}
          </DateDisplayText>
        </DateDisplayBox>

        <DateSelectButton
          isActive={
            filterMode ===
            "date"
          }
          onPress={() =>
            setIsDateModalVisible(
              true
            )
          }
          activeOpacity={0.8}
        >
          <DateSelectButtonText>
            날짜 선택
          </DateSelectButtonText>
        </DateSelectButton>
      </DateControlSection>

      {/* ================= LOG ================= */}

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
      >
        {isLoading ? (
          <ActivityIndicator
            size="large"
            color="#1EC949"
            style={{
              marginTop: 50,
            }}
          />
        ) : (
          <LogCard>
            <LogCardHeader>
              <SummaryTitle>
                {getSummaryTitle()}
              </SummaryTitle>

              <SummaryCount>
                {logs.length}회
              </SummaryCount>
            </LogCardHeader>

            {/* TABLE HEADER */}

            <TableHeader>
              <HeaderText
                style={{
                  flex: 1.2,
                }}
              >
                No.
              </HeaderText>

              <HeaderText
                style={{
                  flex: 1.5,
                }}
              >
                시간
              </HeaderText>

              <HeaderText
                style={{
                  flex: 2.8,
                }}
              >
                장치 ID
              </HeaderText>

              <HeaderText
                style={{
                  flex: 1.8,
                }}
              >
                연결 상태
              </HeaderText>

              <HeaderText
                style={{
                  flex: 1.5,
                }}
              >
                STT
              </HeaderText>
            </TableHeader>

            {/* TABLE CONTENT */}

            {logs.length > 0 ? (
              logs.map(
                (
                  item,
                  idx
                ) => {
                  const reverseNo =
                    String(
                      logs.length -
                        idx
                    ).padStart(
                      3,
                      "0"
                    );

                  const {
                    connStatus,
                    sttStatus,
                  } =
                    getStatusLabels(
                      item
                    );

                  return (
                    <TouchableOpacity
                      key={
                        item.logId ??
                        item.id ??
                        idx
                      }
                      activeOpacity={
                        0.6
                      }
                      onPress={() =>
                        handlePressLog(
                          item
                        )
                      }
                    >
                      <TableRow>
                        <RowText
                          style={{
                            flex: 1.2,
                          }}
                        >
                          {
                            reverseNo
                          }
                        </RowText>

                        <RowText
                          style={{
                            flex: 1.5,
                          }}
                        >
                          {formatLogTime(
                            item
                          )}
                        </RowText>

                        <RowText
                          style={{
                            flex: 2.8,
                          }}
                          numberOfLines={
                            1
                          }
                        >
                          {item.deviceUid ||
                            "알 수 없음"}
                        </RowText>

                        <RowText
                          style={{
                            flex: 1.8,
                          }}
                        >
                          {
                            connStatus
                          }
                        </RowText>

                        <RowText
                          style={{
                            flex: 1.5,
                          }}
                        >
                          {
                            sttStatus
                          }
                        </RowText>
                      </TableRow>
                    </TouchableOpacity>
                  );
                }
              )
            ) : (
              <EmptyWrapper>
                <Ionicons
                  name="calendar-outline"
                  size={36}
                  color="#DDD"
                />

                <EmptyText>
                  {getEmptyMessage()}
                </EmptyText>
              </EmptyWrapper>
            )}
          </LogCard>
        )}
      </ScrollView>

      {/* ================= CALENDAR MODAL ================= */}

      <Modal
        transparent
        visible={
          isDateModalVisible
        }
        animationType="fade"
        onRequestClose={() =>
          setIsDateModalVisible(
            false
          )
        }
      >
        <ModalOverlay
          activeOpacity={1}
          onPress={() =>
            setIsDateModalVisible(
              false
            )
          }
        >
          <CalendarContainer
            activeOpacity={1}
          >
            <CalendarHeader>
              <ModalTitle>
                날짜 선택
              </ModalTitle>

              <TouchableOpacity
                onPress={() =>
                  setIsDateModalVisible(
                    false
                  )
                }
              >
                <Ionicons
                  name="close"
                  size={26}
                  color="#333"
                />
              </TouchableOpacity>
            </CalendarHeader>

            <Calendar
              current={
                selectedDate
              }
              onDayPress={
                handleSelectDate
              }
              markedDates={{
                [selectedDate]: {
                  selected:
                    true,

                  disableTouchEvent:
                    true,
                },
              }}
              theme={{
                backgroundColor:
                  "#ffffff",

                calendarBackground:
                  "#ffffff",

                textSectionTitleColor:
                  "#b6c1cd",

                selectedDayBackgroundColor:
                  "#1EC949",

                selectedDayTextColor:
                  "#ffffff",

                todayTextColor:
                  "#1EC949",

                dayTextColor:
                  "#2d4150",

                textDisabledColor:
                  "#d9e1e8",

                arrowColor:
                  "#1EC949",

                monthTextColor:
                  "#333",

                textMonthFontWeight:
                  "bold",

                textDayFontSize:
                  15,

                textMonthFontSize:
                  18,

                textDayHeaderFontSize:
                  14,
              }}
            />
          </CalendarContainer>
        </ModalOverlay>
      </Modal>
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

const DateControlSection = styled.View`
  flex-direction: row;
  align-items: center;
  padding: 10px 20px 20px;
`;

const TodaySelectButton = styled.TouchableOpacity`
  padding: 8px 15px;
  border-width: 1.5px;
  border-color: #1ec949;
  border-radius: 20px;
  background-color: ${(props) =>
    props.isActive
      ? "#1EC949"
      : "#fff"};
  margin-right: 8px;
`;

const TodaySelectButtonText = styled.Text`
  font-size: 14px;
  font-weight: 700;
  color: ${(props) =>
    props.isActive
      ? "#fff"
      : "#1EC949"};
`;

const DateDisplayBox = styled.View`
  padding: 8px 14px;
  border-width: 1.5px;
  border-color: #1ec949;
  border-radius: 20px;
  background-color: ${(props) =>
    props.isActive
      ? "#fff"
      : "#F8F8F8"};
  margin-right: 8px;
`;

const DateDisplayText = styled.Text`
  font-size: 14px;
  font-weight: 700;
  color: ${(props) =>
    props.isActive
      ? "#1EC949"
      : "#999"};
`;

const DateSelectButton = styled.TouchableOpacity`
  padding: 9px 16px;
  background-color: ${(props) =>
    props.isActive
      ? "#1EC949"
      : "#D1D5DB"};
  border-radius: 20px;
`;

const DateSelectButtonText = styled.Text`
  font-size: 14px;
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
  border-bottom-color: #f0f0f0;
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
  border-bottom-color: #f0f0f0;
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
  border-bottom-color: #f0f0f0;
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