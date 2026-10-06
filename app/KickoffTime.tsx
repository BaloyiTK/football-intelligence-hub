"use client";
import {useEffect,useState} from "react";

export default function KickoffTime({value}:{value?:string}){
 const [label,setLabel]=useState("—");
 useEffect(()=>{
  if(!value){setLabel("Time pending");return}
  const d=new Date(value);
  if(Number.isNaN(d.getTime())){setLabel(value);return}
  setLabel(new Intl.DateTimeFormat(undefined,{hour:"2-digit",minute:"2-digit"}).format(d));
 },[value]);
 return <span className="kickoff">{label}</span>;
}
