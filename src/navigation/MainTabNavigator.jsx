import React from "react";
import { Platform, Alert } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import styled from "styled-components/native";

// ✅ 연결할 진짜 실전 화면들 임포트
import HomeScreen from "../screens/user/HomeScreen";
import IntercomChatScreen from "../screens/user/IntercomChatScreen";
import HistoryScreen from "../screens/user/HistoryScreen"; 
import SettingScreen from "../screens/user/SettingScreen";

// ✅ 하단 탭용 명품 이미지 에셋 (철통 보존 🤙)
const tabHome = require("../assets/tab_home.png");
const tabIntercom = require("../assets/tab_call.png"); 
const tabHistory = require("../assets/tab_history.png");
const tabSetting = require("../assets/tab_setting.png");

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false, // ⚠️ 이미지에 글자가 포함되어 있으니 기본 라벨은 OFF
        tabBarActiveTintColor: "#06F393",
        tabBarInactiveTintColor: "#BBBBBB",
        tabBarStyle: {
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
        tabBarIcon: ({ color }) => {
          let iconSource;
          if (route.name === "홈") iconSource = tabHome;
          else if (route.name === "인터폰") iconSource = tabIntercom;
          else if (route.name === "히스토리") iconSource = tabHistory;
          else if (route.name === "설정") iconSource = tabSetting;

          return (
            <TabIcon 
              source={iconSource} 
              style={{ tintColor: color }}
              resizeMode="contain"
            />
          );
        },
      })}
    >
      <Tab.Screen name="홈" component={HomeScreen} />
      
      {/* ⚡ [인터폰 가드막 구역쇼 🤙] */}
      <Tab.Screen 
        name="인터폰" 
        component={IntercomChatScreen} 
        initialParams={{ sessionId: null }} 
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            const navigationState = navigation.getState();
            const homeRoute = navigationState?.routes?.find(r => r.name === "홈");
            
            // 🎯 [싱크 완료] HomeScreen의 setParams와 100% 자석 결합되는 실시간 상태 명찰 축입니다.
            const currentStatus = homeRoute?.params?.intercomStatus || "idle";

            console.log(`▶️ [하단 탭 가드막] 인터폰 탭 터치됨 ➔ 현재 홈화면 실시간 상태: ${currentStatus}`);

            // 호출 중(incoming) 상태가 아닐 때는 진입을 원천 차단하고 팝업을 띄웁니다.
            if (currentStatus !== "incoming") {
              e.preventDefault();
              Alert.alert(
                "접근 제한", 
                "현재 호출된 인터폰 연결이 없습니다.\n외부 방문객이 벨을 누를 때만 진입할 수 있쇼! 🤙"
              );
            }
          },
        })}
      />
      
      {/* 🤙 [🚨 찐빠 최종 진화 구역] 
          홈 화면에서 MainTab ➔ '히스토리'로 연동 주소를 던져줄 때 엇박자 없이 자석처럼 뽈칵 매치되도록 
          순정 한글 탭 스크린 명찰 아키텍처를 견고하게 유지 확인 완료쇼! */}
      <Tab.Screen name="히스토리" component={HistoryScreen} />
      
      <Tab.Screen name="설정" component={SettingScreen} />
    </Tab.Navigator>
  );
}

// 스타일 컴포넌트 핏 100% 보존쇼 🤙
const TabIcon = styled.Image`
  width: 40px; 
  height: 40px;
  margin-top: 5px;
`;