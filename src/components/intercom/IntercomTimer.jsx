import styled from "styled-components/native";

export default function IntercomTimer({ seconds = 0 }) {
  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;

    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <TimerWrapper>
      <TimerBox>
        <LiveDot />

        <TimerLabel>
          통화
        </TimerLabel>

        <TimerText>
          {formatTimer(seconds)}
        </TimerText>
      </TimerBox>
    </TimerWrapper>
  );
}

const TimerWrapper = styled.View`
  width: 100%;
  padding: 12px 20px 8px;
  background-color: #f3f4f6;
  align-items: flex-start;
`;

const TimerBox = styled.View`
  flex-direction: row;
  align-items: center;
  background-color: #ffffff;
  padding: 7px 11px;
  border-radius: 12px;
  border-width: 1px;
  border-color: #eeeeee;
`;

const LiveDot = styled.View`
  width: 7px;
  height: 7px;
  border-radius: 4px;
  background-color: #ff5b5b;
  margin-right: 6px;
`;

const TimerLabel = styled.Text`
  font-size: 12px;
  font-weight: 600;
  color: #9ca3af;
  margin-right: 7px;
`;

const TimerText = styled.Text`
  font-size: 14px;
  font-weight: 800;
  color: #ff5b5b;
  letter-spacing: 0.3px;
`;