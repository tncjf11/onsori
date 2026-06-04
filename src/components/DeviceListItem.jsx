import React from "react";
import styled from "styled-components/native";

// ✅ 수철님이 준비하신 상태 아이콘 이미지들 뽈칵! 🤙 (순정 보존)
const iconStatusOnline = require("../assets/icon_status_online.png");   // 초록 전원
const iconStatusOffline = require("../assets/icon_status_offline.png"); // 빨강 전원
const iconStatusError = require("../assets/icon_status_error.png");     // 빨강 경고 삼각형

const DeviceListItem = ({ item }) => {
  
  // 배터리 잔량에 따른 색상 결정 (순정 보존 🤙)
  const getBatteryColor = (percent) => {
    if (percent > 70) return "#06F393";
    if (percent > 20) return "#FFB800";
    return "#FF5C5C";
  };

  // =========================================================
  // 🔥 [재호 찐 컨트롤러 동기화] 대소문자 예외 격파 가드 스위칭! 🚀
  // =========================================================
  const getStatusImage = (status) => {
    // 백엔드에서 대문자("ONLINE", "ERROR")로 오거나 소문자로 오더라도 다 낚아채게 .toUpperCase() 장착!
    const formattedStatus = status ? status.toUpperCase() : "OFFLINE";
    
    switch (formattedStatus) {
      case "ONLINE": 
        return iconStatusOnline;
      case "ERROR": 
        return iconStatusError;
      case "OFFLINE":
      default: 
        return iconStatusOffline;
    }
  };

  return (
    <ItemContainer>
      {/* 1. 상단 행 (아이콘 이미지로 교체 완료! 🤙) */}
      <TopRow>
        <StatusIcon source={getStatusImage(item.status)} resizeMode="contain" />
        {/* 🎯 [🚨 명찰 핏 싱크 완료] 재호 분의 DTO 장부 규격에 맞춰 id 혹은 deviceUid 유연 바인딩! */}
        <DeviceId>ID: {item.id || item.deviceId || "0"}</DeviceId>
        <BatteryText color={getBatteryColor(item.battery || 0)}>{item.battery || 0}%</BatteryText>
      </TopRow>

      {/* 2. 하단 행 */}
      <BottomRow>
        {/* 디바이스 고유 UID 번호 명찰 가드 매핑 */}
        <UserId>{item.deviceUid || "DEVICE-NULL"}</UserId>
        {/* 스프링 부트에서 내려주는 타임스탬프 파싱 */}
        <UpdateDate>{item.lastUpdate || item.createdAt?.substring(0, 10) || "연결 이력 없음"}</UpdateDate>
      </BottomRow>
    </ItemContainer>
  );
};

export default DeviceListItem;

/* ================= 스타일 정의 (수철님 시안 100% 동기화 철통 보존 🤙) ================= */
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
  color: ${props => props.color};
`;

const BottomRow = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;

const UserId = styled.Text`
  font-size: 14px;
  color: #888;
`;

const UpdateDate = styled.Text`
  font-size: 13px;
  color: #BBB;
`;