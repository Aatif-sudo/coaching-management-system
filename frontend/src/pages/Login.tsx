import { FormEvent, useState } from "react";
import { Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { pushToast } = useToast();
  const [email, setEmail] = useState("admin@demo.com");
  const [password, setPassword] = useState("Admin@123");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const user = await login(email, password);
      pushToast("success", "Login successful");
      navigate(user.role === "STUDENT" ? "/student" : "/admin");
    } catch (error) {
      pushToast("error", "Invalid credentials or server unavailable");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        px: 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Box
        sx={{
          position: "relative",
          width: "100%",
          maxWidth: 460,
          "&::before": {
            content: '""',
            position: "absolute",
            inset: -12,
            borderRadius: 4,
            bgcolor: "background.paper",
            opacity: 0.25,
            border: "1px solid",
            borderColor: "divider",
            backdropFilter: "blur(8px)",
            zIndex: 0,
          },
        }}
      >
      <Paper sx={{ width: "100%", p: { xs: 3, sm: 4 }, position: "relative", zIndex: 1 }}>
        <Typography variant="h4">Welcome Back</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          Login to manage your coaching institute operations.
        </Typography>

        <Stack component="form" onSubmit={onSubmit} spacing={2} sx={{ mt: 3 }}>
          <TextField
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            fullWidth
          />
          <TextField
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            inputProps={{ minLength: 6 }}
            fullWidth
          />
          <Button type="submit" variant="contained" disabled={submitting} fullWidth>
            {submitting ? "Signing in..." : "Sign In"}
          </Button>
        </Stack>

        <Paper sx={{ mt: 2.5, p: 1.5 }}>
          <Typography variant="caption" sx={{ display: "block", fontWeight: 700 }}>
            Demo credentials
          </Typography>
          <Typography variant="caption" sx={{ display: "block" }}>
            admin@demo.com / Admin@123
          </Typography>
          <Typography variant="caption" sx={{ display: "block" }}>
            teacher@demo.com / Teacher@123
          </Typography>
          <Typography variant="caption" sx={{ display: "block" }}>
            student1@demo.com / Student@123
          </Typography>
        </Paper>
      </Paper>
      </Box>
    </Box>
  );
}

