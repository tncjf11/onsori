import React from "react";
import { Dimensions } from "react-native";
import { LineChart } from "react-native-chart-kit";

// 화면 너비를 가져와서 그래프 크기를 유동적으로 조절합니다.
const screenWidth = Dimensions.get("window").width;

/**
 * @param {Array} data - 외부에서 넘겨받을 통계 숫자 배열 (예: [10, 20, 15...])
 */
const DashboardChart = ({ data }) => {
  
  // 1. 차트에 들어갈 데이터 구조 설정 🤙
  const chartData = {
    labels: ["00", "04", "08", "12", "16", "20", "24"], // X축 시간대
    datasets: [
      {
        // 🤙 데이터가 있으면 쓰고, 없으면 시안용 가짜 데이터를 씁니다.
        data: data || [5, 3, 23, 15, 18, 12, 7], 
        color: (opacity = 1) => `rgba(6, 243, 147, ${opacity})`, // 온소리 민트 (#06F393)
        strokeWidth: 3 // 선 두께
      }
    ],
  };

  // 2. 차트 스타일 및 설정 (시안 100% 동기화 🤙)
  const chartConfig = {
    backgroundColor: "#ffffff",
    backgroundGradientFrom: "#ffffff",
    backgroundGradientTo: "#ffffff",
    decimalPlaces: 0, // 소수점 제거 잉~ 🤙
    color: (opacity = 1) => `rgba(6, 243, 147, ${opacity})`, // 메인 선 색상
    labelColor: (opacity = 1) => `rgba(153, 153, 153, ${opacity})`, // 축 글자 색상
    style: {
      borderRadius: 16
    },
    propsForDots: {
      r: "5", // 점 크기
      strokeWidth: "2",
      stroke: "#06F393" // 점 테두리
    },
    propsForBackgroundLines: {
      strokeDasharray: "", // 배경 점선을 실선으로 혹은 제거
      stroke: "#F0F0F0" // 배경 선 색상
    }
  };

  return (
    <LineChart
      data={chartData}
      width={screenWidth - 70} // 카드 내부 패딩값 제외 (시안 최적화 🤙)
      height={220}
      chartConfig={chartConfig}
      bezier // 🤙 시안처럼 부드러운 곡선을 만드는 마법의 속성!
      style={{
        marginVertical: 10,
        borderRadius: 16,
      }}
      withInnerLines={true} // 격자무늬 표시
      withOuterLines={false}
      withShadow={true} // 선 아래 은은한 그림자 뽈칵! 🤙
    />
  );
};

export default DashboardChart;