import type { Tip } from "../../api/types";
import TipCard from "./shared/TipCard";
import styles from "./TipsList.module.css";

export type SortType =
  | "trending"
  | "confidence"
  | "last5"
  | "last10"
  | "last15"
  | "vsOpp";

interface TipsListProps {
  loading: boolean;
  paginatedTips: Tip[];
  currentPage: number;
  totalPages: number;
  goToPage: (page: number) => void;
  testDate: string;
}

export default function TipsList({
  loading,
  paginatedTips,
  currentPage,
  totalPages,
  goToPage,
  testDate,
}: TipsListProps) {
  return (
    <div className={styles.mainContent}>
      {loading && <p className={styles.loadingText}>Loading tips...</p>}

      {!loading && (
        <>
          {paginatedTips.length === 0 ? (
            <p className={styles.emptyText}>
              No tips found for this selection.
            </p>
          ) : (
            <div className={styles.tipsList}>
              {paginatedTips.map((tip) => (
                <TipCard
                  key={tip.id}
                  tip={tip}
                  dateLabel={testDate}
                  onGameReport={(t) =>
                    console.log("Game report for:", t.player)
                  }
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* PAGINATION CONTROLS */}
      {!loading && totalPages > 1 && (
        <div className={styles.paginationContainer}>
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            className={`${styles.paginationBtn} ${currentPage === 1 ? styles.paginationBtnDisabled : ""}`}
          >
            ← Previous
          </button>
          <span className={styles.paginationInfo}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={`${styles.paginationBtn} ${currentPage === totalPages ? styles.paginationBtnDisabled : ""}`}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
