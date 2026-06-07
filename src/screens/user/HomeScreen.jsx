import React, { useState, useEffect, useRef } from "react";
import {
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Vibration,
  Alert,
} from "react-native";
import styled from "styled-components/native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView as SafeAreaContainer } from "react-native-safe-area-context";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

import BASE_URL from "../../api/config";
import RecentCallItem from "../../components/RecentCallItem";

const bellIcon = require("../../assets/bell.png");

const logHome = (message, data) => {
  if (data !== undefined) {
    console.log(`[HOME] ${message}`, data);
  } else {
    console.log(`[HOME] ${message}`);
  }
};

export default function HomeScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const [modalVisible, setModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [intercomStatus, setIntercomStatus] = useState("idle");
  const [recentCalls, setRecentCalls] = useState([]);
  const [token, setToken] = useState(null);

  const intercomStatusRef = useRef("idle");
  const activeSessionIdRef = useRef(null);
  const lastHomeStatusLogRef = useRef("");

  const syncNavigationParams = (nextStatus, nextSessionId) => {
    const safeSessionId = nextSessionId || null;

    navigation.setParams?.({
      intercomStatus: nextStatus,
      activeSessionId: safeSessionId,
    });

    const parentNavigation = navigation.getParent?.();

    parentNavigation?.setParams?.({
      intercomStatus: nextStatus,
      activeSessionId: safeSessionId,
    });
  };

  const updateIntercomStatus = (
    nextStatus,
    reason = "",
    nextSessionId = activeSessionIdRef.current
  ) => {
    const safeSessionId = nextSessionId || null;
    const prevStatus = intercomStatusRef.current;

    intercomStatusRef.current = nextStatus;
    activeSessionIdRef.current = safeSessionId;

    setIntercomStatus(nextStatus);
    setActiveSessionId(safeSessionId);

    syncNavigationParams(nextStatus, safeSessionId);

    const logKey = `${prevStatus}->${nextStatus}:${safeSessionId}:${reason}`;

    if (lastHomeStatusLogRef.current !== logKey) {
      lastHomeStatusLogRef.current = logKey;

      logHome("인터폰 상태 동기화", {
        previous: prevStatus,
        next: nextStatus,
        activeSessionId: safeSessionId,
        reason,
      });
    }
  };

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

  const getLogDateValue = (log = {}) => {
    return (
      log.createdAt ||
      log.startedAt ||
      log.endedAt ||
      log.endTime ||
      log.timestamp ||
      log.time ||
      ""
    );
  };

  const getSortTime = (log = {}) => {
    const date = parseServerDate(getLogDateValue(log));

    if (!date || Number.isNaN(date.getTime())) {
      return 0;
    }

    return date.getTime();
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

      const year = logTime.getFullYear();
      const month = String(logTime.getMonth() + 1).padStart(2, "0");
      const day = String(logTime.getDate()).padStart(2, "0");

      return `${year}-${month}-${day}`;
    } catch (error) {
      logHome("시간 표시 처리 실패", error?.message);
      return "시간 오차";
    }
  };

  const normalizeStatus = (value) => {
    return String(value || "").toUpperCase();
  };

  const getSessionStatus = (session) => {
    const safeSession = session || {};

    return normalizeStatus(
      safeSession.status ||
        safeSession.sessionStatus ||
        safeSession.callStatus ||
        safeSession.state ||
        ""
    );
  };

  const getSessionId = (session) => {
    const safeSession = session || {};

    return (
      safeSession.sessionId ??
      safeSession.id ??
      safeSession.callSessionId ??
      null
    );
  };

  const hasEndedTime = (session) => {
    const safeSession = session || {};

    return Boolean(
      safeSession.endedAt || safeSession.endTime || safeSession.closedAt
    );
  };

  const isEndedSession = (session) => {
    if (!session) return false;

    const status = getSessionStatus(session);

    return (
      hasEndedTime(session) ||
      status === "CLOSED" ||
      status === "ENDED" ||
      status === "COMPLETE" ||
      status === "COMPLETED" ||
      status === "FINISHED" ||
      status === "SUCCESS" ||
      status === "FAILED" ||
      status === "MISSED" ||
      status === "NO_ANSWER" ||
      status === "CANCELED" ||
      status === "CANCELLED"
    );
  };

  const isActiveSession = (session) => {
    if (!session) return false;
    if (isEndedSession(session)) return false;

    const status = getSessionStatus(session);

    return (
      status === "OPEN" ||
      status === "CALLING" ||
      status === "TALKING" ||
      status === "ONGOING" ||
      status === "INCOMING" ||
      status === "ACTIVE"
    );
  };

  const extractIntercomLogs = (responseData) => {
    if (Array.isArray(responseData?.data)) {
      return responseData.data;
    }

    if (Array.isArray(responseData)) {
      return responseData;
    }

    if (Array.isArray(responseData?.content)) {
      return responseData.content;
    }

    if (Array.isArray(responseData?.logs)) {
      return responseData.logs;
    }

    if (Array.isArray(responseData?.data?.content)) {
      return responseData.data.content;
    }

    if (Array.isArray(responseData?.data?.logs)) {
      return responseData.data.logs;
    }

    if (Array.isArray(responseData?.result)) {
      return responseData.result;
    }

    if (Array.isArray(responseData?.data?.result)) {
      return responseData.data.result;
    }

    return [];
  };

  const getLogTitle = (log = {}) => {
    const summary = String(log.summary || "").trim();
    const visitorText = String(log.visitorText || "").trim();
    const content = String(log.content || "").trim();
    const message = String(log.message || "").trim();

    if (summary && summary !== "내용 없음") return summary;
    if (visitorText) return visitorText;
    if (content) return content;
    if (message) return message;

    return "인터폰 호출 알림";
  };

  const mapRecentLogItem = (log = {}, index = 0) => {
    const logId = log.logId ?? log.id ?? log.intercomLogId ?? index;
    const sessionId = log.sessionId ?? log.callSessionId ?? null;
    const createdAt = getLogDateValue(log);

    return {
      ...log,
      id: logId,
      logId,
      sessionId,
      title: getLogTitle(log),
      time: formatTimeGap(createdAt),
      type: log.intent === "DELIVERY" ? "message" : "bell",
      tags: log.intent ? [log.intent] : ["방문"],
      deviceUid: log.deviceUid,
      createdAt,
      raw: log,
    };
  };

  const triggerHardwareAlert = async (status) => {
    try {
      if (status === "incoming") {
        const vibSetting = await AsyncStorage.getItem("callVibrate");

        logHome("호출 진동 설정 확인", {
          callVibrate: vibSetting,
        });

        if (vibSetting === "true") {
          Vibration.vibrate([0, 1000, 1000], true);
          logHome("호출 진동 시작");
        }
      } else {
        Vibration.cancel();
        logHome("호출 진동 중지");
      }
    } catch (error) {
      logHome("진동 제어 실패", error?.message);
    }
  };

  const fetchRecentLogs = async (savedToken) => {
    if (!savedToken) {
      setRecentCalls([]);
      logHome("최근 호출 이력 조회 생략 - accessToken 없음");
      return;
    }

    try {
      const logResponse = await axios.get(`${BASE_URL}/api/intercom-logs`, {
        headers: {
          Authorization: `Bearer ${savedToken}`,
        },
      });

      const rawLogs = extractIntercomLogs(logResponse.data);

      logHome("최근 호출 이력 원본 응답", {
        isArrayResponse: Array.isArray(logResponse.data),
        success: logResponse.data?.success,
        rawCount: rawLogs.length,
      });

      const mappedLogs = rawLogs
        .filter((log) => log)
        .sort((a, b) => getSortTime(b) - getSortTime(a))
        .slice(0, 4)
        .map(mapRecentLogItem);

      setRecentCalls(mappedLogs);

      logHome("최근 호출 이력 조회 완료", {
        total: rawLogs.length,
        displayed: mappedLogs.length,
      });
    } catch (error) {
      const serverError =
        error.response?.data?.message ||
        JSON.stringify(error.response?.data) ||
        error.message;

      logHome("최근 호출 이력 조회 실패", serverError);
      setRecentCalls([]);
    }
  };

  const checkHomeActiveSession = async (isSilent = false) => {
    let savedToken = null;

    try {
      if (!isSilent) {
        setIsLoading(true);
        logHome("홈 상태 초기 조회 시작");
      }

      savedToken = await AsyncStorage.getItem("accessToken");
      setToken(savedToken);

      const deviceUid = "DEVICE-001";

      logHome("현재 세션 조회 요청", {
        deviceUid,
        hasToken: Boolean(savedToken),
        silent: isSilent,
      });

      let response = null;

      try {
        response = await axios.get(
          `${BASE_URL}/api/sessions/current?deviceUid=${deviceUid}`,
          {
            headers: {
              ...(savedToken ? { Authorization: `Bearer ${savedToken}` } : {}),
            },
          }
        );
      } catch (error) {
        const serverError =
          error.response?.data?.message ||
          JSON.stringify(error.response?.data) ||
          error.message;

        logHome("현재 세션 조회 실패", serverError);
      }

      if (response?.data?.success) {
        const sessionData = response.data?.data || null;
        const nextSessionId = sessionData ? getSessionId(sessionData) : null;
        const sessionStatus = sessionData ? getSessionStatus(sessionData) : "";
        const isIncoming = Boolean(
          sessionData && nextSessionId && isActiveSession(sessionData)
        );

        logHome("현재 세션 응답", {
          exists: Boolean(sessionData),
          sessionId: nextSessionId,
          status: sessionStatus || null,
          endedAt: sessionData?.endedAt || null,
          isIncoming,
        });

        if (isIncoming) {
          if (intercomStatusRef.current !== "incoming") {
            triggerHardwareAlert("incoming");
          }

          updateIntercomStatus(
            "incoming",
            "active session detected",
            nextSessionId
          );
        } else {
          if (intercomStatusRef.current === "incoming") {
            triggerHardwareAlert("idle");
          }

          updateIntercomStatus("idle", "no active session", null);
        }
      } else {
        logHome("현재 세션 없음 또는 응답 확인 필요", response?.data);

        if (intercomStatusRef.current === "incoming") {
          triggerHardwareAlert("idle");
        }

        updateIntercomStatus("idle", "current session response empty", null);
      }

      if (!isSilent) {
        await fetchRecentLogs(savedToken);
      }
    } catch (error) {
      const serverError =
        error.response?.data?.message ||
        JSON.stringify(error.response?.data) ||
        error.message;

      logHome("홈 화면 상태 조회 실패", serverError);

      if (intercomStatusRef.current === "incoming") {
        triggerHardwareAlert("idle");
      }

      updateIntercomStatus("idle", "home status error", null);

      if (!isSilent && savedToken) {
        await fetchRecentLogs(savedToken);
      }
    } finally {
      if (!isSilent) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    let pollingTimer = null;

    if (isFocused) {
      logHome("화면 포커스 - polling 시작");

      checkHomeActiveSession(false);

      pollingTimer = setInterval(() => {
        checkHomeActiveSession(true);
      }, 3000);
    }

    return () => {
      Vibration.cancel();

      if (pollingTimer) {
        clearInterval(pollingTimer);
        logHome("화면 이탈 - polling 중지");
      }
    };
  }, [isFocused]);

  const handleStatusCardPress = () => {
    const targetSessionId = activeSessionId || activeSessionIdRef.current;

    logHome("상태 카드 클릭", {
      intercomStatus,
      activeSessionId: targetSessionId,
    });

    if (intercomStatus === "incoming") {
      Vibration.cancel();

      if (!targetSessionId) {
        logHome("인터폰 진입 실패 - activeSessionId 없음");
        Alert.alert("오류", "연결된 인터폰 세션 정보를 찾을 수 없습니다.");
        checkHomeActiveSession(false);
        return;
      }

      navigation.navigate("IntercomChat", {
        sessionId: targetSessionId,
        token,
      });
      return;
    }

    if (intercomStatus === "disconnected") {
      navigation.navigate("QrVerify");
      return;
    }

    navigation.navigate("MainTab", {
      screen: "히스토리",
    });
  };

  const handlePressRecentCall = (item) => {
    logHome("최근 호출 상세 이동", {
      logId: item.logId || item.id,
      sessionId: item.sessionId,
    });

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
          <HeaderTitle>
            {intercomStatus === "disconnected" ? "로그인 완료" : "홈"}
          </HeaderTitle>
        </HeaderLeft>

        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          style={{ flexDirection: "row", alignItems: "center" }}
        >
          <Ionicons name="information-circle-outline" size={22} color="#555" />
          <InfoBtnText>앱 사용법</InfoBtnText>
        </TouchableOpacity>
      </Header>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 30 }}
      >
        <SystemBlockContainer>
          <SystemMainLabel>인터폰 대화 연결 시스템</SystemMainLabel>
        </SystemBlockContainer>

        {isLoading ? (
          <LoadingWrapper>
            <ActivityIndicator size="small" color="#06F393" />
          </LoadingWrapper>
        ) : (
          <MainBannerActionCard
            activeOpacity={0.7}
            onPress={handleStatusCardPress}
          >
            <BannerLeftContainer>
              <MicIconWrapper
                bgColor={
                  intercomStatus === "disconnected" ? "#EAEAEA" : "#F5F5F5"
                }
              >
                <Ionicons
                  name={intercomStatus === "disconnected" ? "mic-off" : "mic"}
                  size={24}
                  color={intercomStatus === "incoming" ? "#06F393" : "#999"}
                />
              </MicIconWrapper>

              <BannerTextGroup>
                <BannerMainTitle>
                  {intercomStatus === "disconnected" &&
                    "인터폰 장치가 연결되지 않았습니다."}
                  {intercomStatus === "incoming" &&
                    "인터폰 호출이 들어왔습니다."}
                  {intercomStatus === "idle" &&
                    "인터폰 호출 대기 중입니다."}
                </BannerMainTitle>

                <BannerSubDescription>
                  {intercomStatus === "disconnected" &&
                    "QR 인증을 진행해 주세요."}
                  {intercomStatus === "incoming" &&
                    "눌러서 실시간 대화를 확인하세요."}
                  {intercomStatus === "idle" &&
                    "현재 걸려온 인터폰 호출이 없습니다."}
                </BannerSubDescription>
              </BannerTextGroup>
            </BannerLeftContainer>

            {intercomStatus === "disconnected" && (
              <ActionButtonStyle bgColor="#4A72B2">
                <ActionBtnText>QR 인증</ActionBtnText>
              </ActionButtonStyle>
            )}

            {intercomStatus === "incoming" && (
              <ActionButtonStyle bgColor="#06F393">
                <ActionBtnText>확인</ActionBtnText>
              </ActionButtonStyle>
            )}

            {intercomStatus === "idle" && (
              <ActionButtonStyle bgColor="#EAEAEA">
                <ActionBtnText style={{ color: "#999" }}>대기</ActionBtnText>
              </ActionButtonStyle>
            )}
          </MainBannerActionCard>
        )}

        <SectionTitle>최근 호출 이력</SectionTitle>

        <ResultListGroup style={{ flex: 1 }}>
          {recentCalls.length > 0 ? (
            recentCalls.map((item, idx) => (
              <RecentCallItem
                key={item.id || idx}
                item={item}
                token={token || "READY"}
                onPress={() => handlePressRecentCall(item)}
              />
            ))
          ) : (
            <EmptyHistoryContainer>
              <Ionicons name="chatbubbles-outline" size={40} color="#DDD" />
              <EmptyHistoryText>최근 호출된 기록이 없습니다.</EmptyHistoryText>
            </EmptyHistoryContainer>
          )}
        </ResultListGroup>
      </ScrollView>

      <Modal
        animationType="fade"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <ModalOverlay activeOpacity={1} onPress={() => setModalVisible(false)}>
          <ModalContent>
            <ModalHeader>
              <ModalHeaderText>앱 사용법</ModalHeaderText>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ModalHeader>

            <GuideText>1. 인터폰 호출 알림을 확인합니다.</GuideText>
            <GuideText>2. 앱에서 실시간 자막을 확인합니다.</GuideText>
            <GuideText>3. 빠른 응답 또는 직접 입력으로 답변합니다.</GuideText>
            <GuideText>4. 답변이 인터폰 스피커로 전달됩니다.</GuideText>
            <GuideText>5. 통화 종료 후 기록을 확인할 수 있습니다.</GuideText>

            <CloseBtn onPress={() => setModalVisible(false)}>
              <CloseBtnText>확인</CloseBtnText>
            </CloseBtn>
          </ModalContent>
        </ModalOverlay>
      </Modal>
    </Container>
  );
}

const Container = styled(SafeAreaContainer)`
  flex: 1;
  background-color: #FFFFFF;
`;

const Header = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background-color: #FFFFFF;
  border-bottom-width: 1px;
  border-bottom-color: #F0F0F0;
`;

const HeaderLeft = styled.View`
  flex-direction: row;
  align-items: center;
`;

const Logo = styled.Image`
  width: 32px;
  height: 32px;
  margin-right: 8px;
`;

const HeaderTitle = styled.Text`
  font-size: 20px;
  font-weight: 800;
  color: #111;
`;

const InfoBtnText = styled.Text`
  font-size: 14px;
  font-weight: 600;
  color: #555;
  margin-left: 4px;
`;

const SystemBlockContainer = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  margin: 25px 20px 10px;
`;

const SystemMainLabel = styled.Text`
  font-size: 15px;
  color: #555;
  font-weight: 700;
`;

const MainBannerActionCard = styled.TouchableOpacity`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  background-color: #FFFFFF;
  margin: 0 20px 25px;
  padding: 18px 15px;
  border-radius: 16px;
  elevation: 4;
  shadow-color: #000;
  shadow-opacity: 0.06;
  shadow-radius: 8px;
  border-width: 1px;
  border-color: #F0F0F0;
`;

const BannerLeftContainer = styled.View`
  flex-direction: row;
  align-items: center;
  flex: 1;
  margin-right: 10px;
`;

const MicIconWrapper = styled.View`
  width: 44px;
  height: 44px;
  border-radius: 22px;
  background-color: ${(props) => props.bgColor};
  justify-content: center;
  align-items: center;
  margin-right: 12px;
`;

const BannerTextGroup = styled.View`
  flex: 1;
`;

const BannerMainTitle = styled.Text`
  font-size: 14px;
  font-weight: 800;
  color: #222;
`;

const BannerSubDescription = styled.Text`
  font-size: 12px;
  color: #999;
  margin-top: 4px;
  font-weight: 500;
`;

const ActionButtonStyle = styled.View`
  background-color: ${(props) => props.bgColor};
  padding: 10px 16px;
  border-radius: 10px;
  justify-content: center;
  align-items: center;
  min-width: 70px;
`;

const ActionBtnText = styled.Text`
  color: white;
  font-weight: 800;
  font-size: 13px;
`;

const SectionTitle = styled.Text`
  font-size: 15px;
  font-weight: 700;
  color: #555;
  margin: 10px 20px 15px;
`;

const ResultListGroup = styled.View`
  background-color: #fff;
  padding-horizontal: 5px;
`;

const ModalOverlay = styled.TouchableOpacity`
  flex: 1;
  background-color: rgba(0, 0, 0, 0.5);
  justify-content: center;
  align-items: center;
`;

const ModalContent = styled.View`
  width: 85%;
  background-color: white;
  border-radius: 25px;
  padding: 25px;
`;

const ModalHeader = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const ModalHeaderText = styled.Text`
  font-size: 18px;
  font-weight: 800;
  color: #111;
`;

const GuideText = styled.Text`
  font-size: 14px;
  color: #444;
  margin-bottom: 15px;
  line-height: 22px;
  font-weight: 600;
`;

const CloseBtn = styled.TouchableOpacity`
  background-color: #06F393;
  padding: 14px;
  border-radius: 12px;
  align-items: center;
  margin-top: 10px;
`;

const CloseBtnText = styled.Text`
  color: white;
  font-weight: 800;
  font-size: 16px;
`;

const LoadingWrapper = styled.View`
  padding: 40px;
  justify-content: center;
  align-items: center;
`;

const EmptyHistoryContainer = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
  padding: 60px 20px;
`;

const EmptyHistoryText = styled.Text`
  font-size: 14px;
  color: #CCC;
  font-weight: 600;
  margin-top: 10px;
  text-align: center;
`;