import React, { useState, useEffect } from "react";
import { ScrollView, TouchableOpacity, View, ActivityIndicator, Alert, TextInput } from "react-native";
import styled from "styled-components/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";

// 📥 관리자 전용 마스터 키 로드를 위한 비밀금고 부품 임포트!
import AsyncStorage from "@react-native-async-storage/async-storage";

// 🌐 config.js의 배포 주소
import BASE_URL from "../../api/config";

// ✅ 이미지 에셋 (순정 보존 🤙)
const backIcon = require("../../assets/back_icon.png");

export default function AdminCallLogScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused(); // 📱 상세방 다녀왔을 때 자동 리프레시 센서

  // 📱 상태 관리 및 실시간 관제 장치
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("ALL"); // 필터 상태 (ALL, SUCCESS, FAIL)
  const [searchKeyword, setSearchKeyword] = useState(""); // 실시간 텍스트 검색창 상태

  // =========================================================
  // 🔥 [재호 찐 컨트롤러 연동] 전체 호출 로그 및 검색 조건 통합 엔진 🚀
  // =========================================================
  const fetchIntercomLogs = async () => {
    try {
      setIsLoading(true);
      console.log("▶️ [호출 로그] 기기 금고 내부 마스터 신분증 로드 중... 🔑");
      
      const token = await AsyncStorage.getItem("adminToken");
      if (!token) {
        navigation.navigate("AdminLogin");
        return;
      }

      // 🎯 [명세서 개편 수용] 주소 분리 규칙 반영! 
      // 검색 키워드가 있으면 /search 주소를 타격하고, 없으면 전체 목록 주소로 분기 요격!
      let targetUrl = `${BASE_URL}/api/admin/intercom-logs`;
      let params = {};

      if (searchKeyword.trim()) {
        targetUrl = `${BASE_URL}/api/admin/intercom-logs/search`;
        params.keyword = searchKeyword.trim();
      }

      // 필터 토글 상태에 따라 백엔드 status 명찰 대입 분기
      if (filter !== "ALL") {
        if (!searchKeyword.trim()) targetUrl = `${BASE_URL}/api/admin/intercom-logs/search`;
        params.status = filter; // SUCCESS 또는 FAIL 형태 대입
      }

      console.log(`🛰️ [이력 무전 발포] 주소: ${targetUrl}, 필터: ${filter}`);
      
      const response = await axios.get(targetUrl, {
        params: params,
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success && response.data.data) {
        setLogs(response.data.data);
      }
    } catch (error) {
      console.error("🚨 [호출 로그 이력 수급 대실패]:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      fetchIntercomLogs();
    }
  }, [isFocused, filter]);

  // 🕒 백엔드 ISO 타임스탬프에서 시 분(HH:MM) 슬라이싱 유틸
  const formatLogTime = (isoString) => {
    if (!isoString) return "00:00";
    try {
      const date = new Date(isoString);
      const hh = String(date.getHours()).padStart(2, '0');
      const min = String(date.getMinutes()).padStart(2, '0');
      return `${hh}:${min}`;
    } catch {
      return "00:00";
    }
  };

  return (
    <Container>
      {/* 4. 헤더 영역 */}
      <Header>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <BackIcon source={backIcon} resizeMode="contain" />
        </TouchableOpacity>
        <HeaderTitle>전체 호출 로그 관리</HeaderTitle>
        <View style={{ width: 24 }} />
      </Header>

      {/* 📱 동적 실시간 키워드 검색 인풋 바 통합 이식 (HistoryScreen 기능 통합! 뽈칵! 🤙) */}
      <SearchBoxRow>
        <Ionicons name="search" size={20} color="#999" style={{ marginRight: 10 }} />
        <SearchInput 
          placeholder="검색 키워드나 디바이스 UID 입력 후 엔터 🤙"
          value={searchKeyword}
          onChangeText={setSearchKeyword}
          onSubmitEditing={fetchIntercomLogs}
          returnKeyType="search"
          placeholderTextColor="#BBB"
        />
        {searchKeyword.length > 0 && (
          <TouchableOpacity onPress={() => { setSearchKeyword(""); setTimeout(() => fetchIntercomLogs(), 50); }}>
            <Ionicons name="close-circle" size={18} color="#CCC" />
          </TouchableOpacity>
        )}
      </SearchBoxRow>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 5. 필터 토글 버튼 그룹 (대문자 규격 매칭 완착! 뽈칵! 🤙) */}
        <FilterGroup>
          <FilterBtn active={filter === "ALL"} onPress={() => setFilter("ALL")}>
            <FilterText active={filter === "ALL"}>전체 로그</FilterText>
          </FilterBtn>
          
          <FilterBtn 
            active={filter === "SUCCESS"} 
            onPress={() => setFilter("SUCCESS")}
            style={{ backgroundColor: filter === "SUCCESS" ? "#06F393" : "#FFF", borderColor: "#06F393", borderWidth: 1 }}
          >
            <FilterText active={filter === "SUCCESS"} style={{ color: filter === "SUCCESS" ? "#FFF" : "#06F393" }}>통화 연결</FilterText>
          </FilterBtn>
          
          <FilterBtn active={filter === "FAIL"} onPress={() => setFilter("FAIL")}>
            <FilterText active={filter === "FAIL"}>미응답/종료</FilterText>
          </FilterBtn>
        </FilterGroup>

        {/* 6. 로그 리스트 카드 영역 */}
        {isLoading ? (
          <ActivityIndicator size="large" color="#06F393" style={{ marginTop: 50 }} />
        ) : (
          <LogCard>
            <LogCardHeader>
              <SummaryTitle>검색 매칭 기록</SummaryTitle>
              <SummaryCount>{logs.length}건 관착</SummaryCount>
            </LogCardHeader>

            {/* 테이블 헤더 */}
            <TableHeader>
              <HeaderText style={{ flex: 1 }}>No.</HeaderText>
              <HeaderText style={{ flex: 1.5 }}>시간</HeaderText>
              <HeaderText style={{ flex: 3 }}>디바이스 UID</HeaderText>
              <HeaderText style={{ flex: 2 }}>연결 상태</HeaderText>
            </TableHeader>

            {/* 로그 목록 라이브 렌더링 */}
            {logs.length > 0 ? (
              logs.map((item, idx) => (
                /* 🎯 행을 누르면 관리자 전용 상세 자막 감시방으로 워프 바통 터치! */
                <TouchableOpacity 
                  key={item.id || idx}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate("AdminMonitoringDetail", { logId: item.id, item: item })}
                >
                  <TableRow>
                    <RowText style={{ flex: 1 }}>{item.id || idx + 1}</RowText>
                    <RowText style={{ flex: 1.5 }}>{formatLogTime(item.createdAt)}</RowText>
                    <RowText style={{ flex: 3, fontWeight: "600" }}>{item.deviceUid || "기기 없음"}</RowText>
                    <StatusText 
                      style={{ flex: 2 }} 
                      color={item.status === "SUCCESS" || item.status === "연결" ? "#06F393" : "#FF5C5C"}
                    >
                      {item.status === "SUCCESS" || item.status === "연결" ? "통화연결" : "미응답/종료"}
                    </StatusText>
                  </TableRow>
                </TouchableOpacity>
              ))
            ) : (
              <EmptyWrapper>
                <Ionicons name="folder-open-outline" size={36} color="#CCC" />
                <EmptyText>백엔드 장부에 매칭되는 호출 로그 기록이 없쇼.</EmptyText>
              </EmptyWrapper>
            )}
          </LogCard>
        )}
      </ScrollView>
    </Container>
  );
}

/* ================= 스타일 정의 (수철님 명품 시안 컴포넌트 100% 철통 보존 🤙) ================= */
const Container = styled(SafeAreaView)` flex: 1; background-color: #F8F9FA; `;
const Header = styled.View` flex-direction: row; justify-content: space-between; align-items: center; padding: 15px 20px; background-color: #fff; border-bottom-width: 1px; border-bottom-color: #F0F0F0; `;
const BackIcon = styled.Image` width: 24px; height: 24px; `;
const HeaderTitle = styled.Text` font-size: 18px; font-weight: 800; color: #333; `;

const SearchBoxRow = styled.View` flex-direction: row; align-items: center; background-color: #fff; margin: 15px 15px 0; padding: 12px 15px; border-radius: 15px; border-width: 1px; border-color: #EAEAEA; `;
const SearchInput = styled.TextInput` flex: 1; font-size: 14px; color: #333; padding: 0; font-weight: 600; `;

const FilterGroup = styled.View` flex-direction: row; padding: 15px 20px; `;
const FilterBtn = styled.TouchableOpacity` background-color: ${props => props.active ? "#06F393" : "#E2E8F0"}; opacity: ${props => props.active ? 1 : 0.7}; padding: 8px 18px; border-radius: 20px; margin-right: 10px; `;
const FilterText = styled.Text` color: ${props => props.active ? "#fff" : "#4A5568"}; font-size: 13px; font-weight: 700; `;

const LogCard = styled.View` background-color: #fff; margin: 0 15px 30px; padding: 20px; border-radius: 25px; border-width: 1.5px; border-color: #06F393; `;
const LogCardHeader = styled.View` flex-direction: row; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom-width: 1px; border-bottom-color: #EEE; `;
const SummaryTitle = styled.Text` font-size: 16px; font-weight: 800; color: #222; `;
const SummaryCount = styled.Text` font-size: 15px; font-weight: 700; color: #06F393; `;

const TableHeader = styled.View` flex-direction: row; padding-bottom: 15px; border-bottom-width: 1px; border-bottom-color: #F0F0F0; `;
const HeaderText = styled.Text` font-size: 13px; color: #999; text-align: center; font-weight: 700; `;
const TableRow = styled.View` flex-direction: row; padding: 15px 0; border-bottom-width: 1px; border-bottom-color: #F8F8F8; align-items: center; `;
const RowText = styled.Text` font-size: 13px; color: #4A5568; text-align: center; `;
const StatusText = styled.Text` font-size: 13px; text-align: center; font-weight: 800; color: ${props => props.color}; `;

const EmptyWrapper = styled.View` padding: 40px 20px; justify-content: center; align-items: center; `;
const EmptyText = styled.Text` font-size: 13px; color: #BBB; font-weight: 600; margin-top: 8px; `;