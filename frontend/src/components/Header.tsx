import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import styles from "./Header.module.css";

export default function Header() {
  const [hidden, setHidden] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Scroll-hide behavior (your existing code)
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const THRESHOLD = 10;
      if (currentScrollY > lastScrollY && currentScrollY > THRESHOLD) {
        setHidden(true);
      } else {
        setHidden(false);
      }
      setLastScrollY(currentScrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  // Lock body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <header
      className={`${styles.siteHeader} ${hidden ? styles.headerHidden : ""}`}
    >
      <div className={styles.siteHeaderInner}>
        {/* Left Section: Logo */}
        <div className={`${styles.headerSection} ${styles.headerLeft}`}>
          <NavLink to="/" className={styles.logo} onClick={closeMenu}>
            PropAlley <span className={styles.betaBadge}>BETA</span>
          </NavLink>
        </div>

        {/* Middle Section: Navigation (Desktop) */}
        <div className={`${styles.headerSection} ${styles.headerCenter}`}>
          <nav className={styles.nav}>
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

        {/* Right Section: Auth Buttons (Desktop) */}
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

        {/* Hamburger: Mobile Only */}
        <button
          className={styles.hamburger}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
        >
          <span
            className={`${styles.hamburgerLine} ${
              mobileMenuOpen ? styles.hamburgerOpen1 : ""
            }`}
          />
          <span
            className={`${styles.hamburgerLine} ${
              mobileMenuOpen ? styles.hamburgerOpen2 : ""
            }`}
          />
          <span
            className={`${styles.hamburgerLine} ${
              mobileMenuOpen ? styles.hamburgerOpen3 : ""
            }`}
          />
        </button>
      </div>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div className={styles.mobileOverlay} onClick={closeMenu} />
      )}

      {/* Mobile Menu */}
      <nav
        className={`${styles.mobileMenu} ${
          mobileMenuOpen ? styles.mobileMenuOpen : ""
        }`}
      >
        <NavLink
          to="/"
          end
          onClick={closeMenu}
          className={({ isActive }) =>
            `${styles.mobileNavLink} ${
              isActive ? styles.mobileNavLinkActive : ""
            }`
          }
        >
          Home
        </NavLink>
        <NavLink
          to="/players"
          onClick={closeMenu}
          className={({ isActive }) =>
            `${styles.mobileNavLink} ${
              isActive ? styles.mobileNavLinkActive : ""
            }`
          }
        >
          Player Search
        </NavLink>
        <NavLink
          to="/parlay-builder"
          onClick={closeMenu}
          className={({ isActive }) =>
            `${styles.mobileNavLink} ${
              isActive ? styles.mobileNavLinkActive : ""
            }`
          }
        >
          Parlay Builder
        </NavLink>
        <NavLink
          to="/pricing"
          onClick={closeMenu}
          className={({ isActive }) =>
            `${styles.mobileNavLink} ${
              isActive ? styles.mobileNavLinkActive : ""
            }`
          }
        >
          Pricing
        </NavLink>
        <NavLink
          to="/contact"
          onClick={closeMenu}
          className={({ isActive }) =>
            `${styles.mobileNavLink} ${
              isActive ? styles.mobileNavLinkActive : ""
            }`
          }
        >
          Contact
        </NavLink>
      </nav>
    </header>
  );
}
