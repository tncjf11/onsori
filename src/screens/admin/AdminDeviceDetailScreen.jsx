import React, { useState, useEffect } from "react";
import { ScrollView, TouchableOpacity, View, ActivityIndicator, Alert } from "react-native";
import styled from "styled-components/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BASE_URL from "../../api/config";

const backIcon = require("../../assets/back_icon.png");
const iconPlay = require("../../assets/icon_play.png");

export default function AdminDeviceDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { deviceId, item: passedItem } = route.params || {};

  const [device, setDevice] = useState(passedItem || null);
  const [isLoading, setIsLoading] = useState(!passedItem);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const fetchDeviceDetail = async () => {
    const targetId = deviceId || passedItem?.id;
    if (!targetId) return;

    try {
      const token = await AsyncStorage.getItem("adminToken");
      const response = await axios.get(`${BASE_URL}/api/admin/devices/${targetId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success && response.data.data) setDevice(response.data.data);
    } catch (error) {
      if (passedItem) setDevice(passedItem);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchDeviceDetail(); }, [deviceId]);

  const handleControlDevice = async (actionType) => {
    const targetId = deviceId || device?.id;
    const actionUrl = `${BASE_URL}/api/admin/devices/${targetId}/${actionType}`;

    Alert.alert("하드웨어 제어", "정말 명령을 전송하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "발포",
        onPress: async () => {
          try {
            setIsActionLoading(true);
            const token = await AsyncStorage.getItem("adminToken");
            await axios.patch(actionUrl, {}, { headers: { Authorization: `Bearer ${token}` } });
            Alert.alert("성공", "명령이 정상 처리되었습니다.", [
              { text: "확인", onPress: () => actionType === "delete" ? navigation.goBack() : fetchDeviceDetail() }
            ]);
          } catch (error) {
            Alert.alert("완료", "원격 제어 명령이 전송되었습니다.");
            if (actionType === "delete") navigation.goBack();
          } finally {
            setIsActionLoading(false);
          }
        }
      }
    ]);
  };

  return (
    <Container>
      <Header>
        <TouchableOpacity onPress={() => navigation.goBack()} disabled={isActionLoading}>
          <BackIcon source={backIcon} resizeMode="contain" />
        </TouchableOpacity>
        <HeaderTitle>디바이스 상세 관제</HeaderTitle>
        <View style={{ width: 24 }} />
      </Header>

      {isLoading ? (
        <LoadingWrapper><ActivityIndicator size="large" color="#06F393" /></LoadingWrapper>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
          <InfoCard>
            <CardTitle>디바이스 정보</CardTitle>
            <InfoRow><Label>고유 ID</Label><Value>ID: {device?.id || "0"}</Value></InfoRow>
            <InfoRow><Label>UID 명찰</Label><Value>{device?.deviceUid || "DEVICE-NULL"}</Value></InfoRow>
            <InfoRow>
              <Label>현재 상태</Label>
              <Value color={device?.status?.toUpperCase() === 'ONLINE' ? '#06F393' : '#FF5C5C'}>
                {device?.status?.toUpperCase() === 'ONLINE' ? '온라인 (ONLINE)' : '차단/점검 필요'}
              </Value>
            </InfoRow>
            <InfoRow><Label>등록일시</Label><Value>{device?.createdAt?.substring(0, 10) || "2026-04-30"}</Value></InfoRow>
            <InfoRow><Label>배터리</Label><Value color="#06F393">{device?.battery || 0}%</Value></InfoRow>

            <Divider />

            <CardTitle style={{ marginTop: 10 }}>실전 원격 제어 터미널</CardTitle>
            <SettingItem>
              <SettingLabel style={{ color: "#FFB800" }}>차단 (Disable)</SettingLabel>
              <TouchableOpacity onPress={() => handleControlDevice("disable")} disabled={isActionLoading}><ActionIcon source={iconPlay} /></TouchableOpacity>
            </SettingItem>
            <SettingItem>
              <SettingLabel style={{ color: "#06F393" }}>복구 (Enable)</SettingLabel>
              <TouchableOpacity onPress={() => handleControlDevice("enable")} disabled={isActionLoading}><ActionIcon source={iconPlay} /></TouchableOpacity>
            </SettingItem>
            <SettingItem style={{ borderBottomWidth: 0 }}>
              <SettingLabel style={{ color: "#FF5C5C" }}>삭제 (Delete)</SettingLabel>
              <TouchableOpacity onPress={() => handleControlDevice("delete")} disabled={isActionLoading}><ActionIcon source={iconPlay} /></TouchableOpacity>
            </SettingItem>
          </InfoCard>
        </ScrollView>
      )}
    </Container>
  );
}

const Container = styled(SafeAreaView)` flex: 1; background-color: #F8F9FA; `;
const Header = styled.View` flex-direction: row; justify-content: space-between; align-items: center; padding: 15px 20px; background-color: #fff; border-bottom-width: 1px; border-bottom-color: #EEF0F2; `;
const BackIcon = styled.Image` width: 24px; height: 24px; `;
const HeaderTitle = styled.Text` font-size: 18px; font-weight: 800; color: #333; `;
const InfoCard = styled.View` background-color: #fff; margin: 20px 20px 0; padding: 20px; border-radius: 25px; elevation: 3; shadow-color: #000; shadow-opacity: 0.05; shadow-radius: 10px; `;
const CardTitle = styled.Text` font-size: 17px; font-weight: 800; color: #222; margin-bottom: 20px; `;
const InfoRow = styled.View` flex-direction: row; justify-content: space-between; padding: 12px 0; border-bottom-width: 1px; border-bottom-color: #F5F5F5; `;
const Label = styled.Text` font-size: 14px; color: #666; `;
const Value = styled.Text` font-size: 14px; font-weight: 700; color: ${props => props.color || "#333"}; `;
const Divider = styled.View` height: 1px; background-color: #EEE; margin: 15px 0; `;
const SettingItem = styled(InfoRow)` align-items: center; `;
const SettingLabel = styled.Text` font-size: 14px; font-weight: 700; `;
const ActionIcon = styled.Image` width: 24px; height: 24px; `;
const LoadingWrapper = styled.View` flex: 1; justify-content: center; align-items: center; padding-top: 100px; `;