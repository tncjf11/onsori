import React, { useState } from "react";
import {
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import styled from "styled-components/native";
import { SafeAreaView as SafeAreaContainer } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";

const bellIcon = require("../../assets/bell.png");
const iconKeyword = require("../../assets/icon_keyword.png");
const iconCalendar = require("../../assets/icon_calendar.png");
const iconUser = require("../../assets/icon_user.png");
const iconDeviceId = require("../../assets/icon_device_id.png");
const searchIcon = require("../../assets/search_icon.png");

// =========================================================
// 화면용 필터
//
// 현재 백엔드 /api/admin/intercom-logs/search가
// visitTypes / situations / keywords 배열을 직접 지원하지 않으므로
// 이 값들은 결과 페이지에서 로컬 필터링할 때 사용한다.
// =========================================================

const VISIT_TYPES = [
  "관리실",
  "택배",
  "배달",
  "방문판매",
  "공사/점검",
  "지인/가족",
  "미확인",
];

const SITUATIONS = [
  "미응답",
  "긴급",
  "공지",
  "확인요청",
];

const DETAIL_KEYWORDS = [
  "식품",
  "점검",
  "수리",
  "요금/부과",
  "서류/카드",
  "안내/통지",
  "방문예약",
];

const logAdminHistory = (message, data) => {
  if (data !== undefined) {
    console.log(
      `[ADMIN_HISTORY] ${message}`,
      data
    );
  } else {
    console.log(
      `[ADMIN_HISTORY] ${message}`
    );
  }
};

export default function AdminHistoryScreen() {
  const navigation = useNavigation();

  // =========================================================
  // 검색 입력값
  // =========================================================

  const [searchParams, setSearchParams] =
    useState({
      keyword: "",

      /**
       * 백엔드에서는 dateRange가 아니라
       * date=YYYY-MM-DD 한 날짜만 지원
       */
      date: "",

      /**
       * 백엔드 userId는 숫자 ID
       */
      userId: "",

      /**
       * DEVICE-001 같은 실제 기기 UID
       *
       * DB상의 숫자 deviceId와 혼동하지 않는다.
       */
      deviceUid: "",
    });

  // =========================================================
  // 화면용 추가 필터
  // =========================================================

  const [
    selectedVisitTypes,
    setSelectedVisitTypes,
  ] = useState([]);

  const [
    selectedSituations,
    setSelectedSituations,
  ] = useState([]);

  const [
    selectedKeywords,
    setSelectedKeywords,
  ] = useState([]);

  // =========================================================
  // Helper
  // =========================================================

  const trimValue = (value) =>
    String(value || "").trim();

  const toggleTag = (
    tag,
    list,
    setList
  ) => {
    if (list.includes(tag)) {
      setList(
        list.filter(
          (item) => item !== tag
        )
      );

      return;
    }

    setList([
      ...list,
      tag,
    ]);
  };

  const updateSearchParam = (
    key,
    value
  ) => {
    setSearchParams(
      (prev) => ({
        ...prev,
        [key]: value,
      })
    );
  };

  // =========================================================
  // 날짜 형식 확인
  // =========================================================

  const isValidDateFormat = (
    value
  ) => {
    if (!value) {
      return true;
    }

    /**
     * YYYY-MM-DD
     */
    const match =
      value.match(
        /^(\d{4})-(\d{2})-(\d{2})$/
      );

    if (!match) {
      return false;
    }

    const year =
      Number(match[1]);

    const month =
      Number(match[2]);

    const day =
      Number(match[3]);

    const date =
      new Date(
        year,
        month - 1,
        day
      );

    return (
      date.getFullYear() === year &&
      date.getMonth() ===
        month - 1 &&
      date.getDate() === day
    );
  };

  // =========================================================
  // 백엔드가 실제로 지원하는 검색 파라미터만 생성
  //
  // GET /api/admin/intercom-logs/search
  //
  // 지원:
  // keyword
  // date
  // userId
  // deviceUid
  //
  // 필요 시 status도 백엔드 값이 확정되면 추가 가능
  // =========================================================

  const buildApiPayload = ({
    keyword,
    date,
    userId,
    deviceUid,
  }) => {
    const apiPayload = {};

    if (keyword) {
      apiPayload.keyword =
        keyword;
    }

    if (date) {
      apiPayload.date =
        date;
    }

    if (userId) {
      /**
       * 백엔드가 Long을 받으므로
       * 숫자로 전달
       */
      apiPayload.userId =
        Number(userId);
    }

    if (deviceUid) {
      /**
       * ★ 중요
       *
       * 예전:
       *
       * deviceUid=DEVICE-001
       * deviceId=DEVICE-001
       *
       * 두 개를 동시에 보내고 있었음.
       *
       * deviceId는 Long이므로
       * DEVICE-001을 보내면 400 발생 가능.
       *
       * 이제 deviceUid만 전달.
       */
      apiPayload.deviceUid =
        deviceUid;
    }

    return apiPayload;
  };

  // =========================================================
  // 검색
  // =========================================================

  const handleSearch = () => {
    const keyword =
      trimValue(
        searchParams.keyword
      );

    const date =
      trimValue(
        searchParams.date
      );

    const userId =
      trimValue(
        searchParams.userId
      );

    const deviceUid =
      trimValue(
        searchParams.deviceUid
      );

    // =====================================================
    // 날짜 검증
    // =====================================================

    if (
      date &&
      !isValidDateFormat(date)
    ) {
      Alert.alert(
        "날짜 확인",
        "날짜는 YYYY-MM-DD 형식으로 입력해주세요.\n\n예: 2026-08-11"
      );

      return;
    }

    // =====================================================
    // 사용자 ID 검증
    // =====================================================

    if (
      userId &&
      !/^\d+$/.test(userId)
    ) {
      Alert.alert(
        "사용자 ID 확인",
        "사용자 ID는 숫자로 입력해주세요."
      );

      return;
    }

    // =====================================================
    // 서버 API 파라미터
    // =====================================================

    const apiPayload =
      buildApiPayload({
        keyword,
        date,
        userId,
        deviceUid,
      });

    // =====================================================
    // 결과 페이지로 넘길 정보
    // =====================================================

    const nextSearchParams = {
      // 화면 표시용
      keyword:
        keyword ||
        "전체",

      date:
        date ||
        "전체 기간",

      userId:
        userId ||
        "전체 사용자",

      deviceUid:
        deviceUid ||
        "전체 디바이스",

      /**
       * 서버에 실제 전송할 값
       */
      apiPayload,

      /**
       * 아래 값들은 서버에 보내지 않는다.
       *
       * 다음 AdminHistorySearchResultScreen에서
       * 서버가 반환한 결과를 대상으로
       * 로컬 필터링할 때 사용.
       */
      localFilters: {
        visitTypes:
          selectedVisitTypes,

        situations:
          selectedSituations,

        keywords:
          selectedKeywords,
      },

      /**
       * 기존 Result 화면과의 호환성을 위해
       * 개별 값도 남겨둔다.
       */
      visitTypes:
        selectedVisitTypes,

      situations:
        selectedSituations,

      keywords:
        selectedKeywords,
    };

    logAdminHistory(
      "검색 실행",
      {
        apiPayload,

        localFilters: {
          visitTypes:
            selectedVisitTypes,

          situations:
            selectedSituations,

          keywords:
            selectedKeywords,
        },
      }
    );

    navigation.navigate(
      "AdminHistorySearchResult",
      {
        searchParams:
          nextSearchParams,

        refreshKey:
          Date.now(),
      }
    );
  };

  // =========================================================
  // UI
  // =========================================================

  return (
    <Container>
      {/* ================= HEADER ================= */}

      <Header>
        <Logo
          source={bellIcon}
          resizeMode="contain"
        />

        <HeaderTitle>
          기록
        </HeaderTitle>
      </Header>

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={{
          paddingBottom: 40,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ================= 검색 입력 ================= */}

        <SearchContainer>
          {/* 키워드 */}

          <InputRow>
            <InputIcon
              source={
                iconKeyword
              }
              resizeMode="contain"
            />

            <StyledInput
              placeholder="키워드"
              placeholderTextColor="#BBB"
              value={
                searchParams.keyword
              }
              onChangeText={(
                text
              ) =>
                updateSearchParam(
                  "keyword",
                  text
                )
              }
              onSubmitEditing={
                handleSearch
              }
              returnKeyType="search"
              autoCorrect={false}
            />

            <SearchButton
              activeOpacity={0.7}
              onPress={
                handleSearch
              }
            >
              <SearchBtnIcon
                source={
                  searchIcon
                }
                resizeMode="contain"
              />
            </SearchButton>
          </InputRow>

          {/* 날짜 */}

          <InputRow>
            <InputIcon
              source={
                iconCalendar
              }
              resizeMode="contain"
            />

            <StyledInput
              placeholder="날짜 (YYYY-MM-DD)"
              placeholderTextColor="#BBB"
              value={
                searchParams.date
              }
              onChangeText={(
                text
              ) =>
                updateSearchParam(
                  "date",
                  text
                )
              }
              onSubmitEditing={
                handleSearch
              }
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </InputRow>

          {/* 사용자 ID */}

          <InputRow>
            <InputIcon
              source={iconUser}
              resizeMode="contain"
            />

            <StyledInput
              placeholder="사용자 ID"
              placeholderTextColor="#BBB"
              value={
                searchParams.userId
              }
              onChangeText={(
                text
              ) =>
                updateSearchParam(
                  "userId",
                  text.replace(
                    /[^0-9]/g,
                    ""
                  )
                )
              }
              onSubmitEditing={
                handleSearch
              }
              returnKeyType="search"
              keyboardType="number-pad"
            />
          </InputRow>

          {/* Device UID */}

          <InputRow
            style={{
              borderBottomWidth: 0,
            }}
          >
            <InputIcon
              source={
                iconDeviceId
              }
              resizeMode="contain"
            />

            <StyledInput
              placeholder="디바이스 UID (예: DEVICE-001)"
              placeholderTextColor="#BBB"
              value={
                searchParams.deviceUid
              }
              onChangeText={(
                text
              ) =>
                updateSearchParam(
                  "deviceUid",
                  text
                )
              }
              onSubmitEditing={
                handleSearch
              }
              returnKeyType="search"
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </InputRow>
        </SearchContainer>

        {/* ================= 방문 유형 ================= */}

        <SectionWrapper>
          <SectionLabel>
            방문 유형
          </SectionLabel>

          <TagCloud>
            {VISIT_TYPES.map(
              (tag) => {
                const active =
                  selectedVisitTypes.includes(
                    tag
                  );

                return (
                  <TagItem
                    key={tag}
                    active={
                      active
                    }
                    onPress={() =>
                      toggleTag(
                        tag,
                        selectedVisitTypes,
                        setSelectedVisitTypes
                      )
                    }
                  >
                    <TagText
                      active={
                        active
                      }
                    >
                      {tag}
                    </TagText>
                  </TagItem>
                );
              }
            )}
          </TagCloud>
        </SectionWrapper>

        {/* ================= 상황 성격 ================= */}

        <SectionWrapper>
          <SectionLabel>
            상황 성격
          </SectionLabel>

          <TagCloud>
            {SITUATIONS.map(
              (tag) => {
                const active =
                  selectedSituations.includes(
                    tag
                  );

                return (
                  <TagItem
                    key={tag}
                    active={
                      active
                    }
                    onPress={() =>
                      toggleTag(
                        tag,
                        selectedSituations,
                        setSelectedSituations
                      )
                    }
                  >
                    <TagText
                      active={
                        active
                      }
                    >
                      {tag}
                    </TagText>
                  </TagItem>
                );
              }
            )}
          </TagCloud>
        </SectionWrapper>

        {/* ================= 세부 키워드 ================= */}

        <SectionWrapper>
          <SectionLabel>
            세부 키워드
          </SectionLabel>

          <TagCloud>
            {DETAIL_KEYWORDS.map(
              (tag) => {
                const active =
                  selectedKeywords.includes(
                    tag
                  );

                return (
                  <TagItem
                    key={tag}
                    active={
                      active
                    }
                    onPress={() =>
                      toggleTag(
                        tag,
                        selectedKeywords,
                        setSelectedKeywords
                      )
                    }
                  >
                    <TagText
                      active={
                        active
                      }
                    >
                      {tag}
                    </TagText>
                  </TagItem>
                );
              }
            )}
          </TagCloud>
        </SectionWrapper>
      </ScrollView>
    </Container>
  );
}

// =========================================================
// STYLE
// =========================================================

const Container = styled(
  SafeAreaContainer
)`
  flex: 1;
  background-color: #f4f5f7;
`;

const Header = styled.View`
  flex-direction: row;
  align-items: center;
  padding: 15px 20px;
  background-color: #f4f5f7;
`;

const Logo = styled.Image`
  width: 28px;
  height: 28px;
  margin-right: 10px;
`;

const HeaderTitle = styled.Text`
  font-size: 20px;
  font-weight: 800;
  color: #333;
`;

const SearchContainer = styled.View`
  background-color: #fff;
  margin: 15px 20px;
  border-radius: 20px;
  padding: 5px 20px;
  elevation: 2;
  shadow-color: #000;
  shadow-opacity: 0.04;
  shadow-radius: 8px;
`;

const InputRow = styled.View`
  flex-direction: row;
  align-items: center;
  padding: 16px 0;
  border-bottom-width: 1px;
  border-bottom-color: #f0f0f0;
`;

const InputIcon = styled.Image`
  width: 20px;
  height: 20px;
  margin-right: 15px;
  tint-color: #666;
`;

const StyledInput = styled.TextInput`
  flex: 1;
  font-size: 15px;
  color: #333;
  padding: 0;
`;

const SearchButton = styled.TouchableOpacity`
  background-color: #f5f5f5;
  width: 36px;
  height: 36px;
  border-radius: 18px;
  justify-content: center;
  align-items: center;
`;

const SearchBtnIcon = styled.Image`
  width: 20px;
  height: 20px;
  tint-color: #333;
`;

const SectionWrapper = styled.View`
  padding: 10px 20px;
`;

const SectionLabel = styled.Text`
  font-size: 14px;
  font-weight: 700;
  color: #888;
  margin-bottom: 12px;
`;

const TagCloud = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  background-color: #fff;
  padding: 20px 20px 10px 20px;
  border-radius: 20px;
  elevation: 1;
  shadow-color: #000;
  shadow-opacity: 0.03;
  shadow-radius: 5px;
`;

const TagItem = styled.TouchableOpacity`
  background-color: ${(props) =>
    props.active
      ? "#1EC949"
      : "#F4F5F7"};
  padding: 10px 16px;
  border-radius: 12px;
  margin-right: 10px;
  margin-bottom: 10px;
`;

const TagText = styled.Text`
  font-size: 13px;
  font-weight: 600;
  color: ${(props) =>
    props.active
      ? "#fff"
      : "#666"};
`;