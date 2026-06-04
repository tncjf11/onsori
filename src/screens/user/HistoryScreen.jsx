import React, { useState, useEffect } from "react";
import { ScrollView, View, ActivityIndicator, TouchableOpacity } from "react-native";
import styled from "styled-components/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons"; 
import axios from "axios";

// 📥 [재호 지침 3번 반영] 핸드폰 내부 저장소 핵심 부품 전격 임포트!
import AsyncStorage from "@react-native-async-storage/async-storage";

// 🌐 config.js의 배포 주소
import BASE_URL from "../../api/config";

// ✅ 공용 리스트 부품 임포트!
import RecentCallItem from "../../components/RecentCallItem";

// ✅ 이미지 에셋
const bellIcon = require("../../assets/bell.png");
const searchIcon = require("../../assets/search_icon.png");

export default function HistoryScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  // 📱 백엔드 데이터 및 로딩 상태 관리 장치
  const [historyData, setHistoryData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 📥 [재호 지침 4번 반영] 상세 화면으로 안전하게 넘겨주기 위한 토큰 상태창 개통!
  const [token, setToken] = useState(null);

  // =========================================================
  // 🕒 [수철님 9시간 시차 요격 완착 유틸] 한국 시차 상쇄 상대시간 엔진
  // =========================================================
  const formatTimeGap = (isoString) => {
    if (!isoString) return "기록 없음";
    
    try {
      const now = new Date();
      const logTime = new Date(isoString);
      
      // 🎯 백엔드가 보낸 타임스탬프가 UTC(영국 표준시) 기준이라서 9시간 시차가 발생할 경우,
      // 자동으로 9시간(9 * 60 * 60 * 1000 ms)을 더해 한국 시간(KST) 축으로 완벽 자석 피팅!
      const isUtc = !isoString.includes("+09") && (isoString.endsWith("Z") || isoString.includes("T"));
      const kstLogTime = isUtc ? new Date(logTime.getTime() + 9 * 60 * 60 * 1000) : logTime;

      const diffMs = now - kstLogTime;
      const diffMins = Math.floor(diffMs / (1000 * 60));

      if (diffMins < 1) return "방금 전";
      if (diffMins < 60) return `${diffMins}분 전`;
      
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}시간 전`;
      
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return "어제";
      if (diffDays <= 7) return `${diffDays}일 전`;
      
      // 🎯 [시차 버그 소탕] 먼 옛날 데이터도 한국 시차가 완전히 반영된 객체에서 날짜를 정확히 슬라이싱합니다.
      const year = kstLogTime.getFullYear();
      const month = String(kstLogTime.getMonth() + 1).padStart(2, "0");
      const day = String(kstLogTime.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error("🚨 시간 포맷 가드 에러:", error.message);
      return "시간 오차";
    }
  };

  // =========================================================
  // 🔥 [재호 지침 3번 & 4번] AsyncStorage 기반 대개편 구역
  // =========================================================
  const fetchAllHistoryLogs = async () => {
    try {
      setIsLoading(true);
      console.log("▶️ [재호 지침 적용] AsyncStorage에서 찐 로그인 토큰 추출 시작... 🔑");
      
      // A) 휴대폰 기기 내부에 저장되어 있는 진짜 accessToken을 직접 낚아챕니다!
      const savedToken = await AsyncStorage.getItem("accessToken");
      
      if (!savedToken) {
        console.log("❌ 저장된 accessToken 없음 ➔ 목록 초기화 및 가드 발동");
        setHistoryData([]);
        setIsLoading(false);
        return;
      }

      // B) 상세방 워프 릴레이를 위해 상태창에 토큰 값 박제 쇼!
      setToken(savedToken);

      console.log("▶️ [명세서 8-1 진짜 요청] 로컬 토큰 헤더에 실어서 목록 조회 슛! 🎯");
      const response = await axios.get(`${BASE_URL}/api/intercom-logs`, {
        headers: { Authorization: `Bearer ${savedToken}` }
      });
      
      console.log("▶️ [명세서 8-1 응답 수신] 히스토리 아카이브 목록 복원 완료! 👇");

      if (response.data.success && response.data.data) {
        const rawLogs = response.data.data;

        if (rawLogs.length > 0) {
          // 🎯 [1번 및 3번 버그 완파 지령 마감]
          // 1. .reverse()를 결합하여 백엔드가 준 배열을 거꾸로 뒤집어 최신 통화가 무조건 맨 위에 오도록 요격했습니다.
          // 2. log.summary가 비어있거나 "내용 없음" 오염 상태일 때 "인터폰 호출 알림" 디폴트 명찰 가드를 칩니다.
          const mappedLogs = [...rawLogs].reverse().map(log => ({
            id: log.id,
            title: log.summary && log.summary.trim() !== "내용 없음" ? log.summary : "인터폰 호출 알림",
            time: formatTimeGap(log.createdAt), 
            type: log.intent === "DELIVERY" ? "message" : "bell", 
            tags: log.intent ? [log.intent] : ["방문"]
          }));
          
          setHistoryData(mappedLogs);
        } else {
          setHistoryData([]);
        }
      } else {
        setHistoryData([]);
      }
    } catch (error) {
      console.error("🚨 [명세서 8-1 에러] 히스토리 내역 로드 실패:", error.message);
      setHistoryData([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      fetchAllHistoryLogs();
    }
  }, [isFocused]);

  return (
    <Container>
      {/* 1. 상단 헤더 */}
      <Header>
        <HeaderLeft>
          <Logo source={bellIcon} resizeMode="contain" />
          <HeaderTitle>히스토리</HeaderTitle>
        </HeaderLeft>
        
        <TouchableOpacity 
          activeOpacity={0.7} 
          onPress={() => navigation.navigate("HistorySearch")}
        >
          <SearchBtnIcon source={searchIcon} resizeMode="contain" />
        </TouchableOpacity>
      </Header>

      {/* 2. 호출 기록 리스트 영역 */}
      {isLoading ? (
        <LoadingWrapper>
          <ActivityIndicator size="large" color="#06F393" />
          <LoadingText>그동안 쌓인 대화 기록 복원 중...</LoadingText>
        </LoadingWrapper>
      ) : historyData.length > 0 ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
          {historyData.map((item) => (
            <RecentCallItem 
              key={item.id} 
              item={item} 
              token={token || "READY"} 
              onPress={() => navigation.navigate("End", { item: item, logId: item.id, token: token })}
            />
          ))}
        </ScrollView>
      ) : (
        <EmptyHistoryWrapper>
          <Ionicons name="folder-open-outline" size={48} color="#DDD" />
          <EmptyHistoryMainText>최근 호출된 내역이 없습니다.</EmptyHistoryMainText>
          <EmptyHistorySubText>인터폰 대화 연결 시스템을 사용하시면{"\n"}여기에 실시간 자막 기록들이 차곡차곡 보관됩니다.</EmptyHistorySubText>
        </EmptyHistoryWrapper>
      )}
    </Container>
  );
}

/* ================= 스타일 정의 (수철님 순정 스타일 100% 철통 보존 🤙) ================= */
const Container = styled(SafeAreaView)` flex: 1; background-color: #fff; `;
const Header = styled.View` flex-direction: row; justify-content: space-between; align-items: center; padding: 15px 20px; background-color: #fff; border-bottom-width: 1px; border-bottom-color: #f1f1f1; `;
const HeaderLeft = styled.View` flex-direction: row; align-items: center; `;
const Logo = styled.Image` width: 32px; height: 32px; margin-right: 10px; `;
const HeaderTitle = styled.Text` font-size: 22px; font-weight: 800; color: #333; letter-spacing: -0.5px; `;
const SearchBtnIcon = styled.Image` width: 26px; height: 26px; `;
const LoadingWrapper = styled.View` flex: 1; justify-content: center; align-items: center; padding-top: 100px; `;
const LoadingText = styled.Text` font-size: 13px; color: #999; font-weight: 600; margin-top: 12px; `;
const EmptyHistoryWrapper = styled.View` flex: 1; justify-content: center; align-items: center; padding: 40px 30px; margin-top: 100px; `;
const EmptyHistoryMainText = styled.Text` font-size: 16px; color: #666; font-weight: 800; margin-top: 15px; `;
const EmptyHistorySubText = styled.Text` font-size: 13px; color: #BBB; font-weight: 500; text-align: center; margin-top: 8px; line-height: 20px; `;