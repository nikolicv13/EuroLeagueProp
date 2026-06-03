import { NavLink } from "react-router-dom";
import styles from "./Header.module.css";

export default function Header() {
  return (
    <header className={styles.siteHeader}>
      <div className={styles.siteHeaderInner}>
        {/* Left Section: Logo */}
        <NavLink to="/" className={styles.logo}>
          PropAlley <span className={styles.betaBadge}>BETA</span>
        </NavLink>

        {/* Middle Section: Navigation */}
        <div className={`${styles.headerSection} ${styles.headerCenter}`}>
          <nav className={styles.nav}>
            {/* 
              Use the className callback to apply the active style dynamically.
              This is the proper way to use CSS Modules with NavLink!
            */}
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                isActive
                  ? `${styles.navLink} ${styles.navLinkActive}`
                  : styles.navLink
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/players"
              className={({ isActive }) =>
                isActive
                  ? `${styles.navLink} ${styles.navLinkActive}`
                  : styles.navLink
              }
            >
              Player Search
            </NavLink>
            <NavLink
              to="/parlay-builder"
              className={({ isActive }) =>
                isActive
                  ? `${styles.navLink} ${styles.navLinkActive}`
                  : styles.navLink
              }
            >
              Parlay Builder
            </NavLink>
            <NavLink
              to="/pricing"
              className={({ isActive }) =>
                isActive
                  ? `${styles.navLink} ${styles.navLinkActive}`
                  : styles.navLink
              }
            >
              Pricing
            </NavLink>
            <NavLink
              to="/contact"
              className={({ isActive }) =>
                isActive
                  ? `${styles.navLink} ${styles.navLinkActive}`
                  : styles.navLink
              }
            >
              Contact
            </NavLink>
          </nav>
        </div>

        {/* Right Section: Auth Buttons */}
        <div className={`${styles.headerSection} ${styles.headerRight}`}>
          <NavLink
            to="/login"
            className={`${styles.button} ${styles.buttonSecondary}`}
          >
            Login
          </NavLink>
          <NavLink
            to="/signup"
            className={`${styles.button} ${styles.buttonPrimary}`}
          >
            Sign Up
          </NavLink>
        </div>
      </div>
    </header>
  );
}
