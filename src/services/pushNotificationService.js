import { Platform } from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import BASE_URL from "../api/config";

const IS_EXPO_GO = Constants.appOwnership === "expo";

const getNotificationsModule = () => {
  if (IS_EXPO_GO) return null;

  try {
    return require("expo-notifications");
  } catch (error) {
    console.log("[PUSH] expo-notifications 로드 실패:", error?.message);
    return null;
  }
};

export const configurePushNotificationHandler = () => {
  if (IS_EXPO_GO) {
    console.log("[PUSH] Expo Go - Notification Handler 설정 생략");
    return;
  }

  const Notifications = getNotificationsModule();
  if (!Notifications) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  console.log("[PUSH] Notification Handler 설정 완료");
};

const createAndroidNotificationChannel = async (Notifications) => {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync("default", {
    name: "인터폰 알림",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    sound: "default",
  });
};

const requestNotificationPermission = async (Notifications) => {
  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();

  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } =
      await Notifications.requestPermissionsAsync();

    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("[PUSH] 알림 권한이 허용되지 않았습니다.");
    return false;
  }

  return true;
};

export const getExpoPushToken = async () => {
  if (IS_EXPO_GO) {
    console.log("[PUSH] Expo Go 환경 - Push Token 발급 생략");
    return null;
  }

  try {
    const Notifications = getNotificationsModule();
    if (!Notifications) return null;

    await createAndroidNotificationChannel(Notifications);

    const permissionGranted =
      await requestNotificationPermission(Notifications);

    if (!permissionGranted) return null;

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    if (!projectId) {
      console.log("[PUSH] EAS projectId 없음");
      return null;
    }

    const tokenResponse =
      await Notifications.getExpoPushTokenAsync({ projectId });

    const expoPushToken = tokenResponse?.data;

    if (!expoPushToken) {
      console.log("[PUSH] Expo Push Token 발급 결과 없음");
      return null;
    }

    console.log("[PUSH] Expo Push Token 발급 완료");

    return expoPushToken;
  } catch (error) {
    console.log("[PUSH] Expo Push Token 발급 실패:", error?.message);
    return null;
  }
};

export const registerPushToken = async () => {
  if (IS_EXPO_GO) {
    console.log("[PUSH] Expo Go 환경 - Push 등록 생략");
    return {
      success: false,
      reason: "expo-go",
    };
  }

  try {
    const accessToken = await AsyncStorage.getItem("accessToken");

    if (!accessToken) {
      console.log("[PUSH] accessToken 없음 - Push 등록 생략");
      return {
        success: false,
        reason: "no-access-token",
      };
    }

    const expoPushToken = await getExpoPushToken();

    if (!expoPushToken) {
      return {
        success: false,
        reason: "no-push-token",
      };
    }

    const [isPushTokenSaved, registeredPushToken] =
      await Promise.all([
        AsyncStorage.getItem("isPushTokenSaved"),
        AsyncStorage.getItem("registeredPushToken"),
      ]);

    if (
      isPushTokenSaved === "true" &&
      registeredPushToken === expoPushToken
    ) {
      console.log("[PUSH] 이미 등록된 Push Token");

      return {
        success: true,
        alreadyRegistered: true,
        token: expoPushToken,
      };
    }

    console.log("[PUSH] 서버 등록 요청");

    const response = await axios.post(
      `${BASE_URL}/api/push-tokens`,
      {
        token: expoPushToken,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    console.log("[PUSH] 서버 등록 응답:", {
      status: response.status,
      success: response.data?.success,
    });

    if (response.status >= 200 && response.status < 300) {
      await AsyncStorage.multiSet([
        ["isPushTokenSaved", "true"],
        ["registeredPushToken", expoPushToken],
      ]);

      console.log("[PUSH] Push Token 서버 저장 완료");

      return {
        success: true,
        alreadyRegistered: false,
        token: expoPushToken,
      };
    }

    throw new Error(
      response.data?.message || "Push Token 등록 실패"
    );
  } catch (error) {
    console.error(
      "[PUSH] Push Token 서버 등록 실패:",
      error?.response?.data || error?.message
    );

    return {
      success: false,
      reason: "server-error",
      error: error?.response?.data || error?.message,
    };
  }
};

export const clearLocalPushTokenInfo = async () => {
  try {
    await AsyncStorage.multiRemove([
      "isPushTokenSaved",
      "registeredPushToken",
    ]);

    console.log("[PUSH] 로컬 Push Token 정보 초기화 완료");
  } catch (error) {
    console.log(
      "[PUSH] 로컬 Push Token 정보 초기화 실패:",
      error?.message
    );
  }
};