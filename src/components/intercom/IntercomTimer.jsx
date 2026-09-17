import styled from "styled-components/native";

export default function IntercomTimer({
 seconds=0,
}){

const formatTimer=(totalSeconds)=>{
 const mins=Math.floor(totalSeconds/60);
 const secs=totalSeconds%60;

 return `${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;
};

return(
<TimerText>
{formatTimer(seconds)}
</TimerText>
);

}


const TimerText=styled.Text`
font-size:14px;
font-weight:700;
color:#ff5b5b;
`;