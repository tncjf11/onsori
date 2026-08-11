import React, { useState, useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";

import DeviceSettingScreen from "../screens/user/DeviceSettingScreen";
import EndScreen from "../screens/user/EndScreen";
import HistorySearchResultScreen from "../screens/user/HistorySearchResultScreen";
import HistorySearchScreen from "../screens/user/HistorySearchScreen";
import IntercomChatScreen from "../screens/user/IntercomChatScreen";
import QrVerifyScreen from "../screens/user/QrVerifyScreen";
import ResidentLoginScreen from "../screens/user/ResidentLoginScreen";
import TermsPolicyScreen from "../screens/user/TermsPolicyScreen";
import MainTabNavigator from "./MainTabNavigator";

import AdminBtnStatScreen from "../screens/admin/AdminBtnStatScreen";
import AdminCallLogScreen from "../screens/admin/AdminCallLogScreen";
import AdminDeviceDetailScreen from "../screens/admin/AdminDeviceDetailScreen";
import AdminDeviceSearchScreen from "../screens/admin/AdminDeviceSearchScreen";
import AdminHistoryDetailScreen from "../screens/admin/AdminHistoryDetailScreen";
import AdminHistorySearchResultScreen from "../screens/admin/AdminHistorySearchResultScreen";
import AdminLoginScreen from "../screens/admin/AdminLoginScreen";
import AdminMessageEditScreen from "../screens/admin/AdminMessageEditScreen";
import AdminMonitoringDetailScreen from "../screens/admin/AdminMonitoringDetailScreen";
import AdminTabNavigator from "./AdminTabNavigator";

/*
 * 임시 API 속도 측정기
 * 테스트 완료 후 이 import와 아래 <Test />만 삭제하면 됩니다.
 */
import Test from "../api/Test";

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const checkUserAccessStatus = async () => {
      try {
        const token = await AsyncStorage.getItem("accessToken");
        const isVerified = await AsyncStorage.getItem("isVerifiedUser");

        if (!isMounted) return;

        if (token && isVerified === "true") {
          setInitialRoute("MainTab");
        } else {
          setInitialRoute("ResidentLogin");
        }
      } catch (error) {
        console.error("자동 로그인 확인 실패:", error?.message);

        if (isMounted) {
          setInitialRoute("ResidentLogin");
        }
      }
    };

    checkUserAccessStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  if (!initialRoute) {
    return (
      <>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "#F8F9FA",
          }}
        >
          <ActivityIndicator size="large" color="#06F393" />
        </View>

        {__DEV__ && <Test />}
      </>
    );
  }

  return (
    <>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{
            headerShown: false,
            animation: "fade",
          }}
        >
          <Stack.Screen
            name="ResidentLogin"
            component={ResidentLoginScreen}
          />

          <Stack.Screen name="QrVerify" component={QrVerifyScreen} />

          <Stack.Screen name="MainTab" component={MainTabNavigator} />

          <Stack.Screen
            name="IntercomChat"
            component={IntercomChatScreen}
          />

          <Stack.Screen name="End" component={EndScreen} />

          <Stack.Screen
            name="HistorySearch"
            component={HistorySearchScreen}
          />

          <Stack.Screen
            name="HistorySearchResult"
            component={HistorySearchResultScreen}
          />

          <Stack.Screen
            name="DeviceSetting"
            component={DeviceSettingScreen}
          />

          <Stack.Screen
            name="TermsPolicy"
            component={TermsPolicyScreen}
          />

          <Stack.Screen
            name="AdminLogin"
            component={AdminLoginScreen}
          />

          <Stack.Screen
            name="AdminDashboard"
            component={AdminTabNavigator}
          />

          <Stack.Screen
            name="AdminCallLog"
            component={AdminCallLogScreen}
          />

          <Stack.Screen
            name="AdminHistorySearchResult"
            component={AdminHistorySearchResultScreen}
          />

          <Stack.Screen
            name="AdminHistoryDetail"
            component={AdminHistoryDetailScreen}
          />

          <Stack.Screen
            name="AdminBtnStat"
            component={AdminBtnStatScreen}
          />

          <Stack.Screen
            name="AdminMonitoringDetail"
            component={AdminMonitoringDetailScreen}
          />

          <Stack.Screen
            name="AdminMessageEdit"
            component={AdminMessageEditScreen}
          />

          <Stack.Screen
            name="AdminDeviceSearch"
            component={AdminDeviceSearchScreen}
          />

          <Stack.Screen
            name="AdminDeviceDetail"
            component={AdminDeviceDetailScreen}
          />
        </Stack.Navigator>
      </NavigationContainer>

      {/* 모든 화면 위에 표시되는 임시 API 속도 측정기 */}
      {__DEV__ && <Test />}
    </>
  );
}