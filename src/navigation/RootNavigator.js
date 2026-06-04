import React, { useState, useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

// 📥 기기 내부 영구 금고 임포트 (자동 로그인 도장 검문용)
import AsyncStorage from "@react-native-async-storage/async-storage";

// =========================================================
// 📱 [ USER FLOW (거주자 라인) ] - 무죄 석방 순정 보존구역 🤙
// =========================================================
// ✂️ [파쇄 완료] UX 개편으로 더 이상 쓰이지 않는 CallEndScreen의 유령 임포트 선로를 완전히 도려냈습니다!
import DeviceSettingScreen from "../screens/user/DeviceSettingScreen";
import EndScreen from "../screens/user/EndScreen";
import HistorySearchResultScreen from "../screens/user/HistorySearchResultScreen";
import HistorySearchScreen from "../screens/user/HistorySearchScreen";
import IntercomChatScreen from "../screens/user/IntercomChatScreen";
import QrVerifyScreen from "../screens/user/QrVerifyScreen";
import ResidentLoginScreen from "../screens/user/ResidentLoginScreen";
import TermsPolicyScreen from "../screens/user/TermsPolicyScreen";
import MainTabNavigator from "./MainTabNavigator"; // 사용자 탭 바 네비게이터

// =========================================================
// 📡 [ ADMIN FLOW (관리자 라인) ] - 백엔드 7대 컨트롤러 통합 패치 반영! 🚀
// =========================================================
import AdminBtnStatScreen from "../screens/admin/AdminBtnStatScreen"; // 📈 상용구 응답 통계 분석 스크린
import AdminCallLogScreen from "../screens/admin/AdminCallLogScreen"; // 🗂️ 전체 기록 및 실시간 키워드 검색 대통합 기지
import AdminDeviceDetailScreen from "../screens/admin/AdminDeviceDetailScreen"; // 💻 디바이스 원격 차단/활성화/삭제 통제 스크린
import AdminDeviceSearchScreen from "../screens/admin/AdminDeviceSearchScreen"; // 🔍 하드웨어 고유 UID 레이더 검색 스크린
import AdminLoginScreen from "../screens/admin/AdminLoginScreen";
import AdminMessageEditScreen from "../screens/admin/AdminMessageEditScreen"; // ✏️ 자막 정밀 수정 및 과거 타임라인 이력 아카이브 스크린
import AdminMonitoringDetailScreen from "../screens/admin/AdminMonitoringDetailScreen"; // 🖥️ 실시간 관제탑 및 원격 바로 수정 스크린
import AdminTabNavigator from "./AdminTabNavigator"; // 관리자 탭 바 네비게이터

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  // 📱 앱 첫 진입 시 대문 화면을 동적으로 가리키기 위한 상태창
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    const checkUserAccessStatus = async () => {
      try {
        // 🔒 기기 보관소 금고에서 토큰과 QR 인증 완료 스탬프를 확인합니다.
        const token = await AsyncStorage.getItem("accessToken");
        const isVerified = await AsyncStorage.getItem("isVerifiedUser");

        // 🎯 [자연스러운 하이패스 가드]
        // 두 장부가 모두 유효한 유저라면 로그인방과 QR 인증방을 생략하고 메인 홈으로 직송 연결합니다.
        if (token && isVerified === "true") {
          console.log("🎯 [자동 로그인 승인] 인증 장부가 확인되어 메인 탭으로 바로 진입합니다.");
          setInitialRoute("MainTab");
        } else {
          // 기록이 없는 새로운 계정이거나 첫 진입이라면 순정 대문인 ResidentLogin으로 인계합니다.
          console.log("🆕 [신규 인증 필요] 연동 기록이 없어 로그인 화면으로 이동합니다.");
          setInitialRoute("ResidentLogin");
        }
      } catch (error) {
        console.error("🚨 [자동 로그인 검문 런타임 찐빠]:", error.message);
        setInitialRoute("ResidentLogin");
      }
    };

    checkUserAccessStatus();
  }, []);

  // ⏱️ 장고 서랍장 검문이 끝나기 전까지 흰색 화면 마감 및 안전 로딩바 구동
  if (!initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8F9FA" }}>
        <ActivityIndicator size="large" color="#06F393" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName={initialRoute} // 🎯 검문 결과에 따라 ResidentLogin 또는 MainTab이 유동적으로 파킹됩니다.
        screenOptions={{ 
          headerShown: false, 
          animation: "fade" // 📱 시안 감성에 맞게 화면 전환을 부드러운 페이드 효과로 연출!
        }}
      >
        {/* =========================================================
            📱 USER FLOW (거주자 진영 선로)
           ========================================================= */}
        <Stack.Screen name="ResidentLogin" component={ResidentLoginScreen} />
        <Stack.Screen name="QrVerify" component={QrVerifyScreen} />
        <Stack.Screen name="MainTab" component={MainTabNavigator} />
        <Stack.Screen name="IntercomChat" component={IntercomChatScreen} />
        {/* ✂️ [파쇄 완료] 대화방에서 히스토리로 바로 점프하므로, 불필요한 CallEndScreen 스택 선로를 완전히 격하 삭제했습니다. */}
        <Stack.Screen name="End" component={EndScreen} /> 
        <Stack.Screen name="HistorySearch" component={HistorySearchScreen} />
        <Stack.Screen name="HistorySearchResult" component={HistorySearchResultScreen} />
        <Stack.Screen name="DeviceSetting" component={DeviceSettingScreen} />
        <Stack.Screen name="TermsPolicy" component={TermsPolicyScreen} />

        {/* =========================================================
            📡 ADMIN FLOW (관리자 관제탑 진영 선로 🤙)
           ========================================================= */}
        <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
        
        {/* 🎯 [명찰 싱크 완료] 로그인 스크린 내부의 하이패스 워프 목적지와 명찰을 'AdminDashboard'로 완벽 스위칭 매칭! */}
        <Stack.Screen name="AdminDashboard" component={AdminTabNavigator} />
        
        {/* 실전 API 요격형 화면 액션 선로들 배선 연동 */}
        <Stack.Screen name="AdminCallLog" component={AdminCallLogScreen} />
        <Stack.Screen name="AdminBtnStat" component={AdminBtnStatScreen} />
        <Stack.Screen name="AdminMonitoringDetail" component={AdminMonitoringDetailScreen} />
        <Stack.Screen name="AdminMessageEdit" component={AdminMessageEditScreen} />
        <Stack.Screen name="AdminDeviceSearch" component={AdminDeviceSearchScreen} />
        <Stack.Screen name="AdminDeviceDetail" component={AdminDeviceDetailScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}