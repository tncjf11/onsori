import React, { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import styled from "styled-components/native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

// ✅ 수철님이 지정한 메인 캐릭터 이미지
const bellImage = require("../../assets/bell.png");

// 그라데이션을 애니메이션으로 만들기 위해 가공
const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

export default function LoadingScreen({ navigation }) {
  // 배경의 움직임을 제어할 애니메이션 값
  const moveAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. 배경이 "알록달록하게" 움직이는 무한 루프 애니메이션
    Animated.loop(
      Animated.timing(moveAnim, {
        toValue: 1,
        duration: 3000, // 3초 동안 한 바퀴
        easing: Easing.linear,
        useNativeDriver: false, // 레이아웃/색상 변경이라 false
      })
    ).start();

    // 2. 일정 시간(예: 2.5초) 뒤에 다음 화면으로 뽈칵! 이동
    // 실제로는 데이터 로딩이 끝나면 넘어가게 처리할 수도 있습니다.
    const timer = setTimeout(() => {
      // navigation.replace("MainTab"); // 테스트용: 메인으로 이동
      // navigation.goBack(); // 단순히 페이지 전환 로딩용이라면 goBack()
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  // 그라데이션 색상이 바뀌는 효과 (06F393 기반)
  const colorInterpolation = moveAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["#06F393", "#79F7C8", "#06F393"], // 색이 부드럽게 순환함
  });

  return (
    <Container>
      {/* 알록달록하게 변하는 배경 */}
      <Background colors={["#06F393", "#79F7C8", "#DFFFF4"]} start={{x: 0, y: 0}} end={{x: 1, y: 1}}>
        
        {/* 중앙 종 캐릭터 */}
        <ContentArea>
          <BellIcon source={bellImage} resizeMode="contain" />
          <LoadingText>로딩중 ....</LoadingText>
        </ContentArea>

      </Background>
    </Container>
  );
}

/* ================= 스타일 정의 (시안 100% 반영) ================= */

const Container = styled.View`
  flex: 1;
`;

const Background = styled(LinearGradient)`
  flex: 1;
  justify-content: center;
  align-items: center;
`;

const ContentArea = styled.View`
  align-items: center;
  justify-content: center;
`;

const BellIcon = styled.Image`
  width: 320px; /* 시안처럼 큼직하게 */
  height: 320px;
  margin-bottom: 40px;
`;

const LoadingText = styled.Text`
  font-size: 34px;
  font-weight: 900;
  color: #333333;
  letter-spacing: 1px;
`;