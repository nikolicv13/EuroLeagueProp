import styles from "../utils/PaigeContainer.module.css";

export default function ParlayBuilderPage() {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.icon}>🧩</div>
        <h1 className={styles.title}>Parlay Builder</h1>
        <p className={styles.subtitle}>
          We're working hard to bring you the ultimate tool for combining props
          and calculating correlated odds.
          <br />
          <br />
          <span className={styles.highlight}>Coming Soon!</span>
        </p>
      </div>
    </div>
  );
}
