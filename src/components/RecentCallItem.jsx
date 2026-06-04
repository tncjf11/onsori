import React from "react";
import { View, TouchableOpacity } from "react-native";
import styled from "styled-components/native";
import { useNavigation } from "@react-navigation/native";

// ✅ 아이콘 에셋 (철통 보존 🤙)
const iconMessage = require("../assets/recent_message.png");
const iconBell = require("../assets/recent_bell.png");
const iconMissed = require("../assets/recent_missed.png");
const iconRejected = require("../assets/recent_rejected.png");

// 🤙 [🚨 1단계 수술: 2중 마감 안전벨트 장착] 
// 상위 스크린에서 혹시라도 비동기 타이밍 렉 때문에 null을 던져주거나 아예 안 주더라도 
// 부품이 기절하지 않고 정상 렌더링되도록 기본 쉴드 문자열("READY")을 셋팅하쇼!
const RecentCallItem = ({ item, isAdmin = false, token = "READY", onPress }) => {
  const navigation = useNavigation();

  const getIcon = (type) => {
    switch (type) {
      case "message": return iconMessage;
      case "bell": return iconBell;
      case "missed": return iconMissed;
      case "rejected": return iconRejected;
      default: return iconBell;
    }
  };

  const handlePress = () => {
    // 🪙 상위 화면에서 null이 흘러들어왔을 때를 대비한 최종 무결성 바이패스 변수 확보
    const verifiedToken = token || "READY";

    if (onPress) {
      // 👈 [🚨 2단계 수술: 커스텀 핸들러 안전 통로 개통] 
      // HomeScreen이나 검색창 등에서 따로 함수를 달아줬을 때도 검증된 토큰을 안전하게 배달쇼!
      onPress(verifiedToken); 
    } else {
      const targetScreen = isAdmin ? "AdminHistoryDetail" : "End";
      
      console.log(`▶️ [부품 터치 다이렉트 이동] logId: ${item.id} | token 탑재 완료쇼 🤙`);
      
      navigation.navigate(targetScreen, { 
        item: item, 
        logId: item.id,      // 🎫 백엔드가 인식하는 찐 이력 고유 식별 번호
        token: verifiedToken // 🪙 로컬 저장소 안전 마스터 신분증 최종 토스!
      });
    }
  };

  return (
    <ItemContainer 
      activeOpacity={0.7} 
      onPress={handlePress}
      isAdmin={isAdmin}
    >
      {/* 1. 상황별 아이콘 */}
      <CallIcon source={getIcon(item.type)} resizeMode="contain" />

      {/* 2. 텍스트 및 태그 영역 */}
      <ContentArea>
        <TopRow>
          <CallTitle numberOfLines={1}>{item.title}</CallTitle>
          <CallTime>{item.time}</CallTime>
        </TopRow>
        
        <TagRow>
          {item.tags && item.tags.map((tag, idx) => (
            <TagBox key={idx}>
              <TagText>{tag}</TagText>
            </TagBox>
          ))}
        </TagRow>
      </ContentArea>
    </ItemContainer>
  );
};

export default RecentCallItem;

/* ================= 스타일 정의 (수철님 명품 부품 핏 100% 철통 보존 🤙) ================= */
const ItemContainer = styled.TouchableOpacity`
  flex-direction: row;
  padding: 15px 20px;
  background-color: #fff;
  border-bottom-width: ${props => props.isAdmin ? "0px" : "1px"};
  border-bottom-color: #f9f9f9;
  align-items: center;
`;

const CallIcon = styled.Image` width: 42px; height: 42px; margin-right: 15px; `;
const ContentArea = styled.View` flex: 1; `;
const TopRow = styled.View` flex-direction: row; justify-content: space-between; align-items: center; `;
const CallTitle = styled.Text` font-size: 16px; font-weight: 700; color: #222; flex: 1; margin-right: 10px; `;
const CallTime = styled.Text` font-size: 12px; color: #bbb; `;
const TagRow = styled.View` flex-direction: row; margin-top: 6px; flex-wrap: wrap; `;
const TagBox = styled.View` background-color: #F2F4F7; padding: 3px 8px; border-radius: 4px; margin-right: 6px; margin-bottom: 2px; `;
const TagText = styled.Text` font-size: 11px; color: #888; font-weight: 600; `;