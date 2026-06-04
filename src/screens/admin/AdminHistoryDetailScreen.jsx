import React from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";
import styled from "styled-components/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";

// ✅ 이미지 에셋 (수정 아이콘 추가! 뽈칵! 🤙)
const backIcon = require("../../assets/back_icon.png");
const iconWrench = require("../../assets/icon_wrench.png"); // 👈 수철님이 말씀하신 수정 아이콘!

export default function AdminHistoryDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  // 🤙 검색 결과에서 넘겨받은 사용자 정보 (없으면 시안용 가짜 데이터)
  const { item } = route.params || { item: { title: "user000123" } };

  return (
    <Container>
      {/* 1. 헤더 영역 */}
      <Header>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <BackIcon source={backIcon} resizeMode="contain" />
        </TouchableOpacity>
        <HeaderTitle>{item.title}님의 통화 기록</HeaderTitle>
        <View style={{ width: 24 }} />
      </Header>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* 2. 대화 로그 카드 (채팅 내역 뽈칵! 🤙) */}
        <ContentCard>
          <ReceiveBubble>
            <BubbleText>계세요? 택배입니다.</BubbleText>
            <BubbleTime>21:22</BubbleTime>
          </ReceiveBubble>

          <SendBubble>
            <BubbleTime>21:23</BubbleTime>
            <BubbleText style={{ color: "#fff", backgroundColor: "#06F393" }}>네. 자세히 말해주세요.</BubbleText>
          </SendBubble>

          <ReceiveBubble>
            <BubbleText>등기여서 직접 수령하셔야 해요.</BubbleText>
            <BubbleTime>21:23</BubbleTime>
          </ReceiveBubble>

          <ReceiveBubble>
            <BubbleText>성함이 어떻게 되세요?</BubbleText>
            <BubbleTime>21:23</BubbleTime>
          </ReceiveBubble>

          <SendBubble>
            <BubbleTime>21:24</BubbleTime>
            <BubbleText style={{ color: "#fff", backgroundColor: "#06F393" }}>지금 나갈게요.</BubbleText>
          </SendBubble>
        </ContentCard>

        {/* 3. 수정 이력 카드 (수정 아이콘 포함 뽈칵! 🤙) */}
        <ContentCard>
          <SectionHeader>
            <WrenchIcon source={iconWrench} resizeMode="contain" />
            <SectionTitle>수정 이력</SectionTitle>
          </SectionHeader>

          <HistoryItem>
            <HistoryHeader>
              <HistoryIcon>↪</HistoryIcon>
              <HistoryMainText>계세요? 택배입니다.</HistoryMainText>
              <HistoryTime>2026-05-04 19:20</HistoryTime>
            </HistoryHeader>
            <HistorySubText>계세요? 택배입니다. 이러쿵 저러쿵이러쿵 저러쿵</HistorySubText>
          </HistoryItem>

          <HistoryItem style={{ borderBottomWidth: 0 }}>
            <HistoryHeader>
              <HistoryIcon>↪</HistoryIcon>
              <HistoryMainText>등기여서 직접 수령하셔야 해요.</HistoryMainText>
              <HistoryTime>2026-05-04 19:18</HistoryTime>
            </HistoryHeader>
            <HistorySubText>등기입니다 직접 수령해주세요.</HistorySubText>
          </HistoryItem>
        </ContentCard>

      </ScrollView>
    </Container>
  );
}

/* ================= 스타일 정의 (시안 100% 동기화 🤙) ================= */

const Container = styled(SafeAreaView)`
  flex: 1;
  background-color: #F8F9FA;
`;

const Header = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background-color: #fff;
`;

const BackIcon = styled.Image`
  width: 24px;
  height: 24px;
`;

const HeaderTitle = styled.Text`
  font-size: 18px;
  font-weight: 800;
  color: #333;
`;

const ContentCard = styled.View`
  background-color: #fff;
  margin: 20px 20px 0;
  padding: 20px;
  border-radius: 25px;
  border-width: 1.5px;
  border-color: #06F393; /* 온소리 시그니처 그린 테두리 🤙 */
`;

/* 채팅 버블 스타일 */
const ReceiveBubble = styled.View`
  flex-direction: row;
  align-items: flex-end;
  margin-bottom: 15px;
`;

const SendBubble = styled.View`
  flex-direction: row;
  justify-content: flex-end;
  align-items: flex-end;
  margin-bottom: 15px;
`;

const BubbleText = styled.Text`
  background-color: #F0F0F0;
  padding: 10px 15px;
  border-radius: 15px;
  font-size: 14px;
  max-width: 70%;
`;

const BubbleTime = styled.Text`
  font-size: 11px;
  color: #999;
  margin: 0 8px;
`;

/* 수정 이력 스타일 */
const SectionHeader = styled.View`
  flex-direction: row;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom-width: 1px;
  border-bottom-color: #EEE;
`;

const WrenchIcon = styled.Image`
  width: 20px;
  height: 20px;
  margin-right: 10px;
`;

const SectionTitle = styled.Text`
  font-size: 16px;
  font-weight: 700;
  color: #333;
`;

const HistoryItem = styled.View`
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom-width: 1px;
  border-bottom-color: #F0F0F0;
`;

const HistoryHeader = styled.View`
  flex-direction: row;
  align-items: center;
  margin-bottom: 5px;
`;

const HistoryIcon = styled.Text`
  font-size: 16px;
  color: #999;
  margin-right: 8px;
`;

const HistoryMainText = styled.Text`
  flex: 1;
  font-size: 14px;
  color: #333;
  font-weight: 600;
`;

const HistoryTime = styled.Text`
  font-size: 12px;
  color: #BBB;
`;

const HistorySubText = styled.Text`
  font-size: 13px;
  color: #666;
  margin-left: 24px;
  line-height: 18px;
`;