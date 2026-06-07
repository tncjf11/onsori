import React from "react";
import styled from "styled-components/native";

const iconStatusOnline = require("../assets/icon_status_online.png");
const iconStatusOffline = require("../assets/icon_status_offline.png");
const iconStatusError = require("../assets/icon_status_error.png");

const DeviceListItem = ({ item = {} }) => {
  const getBatteryValue = () => {
    const value = Number(item.battery ?? item.batteryLevel ?? 0);

    if (Number.isNaN(value)) return 0;

    return value;
  };

  const getBatteryColor = (percent) => {
    if (percent > 70) return "#06F393";
    if (percent > 20) return "#FFB800";
    return "#FF5C5C";
  };

  const getStatusType = (statusValue) => {
    const status = String(statusValue || "").toUpperCase();

    if (status === "ONLINE" || status === "ACTIVE" || status === "ENABLED") {
      return "ONLINE";
    }

    if (status === "ERROR" || status === "FAIL" || status === "FAILED") {
      return "ERROR";
    }

    return "OFFLINE";
  };

  const getStatusImage = (statusValue) => {
    const status = getStatusType(statusValue);

    if (status === "ONLINE") return iconStatusOnline;
    if (status === "ERROR") return iconStatusError;

    return iconStatusOffline;
  };

  const getStatusLabel = (statusValue) => {
    const status = getStatusType(statusValue);

    if (status === "ONLINE") return "온라인";
    if (status === "ERROR") return "오류";

    return "오프라인";
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "기록 없음";

    try {
      const text = String(dateValue);

      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        return text;
      }

      const hasExplicitTimezone =
        text.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(text);

      if (hasExplicitTimezone) {
        const date = new Date(text);

        if (Number.isNaN(date.getTime())) return "기록 없음";

        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");

        return `${yyyy}-${mm}-${dd}`;
      }

      return text.replace("T", " ").substring(0, 10);
    } catch {
      return "기록 없음";
    }
  };

  const battery = getBatteryValue();
  const deviceUid = item.deviceUid || "장치 UID 없음";
  const deviceId = item.id || item.deviceId || "관리 ID 없음";
  const updatedDate = formatDate(
    item.lastUpdate || item.lastUpdatedAt || item.updatedAt || item.createdAt
  );

  return (
    <ItemContainer>
      <TopRow>
        <StatusIcon source={getStatusImage(item.status)} resizeMode="contain" />

        <DeviceId numberOfLines={1}>{deviceUid}</DeviceId>

        <BatteryText color={getBatteryColor(battery)}>{battery}%</BatteryText>
      </TopRow>

      <BottomRow>
        <StatusText>{getStatusLabel(item.status)}</StatusText>
        <MetaText>ID: {deviceId}</MetaText>
        <UpdateDate>{updatedDate}</UpdateDate>
      </BottomRow>
    </ItemContainer>
  );
};

export default DeviceListItem;

/* ================= 스타일 정의 ================= */

const ItemContainer = styled.View`
  background-color: #fff;
  margin: 0 20px 12px;
  padding: 15px 20px;
  border-radius: 20px;
  elevation: 2;
  shadow-color: #000;
  shadow-opacity: 0.05;
  shadow-radius: 5px;
`;

const TopRow = styled.View`
  flex-direction: row;
  align-items: center;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom-width: 1px;
  border-bottom-color: #F8F8F8;
`;

const StatusIcon = styled.Image`
  width: 22px;
  height: 22px;
  margin-right: 12px;
`;

const DeviceId = styled.Text`
  flex: 1;
  font-size: 16px;
  font-weight: 700;
  color: #333;
`;

const BatteryText = styled.Text`
  font-size: 15px;
  font-weight: 700;
  color: ${(props) => props.color};
`;

const BottomRow = styled.View`
  flex-direction: row;
  align-items: center;
`;

const StatusText = styled.Text`
  font-size: 13px;
  color: #666;
  font-weight: 700;
  margin-right: 10px;
`;

const MetaText = styled.Text`
  flex: 1;
  font-size: 13px;
  color: #888;
`;

const UpdateDate = styled.Text`
  font-size: 13px;
  color: #BBB;
`;