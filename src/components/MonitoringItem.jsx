import React from "react";
import { TouchableOpacity, View } from "react-native";
import styled from "styled-components/native";
import { useNavigation } from "@react-navigation/native";

/**
 * @param {Object} item - 백엔드 찐 모니터링 데이터 (id, sessionId, deviceUid, status, createdAt)
 */
const MonitoringItem = ({ item }) => {
  const navigation = useNavigation();

  // =========================================================
  // 🔥 [재호 찐 모니터링 동기화] 백엔드 대문자 STATUS 상태 분기 요격! 🚀
  // =========================================================
  // 백엔드에서 통화 중일 때는 대문자 "OPEN"으로 날아옵니다!
  const isCallActive = item.status === "OPEN" || item.status === "open";
  const statusColor = isCallActive ? "#06F393" : "#999";

  // 화면에 이쁘게 뿌려줄 한글 상태 텍스트 자석 매핑
  const displaySttStatus = isCallActive ? "자막 송출 중" : "통화 종료";
  const displayCallStatus = isCallActive ? "연결 중 (Live)" : "대기 상태";

  // 🕒 백엔드 타임스탬프(createdAt)에서 시간 파싱 유틸
  const formatTime = (isoString) => {
    if (!isoString) return "00:00";
    try {
      const date = new Date(isoString);
      const hh = String(date.getHours()).padStart(2, '0');
      const min = String(date.getMinutes()).padStart(2, '0');
      return `${hh}:${min}`;
    } catch {
      return "00:00";
    }
  };

  return (
    <ItemContainer 
      activeOpacity={0.8}
      // 상세 관제탑 화면으로 워프할 때 고유 식별 명찰들을 묶어서 전송!
      onPress={() => navigation.navigate("AdminMonitoringDetail", { 
        item: item,
        logId: item.id,
        sessionId: item.sessionId
      })}
    >
      {/* 1. 상단 정보 (기기 UID 식별자 & 통화 시작 시간) */}
      <TopRow>
        {/* 🎯 [명찰 싱크 완료] 유저 이름 대신 디바이스 식별 고유 UID나 세션 번호 바인딩! */}
        <UserId>{item.deviceUid || `세션 ID: ${item.sessionId || item.id}`}</UserId>
        <Duration>{formatTime(item.createdAt)}</Duration>
      </TopRow>

      <Divider />

      {/* 2. 하단 상태 (STT 배지 & 통화 상태) */}
      <BottomRow>
        <SttBadge bgColor={statusColor}>
          <SttText>STT: {displaySttStatus}</SttText>
        </SttBadge>
        
        <CallStatus color={statusColor}>
          {displayCallStatus}
        </CallStatus>
      </BottomRow>
    </ItemContainer>
  );
};

export default MonitoringItem;

/* ================= 스타일 정의 (수철님 명품 시안 100% 동기화 철통 보존 🤙) ================= */
const ItemContainer = styled.TouchableOpacity`
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
  background-color: ${props => props.bgColor};
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
  color: ${props => props.color};
`;