import React, { useState, useEffect } from "react";
import {
  ScrollView,
  TouchableOpacity,
  View,
  Modal,
  Dimensions,
} from "react-native";
import styled from "styled-components/native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView as SafeAreaContainer } from "react-native-safe-area-context";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

import BASE_URL from "../../api/config";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const bellIcon = require("../../assets/bell.png");
const checkOn = require("../../assets/check_on.png");
const checkOff = require("../../assets/check_off.png");
const arrowRight = require("../../assets/arrow_right.png");
const logoutIcon = require("../../assets/logout_icon.png");
const deleteUserIcon = require("../../assets/delete_user_icon.png");

const logoutOverlayImg = require("../../assets/logout_overlay.png");
const deleteUserOverlayImg = require("../../assets/delete_user_overlay.png");

const USER_STORAGE_KEYS = [
  "accessToken",
  "isVerifiedUser",
  "userName",
  "userId",
  "isPushTokenSaved",
];

const SETTING_STORAGE_KEYS = [
  "callVibrate",
  "callSound",
  "subtitleVibrate",
];

export default function SettingScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const [isVibrateCall, setIsVibrateCall] = useState(false);
  const [isSoundCall, setIsSoundCall] = useState(false);
  const [isVibrateSubtitle, setIsVibrateSubtitle] = useState(false);

  const [userName, setUserName] = useState("로딩 중...");
  const [userId, setUserId] = useState("로딩 중...");

  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);
  const [isDeleteUserModalVisible, setIsDeleteUserModalVisible] = useState(false);
  const [showErrorBanner, setShowErrorBanner] = useState(false);

  const loadHardwareAndUserInfo = async () => {
    try {
      const vCall = await AsyncStorage.getItem("callVibrate");
      const sCall = await AsyncStorage.getItem("callSound");
      const vSub = await AsyncStorage.getItem("subtitleVibrate");

      setIsVibrateCall(vCall === "true");
      setIsSoundCall(sCall === "true");
      setIsVibrateSubtitle(vSub === "true");

      const savedName = await AsyncStorage.getItem("userName");
      const savedId = await AsyncStorage.getItem("userId");

      setUserName(savedName || "카카오 연동 유저");
      setUserId(savedId || "정보 없음");
    } catch (error) {
      console.error("설정 정보 로드 실패:", error?.message);
    }
  };

  useEffect(() => {
    if (isFocused) {
      loadHardwareAndUserInfo();
    }
  }, [isFocused]);

  useEffect(() => {
    const savePushTokenToServer = async () => {
      try {
        const isPushSaved = await AsyncStorage.getItem("isPushTokenSaved");
        if (isPushSaved === "true") return;

        const realJwt = await AsyncStorage.getItem("accessToken");

        const dummyExpoPushToken = "ExponentPushToken[vx_onsori_2026]";

        if (!realJwt) {
          setShowErrorBanner(true);
          return;
        }

        const response = await axios.post(
          `${BASE_URL}/api/push-tokens`,
          {
            token: dummyExpoPushToken,
          },
          {
            headers: {
              Authorization: `Bearer ${realJwt}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (response.status >= 200 && response.status < 300) {
          await AsyncStorage.setItem("isPushTokenSaved", "true");
          setShowErrorBanner(false);
        }
      } catch (error) {
        console.error("푸시 토큰 등록 실패:", error?.message);
        setShowErrorBanner(true);
      }
    };

    if (isFocused) {
      savePushTokenToServer();
    }
  }, [isFocused]);

  const toggleSetting = async (type) => {
    try {
      if (type === "vibrateCall") {
        const next = !isVibrateCall;
        setIsVibrateCall(next);
        await AsyncStorage.setItem("callVibrate", String(next));
        return;
      }

      if (type === "soundCall") {
        const next = !isSoundCall;
        setIsSoundCall(next);
        await AsyncStorage.setItem("callSound", String(next));
        return;
      }

      if (type === "vibrateSubtitle") {
        const next = !isVibrateSubtitle;
        setIsVibrateSubtitle(next);
        await AsyncStorage.setItem("subtitleVibrate", String(next));
      }
    } catch (error) {
      console.error("설정 저장 실패:", error?.message);
    }
  };

  const resetNotificationSettings = async () => {
    await AsyncStorage.setItem("callVibrate", "false");
    await AsyncStorage.setItem("callSound", "false");
    await AsyncStorage.setItem("subtitleVibrate", "false");

    setIsVibrateCall(false);
    setIsSoundCall(false);
    setIsVibrateSubtitle(false);
  };

  const handleLogoutConfirm = async () => {
    try {
      setIsLogoutModalVisible(false);

      await AsyncStorage.multiRemove(USER_STORAGE_KEYS);
      await resetNotificationSettings();

      navigation.reset({
        index: 0,
        routes: [{ name: "ResidentLogin" }],
      });
    } catch (error) {
      console.error("로그아웃 처리 실패:", error?.message);
    }
  };

  const handleDeleteUserConfirm = async () => {
    try {
      setIsDeleteUserModalVisible(false);

      await AsyncStorage.multiRemove([
        ...USER_STORAGE_KEYS,
        ...SETTING_STORAGE_KEYS,
      ]);

      navigation.reset({
        index: 0,
        routes: [{ name: "ResidentLogin" }],
      });
    } catch (error) {
      console.error("회원탈퇴 처리 실패:", error?.message);
    }
  };

  return (
    <Container>
      <Header>
        <Logo source={bellIcon} resizeMode="contain" />
        <HeaderTitle>설정</HeaderTitle>
      </Header>

      <ScrollView showsVerticalScrollIndicator={false}>
        <SectionContainer>
          <SectionLabel>알림</SectionLabel>

          <SettingItem
            activeOpacity={0.7}
            onPress={() => toggleSetting("vibrateCall")}
          >
            <ItemText>인터폰 호출 시 진동</ItemText>
            <CheckBoxContainer>
              <BoxBase source={checkOff} />
              {isVibrateCall && <CheckMark source={checkOn} />}
            </CheckBoxContainer>
          </SettingItem>

          <SettingItem
            activeOpacity={0.7}
            onPress={() => toggleSetting("soundCall")}
          >
            <ItemText>인터폰 호출 시 소리</ItemText>
            <CheckBoxContainer>
              <BoxBase source={checkOff} />
              {isSoundCall && <CheckMark source={checkOn} />}
            </CheckBoxContainer>
          </SettingItem>

          <SettingItem
            activeOpacity={0.7}
            onPress={() => toggleSetting("vibrateSubtitle")}
          >
            <ItemText>대화 자막 발생 시 진동</ItemText>
            <CheckBoxContainer>
              <BoxBase source={checkOff} />
              {isVibrateSubtitle && <CheckMark source={checkOn} />}
            </CheckBoxContainer>
          </SettingItem>
        </SectionContainer>

        <SectionContainer>
          <SectionLabel>설정</SectionLabel>

          <SettingLinkItem
            activeOpacity={0.6}
            onPress={() => navigation.navigate("DeviceSetting")}
          >
            <ItemText>기기 설정</ItemText>
            <ArrowIcon source={arrowRight} />
          </SettingLinkItem>

          <SettingLinkItem
            activeOpacity={0.6}
            onPress={() => navigation.navigate("TermsPolicy")}
          >
            <ItemText>약관 및 정책</ItemText>
            <ArrowIcon source={arrowRight} />
          </SettingLinkItem>
        </SectionContainer>

        <SectionContainer>
          <SectionLabel>계정 관리</SectionLabel>

          <InfoRow>
            <InfoLabel>회원 아이디</InfoLabel>
            <InfoValue>{userId}</InfoValue>
          </InfoRow>

          <InfoRow>
            <InfoLabel>연결된 계정</InfoLabel>
            <InfoValue>(카카오) {userName}</InfoValue>
          </InfoRow>

          <ActionItem
            onPress={() => setIsLogoutModalVisible(true)}
            style={{
              borderTopWidth: 1,
              borderTopColor: "#EEE",
              marginTop: 10,
            }}
          >
            <ActionLeft>
              <ActionIcon source={logoutIcon} />
              <ActionText>로그아웃</ActionText>
            </ActionLeft>
          </ActionItem>

          <ActionItem onPress={() => setIsDeleteUserModalVisible(true)}>
            <ActionLeft>
              <ActionIcon source={deleteUserIcon} />
              <ActionText style={{ color: "#FF4D4D" }}>회원탈퇴</ActionText>
            </ActionLeft>
          </ActionItem>
        </SectionContainer>

        <Footer>
          <InquiryText>기기 문의 222@hanseo.ac.kr    041 - 000 - 0000</InquiryText>
        </Footer>
      </ScrollView>

      {showErrorBanner && (
        <ErrorToastRow>
          <Ionicons
            name="alert-circle"
            size={20}
            color="#fff"
            style={{ marginRight: 8 }}
          />

          <ErrorToastText>
            알림 설정을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.
          </ErrorToastText>

          <TouchableOpacity onPress={() => setShowErrorBanner(false)}>
            <Ionicons
              name="close"
              size={18}
              color="#fff"
              style={{ marginLeft: 10 }}
            />
          </TouchableOpacity>
        </ErrorToastRow>
      )}

      <Modal
        transparent={true}
        visible={isLogoutModalVisible}
        animationType="fade"
        onRequestClose={() => setIsLogoutModalVisible(false)}
      >
        <OverlayBackground>
          <OverlayImageCard source={logoutOverlayImg} resizeMode="contain">
            <TransparentButtonRow>
              <TransparentTouchArea onPress={handleLogoutConfirm} />
              <TransparentTouchArea
                onPress={() => setIsLogoutModalVisible(false)}
              />
            </TransparentButtonRow>
          </OverlayImageCard>
        </OverlayBackground>
      </Modal>

      <Modal
        transparent={true}
        visible={isDeleteUserModalVisible}
        animationType="fade"
        onRequestClose={() => setIsDeleteUserModalVisible(false)}
      >
        <OverlayBackground>
          <OverlayImageCard source={deleteUserOverlayImg} resizeMode="contain">
            <TransparentButtonRow>
              <TransparentTouchArea onPress={handleDeleteUserConfirm} />
              <TransparentTouchArea
                onPress={() => setIsDeleteUserModalVisible(false)}
              />
            </TransparentButtonRow>
          </OverlayImageCard>
        </OverlayBackground>
      </Modal>
    </Container>
  );
}

const Container = styled(SafeAreaContainer)`
  flex: 1;
  background-color: #fff;
`;

const Header = styled.View`
  flex-direction: row;
  align-items: center;
  padding: 15px 20px;
  border-bottom-width: 1px;
  border-bottom-color: #EEE;
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

const SectionContainer = styled.View`
  padding: 20px 0 10px;
  border-bottom-width: 8px;
  border-bottom-color: #F8F9FA;
`;

const SectionLabel = styled.Text`
  font-size: 14px;
  color: #999;
  padding: 0 20px;
  margin-bottom: 10px;
  font-weight: 600;
`;

const SettingItem = styled.TouchableOpacity`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
`;

const SettingLinkItem = styled(SettingItem)``;

const ItemText = styled.Text`
  font-size: 16px;
  color: #333;
  font-weight: 500;
`;

const CheckBoxContainer = styled.View`
  width: 24px;
  height: 24px;
  position: relative;
`;

const BoxBase = styled.Image`
  width: 24px;
  height: 24px;
`;

const CheckMark = styled.Image`
  width: 24px;
  height: 24px;
  position: absolute;
  top: 0;
  left: 0;
`;

const ArrowIcon = styled.Image`
  width: 18px;
  height: 18px;
`;

const InfoRow = styled.View`
  flex-direction: row;
  padding: 12px 20px;
`;

const InfoLabel = styled.Text`
  font-size: 14px;
  color: #999;
  width: 100px;
`;

const InfoValue = styled.Text`
  font-size: 14px;
  color: #555;
  flex: 1;
`;

const ActionItem = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  padding: 15px 20px;
`;

const ActionLeft = styled.View`
  flex-direction: row;
  align-items: center;
`;

const ActionIcon = styled.Image`
  width: 24px;
  height: 24px;
  margin-right: 8px;
`;

const ActionText = styled.Text`
  font-size: 15px;
  color: #333;
  font-weight: 600;
`;

const Footer = styled.View`
  padding: 30px 20px;
  align-items: center;
`;

const InquiryText = styled.Text`
  font-size: 12px;
  color: #BBB;
`;

const OverlayBackground = styled.View`
  flex: 1;
  background-color: rgba(0, 0, 0, 0.4);
  justify-content: center;
  align-items: center;
`;

const OverlayImageCard = styled.ImageBackground`
  width: ${SCREEN_WIDTH * 0.8}px;
  height: ${(SCREEN_WIDTH * 0.8) * 0.52}px;
  justify-content: flex-end;
  padding-bottom: 15px;
`;

const TransparentButtonRow = styled.View`
  flex-direction: row;
  width: 100%;
  height: 50px;
  padding-horizontal: 15px;
  justify-content: space-between;
`;

const TransparentTouchArea = styled.TouchableOpacity`
  width: 47%;
  height: 100%;
  background-color: transparent;
`;

const ErrorToastRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  background-color: #2D3748;
  padding: 14px 20px;
  position: absolute;
  bottom: 20px;
  left: 20px;
  right: 20px;
  border-radius: 15px;
  border-left-width: 5px;
  border-left-color: #FF4D4D;
  z-index: 9999;
`;

const ErrorToastText = styled.Text`
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  flex: 1;
`;
