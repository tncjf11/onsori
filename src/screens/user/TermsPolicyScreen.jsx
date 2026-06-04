import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import { Modal, ScrollView, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import styled from "styled-components/native";

// ✅ 이미지 에셋 (기존 에셋 재사용 🤙)
const backIcon = require("../../assets/back_icon.png");
const arrowRight = require("../../assets/arrow_right.png");

export default function TermsPolicyScreen() {
  const navigation = useNavigation();

  // 📱 약관 모달창 상태 관리
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState({ title: "", content: "" });

  // ✅ [시안 동기화 🤙] 약관 항목 및 실제 리포트용 내용 데이터 세트
  const policyList = [
    { id: 1, title: "이용약관", content: "제1조 (목적)\n본 약관은 온소리(On-Sori) 실시간 인터폰 자막 통신 서비스의 이용 조건 및 절차에 관한 사항을 규정함을 목적으로 합니다.\n\n제2조 (서비스의 제공)\n본 앱은 청각장애인 거주자를 위한 실시간 STT 음성 자막 변환 및 상용구 전송 인터페이스를 제공합니다." },
    { id: 2, title: "개인정보 처리방침", content: "온소리는 거주자의 안전한 서비스 이용을 위해 최소한의 개인정보(카카오 ID, 기기 UID)만을 수집하며, 대한민국 개인정보보호법을 철저히 준수합니다. 수집된 정보는 서비스 제공 이외의 용도로 절대 활용되지 않습니다." },
    { id: 3, title: "음성 데이터 수집 및 이용 동의", content: "1. 수집 항목: 인터폰 호출 시 발생하는 상대방(방문자)의 음성 청크 파일\n2. 이용 목적: 음성인식(STT)을 통한 실시간 자막 표시 및 AI 텍스트 문맥 가공\n3. 보유 기간: AI 정제 자막 합성 완료(Finalize) 즉시 원본 음성은 안전하게 파기됩니다." },
    { id: 4, title: "데이터 저장 및 파기 정책", content: "통화 세션이 종료(`CLOSED`)된 후 조립된 최종 정제 자막 리포트는 사용자의 히스토리 보관함에 안전하게 격리 저장됩니다. 사용자가 히스토리에서 내역을 직접 삭제하는 경우 즉시 영구 파기 처리됩니다." },
    { id: 5, title: "펌웨어 및 소프트웨어 업데이트 정책", content: "온소리 하드웨어 단말 기기 및 모바일 앱의 서비스 안정성 향상, AI 음성인식 모델 가독성 패치, 보안 취약점 보완을 위해 정기적인 무선(OTA) 소프트웨어 업데이트 정책을 시행하고 있습니다." },
  ];

  // 🎯 특정 약관 클릭 시 팝업 가동 핸들러
  const handleOpenPolicy = (item) => {
    setSelectedPolicy(item);
    setModalVisible(true);
  };

  return (
    <Container>
      {/* 1. 헤더 영역 */}
      <Header>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <BackIcon source={backIcon} resizeMode="contain" />
        </TouchableOpacity>
        <HeaderTitle>약관 및 정책</HeaderTitle>
        <View style={{ width: 24 }} /> 
      </Header>

      <ScrollView showsVerticalScrollIndicator={false}>
        <SectionContainer>
          {policyList.map((item) => (
            <PolicyItem 
              key={item.id} 
              activeOpacity={0.6}
              onPress={() => handleOpenPolicy(item)}
            >
              <ItemText>{item.title}</ItemText>
              <ArrowIcon source={arrowRight} />
            </PolicyItem>
          ))}
        </SectionContainer>

        {/* 하단 버전 정보 */}
        <VersionInfo>
          <VersionText>현재 버전 1.0.0 (최신 버전)</VersionText>
        </VersionInfo>
      </ScrollView>

      {/* 🚨 [고도화 뽈칵 🤙] 약관 상세 조회용 투명 오버레이 모달 창 */}
      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <ModalOverlay>
          <ModalContent>
            <ModalHeader>
              <ModalHeaderTitle>{selectedPolicy.title}</ModalHeaderTitle>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </ModalHeader>
            
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <PolicyContentText>{selectedPolicy.content}</PolicyContentText>
            </ScrollView>

            <CloseButton onPress={() => setModalVisible(false)}>
              <CloseButtonText>동의 및 확인</CloseButtonText>
            </CloseButton>
          </ModalContent>
        </ModalOverlay>
      </Modal>
    </Container>
  );
}

/* ================= 스타일 정의 (시안 감성 100% 동기화 🤙) ================= */
const Container = styled(SafeAreaView)` flex: 1; background-color: #fff; `;
const Header = styled.View` flex-direction: row; justify-content: space-between; align-items: center; padding: 15px 20px; border-bottom-width: 1px; border-bottom-color: #EEE; `;
const BackIcon = styled.Image` width: 24px; height: 24px; `;
const HeaderTitle = styled.Text` font-size: 18px; font-weight: 700; color: #333; `;

const SectionContainer = styled.View` padding-top: 10px; `;
const PolicyItem = styled.TouchableOpacity` flex-direction: row; justify-content: space-between; align-items: center; padding: 20px; border-bottom-width: 1px; border-bottom-color: #F5F5F5; `;
const ItemText = styled.Text` font-size: 16px; color: #333; font-weight: 500; `;
const ArrowIcon = styled.Image` width: 18px; height: 18px; opacity: 0.3; `;

const VersionInfo = styled.View` padding: 40px 20px; align-items: center; `;
const VersionText = styled.Text` font-size: 13px; color: #BBB; `;

/* 🆕 팝업 스타일 시트 매핑 */
const ModalOverlay = styled.View` flex: 1; background-color: rgba(0, 0, 0, 0.4); justify-content: flex-end; `;
const ModalContent = styled.View` background-color: white; border-top-left-radius: 24px; border-top-right-radius: 24px; max-height: 75%; padding: 25px; `;
const ModalHeader = styled.View` flex-direction: row; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom-width: 1px; border-bottom-color: #EEE; `;
const ModalHeaderTitle = styled.Text` font-size: 18px; font-weight: 800; color: #222; `;
const PolicyContentText = styled.Text` font-size: 14px; color: #555; line-height: 22px; font-weight: 600; `;
const CloseButton = styled.TouchableOpacity` background-color: #06F393; padding: 16px; border-radius: 14px; align-items: center; margin-top: 15px; `;
const CloseButtonText = styled.Text` color: white; font-weight: 800; font-size: 16px; `;