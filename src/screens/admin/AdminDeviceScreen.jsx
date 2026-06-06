import React, { useState, useEffect } from "react";
import { ScrollView, TouchableOpacity, View, ActivityIndicator, Alert } from "react-native";
import styled from "styled-components/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import axios from "axios";

// 📥 관리자 마스터 키 수급 및 부품 임포트
import AsyncStorage from "@react-native-async-storage/async-storage";
import BASE_URL from "../../api/config";

// ✅ 완착 개조된 컴포넌트들
import DeviceListItem from "../../components/DeviceListItem";
import AdminSummaryBox from "../../components/AdminSummaryBox"; 

const bellIcon = require("../../assets/bell.png");

export default function AdminDeviceScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const [devices, setDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, online: 0, offline: 0, error: 0 });

  const fetchAllDevices = async () => {
    try {
      setIsLoading(true);
      const token = await AsyncStorage.getItem("adminToken");
      if (!token) {
        navigation.navigate("AdminLogin");
        return;
      }

      const response = await axios.get(`${BASE_URL}/api/admin/devices`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success && response.data.data) {
        const deviceList = response.data.data;
        setDevices(deviceList);

        const total = deviceList.length;
        const online = deviceList.filter(d => d.status?.toUpperCase() === "ONLINE").length;
        const error = deviceList.filter(d => d.status?.toUpperCase() === "ERROR").length;
        const offline = total - online - error;

        setStats({ total, online, offline, error });
      }
    } catch (error) {
      Alert.alert("통신 오류", "장치 데이터를 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) fetchAllDevices();
  }, [isFocused]);

  return (
    <Container>
      <Header>
        <Logo source={bellIcon} resizeMode="contain" />
        <HeaderTitle>장치 관리</HeaderTitle>
      </Header>

      {isLoading ? (
        <LoadingWrapper>
          <ActivityIndicator size="large" color="#06F393" />
          <LoadingText>장치 목록 동기화 중...</LoadingText>
        </LoadingWrapper>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
          
          {/* 🎯 [컴포넌트화 완료] AdminSummaryBox 적용 */}
          <AdminSummaryBox data={stats} />

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
                  onPress={() => navigation.navigate("AdminDeviceDetail", { deviceId: item.id, item: item })}
                >
                  <DeviceListItem item={item} />
                </TouchableOpacity>
              ))
            ) : (
              <EmptyWrapper>
                <Ionicons name="hardware-handle-outline" size={40} color="#DDD" />
                <EmptyText>등록된 기기가 없습니다.</EmptyText>
              </EmptyWrapper>
            )}
          </ListArea>
        </ScrollView>
      )}
    </Container>
  );
}

const Container = styled(SafeAreaView)` flex: 1; background-color: #F8F9FA; `;
const Header = styled.View` flex-direction: row; align-items: center; padding: 15px 20px; background-color: #fff; border-bottom-width: 1px; border-bottom-color: #F0F0F0; `;
const Logo = styled.Image` width: 32px; height: 32px; margin-right: 10px; `;
const HeaderTitle = styled.Text` font-size: 20px; font-weight: 800; color: #333; `;
const ListHeaderArea = styled.View` flex-direction: row; justify-content: space-between; align-items: center; padding: 10px 25px 15px; `;
const ListTitle = styled.Text` font-size: 18px; font-weight: 800; color: #333; `;
const ListArea = styled.View` width: 100%; `;
const LoadingWrapper = styled.View` flex: 1; justify-content: center; align-items: center; padding-top: 100px; `;
const LoadingText = styled.Text` font-size: 13px; color: #718096; font-weight: 600; margin-top: 12px; `;
const EmptyWrapper = styled.View` padding: 60px 20px; justify-content: center; align-items: center; `;
const EmptyText = styled.Text` font-size: 14px; color: #BBB; font-weight: 600; margin-top: 10px; `;