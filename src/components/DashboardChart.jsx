import React from "react";
import { Dimensions } from "react-native";
import { LineChart } from "react-native-chart-kit";

const screenWidth = Dimensions.get("window").width;

const DashboardChart = ({ data = [] }) => {
  const normalizeChartData = (value) => {
    const safeData = Array.isArray(value)
      ? value.map((item) => Number(item) || 0)
      : [];

    if (safeData.length >= 7) {
      return safeData.slice(0, 7);
    }

    return [...safeData, ...Array(7 - safeData.length).fill(0)];
  };

  const chartData = {
    labels: ["00", "04", "08", "12", "16", "20", "24"],
    datasets: [
      {
        data: normalizeChartData(data),
        color: (opacity = 1) => `rgba(6, 243, 147, ${opacity})`,
        strokeWidth: 3,
      },
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
      stroke: "#06F393",
    },
    propsForBackgroundLines: {
      stroke: "#F0F0F0",
    },
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
      withInnerLines
      withOuterLines={false}
      withShadow
    />
  );
};

export default DashboardChart;