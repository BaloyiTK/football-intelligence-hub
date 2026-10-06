"use client";
import {useEffect,useState} from "react";

function legacyKickoff(value:string,date?:string){
 const m=value.match(/^(\d{1,2}):(\d{2})\s*SAST$/i);
 if(!m||!date)return null;
 const hh=String(Number(m[1])).padStart(2,"0");
 return new Date(`${date}T${hh}:${m[2]}:00+02:00`);
}

export default function KickoffTime({value,date}:{value?:string;date?:string}){
 const [label,setLabel]=useState("—");
 useEffect(()=>{
  if(!value){setLabel("Time pending");return}
  const legacy=legacyKickoff(value,date);
  const d=legacy??new Date(value);
  if(Number.isNaN(d.getTime())){setLabel(value.replace(/\s*SAST$/i,""));return}
  setLabel(new Intl.DateTimeFormat(undefined,{hour:"2-digit",minute:"2-digit"}).format(d));
 },[value,date]);
 return <span className="kickoff">{label}</span>;
}
