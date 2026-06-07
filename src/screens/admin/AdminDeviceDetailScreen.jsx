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
import { useNavigation, useRoute } from "@react-navigation/native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

import BASE_URL from "../../api/config";

const backIcon = require("../../assets/back_icon.png");

export default function AdminDeviceDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const { deviceId, item: passedItem } = route.params || {};

  const [device, setDevice] = useState(passedItem || null);
  const [isLoading, setIsLoading] = useState(!passedItem);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const getTargetDeviceId = () => {
    return (
      deviceId ||
      device?.id ||
      device?.deviceId ||
      passedItem?.id ||
      passedItem?.deviceId ||
      null
    );
  };

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

  const getStatusLabel = (statusValue) => {
    const status = getStatusType(statusValue);

    if (status === "ONLINE") return "온라인";
    if (status === "ERROR") return "오류";

    return "오프라인";
  };

  const getStatusColor = (statusValue) => {
    const status = getStatusType(statusValue);

    if (status === "ONLINE") return "#06F393";
    if (status === "ERROR") return "#FF5C5C";

    return "#999";
  };

  const getBatteryValue = () => {
    const value = Number(device?.battery ?? device?.batteryLevel ?? 0);

    if (Number.isNaN(value)) return 0;

    return value;
  };

  const getBatteryColor = (percent) => {
    if (percent > 70) return "#06F393";
    if (percent > 20) return "#FFB800";
    return "#FF5C5C";
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "기록 없음";

    try {
      const text = String(dateValue);

      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        return text;
      }

      const hasExplicitTimezone =
        text.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(text);

      if (hasExplicitTimezone) {
        const date = new Date(text);

        if (Number.isNaN(date.getTime())) return "기록 없음";

        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        const hh = String(date.getHours()).padStart(2, "0");
        const min = String(date.getMinutes()).padStart(2, "0");

        return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
      }

      return text.replace("T", " ").substring(0, 16).replace(/-/g, "/");
    } catch {
      return "기록 없음";
    }
  };

  const fetchDeviceDetail = async () => {
    const targetId = getTargetDeviceId();

    if (!targetId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      const token = await AsyncStorage.getItem("adminToken");

      if (!token) {
        navigation.navigate("AdminLogin");
        return;
      }

      const response = await axios.get(
        `${BASE_URL}/api/admin/devices/${targetId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data?.success && response.data?.data) {
        setDevice(response.data.data);
      } else if (passedItem) {
        setDevice(passedItem);
      }
    } catch (error) {
      console.error("장치 상세 조회 실패:", error?.message);

      if (passedItem) {
        setDevice(passedItem);
      } else {
        setDevice(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDeviceDetail();
  }, [deviceId]);

  const getActionInfo = (actionType) => {
    if (actionType === "disable") {
      return {
        title: "장치 비활성화",
        message: "이 장치를 비활성화하시겠습니까?",
        confirmText: "비활성화",
        successMessage: "장치가 비활성화되었습니다.",
      };
    }

    if (actionType === "enable") {
      return {
        title: "장치 활성화",
        message: "이 장치를 다시 활성화하시겠습니까?",
        confirmText: "활성화",
        successMessage: "장치가 활성화되었습니다.",
      };
    }

    if (actionType === "delete") {
      return {
        title: "장치 삭제",
        message: "이 장치를 삭제 처리하시겠습니까?",
        confirmText: "삭제",
        successMessage: "장치가 삭제 처리되었습니다.",
      };
    }

    return {
      title: "장치 제어",
      message: "요청을 처리하시겠습니까?",
      confirmText: "확인",
      successMessage: "요청이 처리되었습니다.",
    };
  };

  const handleControlDevice = async (actionType) => {
    const targetId = getTargetDeviceId();

    if (!targetId) {
      Alert.alert("오류", "장치 정보를 찾을 수 없습니다.");
      return;
    }

    const actionInfo = getActionInfo(actionType);

    Alert.alert(actionInfo.title, actionInfo.message, [
      {
        text: "취소",
        style: "cancel",
      },
      {
        text: actionInfo.confirmText,
        style: actionType === "delete" ? "destructive" : "default",
        onPress: async () => {
          try {
            setIsActionLoading(true);

            const token = await AsyncStorage.getItem("adminToken");

            if (!token) {
              Alert.alert("오류", "관리자 로그인이 필요합니다.");
              navigation.navigate("AdminLogin");
              return;
            }

            const response = await axios.patch(
              `${BASE_URL}/api/admin/devices/${targetId}/${actionType}`,
              {},
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );

            if (response.data?.success === false) {
              Alert.alert(
                "실패",
                response.data?.message || "요청 처리에 실패했습니다."
              );
              return;
            }

            Alert.alert("완료", actionInfo.successMessage, [
              {
                text: "확인",
                onPress: () => {
                  if (actionType === "delete") {
                    navigation.goBack();
                  } else {
                    fetchDeviceDetail();
                  }
                },
              },
            ]);
          } catch (error) {
            const serverError =
              error.response?.data?.message ||
              JSON.stringify(error.response?.data) ||
              error.message;

            console.error("장치 제어 실패:", serverError);
            Alert.alert("오류", "요청 처리에 실패했습니다.");
          } finally {
            setIsActionLoading(false);
          }
        },
      },
    ]);
  };

  const battery = getBatteryValue();

  return (
    <Container>
      <Header>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          disabled={isActionLoading}
        >
          <BackIcon source={backIcon} resizeMode="contain" />
        </TouchableOpacity>

        <HeaderTitle>장치 상세</HeaderTitle>

        <View style={{ width: 24 }} />
      </Header>

      {isLoading ? (
        <LoadingWrapper>
          <ActivityIndicator size="large" color="#06F393" />
        </LoadingWrapper>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 110 }}
        >
          <InfoCard>
            <CardTitle>장치 정보</CardTitle>

            <InfoRow>
              <Label>관리 ID</Label>
              <Value>{device?.id || device?.deviceId || "관리 ID 없음"}</Value>
            </InfoRow>

            <InfoRow>
              <Label>장치 UID</Label>
              <Value>{device?.deviceUid || "장치 UID 없음"}</Value>
            </InfoRow>

            <InfoRow>
              <Label>현재 상태</Label>
              <Value color={getStatusColor(device?.status)}>
                {getStatusLabel(device?.status)}
              </Value>
            </InfoRow>

            <InfoRow>
              <Label>등록 일시</Label>
              <Value>{formatDate(device?.createdAt)}</Value>
            </InfoRow>

            <InfoRow>
              <Label>최근 수정</Label>
              <Value>
                {formatDate(
                  device?.lastUpdate || device?.lastUpdatedAt || device?.updatedAt
                )}
              </Value>
            </InfoRow>

            <InfoRow>
              <Label>배터리</Label>
              <Value color={getBatteryColor(battery)}>{battery}%</Value>
            </InfoRow>

            <Divider />

            <CardTitle style={{ marginTop: 10 }}>장치 제어</CardTitle>

            <SettingItem>
              <SettingLabel color="#FFB800">비활성화</SettingLabel>

              <ActionButton
                onPress={() => handleControlDevice("disable")}
                disabled={isActionLoading}
              >
                <ActionButtonText>실행</ActionButtonText>
              </ActionButton>
            </SettingItem>

            <SettingItem>
              <SettingLabel color="#06F393">활성화</SettingLabel>

              <ActionButton
                onPress={() => handleControlDevice("enable")}
                disabled={isActionLoading}
              >
                <ActionButtonText>실행</ActionButtonText>
              </ActionButton>
            </SettingItem>

            <SettingItem style={{ borderBottomWidth: 0 }}>
              <SettingLabel color="#FF5C5C">삭제</SettingLabel>

              <DangerButton
                onPress={() => handleControlDevice("delete")}
                disabled={isActionLoading}
              >
                <DangerButtonText>삭제</DangerButtonText>
              </DangerButton>
            </SettingItem>
          </InfoCard>
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
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background-color: #fff;
  border-bottom-width: 1px;
  border-bottom-color: #EEF0F2;
`;

const BackIcon = styled.Image`
  width: 24px;
  height: 24px;
`;

const HeaderTitle = styled.Text`
  font-size: 18px;
  font-weight: 800;
  color: #333;
`;

const InfoCard = styled.View`
  background-color: #fff;
  margin: 20px 20px 0;
  padding: 20px;
  border-radius: 25px;
  elevation: 3;
  shadow-color: #000;
  shadow-opacity: 0.05;
  shadow-radius: 10px;
`;

const CardTitle = styled.Text`
  font-size: 17px;
  font-weight: 800;
  color: #222;
  margin-bottom: 20px;
`;

const InfoRow = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom-width: 1px;
  border-bottom-color: #F5F5F5;
`;

const Label = styled.Text`
  font-size: 14px;
  color: #666;
`;

const Value = styled.Text`
  flex: 1;
  text-align: right;
  font-size: 14px;
  font-weight: 700;
  color: ${(props) => props.color || "#333"};
`;

const Divider = styled.View`
  height: 1px;
  background-color: #EEE;
  margin: 15px 0;
`;

const SettingItem = styled(InfoRow)`
  align-items: center;
`;

const SettingLabel = styled.Text`
  font-size: 14px;
  font-weight: 700;
  color: ${(props) => props.color || "#333"};
`;

const ActionButton = styled.TouchableOpacity`
  padding: 8px 16px;
  border-radius: 14px;
  background-color: #F1F2F4;
`;

const ActionButtonText = styled.Text`
  font-size: 13px;
  font-weight: 800;
  color: #333;
`;

const DangerButton = styled(ActionButton)`
  background-color: #FFF1F1;
`;

const DangerButtonText = styled.Text`
  font-size: 13px;
  font-weight: 800;
  color: #FF5C5C;
`;

const LoadingWrapper = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
  padding-top: 100px;
`;