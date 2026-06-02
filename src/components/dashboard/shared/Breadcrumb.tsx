import { NavLink } from "react-router-dom";
import styles from "./Breadcrumb.module.css";

interface BreadcrumbProps {
  leagueId: string;
  leagueName: string;
  playerName: string;
}

export default function Breadcrumb({
  leagueId,
  leagueName,
  playerName,
}: BreadcrumbProps) {
  return (
    <nav className={styles.breadcrumb}>
      {/* 1. Goes to the dedicated Search Page */}
      <NavLink to="/players" className={styles.link}>
        Search
      </NavLink>

      <span className={styles.separator}>/</span>

      {/* 2. Goes to Search Page, but pre-fills the League dropdown */}
      <NavLink to={`/players?leagueId=${leagueId}`} className={styles.link}>
        {leagueName}
      </NavLink>

      <span className={styles.separator}>/</span>

      {/* 3. Current Page */}
      <span className={styles.current}>{playerName}</span>
    </nav>
  );
}
