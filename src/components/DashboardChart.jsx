import React from "react";
import { Dimensions } from "react-native";
import { LineChart } from "react-native-chart-kit";

const screenWidth = Dimensions.get("window").width;

/**
 * @param {Array} data - 백엔드에서 받아온 12개 시간대(00, 02, 04, ... 24) 호출 수 배열
 */
const DashboardChart = ({ data }) => {
  
  // 1. 오늘 기준 시간대 레이블(00~24, 2시간 간격) 설정
  const chartData = {
    labels: ["00", "04", "08", "12", "16", "20", "24"],
    datasets: [
      {
        // 2. 백엔드에서 전달받은 데이터가 없으면 차트 렌더링 시 오류 발생 방지
        data: data && data.length > 0 ? data : [0, 0, 0, 0, 0, 0, 0], 
        color: (opacity = 1) => `rgba(6, 243, 147, ${opacity})`, 
        strokeWidth: 3 
      }
    ],
  };

  const chartConfig = {
    backgroundColor: "#ffffff",
    backgroundGradientFrom: "#ffffff",
    backgroundGradientTo: "#ffffff",
    decimalPlaces: 0, 
    color: (opacity = 1) => `rgba(6, 243, 147, ${opacity})`, 
    labelColor: (opacity = 1) => `rgba(153, 153, 153, ${opacity})`, 
    propsForDots: {
      r: "4",
      strokeWidth: "2",
      stroke: "#06F393"
    },
    propsForBackgroundLines: {
      stroke: "#F0F0F0"
    }
  };

  return (
    <LineChart
      data={chartData}
      width={screenWidth - 70}
      height={220}
      chartConfig={chartConfig}
      bezier
      style={{
        marginVertical: 10,
        borderRadius: 16,
      }}
      withInnerLines={true}
      withOuterLines={false}
      withShadow={true}
    />
  );
};

export default DashboardChart;