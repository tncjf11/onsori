import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import axios from "axios";

const MAX_RECORDS = 30;
const GLOBAL_STORE_KEY = "__EXPO_API_SPEED_TEST_STORE__";

/*
 * Fast Refresh가 발생해도 Axios 인터셉터가
 * 여러 번 중복 등록되지 않도록 전역 저장소를 사용합니다.
 */
const getSpeedTestStore = () => {
  if (!globalThis[GLOBAL_STORE_KEY]) {
    globalThis[GLOBAL_STORE_KEY] = {
      installed: false,
      records: [],
      listeners: new Set(),
      requestInterceptorId: null,
      responseInterceptorId: null,
    };
  }

  return globalThis[GLOBAL_STORE_KEY];
};

const speedTestStore = getSpeedTestStore();

const formatDuration = (milliseconds) => {
  if (!Number.isFinite(milliseconds)) {
    return "-";
  }

  if (milliseconds >= 1000) {
    return `${(milliseconds / 1000).toFixed(2)}초`;
  }

  return `${Math.round(milliseconds)}ms`;
};

const getDurationColor = (milliseconds) => {
  if (!Number.isFinite(milliseconds)) {
    return "#999999";
  }

  if (milliseconds < 200) {
    return "#1EC949";
  }

  if (milliseconds < 500) {
    return "#2F80ED";
  }

  if (milliseconds < 1000) {
    return "#E89700";
  }

  return "#FF4D4D";
};

const buildQueryString = (params) => {
  if (!params || typeof params !== "object") {
    return "";
  }

  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null
  );

  if (entries.length === 0) {
    return "";
  }

  const query = entries
    .map(([key, value]) => {
      return `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
    })
    .join("&");

  return `?${query}`;
};

const getRequestUrl = (config = {}) => {
  const baseURL = config.baseURL || "";
  const url = config.url || "";
  const queryString = buildQueryString(config.params);

  if (/^https?:\/\//i.test(url)) {
    return `${url}${queryString}`;
  }

  return `${baseURL}${url}${queryString}`;
};

const notifyListeners = () => {
  const copiedRecords = [...speedTestStore.records];

  speedTestStore.listeners.forEach((listener) => {
    listener(copiedRecords);
  });
};

const addRecord = (record) => {
  speedTestStore.records = [
    record,
    ...speedTestStore.records,
  ].slice(0, MAX_RECORDS);

  notifyListeners();
};

const installAxiosSpeedMonitor = () => {
  if (speedTestStore.installed) {
    return;
  }

  speedTestStore.installed = true;

  speedTestStore.requestInterceptorId =
    axios.interceptors.request.use(
      (config) => {
        config.__apiSpeedTestStartedAt = Date.now();

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

  speedTestStore.responseInterceptorId =
    axios.interceptors.response.use(
      (response) => {
        const startedAt =
          response.config?.__apiSpeedTestStartedAt;

        const duration = Number.isFinite(startedAt)
          ? Date.now() - startedAt
          : null;

        const record = {
          id: `${Date.now()}-${Math.random()}`,
          method: String(
            response.config?.method || "GET"
          ).toUpperCase(),
          url: getRequestUrl(response.config),
          status: response.status,
          duration,
          success: true,
          measuredAt: new Date().toLocaleTimeString("ko-KR", {
            hour12: false,
          }),
        };

        console.log(
          `🚀 [API SPEED] ${record.method} ${record.url} | ` +
            `HTTP ${record.status} | ${formatDuration(record.duration)}`
        );

        addRecord(record);

        return response;
      },
      (error) => {
        const config = error.config || {};
        const startedAt = config.__apiSpeedTestStartedAt;

        const duration = Number.isFinite(startedAt)
          ? Date.now() - startedAt
          : null;

        const record = {
          id: `${Date.now()}-${Math.random()}`,
          method: String(config.method || "GET").toUpperCase(),
          url: getRequestUrl(config),
          status: error.response?.status || "ERR",
          duration,
          success: false,
          measuredAt: new Date().toLocaleTimeString("ko-KR", {
            hour12: false,
          }),
        };

        console.log(
          `❌ [API SPEED] ${record.method} ${record.url} | ` +
            `HTTP ${record.status} | ${formatDuration(record.duration)}`
        );

        addRecord(record);

        return Promise.reject(error);
      }
    );
};

/*
 * App.js에서 Test.jsx를 import하는 순간 등록됩니다.
 * 화면의 useEffect보다 먼저 등록되므로 첫 API 요청도 잡을 수 있습니다.
 */
installAxiosSpeedMonitor();

export default function Test() {
  const [records, setRecords] = useState([
    ...speedTestStore.records,
  ]);

  /*
   * 처음에는 앱 화면을 가리지 않도록 접힌 상태로 둡니다.
   */
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const listener = (nextRecords) => {
      setRecords(nextRecords);
    };

    speedTestStore.listeners.add(listener);
    setRecords([...speedTestStore.records]);

    return () => {
      speedTestStore.listeners.delete(listener);
    };
  }, []);

  const summary = useMemo(() => {
    const validRecords = records.filter((record) =>
      Number.isFinite(record.duration)
    );

    if (validRecords.length === 0) {
      return {
        average: null,
        minimum: null,
        maximum: null,
        successCount: 0,
        failureCount: 0,
      };
    }

    const durations = validRecords.map(
      (record) => record.duration
    );

    const total = durations.reduce(
      (sum, duration) => sum + duration,
      0
    );

    return {
      average: total / durations.length,
      minimum: Math.min(...durations),
      maximum: Math.max(...durations),
      successCount: validRecords.filter(
        (record) => record.success
      ).length,
      failureCount: validRecords.filter(
        (record) => !record.success
      ).length,
    };
  }, [records]);

  const clearRecords = () => {
    speedTestStore.records = [];
    notifyListeners();

    console.log("🧹 [API SPEED] 측정 기록 초기화");
  };

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      {!isExpanded ? (
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.floatingButton}
          onPress={() => setIsExpanded(true)}
        >
          <Text style={styles.floatingButtonTitle}>API</Text>

          <Text style={styles.floatingButtonValue}>
            {records.length > 0
              ? formatDuration(records[0]?.duration)
              : "대기"}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.panel}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.panelHeader}
            onPress={() => setIsExpanded(false)}
          >
            <View>
              <Text style={styles.panelTitle}>
                API 속도 점검
              </Text>

              <Text style={styles.panelSubtitle}>
                총 {records.length}건 측정
              </Text>
            </View>

            <Text style={styles.closeText}>접기</Text>
          </TouchableOpacity>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>평균</Text>
              <Text style={styles.summaryValue}>
                {formatDuration(summary.average)}
              </Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>최소</Text>
              <Text style={styles.summaryValue}>
                {formatDuration(summary.minimum)}
              </Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>최대</Text>
              <Text style={styles.summaryValue}>
                {formatDuration(summary.maximum)}
              </Text>
            </View>
          </View>

          <View style={styles.recordHeader}>
            <Text style={styles.recordHeaderText}>
              성공 {summary.successCount} / 실패{" "}
              {summary.failureCount}
            </Text>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={clearRecords}
            >
              <Text style={styles.clearText}>초기화</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.recordList}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {records.length > 0 ? (
              records.map((record) => (
                <View key={record.id} style={styles.recordItem}>
                  <View style={styles.recordTopRow}>
                    <Text
                      style={[
                        styles.methodText,
                        {
                          color: record.success
                            ? "#1EC949"
                            : "#FF4D4D",
                        },
                      ]}
                    >
                      {record.method}
                    </Text>

                    <Text style={styles.statusText}>
                      HTTP {record.status}
                    </Text>

                    <Text
                      style={[
                        styles.durationText,
                        {
                          color: getDurationColor(
                            record.duration
                          ),
                        },
                      ]}
                    >
                      {formatDuration(record.duration)}
                    </Text>
                  </View>

                  <Text
                    style={styles.urlText}
                    numberOfLines={2}
                  >
                    {record.url}
                  </Text>

                  <Text style={styles.measuredAtText}>
                    {record.measuredAt}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyWrapper}>
                <Text style={styles.emptyText}>
                  페이지를 이동하거나 버튼을 눌러 API를
                  호출해보세요.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    elevation: 99999,
    justifyContent: "flex-end",
    alignItems: "flex-end",
    padding: 12,
  },

  floatingButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#1EC949",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 7,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    elevation: 12,
  },

  floatingButtonTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  floatingButtonValue: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "700",
    color: "#E9FFEF",
  },

  panel: {
    width: "96%",
    maxHeight: 480,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#1EC949",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 15,
  },

  panelHeader: {
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: "#1EC949",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  panelTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  panelSubtitle: {
    marginTop: 3,
    fontSize: 11,
    color: "#E9FFEF",
  },

  closeText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  summaryRow: {
    flexDirection: "row",
    paddingVertical: 12,
    backgroundColor: "#F6F7F8",
  },

  summaryItem: {
    flex: 1,
    alignItems: "center",
  },

  summaryDivider: {
    width: 1,
    backgroundColor: "#E5E7EB",
  },

  summaryLabel: {
    fontSize: 11,
    color: "#999999",
    marginBottom: 3,
  },

  summaryValue: {
    fontSize: 14,
    fontWeight: "900",
    color: "#333333",
  },

  recordHeader: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },

  recordHeaderText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#666666",
  },

  clearText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FF4D4D",
  },

  recordList: {
    maxHeight: 285,
  },

  recordItem: {
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },

  recordTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  methodText: {
    width: 54,
    fontSize: 12,
    fontWeight: "900",
  },

  statusText: {
    flex: 1,
    fontSize: 12,
    color: "#777777",
  },

  durationText: {
    fontSize: 13,
    fontWeight: "900",
  },

  urlText: {
    marginTop: 5,
    fontSize: 11,
    lineHeight: 16,
    color: "#444444",
  },

  measuredAtText: {
    marginTop: 4,
    fontSize: 10,
    color: "#AAAAAA",
  },

  emptyWrapper: {
    padding: 35,
    alignItems: "center",
  },

  emptyText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#999999",
    textAlign: "center",
  },
});