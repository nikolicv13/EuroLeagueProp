import styles from "../utils/PaigeContainer.module.css";

export default function PricingPage() {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.icon}>💎</div>
        <h1 className={styles.title}>Pricing</h1>
        <p className={styles.subtitle}>
          PropAlley is currently in{" "}
          <span className={styles.highlight}>Beta</span>, which means the entire
          platform is completely <strong>free to use</strong> right now.
          <br />
          <br />
          At the start of the next season, our premium tiers and pricing will be
          officially revealed.
          <br />
          <br />
          <em>
            Don't worry—there will always be a free tier so you can keep finding
            your edge.
          </em>
        </p>
      </div>
    </div>
  );
}
