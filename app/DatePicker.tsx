"use client";

import { useRouter } from "next/navigation";

export default function DatePicker({ selected }: { selected?: string }) {
  const router = useRouter();
  return (
    <form className="datepick">
      <label htmlFor="prediction-date">Prediction date</label>
      <input
        id="prediction-date"
        type="date"
        name="date"
        value={selected ?? ""}
        onChange={(event) => {
          const date = event.target.value;
          if (date) router.push("/?date=" + encodeURIComponent(date));
        }}
      />
      <button type="submit">View</button>
    </form>
  );
}
