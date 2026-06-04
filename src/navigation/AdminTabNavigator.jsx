import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Platform } from "react-native";
import styled from "styled-components/native";

// ✅ 관리자용 화면들 임포트 완착!
import AdminCallLogScreen from "../screens/admin/AdminCallLogScreen";
import AdminDashboardScreen from "../screens/admin/AdminDashboardScreen";
import AdminDeviceScreen from "../screens/admin/AdminDeviceScreen";
import AdminMonitoringScreen from "../screens/admin/AdminMonitoringScreen";

// ✅ 수철님이 준비한 '글자 포함' 탭 이미지들 (순정 보존)
const tabDashboard = require("../assets/tab_admin_dashboard.png");
const tabHistory = require("../assets/tab_admin_history.png");
const tabMonitoring = require("../assets/tab_admin_monitoring.png");
const tabDevice = require("../assets/tab_admin_device.png");

const Tab = createBottomTabNavigator();

export default function AdminTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false, // 이미지에 글자가 포함되어 있으니 기본 라벨은 OFF
        tabBarActiveTintColor: "#06F393",
        tabBarInactiveTintColor: "#BBBBBB",
        tabBarStyle: {
          // app.json의 edgeToEdgeEnabled: false 세팅에 완벽 호환되는 높이 및 패딩 제어
          height: Platform.OS === 'ios' ? 100 : 80,
          paddingBottom: Platform.OS === 'ios' ? 30 : 10,
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
          backgroundColor: "#FFFFFF",
          position: "absolute",
          elevation: 20,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
        },
        tabBarIcon: ({ focused }) => {
          let iconSource;

          // =========================================================
          // 🔥 [대통합 동기화] 탭 내부 라우트 식별 명찰 자석 매칭!
          // =========================================================
          if (route.name === "AdminDashboard") {
            iconSource = tabDashboard;
          } else if (route.name === "AdminCallLog") { 
            iconSource = tabHistory;
          } else if (route.name === "AdminMonitoring") {
            iconSource = tabMonitoring;
          } else if (route.name === "AdminDevice") {
            iconSource = tabDevice;
          }

          return (
            <TabIcon 
              source={iconSource} 
              style={{ 
                // 유저용 tabBarStyle과 통일감을 주되, 수철님의 기존 기획인 투명도(opacity) 피드백 결합
                opacity: focused ? 1 : 0.4 
              }} 
              resizeMode="contain" 
            />
          );
        },
      })}
    >
      {/* 🛠️ 관리자 하단 관제탑 4대 천왕 스크린 배선 정렬 조립 */}
      <Tab.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      <Tab.Screen name="AdminCallLog" component={AdminCallLogScreen} /> 
      <Tab.Screen name="AdminMonitoring" component={AdminMonitoringScreen} />
      <Tab.Screen name="AdminDevice" component={AdminDeviceScreen} />
    </Tab.Navigator>
  );
}

// 스타일 컴포넌트 핏 100% 보존 및 크기 최적화 완료
const TabIcon = styled.Image`
  width: 40px; 
  height: 40px;
  margin-top: 5px;
`;