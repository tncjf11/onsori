import React from "react";
import { Platform, Alert } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import styled from "styled-components/native";

import HomeScreen from "../screens/user/HomeScreen";
import IntercomChatScreen from "../screens/user/IntercomChatScreen";
import HistoryScreen from "../screens/user/HistoryScreen";
import SettingScreen from "../screens/user/SettingScreen";

const tabHome = require("../assets/tab_home.png");
const tabIntercom = require("../assets/tab_call.png");
const tabHistory = require("../assets/tab_history.png");
const tabSetting = require("../assets/tab_setting.png");

const Tab = createBottomTabNavigator();

const logMainTab = (message, data) => {
  if (data !== undefined) {
    console.log(`[MAIN_TAB] ${message}`, data);
  } else {
    console.log(`[MAIN_TAB] ${message}`);
  }
};

export default function MainTabNavigator() {
  const getTabIcon = (routeName) => {
    if (routeName === "홈") return tabHome;
    if (routeName === "인터폰") return tabIntercom;
    if (routeName === "히스토리") return tabHistory;
    if (routeName === "설정") return tabSetting;

    return tabHome;
  };

  const getMainTabRouteParams = (navigation) => {
    try {
      const parentState = navigation.getParent?.()?.getState?.();
      const mainTabRoute = parentState?.routes?.find(
        (route) => route.name === "MainTab"
      );

      return mainTabRoute?.params || {};
    } catch (error) {
      logMainTab("MainTab 부모 route 정보 확인 실패", error?.message);
      return {};
    }
  };

  const getHomeRouteParams = (navigation) => {
    try {
      const navigationState = navigation.getState();
      const homeRoute = navigationState?.routes?.find(
        (route) => route.name === "홈"
      );

      return homeRoute?.params || {};
    } catch (error) {
      logMainTab("홈 route 정보 확인 실패", error?.message);
      return {};
    }
  };

  const getHomeRouteInfo = (navigation) => {
    const parentParams = getMainTabRouteParams(navigation);
    const homeParams = getHomeRouteParams(navigation);

    const hasParentStatus = Object.prototype.hasOwnProperty.call(
      parentParams,
      "intercomStatus"
    );

    const hasParentSessionId = Object.prototype.hasOwnProperty.call(
      parentParams,
      "activeSessionId"
    );

    const intercomStatus = hasParentStatus
      ? parentParams.intercomStatus || "idle"
      : homeParams.intercomStatus || "idle";

    const activeSessionId = hasParentSessionId
      ? parentParams.activeSessionId || null
      : homeParams.activeSessionId || null;

    return {
      intercomStatus,
      activeSessionId,
    };
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
        tabBarIcon: ({ color }) => (
          <TabIcon
            source={getTabIcon(route.name)}
            style={{ tintColor: color }}
            resizeMode="contain"
          />
        ),
      })}
    >
      <Tab.Screen name="홈" component={HomeScreen} />

      <Tab.Screen
        name="인터폰"
        component={IntercomChatScreen}
        listeners={({ navigation }) => ({
          tabPress: (event) => {
            const { intercomStatus, activeSessionId } =
              getHomeRouteInfo(navigation);

            logMainTab("인터폰 탭 클릭", {
              intercomStatus,
              activeSessionId,
            });

            if (intercomStatus !== "incoming") {
              event.preventDefault();

              logMainTab("인터폰 탭 차단 - 현재 호출 없음", {
                intercomStatus,
              });

              Alert.alert(
                "접근 제한",
                "현재 연결된 인터폰 호출이 없습니다.\n방문객 호출이 들어왔을 때만 진입할 수 있습니다."
              );

              return;
            }

            if (!activeSessionId) {
              event.preventDefault();

              logMainTab("인터폰 탭 차단 - sessionId 없음", {
                intercomStatus,
                activeSessionId,
              });

              Alert.alert(
                "세션 확인 중",
                "인터폰 세션 정보를 확인하는 중입니다.\n잠시 후 다시 시도해 주세요."
              );

              return;
            }

            event.preventDefault();

            logMainTab("인터폰 탭 진입 허용", {
              sessionId: activeSessionId,
            });

            navigation.navigate("인터폰", {
              sessionId: activeSessionId,
              enteredFrom: "mainTab",
              refreshKey: Date.now(),
            });
          },
        })}
      />

      <Tab.Screen name="히스토리" component={HistoryScreen} />

      <Tab.Screen name="설정" component={SettingScreen} />
    </Tab.Navigator>
  );
}

const TabIcon = styled.Image`
  width: 40px;
  height: 40px;
  margin-top: 5px;
`;