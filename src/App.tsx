import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./layout/AppLayout";

import PlayerPage from "./pages/PlayerPage";
import ParlayBuilderPage from "./pages/ParleyBuilderPage";
import PricingPage from "./pages/PricingPage";
import ContactPage from "./pages/ContactsPage";
import TypsDashboard from "./components/TipsDashboard";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<TypsDashboard />} />
        <Route path="/player-stats/:playerId" element={<PlayerPage />} />
        <Route path="/parlay-builder" element={<ParlayBuilderPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/contact" element={<ContactPage />} />
        {/* If path doesnt exist navigate to default */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
