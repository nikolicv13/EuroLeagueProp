import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./layout/AppLayout";
import { AuthProvider } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import PlayerStats from "./components/player/PlayerStats";
import ParlayBuilderPage from "./pages/ParleyBuilderPage";
import PricingPage from "./pages/PricingPage";
import ContactPage from "./pages/ContactsPage";
import TypsDashboard from "./components/dashboard/TipsDashboard";
import PlayerSearchPage from "./components/player/PlayerSearchPage";
import AccountPage from "./pages/AccountPage";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Auth pages — no header/layout */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* Main app — with header/layout */}
        <Route element={<AppLayout />}>
          <Route path="/" element={<TypsDashboard />} />
          <Route path="/players" element={<PlayerSearchPage />} />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <AccountPage />
              </ProtectedRoute>
            }
          />
          <Route path="/player-stats/:playerId" element={<PlayerStats />} />
          <Route path="/parlay-builder" element={<ParlayBuilderPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
