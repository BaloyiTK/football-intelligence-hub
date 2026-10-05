"use client";
import { useRouter } from "next/navigation";
export default function DatePicker({selected}:{selected?:string}){const router=useRouter();return <div className="datepick"><label htmlFor="prediction-date">Browse date</label><input id="prediction-date" type="date" value={selected??""} onChange={e=>{if(e.target.value)router.push("/?date="+encodeURIComponent(e.target.value))}}/></div>}