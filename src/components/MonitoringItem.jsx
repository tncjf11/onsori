import React from "react";
import styled from "styled-components/native";

const ACTIVE_SESSION_STATUSES = new Set([
  "OPEN",
  "CALLING",
  "TALKING",
  "ONGOING",
  "ACTIVE",
  "CONNECTED",
  "INCOMING",
]);

const ENDED_SESSION_STATUSES = new Set([
  "CLOSED",
  "ENDED",
  "COMPLETE",
  "COMPLETED",
  "FINISHED",
  "SUCCESS",
]);

const FAILED_SESSION_STATUSES = new Set([
  "FAILED",
  "MISSED",
  "NO_ANSWER",
  "CANCELED",
  "CANCELLED",
]);

const MonitoringItem = ({ item = {} }) => {
  const normalizeStatus = (statusValue) => {
    return String(statusValue || "")
      .trim()
      .toUpperCase();
  };

  const getRawStatus = () => {
    return normalizeStatus(
      item.status ||
        item.sessionStatus ||
        item.callStatus ||
        item.state ||
        item.connectionState ||
        ""
    );
  };

  const hasEndedTime = () => {
    return Boolean(
      item.endedAt ||
        item.endTime ||
        item.closedAt ||
        item.completedAt ||
        item.finishedAt
    );
  };

  const getStatusType = () => {
    const status = getRawStatus();

    if (hasEndedTime()) {
      return "ENDED";
    }

    if (ENDED_SESSION_STATUSES.has(status)) {
      return "ENDED";
    }

    if (FAILED_SESSION_STATUSES.has(status)) {
      return "FAILED";
    }

    if (ACTIVE_SESSION_STATUSES.has(status)) {
      return "ACTIVE";
    }

    return "UNKNOWN";
  };

  const getStatusColor = () => {
    const statusType = getStatusType();

    if (statusType === "ACTIVE") return "#06F393";
    if (statusType === "ENDED") return "#999";
    if (statusType === "FAILED") return "#FF5C5C";

    return "#999";
  };

  const normalizeKoreanStatus = (value) => {
    return String(value || "").trim();
  };

  const getCallStatusText = () => {
    const backendConnectionStatus = normalizeKoreanStatus(
      item.connectionStatus
    );

    if (
      backendConnectionStatus === "연결" ||
      backendConnectionStatus === "종료" ||
      backendConnectionStatus === "미응답"
    ) {
      return backendConnectionStatus;
    }

    const statusType = getStatusType();

    if (statusType === "ACTIVE") return "연결";
    if (statusType === "ENDED") return "종료";
    if (statusType === "FAILED") return "미응답";

    return "확인 필요";
  };

  const getSttStatusText = () => {
    const backendSttStatus = normalizeKoreanStatus(item.sttStatus);

    if (
      backendSttStatus === "진행 중" ||
      backendSttStatus === "진행중" ||
      backendSttStatus === "완료" ||
      backendSttStatus === "중단"
    ) {
      return backendSttStatus === "진행중" ? "진행 중" : backendSttStatus;
    }

    const statusType = getStatusType();

    if (statusType === "ACTIVE") return "진행 중";
    if (statusType === "ENDED") return "완료";
    if (statusType === "FAILED") return "중단";

    return "확인 필요";
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
        .map((value) => Number(String(value).split(".")[0]));

      if (!year || !month || !day) return null;

      return new Date(year, month - 1, day, hour, minute, second);
    } catch {
      return null;
    }
  };

  const getStartedAt = () => {
    return (
      item.startedAt ||
      item.startTime ||
      item.createdAt ||
      item.requestedAt ||
      item.timestamp ||
      ""
    );
  };

  const formatTime = (dateValue) => {
    if (item.time) return item.time;
    if (!dateValue) return "00:00";

    const date = parseServerDate(dateValue);

    if (!date || Number.isNaN(date.getTime())) return "00:00";

    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");

    return `${hh}:${min}`;
  };

  const statusColor = getStatusColor();

  const title =
    item.title ||
    item.deviceUid ||
    item.deviceId ||
    `세션 ID: ${item.sessionId || item.id || "-"}`;

  return (
    <ItemContainer>
      <TopRow>
        <UserId numberOfLines={1}>{title}</UserId>
        <Duration>{formatTime(getStartedAt())}</Duration>
      </TopRow>

      <Divider />

      <BottomRow>
        <SttBadge bgColor={statusColor}>
          <SttText>STT: {getSttStatusText()}</SttText>
        </SttBadge>

        <CallStatus color={statusColor}>{getCallStatusText()}</CallStatus>
      </BottomRow>
    </ItemContainer>
  );
};

export default MonitoringItem;

const ItemContainer = styled.View`
  background-color: #fff;
  margin: 0 20px 15px;
  padding: 18px 20px;
  border-radius: 20px;
  elevation: 3;
  shadow-color: #000;
  shadow-opacity: 0.05;
  shadow-radius: 10px;
`;

const TopRow = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`;

const UserId = styled.Text`
  flex: 1;
  font-size: 16px;
  font-weight: 700;
  color: #333;
  margin-right: 10px;
`;

const Duration = styled.Text`
  font-size: 13px;
  color: #BBB;
  font-weight: 500;
`;

const Divider = styled.View`
  height: 1px;
  background-color: #F0F0F0;
  margin-bottom: 12px;
`;

const BottomRow = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;

const SttBadge = styled.View`
  background-color: ${(props) => props.bgColor};
  padding: 6px 12px;
  border-radius: 15px;
`;

const SttText = styled.Text`
  color: #fff;
  font-size: 12px;
  font-weight: 800;
`;

const CallStatus = styled.Text`
  font-size: 14px;
  font-weight: 700;
  color: ${(props) => props.color};
`;