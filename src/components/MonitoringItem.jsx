import React from "react";
import styled from "styled-components/native";

const MonitoringItem = ({ item = {} }) => {
  const normalizeStatus = (statusValue) => {
    return String(statusValue || "").toUpperCase();
  };

  const getStatusType = (statusValue) => {
    const status = normalizeStatus(statusValue);

    if (
      status === "OPEN" ||
      status === "CALLING" ||
      status === "TALKING" ||
      status === "ONGOING" ||
      status === "ACTIVE"
    ) {
      return "ACTIVE";
    }

    if (
      status === "CLOSED" ||
      status === "ENDED" ||
      status === "COMPLETE" ||
      status === "COMPLETED" ||
      status === "FINISHED"
    ) {
      return "ENDED";
    }

    if (
      status === "FAILED" ||
      status === "MISSED" ||
      status === "NO_ANSWER"
    ) {
      return "FAILED";
    }

    return "UNKNOWN";
  };

  const getStatusColor = (statusValue) => {
    const status = getStatusType(statusValue);

    if (status === "ACTIVE") return "#06F393";
    if (status === "ENDED") return "#999";
    if (status === "FAILED") return "#FF5C5C";

    return "#999";
  };

  const getCallStatusText = (statusValue) => {
    const status = getStatusType(statusValue);

    if (status === "ACTIVE") return "연결";
    if (status === "ENDED") return "종료";
    if (status === "FAILED") return "미응답";

    return "확인 필요";
  };

  const getSttStatusText = (statusValue) => {
    const status = getStatusType(statusValue);

    if (status === "ACTIVE") return "진행 중";
    if (status === "ENDED") return "완료";
    if (status === "FAILED") return "중단";

    return "확인 필요";
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

  const formatTime = (dateValue) => {
    if (item.time) return item.time;
    if (!dateValue) return "00:00";

    const date = parseServerDate(dateValue);

    if (!date || Number.isNaN(date.getTime())) return "00:00";

    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");

    return `${hh}:${min}`;
  };

  const statusColor = getStatusColor(item.status || item.sessionStatus);

  const title =
    item.title ||
    item.deviceUid ||
    `세션 ID: ${item.sessionId || item.id || "-"}`;

  return (
    <ItemContainer>
      <TopRow>
        <UserId numberOfLines={1}>{title}</UserId>
        <Duration>{formatTime(item.startedAt || item.createdAt)}</Duration>
      </TopRow>

      <Divider />

      <BottomRow>
        <SttBadge bgColor={statusColor}>
          <SttText>
            STT: {getSttStatusText(item.status || item.sessionStatus)}
          </SttText>
        </SttBadge>

        <CallStatus color={statusColor}>
          {getCallStatusText(item.status || item.sessionStatus)}
        </CallStatus>
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