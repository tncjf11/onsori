import React, { useEffect, useRef, useState } from "react";
import {
  View,
  ActivityIndicator,
} from "react-native";

import {
  NavigationContainer,
} from "@react-navigation/native";

import {
  createNativeStackNavigator,
} from "@react-navigation/native-stack";

import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import * as Notifications from "expo-notifications";

import BASE_URL from "../api/config";
import {
  configurePushNotificationHandler,
} from "../services/pushNotificationService";

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

const Stack = createNativeStackNavigator();

const ACTIVE_SESSION_STATUSES = new Set([
  "INCOMING",
  "OPEN",
  "CALLING",
  "TALKING",
  "ONGOING",
  "ACTIVE",
  "CONNECTED",
]);

configurePushNotificationHandler();

export default function RootNavigator() {
  const [initialRoute, setInitialRoute] =
    useState(null);

  const navigationRef = useRef(null);
  const pendingNotificationRef = useRef(null);
  const lastHandledNotificationIdRef =
    useRef(null);

  const getCurrentSession = async (
    token,
    deviceUid
  ) => {
    const response = await axios.get(
      `${BASE_URL}/api/sessions/current`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          deviceUid,
        },
      }
    );

    if (!response.data?.success) {
      return null;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        response.data,
        "data"
      )
    ) {
      return response.data.data || null;
    }

    return response.data || null;
  };

  const handleNotificationPress = async (
    response
  ) => {
    try {
      const notificationId =
        response?.notification?.request
          ?.identifier;

      if (
        notificationId &&
        lastHandledNotificationIdRef.current ===
          notificationId
      ) {
        return;
      }

      if (notificationId) {
        lastHandledNotificationIdRef.current =
          notificationId;
      }

      console.log(
        "[PUSH] 인터폰 알림 클릭"
      );

      const token =
        await AsyncStorage.getItem(
          "accessToken"
        );

      const deviceUid =
        (await AsyncStorage.getItem(
          "deviceUid"
        )) || "DEVICE-001";

      if (!token) {
        navigationRef.current?.navigate(
          "ResidentLogin"
        );
        return;
      }

      const currentSession =
        await getCurrentSession(
          token,
          deviceUid
        );

      const sessionId =
        currentSession?.sessionId ??
        currentSession?.id ??
        null;

      const status = String(
        currentSession?.status || ""
      )
        .trim()
        .toUpperCase();

      if (
        currentSession &&
        sessionId &&
        ACTIVE_SESSION_STATUSES.has(status)
      ) {
        console.log(
          "[PUSH] 현재 인터폰 세션 확인 완료",
          {
            sessionId,
            status,
          }
        );

        navigationRef.current?.navigate(
          "IntercomChat",
          {
            sessionId,
            activeSessionId: sessionId,
            intercomStatus: "incoming",
            enteredFrom: "pushNotification",
            refreshKey: Date.now(),
            token,
            deviceUid,
          }
        );

        return;
      }

      console.log(
        "[PUSH] 현재 진행 중인 인터폰 세션 없음"
      );

      navigationRef.current?.navigate(
        "MainTab",
        {
          screen: "홈",
          params: {
            refreshKey: Date.now(),
          },
        }
      );
    } catch (error) {
      console.error(
        "[PUSH] 알림 클릭 처리 실패:",
        error?.response?.data ||
          error?.message
      );

      navigationRef.current?.navigate(
        "MainTab",
        {
          screen: "홈",
          params: {
            refreshKey: Date.now(),
          },
        }
      );
    }
  };

  const processNotificationResponse =
    async (response) => {
      if (!response) return;

      await handleNotificationPress(
        response
      );

      try {
        await Notifications.clearLastNotificationResponseAsync();
      } catch (error) {
        console.log(
          "[PUSH] 마지막 알림 응답 초기화 실패:",
          error?.message
        );
      }
    };

  useEffect(() => {
    let isMounted = true;

    const checkUserAccessStatus =
      async () => {
        try {
          const token =
            await AsyncStorage.getItem(
              "accessToken"
            );

          const isVerified =
            await AsyncStorage.getItem(
              "isVerifiedUser"
            );

          if (!isMounted) return;

          if (
            token &&
            isVerified === "true"
          ) {
            setInitialRoute("MainTab");
          } else {
            setInitialRoute(
              "ResidentLogin"
            );
          }
        } catch (error) {
          console.error(
            "자동 로그인 확인 실패:",
            error?.message
          );

          if (isMounted) {
            setInitialRoute(
              "ResidentLogin"
            );
          }
        }
      };

    checkUserAccessStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const subscription =
      Notifications.addNotificationResponseReceivedListener(
        async (response) => {
          if (
            navigationRef.current?.isReady?.()
          ) {
            await processNotificationResponse(
              response
            );
          } else {
            pendingNotificationRef.current =
              response;
          }
        }
      );

    return () => {
      subscription.remove();
    };
  }, []);

  const handleNavigationReady =
    async () => {
      if (
        pendingNotificationRef.current
      ) {
        const response =
          pendingNotificationRef.current;

        pendingNotificationRef.current =
          null;

        await processNotificationResponse(
          response
        );

        return;
      }

      try {
        const lastResponse =
          await Notifications.getLastNotificationResponseAsync();

        if (lastResponse) {
          await processNotificationResponse(
            lastResponse
          );
        }
      } catch (error) {
        console.log(
          "[PUSH] 마지막 알림 응답 확인 실패:",
          error?.message
        );
      }
    };

  if (!initialRoute) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#F8F9FA",
        }}
      >
        <ActivityIndicator
          size="large"
          color="#06F393"
        />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={handleNavigationReady}
    >
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

        <Stack.Screen
          name="QrVerify"
          component={QrVerifyScreen}
        />

        <Stack.Screen
          name="MainTab"
          component={MainTabNavigator}
        />

        <Stack.Screen
          name="IntercomChat"
          component={IntercomChatScreen}
        />

        <Stack.Screen
          name="End"
          component={EndScreen}
        />

        <Stack.Screen
          name="HistorySearch"
          component={HistorySearchScreen}
        />

        <Stack.Screen
          name="HistorySearchResult"
          component={
            HistorySearchResultScreen
          }
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
          component={
            AdminHistorySearchResultScreen
          }
        />

        <Stack.Screen
          name="AdminHistoryDetail"
          component={
            AdminHistoryDetailScreen
          }
        />

        <Stack.Screen
          name="AdminBtnStat"
          component={AdminBtnStatScreen}
        />

        <Stack.Screen
          name="AdminMonitoringDetail"
          component={
            AdminMonitoringDetailScreen
          }
        />

        <Stack.Screen
          name="AdminMessageEdit"
          component={
            AdminMessageEditScreen
          }
        />

        <Stack.Screen
          name="AdminDeviceSearch"
          component={
            AdminDeviceSearchScreen
          }
        />

        <Stack.Screen
          name="AdminDeviceDetail"
          component={
            AdminDeviceDetailScreen
          }
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}