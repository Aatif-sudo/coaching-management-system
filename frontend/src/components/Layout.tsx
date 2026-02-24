import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import LogoutIcon from "@mui/icons-material/Logout";
import {
  AppBar,
  Box,
  Button,
  Container,
  Toolbar,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { Link as RouterLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useThemeMode } from "../context/ThemeModeContext";

interface NavItem {
  label: string;
  to: string;
}

const staffNav: NavItem[] = [
  { label: "Dashboard", to: "/admin" },
  { label: "Students", to: "/students" },
  { label: "Batches", to: "/batches" },
  { label: "Attendance", to: "/attendance" },
  { label: "Notes", to: "/notes" },
  { label: "Fees", to: "/fees" },
];

const studentNav: NavItem[] = [{ label: "Dashboard", to: "/student" }];

export function Layout() {
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const navItems = user?.role === "STUDENT" ? studentNav : staffNav;
  const location = useLocation();

  return (
    <Box sx={{ minHeight: "100vh" }}>
      <AppBar position="sticky" color="default" elevation={1}>
        <Container maxWidth="xl">
          <Toolbar sx={{ px: "0 !important", py: 1, minHeight: "auto" }}>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={2} sx={{ width: "100%" }}>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  Coaching Management System
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Operations console for coaching institutes
                </Typography>
              </Box>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Paper variant="outlined" sx={{ px: 1.5, py: 1 }}>
                  <Typography variant="caption" sx={{ display: "block", fontWeight: 700 }}>
                    {user?.full_name}
                  </Typography>
                  <Typography variant="caption">{user?.role}</Typography>
                </Paper>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={toggleMode}
                  startIcon={mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
                >
                  {mode === "dark" ? "Light" : "Dark"}
                </Button>
                <Button variant="contained" size="small" onClick={logout} endIcon={<LogoutIcon />}>
                  Logout
                </Button>
              </Stack>
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 3 }}>

        <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", lg: "220px 1fr" } }}>
          <Paper sx={{ p: 1.5, position: "relative", zIndex: 1 }}>
            <Stack spacing={0.5}>
              {navItems.map((item) => (
                <Button
                  key={item.to}
                  component={RouterLink}
                  to={item.to}
                  variant={location.pathname === item.to ? "contained" : "text"}
                  fullWidth
                  sx={{
                    justifyContent: "flex-start",
                    textTransform: "none",
                    fontWeight: 700,
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </Stack>
          </Paper>

          <Paper sx={{ p: { xs: 2, sm: 3 }, position: "relative", zIndex: 1 }}>
            <Outlet />
          </Paper>
        </Box>
      </Container>
    </Box>
  );
}

