import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Platform } from "react-native";
import styled from "styled-components/native";

import AdminDashboardScreen from "../screens/admin/AdminDashboardScreen";
import AdminHistoryScreen from "../screens/admin/AdminHistoryScreen";
import AdminMonitoringScreen from "../screens/admin/AdminMonitoringScreen";
import AdminDeviceScreen from "../screens/admin/AdminDeviceScreen";

const tabDashboard = require("../assets/tab_admin_dashboard.png");
const tabHistory = require("../assets/tab_admin_history.png");
const tabMonitoring = require("../assets/tab_admin_monitoring.png");
const tabDevice = require("../assets/tab_admin_device.png");

const Tab = createBottomTabNavigator();

export default function AdminTabNavigator() {
  const getTabIcon = (routeName) => {
    if (routeName === "AdminDashboard") return tabDashboard;
    if (routeName === "AdminHistory") return tabHistory;
    if (routeName === "AdminMonitoring") return tabMonitoring;
    if (routeName === "AdminDevice") return tabDevice;

    return tabDashboard;
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: "#06F393",
        tabBarInactiveTintColor: "#BBBBBB",
        tabBarStyle: {
          height: Platform.OS === "ios" ? 100 : 80,
          paddingBottom: Platform.OS === "ios" ? 30 : 10,
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
        tabBarIcon: ({ focused }) => (
          <TabIcon
            source={getTabIcon(route.name)}
            style={{
              opacity: focused ? 1 : 0.4,
            }}
            resizeMode="contain"
          />
        ),
      })}
    >
      <Tab.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      <Tab.Screen name="AdminHistory" component={AdminHistoryScreen} />
      <Tab.Screen name="AdminMonitoring" component={AdminMonitoringScreen} />
      <Tab.Screen name="AdminDevice" component={AdminDeviceScreen} />
    </Tab.Navigator>
  );
}

const TabIcon = styled.Image`
  width: 40px;
  height: 40px;
  margin-top: 5px;
`;