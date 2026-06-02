import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./layout/AppLayout";

import PlayerStats from "./components/player/PlayerStats";
import ParlayBuilderPage from "./pages/ParleyBuilderPage";
import PricingPage from "./pages/PricingPage";
import ContactPage from "./pages/ContactsPage";
import TypsDashboard from "./components/dashboard/TipsDashboard";
import PlayerSearchPage from "./components/player/PlayerSearchPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<TypsDashboard />} />
        <Route path="/players" element={<PlayerSearchPage />} />
        <Route path="/player-stats/:playerId" element={<PlayerStats />} />
        <Route path="/parlay-builder" element={<ParlayBuilderPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/contact" element={<ContactPage />} />
        {/* If path doesnt exist navigate to default */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
