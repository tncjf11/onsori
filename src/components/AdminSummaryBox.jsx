import React from "react";
import styled from "styled-components/native";

/**
 * @param {Object} data - { total, online, offline, error } 객체
 */
const AdminSummaryBox = ({ data }) => {
  return (
    <SummaryContainer>
      <Item>
        <Label>전체 장치</Label>
        <Value>{data.total || 0}</Value>
      </Item>
      <Item>
        <Label>온라인</Label>
        <Value style={{ color: "#06F393" }}>{data.online || 0}</Value>
      </Item>
      <Item>
        <Label>오프라인</Label>
        <Value>{data.offline || 0}</Value>
      </Item>
      <Item>
        <Label>오류</Label>
        <Value style={{ color: "#FF5C5C" }}>{data.error || 0}</Value>
      </Item>
    </SummaryContainer>
  );
};

export default AdminSummaryBox;

const SummaryContainer = styled.View`
  flex-direction: row;
  justify-content: space-between;
  background-color: white;
  margin: 20px;
  padding: 20px;
  border-radius: 20px;
  elevation: 3;
  shadow-color: #000;
  shadow-opacity: 0.05;
  shadow-radius: 10px;
`;

const Item = styled.View`
  align-items: center;
  flex: 1;
`;

const Label = styled.Text`
  font-size: 13px;
  color: #888;
  margin-bottom: 8px;
`;

const Value = styled.Text`
  font-size: 18px;
  font-weight: 800;
  color: #333;
`;