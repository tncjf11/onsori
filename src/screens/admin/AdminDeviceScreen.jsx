import React, { useState, useEffect } from "react";
import { ScrollView, TouchableOpacity, View, ActivityIndicator, Alert } from "react-native";
import styled from "styled-components/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import axios from "axios";

// 📥 관리자 마스터 키 수급을 위한 비밀금고 부품 임포트
import AsyncStorage from "@react-native-async-storage/async-storage";

// 🌐 config.js의 배포 주소
import BASE_URL from "../../api/config";

// ✅ 우리가 완착 개조해둔 리스트 아이템 부품 임포트
import DeviceListItem from "../../components/DeviceListItem";

// ✅ 이미지 에셋 (기존 bell.png 재사용)
const bellIcon = require("../../assets/bell.png");

export default function AdminDeviceScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused(); // 📱 장치 제어 후 돌아왔을 때 자동 새로고침 센서

  // 📱 백엔드 기기국에서 받아올 리얼 디바이스 데이터 상태창
  const [devices, setDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 📊 실시간 장치 상단 현황 계산용 상태창
  const [stats, setStats] = useState({ total: 0, online: 0, offline: 0, error: 0 });

  // =========================================================
  // 🔥 [재호 찐 디바이스 컨트롤러 연동] 전체 장치 목록 수급 엔진
  // =========================================================
  const fetchAllDevices = async () => {
    try {
      setIsLoading(true);
      console.log("▶️ [장치 관리] 기기 금고 내부 마스터 신분증 로드 중... 🔑");
      
      const token = await AsyncStorage.getItem("adminToken");
      if (!token) {
        console.log("❌ 관리자 토큰 누락 ➔ 로그인방 강제 퇴거");
        navigation.navigate("AdminLogin");
        return;
      }

      // 🎯 [명세서 찐 연동] GET /api/admin/devices 타격 & 마스터 토큰 헤더 적립
      const response = await axios.get(`${BASE_URL}/api/admin/devices`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log("▶️ [장치 목록 수신 완료] 응답 원본 확인:", response.data);

      if (response.data.success && response.data.data) {
        const deviceList = response.data.data;
        setDevices(deviceList);

        // 🧮 [실시간 수치 자동 계산 엔진] 
        // 하드코딩 데이터를 타파하고, 현재 리스트 상태값 대문자(ONLINE / OFFLINE / ERROR) 분기 필터링 카운트
        const total = deviceList.length;
        const online = deviceList.filter(d => d.status?.toUpperCase() === "ONLINE").length;
        const error = deviceList.filter(d => d.status?.toUpperCase() === "ERROR").length;
        const offline = total - online - error; // 나머지는 오프라인 마감

        setStats({ total, online, offline, error });
      }
    } catch (error) {
      console.error("🚨 [장치 목록 수급 대실패]:", error.message);
      Alert.alert("통신 오류", "백엔드 하드웨어 장부 수급에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      fetchAllDevices();
    }
  }, [isFocused]);

  return (
    <Container>
      {/* 3. 상단 헤더 영역 */}
      <Header>
        <Logo source={bellIcon} resizeMode="contain" />
        <HeaderTitle>장치 관리</HeaderTitle>
      </Header>

      {isLoading ? (
        <LoadingWrapper>
          <ActivityIndicator size="large" color="#06F393" />
          <LoadingText>기지국 연동 하드웨어 명단 동기화 중...</LoadingText>
        </LoadingWrapper>
      ) : (
        /* 하단 탭 바 간섭 우회 처리를 위해 contentContainerStyle 패딩 바텀 여백을 90으로 넉넉하게 고정 */
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
          
          {/* 4. 장치 현황 요약 카드 (실시간 수학 계산 주입 완료) */}
          <StatusCard>
            <CardHeader>
              <Ionicons name="card-outline" size={20} color="#333" />
              <CardHeaderText>장치 현황 관제</CardHeaderText>
            </CardHeader>
            
            <StatusRow>
              <StatusBox>
                <StatusLabel>전체 장치</StatusLabel>
                <StatusValue>{stats.total}</StatusValue>
              </StatusBox>
              <StatusBox>
                <StatusLabel>온라인</StatusLabel>
                <StatusValue color="#06F393">{stats.online}</StatusValue>
              </StatusBox>
              <StatusBox>
                <StatusLabel>오프라인</StatusLabel>
                <StatusValue>{stats.offline}</StatusValue>
              </StatusBox>
              <StatusBox style={{ borderRightWidth: 0 }}>
                <StatusLabel>오류</StatusLabel>
                <StatusValue color="#FF5C5C">{stats.error}</StatusValue>
              </StatusBox>
            </StatusRow>
          </StatusCard>

          {/* 5. 디바이스 목록 섹션 */}
          <ListHeaderArea>
            <ListTitle>디바이스 목록 ({devices.length})</ListTitle>
            <TouchableOpacity onPress={() => navigation.navigate("AdminDeviceSearch")}>
              <Ionicons name="search" size={24} color="#333" />
            </TouchableOpacity>
          </ListHeaderArea>

          <ListArea>
            {devices.length > 0 ? (
              devices.map((item, idx) => (
                <TouchableOpacity 
                  key={item.id || item.deviceUid || idx} 
                  activeOpacity={0.9}
                  // 🎯 카드를 터치하면 개별 기기를 차단/삭제할 수 있는 상세방으로 고유 ID를 메어 바통 터치
                  onPress={() => navigation.navigate("AdminDeviceDetail", { deviceId: item.id, item: item })}
                >
                  <DeviceListItem item={item} />
                </TouchableOpacity>
              ))
            ) : (
              <EmptyWrapper>
                <Ionicons name="hardware-handle-outline" size={40} color="#DDD" />
                <EmptyText>현재 네트워크에 등록된 인터폰 기기가 없습니다.</EmptyText>
              </EmptyWrapper>
            )}
          </ListArea>

        </ScrollView>
      )}
    </Container>
  );
}

/* ================= 스타일 정의 (수철님 명품 시안 컴포넌트 100% 철통 보존) ================= */
const Container = styled(SafeAreaView)` flex: 1; background-color: #F8F9FA; `;
const Header = styled.View` flex-direction: row; align-items: center; padding: 15px 20px; background-color: #fff; border-bottom-width: 1px; border-bottom-color: #F0F0F0; `;
const Logo = styled.Image` width: 32px; height: 32px; margin-right: 10px; `;
const HeaderTitle = styled.Text` font-size: 20px; font-weight: 800; color: #333; `;

const StatusCard = styled.View` background-color: #fff; margin: 20px; padding: 20px; border-radius: 25px; elevation: 5; shadow-color: #000; shadow-opacity: 0.05; shadow-radius: 10px; `;
const CardHeader = styled.View` flex-direction: row; align-items: center; margin-bottom: 20px; `;
const CardHeaderText = styled.Text` font-size: 16px; font-weight: 700; color: #333; margin-left: 10px; `;

const StatusRow = styled.View` flex-direction: row; background-color: #F5F5F5; border-radius: 15px; padding: 15px 5px; `;
const StatusBox = styled.View` flex: 1; align-items: center; border-right-width: 1px; border-right-color: #E0E0E0; `;
const StatusLabel = styled.Text` font-size: 11px; color: #999; margin-bottom: 5px; `;
const StatusValue = styled.Text` font-size: 18px; font-weight: 800; color: ${props => props.color || "#333"}; `;

const ListHeaderArea = styled.View` flex-direction: row; justify-content: space-between; align-items: center; padding: 10px 25px 15px; `;
const ListTitle = styled.Text` font-size: 18px; font-weight: 800; color: #333; `;
const ListArea = styled.View` width: 100%; `;

const LoadingWrapper = styled.View` flex: 1; justify-content: center; align-items: center; padding-top: 100px; `;
const LoadingText = styled.Text` font-size: 13px; color: #718096; font-weight: 600; margin-top: 12px; `;
const EmptyWrapper = styled.View` padding: 60px 20px; justify-content: center; align-items: center; `;
const EmptyText = styled.Text` font-size: 14px; color: #BBB; font-weight: 600; margin-top: 10px; `;