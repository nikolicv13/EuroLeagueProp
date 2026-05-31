import React from "react";
import styles from "./OddsSlider.module.css";

interface OddsSliderProps {
  minOdds: number;
  maxOdds: number;
  onMinChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onMaxChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function OddsSlider({
  minOdds,
  maxOdds,
  onMinChange,
  onMaxChange,
}: OddsSliderProps) {
  const getTrackStyle = () => {
    const min = 1.0;
    const max = 10.0;
    const leftPercent = ((minOdds - min) / (max - min)) * 100;
    const rightPercent = 100 - ((maxOdds - min) / (max - min)) * 100;
    return { left: `${leftPercent}%`, right: `${rightPercent}%` };
  };

  return (
    <div className={styles.oddsSliderContainer}>
      <label className={styles.filterLabel}>Filter by Odds</label>
      <div className={styles.oddsSliderValues}>
        <span>{minOdds.toFixed(2)}</span>
        <span>{maxOdds.toFixed(2)}</span>
      </div>
      <div className={styles.rangeSlider}>
        <div className={styles.rangeTrackActive} style={getTrackStyle()}></div>
        <input
          type="range"
          min="1.00"
          max="10.00"
          step="0.05"
          value={minOdds}
          onChange={onMinChange}
        />
        <input
          type="range"
          min="1.00"
          max="10.00"
          step="0.05"
          value={maxOdds}
          onChange={onMaxChange}
        />
      </div>
    </div>
  );
}
