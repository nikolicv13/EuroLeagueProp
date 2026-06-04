import { useState } from "react";
import styles from "../utils/PaigeContainer.module.css";

export default function ContactPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");

    try {
      const response = await fetch("https://formspree.io/f/mojzqewy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email, message }),
      });

      if (response.ok) {
        setStatus("success");
        setEmail("");
        setMessage("");
      } else {
        setStatus("error");
      }
    } catch (error) {
      console.error("Form submission error:", error);
      setStatus("error");
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.icon}>✉️</div>
        <h1 className={styles.title}>Contact Us</h1>

        {status === "success" ? (
          <div style={{ marginTop: "24px" }}>
            <p
              className={styles.subtitle}
              style={{ color: "var(--success)", fontWeight: 700 }}
            >
              Message sent successfully!
            </p>
            <p
              className={styles.subtitle}
              style={{ fontSize: "14px", marginTop: "8px" }}
            >
              Thanks for reaching out. We'll get back to you as soon as
              possible.
            </p>
            <button
              className={styles.submitBtn}
              style={{ background: "var(--text-secondary)", marginTop: "16px" }}
              onClick={() => setStatus("idle")}
            >
              Send Another Message
            </button>
          </div>
        ) : (
          <>
            <p className={styles.subtitle}>
              Have a question, a feature suggestion, or found a bug? We'd love
              to hear from you.
            </p>

            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="email">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  className={styles.input}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={status === "loading"}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="message">
                  Message
                </label>
                <textarea
                  id="message"
                  className={styles.textarea}
                  placeholder="Tell us what's on your mind..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  disabled={status === "loading"}
                />
              </div>

              {status === "error" && (
                <p
                  style={{
                    color: "var(--danger)",
                    fontSize: "14px",
                    fontWeight: 600,
                    margin: 0,
                  }}
                >
                  Something went wrong. Please try again later.
                </p>
              )}

              <button
                type="submit"
                className={styles.submitBtn}
                disabled={status === "loading"}
                style={{ opacity: status === "loading" ? 0.7 : 1 }}
              >
                {status === "loading" ? "Sending..." : "Send Message"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
