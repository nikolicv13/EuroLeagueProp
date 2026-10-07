import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn(
    "⚠️  SUPABASE_URL or SUPABASE_SERVICE_KEY missing — auth routes will not work",
  );
}

export async function authMiddleware(req, res, next) {
  if (!supabase) {
    return res.status(500).json({ error: "Auth not configured on server" });
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization header" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.user = {
      id: user.id,
      email: user.email,
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: "Auth verification failed" });
  }
}

export async function optionalAuth(req, res, next) {
  if (!supabase) {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser(token);
      if (user) {
        req.user = { id: user.id, email: user.email };
      }
    } catch {
      // Continue without user
    }
  }
  next();
}
