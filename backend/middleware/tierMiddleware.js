export function tierMiddleware(requiredTier) {
  return async (req, res, next) => {
    // If no user attached (not logged in), block
    if (!req.user) {
      return res.status(401).json({ error: "Login required" });
    }

    try {
      const result = await req.app
        .get("pool")
        .query("SELECT tier FROM users WHERE id = $1", [req.user.id]);

      if (result.rows.length === 0) {
        return res.status(401).json({ error: "User not found" });
      }

      const userTier = result.rows[0].tier;

      // pro can access everything, free can only access "free" routes
      const tierHierarchy = { free: 0, pro: 1 };

      if ((tierHierarchy[userTier] || 0) < (tierHierarchy[requiredTier] || 0)) {
        return res.status(403).json({
          error: "upgrade_required",
          message: `This feature requires a ${requiredTier} subscription`,
          currentTier: userTier,
          requiredTier,
        });
      }

      req.userTier = userTier;
      next();
    } catch (err) {
      console.error("Tier check failed:", err);
      return res.status(500).json({ error: "Failed to check subscription" });
    }
  };
}
