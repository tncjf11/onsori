import React, { useState, useEffect } from "react";
import {
  ScrollView,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
} from "react-native";
import styled from "styled-components/native";
import { SafeAreaView as SafeAreaContainer } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

import BASE_URL from "../../api/config";
import DeviceListItem from "../../components/DeviceListItem";
import AdminSummaryBox from "../../components/AdminSummaryBox";

const bellIcon = require("../../assets/bell.png");

export default function AdminDeviceScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const [devices, setDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    online: 0,
    offline: 0,
    error: 0,
  });

  const getStatusType = (statusValue) => {
    const status = String(statusValue || "").toUpperCase();

    if (status === "ONLINE" || status === "ACTIVE" || status === "ENABLED") {
      return "ONLINE";
    }

    if (status === "ERROR" || status === "FAIL" || status === "FAILED") {
      return "ERROR";
    }

    return "OFFLINE";
  };

  const buildStats = (deviceList) => {
    const total = deviceList.length;
    const online = deviceList.filter(
      (device) => getStatusType(device.status) === "ONLINE"
    ).length;
    const error = deviceList.filter(
      (device) => getStatusType(device.status) === "ERROR"
    ).length;
    const offline = total - online - error;

    return {
      total,
      online,
      offline,
      error,
    };
  };

  const resetDevices = () => {
    setDevices([]);
    setStats({
      total: 0,
      online: 0,
      offline: 0,
      error: 0,
    });
  };

  const fetchAllDevices = async () => {
    try {
      setIsLoading(true);

      const token = await AsyncStorage.getItem("adminToken");

      if (!token) {
        resetDevices();
        navigation.navigate("AdminLogin");
        return;
      }

      const response = await axios.get(`${BASE_URL}/api/admin/devices`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data?.success && Array.isArray(response.data?.data)) {
        const deviceList = response.data.data;

        setDevices(deviceList);
        setStats(buildStats(deviceList));
      } else {
        resetDevices();
      }
    } catch (error) {
      console.error("장치 목록 조회 실패:", error?.message);
      resetDevices();
      Alert.alert("오류", "장치 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      fetchAllDevices();
    }
  }, [isFocused]);

  const handlePressDevice = (item) => {
    navigation.navigate("AdminDeviceDetail", {
      deviceId: item.id || item.deviceId,
      item,
    });
  };

  return (
    <Container>
      <Header>
        <Logo source={bellIcon} resizeMode="contain" />
        <HeaderTitle>장치 관리</HeaderTitle>
      </Header>

      {isLoading ? (
        <LoadingWrapper>
          <ActivityIndicator size="large" color="#06F393" />
          <LoadingText>장치 목록을 불러오는 중...</LoadingText>
        </LoadingWrapper>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 90 }}
        >
          <AdminSummaryBox data={stats} />

          <ListHeaderArea>
            <ListTitle>장치 목록 ({devices.length})</ListTitle>

            <TouchableOpacity
              onPress={() => navigation.navigate("AdminDeviceSearch")}
            >
              <Ionicons name="search" size={24} color="#333" />
            </TouchableOpacity>
          </ListHeaderArea>

          <ListArea>
            {devices.length > 0 ? (
              devices.map((item, idx) => (
                <TouchableOpacity
                  key={item.id || item.deviceId || item.deviceUid || idx}
                  activeOpacity={0.9}
                  onPress={() => handlePressDevice(item)}
                >
                  <DeviceListItem item={item} />
                </TouchableOpacity>
              ))
            ) : (
              <EmptyWrapper>
                <Ionicons name="hardware-handle-outline" size={40} color="#DDD" />
                <EmptyText>등록된 장치가 없습니다.</EmptyText>
              </EmptyWrapper>
            )}
          </ListArea>
        </ScrollView>
      )}
    </Container>
  );
}

const Container = styled(SafeAreaContainer)`
  flex: 1;
  background-color: #F8F9FA;
`;

const Header = styled.View`
  flex-direction: row;
  align-items: center;
  padding: 15px 20px;
  background-color: #fff;
  border-bottom-width: 1px;
  border-bottom-color: #F0F0F0;
`;

const Logo = styled.Image`
  width: 32px;
  height: 32px;
  margin-right: 10px;
`;

const HeaderTitle = styled.Text`
  font-size: 20px;
  font-weight: 800;
  color: #333;
`;

const ListHeaderArea = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 10px 25px 15px;
`;

const ListTitle = styled.Text`
  font-size: 18px;
  font-weight: 800;
  color: #333;
`;

const ListArea = styled.View`
  width: 100%;
`;

const LoadingWrapper = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
  padding-top: 100px;
`;

const LoadingText = styled.Text`
  font-size: 13px;
  color: #718096;
  font-weight: 600;
  margin-top: 12px;
`;

const EmptyWrapper = styled.View`
  padding: 60px 20px;
  justify-content: center;
  align-items: center;
`;

const EmptyText = styled.Text`
  font-size: 14px;
  color: #BBB;
  font-weight: 600;
  margin-top: 10px;
`;