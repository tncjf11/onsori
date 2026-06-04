import React from "react";
import { View, TouchableOpacity } from "react-native";
import styled from "styled-components/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

export default function CallEndScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  // =========================================================
  // 🔥 [재호 백엔드 2번 지침서 반영] 3대장 가방 데이터 패킹 풀기쇼 🔓
  // =========================================================
  // 인터폰방(IntercomChat)에서 넘어온 세션ID, 백엔드가 갓 생성해준 찐 logId, 그리고 인증용 token 낚아채기!
  const { sessionId = null, logId = null, token = null } = route.params || {};

  const handleGoToDetail = () => {
    // 🤙 [재호 쉴드 가동] 이제 sessionId가 아니라 백엔드가 리턴해준 진짜 히스토리 기록 번호인 logId를 검사하쇼!
    if (logId) {
      console.log(`▶消 [재호 2번 지침 준수] 착각 차단! 찐 기록방 워프 가동 ➔ logId: ${logId}`);
      
      // 🤙 [401 에러 최종 파괴] 상세 기록방(End)이 거절하지 않도록 진짜 token까지 셋트로 패킹해서 바구니에 토스!
      navigation.navigate("End", { logId: logId, token: token });
    } else {
      console.log("⚠️ 백엔드에서 인계받은 logId가 누락되어 안전하게 메인 히스토리 탭으로 백업 퇴장쇼!");
      // 만약 logId가 유실되어 들어왔다면 안전하게 전체 히스토리 목록 탭으로 백업 워프!
      navigation.navigate("MainTab", { screen: "히스토리" });
    }
  };

  return (
    <Container>
      <MainContentBox>
        {/* 🟢 시안 속 대형 녹색 체크원 아이콘 매칭 */}
        <CheckCircleIconContainer>
          <Ionicons name="checkmark-sharp" size={55} color="#FFFFFF" />
        </CheckCircleIconContainer>

        <InfoMainTitle>통화가 종료되었습니다.</InfoMainTitle>
        <InfoSubDescription>
          통화 메모가 정상적으로 기록되었습니다.{"\n"}상세 내역은 히스토리에서 확인 가능합니다.
        </InfoSubDescription>
      </MainContentBox>

      {/* 📥 [라우팅 락 해제] 시안 하단에 나란히 배치된 투 트랙 액션 버튼 영역 */}
      <BottomButtonGroupRow>
        <ActionButton 
          bgColor="#06F393" 
          onPress={() => navigation.navigate("MainTab", { screen: "홈" })}
        >
          <ActionButtonText color="#FFFFFF">홈으로</ActionButtonText>
        </ActionButton>

        {/* 🤙 [동선 초강력 진화] 재호 분의 2번 수정을 탑재한 찐 다이렉트 리포트 상세방 매핑 슛! */}
        <ActionButton 
          bgColor="#EBF1FA" 
          onPress={handleGoToDetail}
        >
          <ActionButtonText color="#4A72B2">히스토리 보기</ActionButtonText>
        </ActionButton>
      </BottomButtonGroupRow>
    </Container>
  );
}

/* ================= 스타일 정의 (수철님 명품 시안 감성 100% 철통 보존 🤙) ================= */
const Container = styled(SafeAreaView)` flex: 1; background-color: #FFFFFF; padding: 20px; justify-content: space-between; `;
const MainContentBox = styled.View` flex: 1; justify-content: center; align-items: center; padding-bottom: 60px; `;

const CheckCircleIconContainer = styled.View` width: 100px; height: 100px; border-radius: 50px; background-color: #06F393; justify-content: center; align-items: center; margin-bottom: 30px; elevation: 4; shadow-color: #06F393; shadow-opacity: 0.2; shadow-radius: 10px; `;
const InfoMainTitle = styled.Text` font-size: 24px; font-weight: 800; color: #222222; margin-bottom: 15px; `;
const InfoSubDescription = styled.Text` font-size: 15px; font-weight: 600; color: #777777; text-align: center; line-height: 22px; `;

const BottomButtonGroupRow = styled.View` flex-direction: row; justify-content: space-between; width: 100%; padding-bottom: 20px; `;
const ActionButton = styled.TouchableOpacity` width: 48.5%; background-color: ${props => props.bgColor}; padding: 16px; border-radius: 16px; align-items: center; justify-content: center; `;
const ActionButtonText = styled.Text` font-size: 16px; font-weight: 800; color: ${props => props.color}; `;