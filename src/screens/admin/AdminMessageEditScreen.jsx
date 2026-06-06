import React, { useState, useEffect } from "react";
import { ScrollView, TouchableOpacity, View, TextInput, ActivityIndicator, Alert } from "react-native";
import styled from "styled-components/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, useIsFocused } from "@react-navigation/native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BASE_URL from "../../api/config";

const backIcon = require("../../assets/back_icon.png");
const iconMailRaw = require("../../assets/icon_mail_raw.png");
const iconMailAi = require("../../assets/icon_mail_ai.png");
const iconWrench = require("../../assets/icon_wrench.png");
const pencilIcon = require("../../assets/pencil_icon.png");

export default function AdminMessageEditScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const isFocused = useIsFocused();

  const { transcriptId, item: passedItem } = route.params || {};
  const targetTranscriptId = transcriptId || passedItem?.id;

  const [originalText, setOriginalText] = useState("");
  const [editedText, setEditedText] = useState("");
  const [historyList, setHistoryList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTranscriptAndHistories = async () => {
    if (!targetTranscriptId) return;
    try {
      setIsLoading(true);
      const token = await AsyncStorage.getItem("adminToken");
      
      const [res, historyRes] = await Promise.all([
        axios.get(`${BASE_URL}/api/admin/transcripts/${targetTranscriptId}`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${BASE_URL}/api/admin/transcripts/${targetTranscriptId}/histories`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      const data = res.data.data;
      setOriginalText(data.originalText || "원본 데이터 없음");
      setEditedText(data.text || "");
      setHistoryList(historyRes.data.data || []);
    } catch (e) {
      console.error("데이터 로드 실패:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { if (isFocused) fetchTranscriptAndHistories(); }, [isFocused, targetTranscriptId]);

  const handleModifyTranscript = async () => {
    if (!editedText.trim()) return;
    try {
      setIsSubmitting(true);
      const token = await AsyncStorage.getItem("adminToken");
      await axios.patch(`${BASE_URL}/api/admin/transcripts/${targetTranscriptId}`, 
        { text: editedText.trim() }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert("교정 완료", "성공적으로 반영되었습니다.", [{ text: "확인", onPress: fetchTranscriptAndHistories }]);
    } catch (e) { 
      Alert.alert("오류", "수정 중 오류 발생"); 
      console.error(e);
    } finally { setIsSubmitting(false); }
  };

  return (
    <Container>
      <Header>
        <TouchableOpacity onPress={() => navigation.goBack()}><BackIcon source={backIcon} /></TouchableOpacity>
        <HeaderTitle>메시지 정보</HeaderTitle>
        <View style={{ width: 24 }} />
      </Header>

      {isLoading ? (
        <LoadingWrapper><ActivityIndicator size="large" color="#06F393" /></LoadingWrapper>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <InfoCard>
            <SectionTop><SectionIcon source={iconMailRaw} /><SectionLabel>교정처리 전 원본</SectionLabel></SectionTop>
            <MainText>{originalText}</MainText>
            <Divider />
            <SectionTop><SectionIcon source={iconMailAi} /><SectionLabel>AI 후처리 교정본</SectionLabel></SectionTop>
            <EditInputRow>
              <StyledTextInput value={editedText} onChangeText={setEditedText} />
              <TouchableOpacity onPress={handleModifyTranscript} disabled={isSubmitting}>
                <EditIcon source={pencilIcon} />
              </TouchableOpacity>
            </EditInputRow>
          </InfoCard>

          <HistoryCard>
            <HistoryHeader><WrenchIcon source={iconWrench} /><SectionTitle>수정 이력</SectionTitle></HistoryHeader>
            {historyList.map((h, i) => (
              <HistoryItem key={i}>
                <HistoryTextContainer>
                  <HistoryText>{h.previousText || h.text}</HistoryText>
                  <HistoryDate>{h.createdAt ? h.createdAt.substring(0, 16).replace('T', ' ') : ""}</HistoryDate>
                </HistoryTextContainer>
              </HistoryItem>
            ))}
          </HistoryCard>
        </ScrollView>
      )}
    </Container>
  );
}

const Container = styled(SafeAreaView)` flex: 1; background-color: #F8F9FA; `;
const Header = styled.View` flex-direction: row; justify-content: space-between; align-items: center; padding: 15px 20px; background-color: #fff; border-bottom: 1px solid #F0F0F0; `;
const HeaderTitle = styled.Text` font-size: 18px; font-weight: 800; `;
const InfoCard = styled.View` background-color: #fff; margin: 20px; padding: 20px; border-radius: 20px; elevation: 2; `;
const SectionTop = styled.View` flex-direction: row; align-items: center; margin-bottom: 10px; `;
const SectionIcon = styled.Image` width: 20px; height: 20px; margin-right: 8px; `;
const SectionLabel = styled.Text` font-size: 14px; font-weight: 700; color: #666; `;
const MainText = styled.Text` font-size: 15px; color: #333; margin-left: 28px; `;
const Divider = styled.View` height: 1px; background-color: #F0F0F0; margin: 20px 0; `;
const EditInputRow = styled.View` flex-direction: row; align-items: center; background-color: #F8F9FA; padding: 10px; border-radius: 12px; margin-left: 28px; `;
const StyledTextInput = styled.TextInput` flex: 1; font-size: 15px; font-weight: 700; color: #06F393; `;
const EditIcon = styled.Image` width: 20px; height: 20px; tint-color: #06F393; `;
const HistoryCard = styled(InfoCard)` margin-top: 0; `;
const HistoryHeader = styled.View` flex-direction: row; align-items: center; margin-bottom: 15px; `;
const WrenchIcon = styled.Image` width: 18px; height: 18px; margin-right: 8px; `;
const SectionTitle = styled.Text` font-size: 16px; font-weight: 800; `;
const HistoryItem = styled.View` padding: 10px 0; border-bottom: 1px solid #F8F8F8; `;
const HistoryTextContainer = styled.View` flex-direction: row; justify-content: space-between; align-items: center; `;
const HistoryText = styled.Text` font-size: 14px; color: #444; `;
const HistoryDate = styled.Text` font-size: 12px; color: #AAA; `;
const LoadingWrapper = styled.View` flex: 1; justify-content: center; align-items: center; padding-top: 100px; `;