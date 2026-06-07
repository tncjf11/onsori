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
import {
  useNavigation,
  useRoute,
  useIsFocused,
} from "@react-navigation/native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

import BASE_URL from "../../api/config";

const backIcon = require("../../assets/back_icon.png");
const iconMailRaw = require("../../assets/icon_mail_raw.png");
const iconMailAi = require("../../assets/icon_mail_ai.png");
const iconWrench = require("../../assets/icon_wrench.png");
const pencilIcon = require("../../assets/pencil_icon.png");

const logMessageEdit = (message, data) => {
  if (data !== undefined) {
    console.log(`[ADMIN_MESSAGE_EDIT] ${message}`, data);
  } else {
    console.log(`[ADMIN_MESSAGE_EDIT] ${message}`);
  }
};

export default function AdminMessageEditScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const isFocused = useIsFocused();

  const { messageId, transcriptId, item: passedItem = {} } = route.params || {};

  const targetMessageId =
    messageId ||
    passedItem.messageId ||
    (passedItem.content !== undefined ? passedItem.id : null) ||
    null;

  const targetTranscriptId =
    transcriptId ||
    passedItem.transcriptId ||
    (!targetMessageId ? passedItem.id : null) ||
    null;

  const isConversationMessage = Boolean(targetMessageId);

  const [originalText, setOriginalText] = useState("");
  const [editedText, setEditedText] = useState("");
  const [historyList, setHistoryList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getTextValue = (source) => {
    return (
      source?.content ||
      source?.text ||
      source?.messageText ||
      source?.message ||
      source?.afterText ||
      source?.afterContent ||
      ""
    );
  };

  const getOriginalValue = (source) => {
    return (
      source?.originalContent ||
      source?.originalText ||
      source?.beforeContent ||
      source?.beforeText ||
      ""
    );
  };

  const getInitialOriginalText = () => {
    const original = getOriginalValue(passedItem);
    const current = getTextValue(passedItem);

    return original || current || "내용 없음";
  };

  const getInitialEditedText = () => {
    return getTextValue(passedItem);
  };

  const buildFallbackHistory = (source = passedItem) => {
    const beforeText = getOriginalValue(source);
    const currentText = getTextValue(source);

    if (beforeText && currentText && beforeText !== currentText) {
      return [
        {
          id:
            source.messageId ||
            source.transcriptId ||
            source.id ||
            "fallback-history",
          beforeText,
          afterText: currentText,
          editedAt: source.updatedAt || source.editedAt || source.createdAt,
        },
      ];
    }

    return [];
  };

  const fetchHistories = async (token) => {
    if (isConversationMessage) {
      const fallbackHistory = buildFallbackHistory();

      logMessageEdit("conversation message 이력 fallback 사용", {
        messageId: targetMessageId,
        count: fallbackHistory.length,
      });

      setHistoryList(fallbackHistory);
      return;
    }

    if (!targetTranscriptId) {
      const fallbackHistory = buildFallbackHistory();

      logMessageEdit("transcriptId 없음 - 이력 fallback 사용", {
        count: fallbackHistory.length,
      });

      setHistoryList(fallbackHistory);
      return;
    }

    try {
      logMessageEdit("수정 이력 조회 요청", {
        transcriptId: targetTranscriptId,
      });

      const historyResponse = await axios.get(
        `${BASE_URL}/api/admin/transcripts/${targetTranscriptId}/histories`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const histories = Array.isArray(historyResponse.data?.data)
        ? historyResponse.data.data
        : [];

      logMessageEdit("수정 이력 조회 완료", {
        transcriptId: targetTranscriptId,
        count: histories.length,
      });

      setHistoryList(histories.length > 0 ? histories : buildFallbackHistory());
    } catch (error) {
      const serverError =
        error.response?.data?.message ||
        JSON.stringify(error.response?.data) ||
        error.message;

      logMessageEdit("수정 이력 조회 실패 - fallback 사용", {
        transcriptId: targetTranscriptId,
        error: serverError,
      });

      setHistoryList(buildFallbackHistory());
    }
  };

  const loadMessageInfo = async () => {
    try {
      setIsLoading(true);

      logMessageEdit("메시지 정보 화면 진입", {
        routeMessageId: messageId || null,
        routeTranscriptId: transcriptId || null,
        targetMessageId: targetMessageId || null,
        targetTranscriptId: targetTranscriptId || null,
        isConversationMessage,
      });

      const token = await AsyncStorage.getItem("adminToken");

      if (!token) {
        logMessageEdit("adminToken 없음 - 로그인 화면 이동");

        Alert.alert("오류", "관리자 로그인이 필요합니다.");
        navigation.navigate("AdminLogin");
        return;
      }

      const nextOriginalText = getInitialOriginalText();
      const nextEditedText = getInitialEditedText();

      setOriginalText(nextOriginalText);
      setEditedText(nextEditedText);

      logMessageEdit("초기 메시지 세팅", {
        originalText: nextOriginalText,
        editedText: nextEditedText,
      });

      await fetchHistories(token);
    } catch (error) {
      const serverError =
        error.response?.data?.message ||
        JSON.stringify(error.response?.data) ||
        error.message;

      logMessageEdit("메시지 정보 조회 실패", serverError);
      Alert.alert("오류", "메시지 정보를 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      loadMessageInfo();
    }
  }, [isFocused, targetMessageId, targetTranscriptId]);

  const parseServerDate = (isoString) => {
    if (!isoString) return null;

    try {
      const hasExplicitTimezone =
        isoString.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(isoString);

      if (hasExplicitTimezone) {
        const date = new Date(isoString);
        return Number.isNaN(date.getTime()) ? null : date;
      }

      const normalized = isoString.replace("T", " ");
      const [datePart, timePart = "00:00:00"] = normalized.split(" ");
      const [year, month, day] = datePart.split("-").map(Number);
      const [hour = 0, minute = 0, second = 0] = timePart
        .split(":")
        .map((value) => Number(String(value).split(".")[0]));

      if (!year || !month || !day) return null;

      return new Date(year, month - 1, day, hour, minute, second);
    } catch {
      return null;
    }
  };

  const formatDateTime = (isoString) => {
    const date = parseServerDate(isoString);

    if (!date || Number.isNaN(date.getTime())) return "";

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");

    return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
  };

  const handleModifyMessage = async () => {
    if (!editedText.trim()) {
      Alert.alert("안내", "수정할 내용을 입력하세요.");
      return;
    }

    if (isSubmitting) {
      logMessageEdit("수정 요청 무시 - 이미 처리 중");
      return;
    }

    try {
      setIsSubmitting(true);

      const token = await AsyncStorage.getItem("adminToken");

      if (!token) {
        logMessageEdit("수정 중단 - adminToken 없음");

        Alert.alert("오류", "관리자 로그인이 필요합니다.");
        navigation.navigate("AdminLogin");
        return;
      }

      const apiId = isConversationMessage ? targetMessageId : targetTranscriptId;

      if (!apiId) {
        logMessageEdit("수정 중단 - apiId 없음", {
          targetMessageId,
          targetTranscriptId,
        });

        Alert.alert("오류", "수정할 메시지 정보를 찾을 수 없습니다.");
        return;
      }

      const endpoint = isConversationMessage
        ? `${BASE_URL}/api/admin/conversation-messages/${apiId}`
        : `${BASE_URL}/api/admin/transcripts/${apiId}`;

      const body = isConversationMessage
        ? {
            content: editedText.trim(),
          }
        : {
            text: editedText.trim(),
          };

      logMessageEdit("메시지 수정 요청", {
        type: isConversationMessage ? "conversation-message" : "transcript",
        apiId,
        body,
      });

      const response = await axios.patch(endpoint, body, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      logMessageEdit("메시지 수정 응답", {
        status: response.status,
        data: response.data,
      });

      if (response.data?.success === false) {
        Alert.alert(
          "실패",
          response.data?.message || "수정 처리에 실패했습니다."
        );
        return;
      }

      const updatedData = response.data?.data;

      if (isConversationMessage && updatedData) {
        const nextOriginalText =
          updatedData.originalContent ||
          updatedData.originalText ||
          originalText ||
          getInitialOriginalText();

        const nextEditedText =
          updatedData.content || updatedData.text || editedText.trim();

        setOriginalText(nextOriginalText);
        setEditedText(nextEditedText);
        setHistoryList(buildFallbackHistory(updatedData));

        logMessageEdit("conversation message 수정 반영", {
          originalText: nextOriginalText,
          editedText: nextEditedText,
        });
      } else {
        await fetchHistories(token);
      }

      Alert.alert("완료", "수정 내용이 반영되었습니다.");
    } catch (error) {
      const serverError =
        error.response?.data?.message ||
        JSON.stringify(error.response?.data) ||
        error.message;

      logMessageEdit("메시지 수정 실패", serverError);
      Alert.alert("오류", "수정 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getHistoryMainText = (history) => {
    return (
      history.afterText ||
      history.text ||
      history.content ||
      history.afterContent ||
      "수정된 내용 없음"
    );
  };

  const getHistorySubText = (history) => {
    return (
      history.beforeText ||
      history.previousText ||
      history.originalText ||
      history.originalContent ||
      history.beforeContent ||
      ""
    );
  };

  const getHistoryDate = (history) => {
    return history.editedAt || history.updatedAt || history.createdAt;
  };

  return (
    <Container>
      <Header>
        <TouchableOpacity
          onPress={() => {
            logMessageEdit("뒤로가기 클릭");
            navigation.goBack();
          }}
        >
          <BackIcon source={backIcon} resizeMode="contain" />
        </TouchableOpacity>

        <HeaderTitle>메시지 정보</HeaderTitle>

        <View style={{ width: 24 }} />
      </Header>

      {isLoading ? (
        <LoadingWrapper>
          <ActivityIndicator size="large" color="#06F393" />
        </LoadingWrapper>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <InfoCard>
            <SectionTop>
              <SectionIcon source={iconMailRaw} resizeMode="contain" />
              <SectionLabel>수정 전 내용</SectionLabel>
            </SectionTop>

            <MainText>{originalText}</MainText>

            <Divider />

            <SectionTop>
              <SectionIcon source={iconMailAi} resizeMode="contain" />
              <SectionLabel>수정할 내용</SectionLabel>
            </SectionTop>

            <EditInputRow>
              <StyledTextInput
                value={editedText}
                onChangeText={setEditedText}
                multiline
                placeholder="수정할 내용을 입력하세요"
                placeholderTextColor="#BBB"
              />

              <TouchableOpacity
                onPress={handleModifyMessage}
                disabled={isSubmitting}
              >
                <EditIcon
                  source={pencilIcon}
                  resizeMode="contain"
                  style={{
                    tintColor: isSubmitting ? "#BBB" : "#06F393",
                  }}
                />
              </TouchableOpacity>
            </EditInputRow>
          </InfoCard>

          <HistoryCard>
            <HistoryHeader>
              <WrenchIcon source={iconWrench} resizeMode="contain" />
              <SectionTitle>수정 이력</SectionTitle>
            </HistoryHeader>

            {historyList.length > 0 ? (
              historyList.map((history, idx) => (
                <HistoryItem key={history.id || idx}>
                  <HistoryTextContainer>
                    <HistoryText numberOfLines={1}>
                      {getHistoryMainText(history)}
                    </HistoryText>

                    <HistoryDate>
                      {formatDateTime(getHistoryDate(history))}
                    </HistoryDate>
                  </HistoryTextContainer>

                  {getHistorySubText(history) ? (
                    <HistorySubText>
                      수정 전: {getHistorySubText(history)}
                    </HistorySubText>
                  ) : null}
                </HistoryItem>
              ))
            ) : (
              <EmptyHistoryText>수정된 이력이 없습니다.</EmptyHistoryText>
            )}
          </HistoryCard>
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
  border-bottom-color: #F0F0F0;
`;

const BackIcon = styled.Image`
  width: 24px;
  height: 24px;
  tint-color: #333;
`;

const HeaderTitle = styled.Text`
  flex: 1;
  margin-horizontal: 12px;
  font-size: 18px;
  font-weight: 800;
  color: #333;
  text-align: center;
`;

const InfoCard = styled.View`
  background-color: #fff;
  margin: 20px;
  padding: 20px;
  border-radius: 20px;
  elevation: 2;
`;

const SectionTop = styled.View`
  flex-direction: row;
  align-items: center;
  margin-bottom: 10px;
`;

const SectionIcon = styled.Image`
  width: 20px;
  height: 20px;
  margin-right: 8px;
`;

const SectionLabel = styled.Text`
  font-size: 14px;
  font-weight: 700;
  color: #666;
`;

const MainText = styled.Text`
  font-size: 15px;
  color: #333;
  margin-left: 28px;
  line-height: 22px;
`;

const Divider = styled.View`
  height: 1px;
  background-color: #F0F0F0;
  margin: 20px 0;
`;

const EditInputRow = styled.View`
  flex-direction: row;
  align-items: center;
  background-color: #F8F9FA;
  padding: 10px;
  border-radius: 12px;
  margin-left: 28px;
`;

const StyledTextInput = styled.TextInput`
  flex: 1;
  min-height: 38px;
  font-size: 15px;
  font-weight: 700;
  color: #06F393;
  padding: 0;
  text-align-vertical: top;
`;

const EditIcon = styled.Image`
  width: 20px;
  height: 20px;
  margin-left: 10px;
`;

const HistoryCard = styled(InfoCard)`
  margin-top: 0;
`;

const HistoryHeader = styled.View`
  flex-direction: row;
  align-items: center;
  margin-bottom: 15px;
`;

const WrenchIcon = styled.Image`
  width: 18px;
  height: 18px;
  margin-right: 8px;
`;

const SectionTitle = styled.Text`
  font-size: 16px;
  font-weight: 800;
  color: #333;
`;

const HistoryItem = styled.View`
  padding: 10px 0;
  border-bottom-width: 1px;
  border-bottom-color: #F8F8F8;
`;

const HistoryTextContainer = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;

const HistoryText = styled.Text`
  flex: 1;
  font-size: 14px;
  color: #444;
  margin-right: 8px;
`;

const HistoryDate = styled.Text`
  font-size: 12px;
  color: #AAA;
`;

const HistorySubText = styled.Text`
  font-size: 13px;
  color: #888;
  margin-top: 5px;
  line-height: 18px;
`;

const EmptyHistoryText = styled.Text`
  font-size: 14px;
  color: #BBB;
  font-weight: 600;
  text-align: center;
  padding: 20px 0;
`;

const LoadingWrapper = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
  padding-top: 100px;
`;