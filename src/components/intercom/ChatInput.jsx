import styled from "styled-components/native";

const sendInactive = require("../../assets/send_inactive.png");
const sendActive = require("../../assets/send_active.png");

export default function ChatInput({
  inputText,
  onChangeText,
  onSend,
  onFocus,
  disabled = false,
}) {
  const canSend =
    String(inputText || "").trim().length > 0;

  const handleSubmit = () => {
    if (!disabled && canSend) {
      onSend?.();
    }
  };

  return (
    <InputSection>
      <InputBar>
        <InputField
          value={inputText}
          onChangeText={onChangeText}
          onFocus={onFocus}
          editable={!disabled}
          multiline={false}
          returnKeyType="send"
          blurOnSubmit={false}
          placeholder="방문자에게 전달할 내용을 입력하세요"
          placeholderTextColor="#A4A8AE"
          onSubmitEditing={handleSubmit}
        />

        <SendButton
          onPress={handleSubmit}
          disabled={disabled || !canSend}
          activeOpacity={0.7}
          hitSlop={{
            top: 6,
            bottom: 6,
            left: 6,
            right: 6,
          }}
        >
          <SendBtnIcon
            source={
              canSend
                ? sendActive
                : sendInactive
            }
            resizeMode="contain"
          />
        </SendButton>
      </InputBar>
    </InputSection>
  );
}

const InputSection = styled.View`
  width: 100%;
  background-color: #ffffff;
  padding: 10px 16px 11px;
  z-index: 20;
  flex-shrink: 0;
`;

const InputBar = styled.View`
  width: 100%;
  min-height: 52px;
  flex-direction: row;
  align-items: center;
  background-color: #f7f8fa;
  border-radius: 18px;
  border-width: 1px;
  border-color: #eceff3;
  padding: 5px 8px 5px 12px;
`;

const InputField = styled.TextInput`
  flex: 1;
  min-height: 40px;
  font-size: 15px;
  font-weight: 500;
  color: #222222;
  padding: 8px 10px;
`;

const SendButton = styled.TouchableOpacity`
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const SendBtnIcon = styled.Image`
  width: 36px;
  height: 36px;
`;