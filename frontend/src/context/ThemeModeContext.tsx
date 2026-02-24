import { createContext, type ReactNode, useContext, useMemo, useState } from "react";
import { ThemeProvider } from "@mui/material";
import { alpha, createTheme } from "@mui/material/styles";

type ThemeMode = "light" | "dark";

interface ThemeModeContextValue {
  mode: ThemeMode;
  toggleMode: () => void;
}

const STORAGE_KEY = "cms_theme_mode";

const ThemeModeContext = createContext<ThemeModeContextValue | undefined>(undefined);

function getInitialMode(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  return "dark";
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(getInitialMode);

  const toggleMode = () => {
    setMode((prev) => {
      const next = prev === "light" ? "dark" : "light";
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  };

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          ...(mode === "dark"
            ? {
                primary: { main: "#38bdf8" },
                secondary: { main: "#06b6d4" },
                background: { default: "#050914", paper: "#0b1220" },
                text: { primary: "#e6edf7", secondary: "#9fb0c9" },
              }
            : {
                primary: { main: "#0f5bd7" },
                secondary: { main: "#0891b2" },
              }),
        },
        typography: {
          fontFamily: `"Sora", "Inter", "Segoe UI", Roboto, sans-serif`,
          h4: { fontWeight: 700, letterSpacing: "-0.01em" },
          h5: { fontWeight: 700, letterSpacing: "-0.01em" },
          h6: { fontWeight: 700, letterSpacing: "-0.01em" },
          button: { fontWeight: 600, textTransform: "none" },
        },
        shape: {
          borderRadius: 14,
        },
        components: {
          MuiCssBaseline: {
            styleOverrides: {
              body: {
                background:
                  mode === "dark"
                    ? [
                        "radial-gradient(1000px 600px at 10% -10%, rgba(56, 189, 248, 0.22), transparent 55%)",
                        "radial-gradient(800px 500px at 95% 0%, rgba(6, 182, 212, 0.16), transparent 50%)",
                        "linear-gradient(135deg, #050914 0%, #0b1220 42%, #0f172a 100%)",
                      ].join(", ")
                    : [
                        "radial-gradient(900px 500px at 10% -15%, rgba(14, 165, 233, 0.14), transparent 55%)",
                        "radial-gradient(700px 400px at 90% 0%, rgba(14, 116, 144, 0.10), transparent 52%)",
                        "linear-gradient(135deg, #f4f8ff 0%, #ecf5ff 40%, #f8fafc 100%)",
                      ].join(", "),
                backgroundAttachment: "fixed",
              },
            },
          },
          MuiAppBar: {
            styleOverrides: {
              root: {
                backgroundColor: alpha(mode === "dark" ? "#050914" : "#ffffff", mode === "dark" ? 0.62 : 0.72),
                backdropFilter: "blur(16px) saturate(150%)",
                borderBottom: `1px solid ${alpha(mode === "dark" ? "#6b8fb9" : "#0f172a", 0.14)}`,
              },
            },
          },
          MuiPaper: {
            defaultProps: {
              variant: "outlined",
            },
            styleOverrides: {
              root: {
                backgroundColor: alpha(mode === "dark" ? "#0b1220" : "#ffffff", mode === "dark" ? 0.46 : 0.62),
                backdropFilter: "blur(16px) saturate(145%)",
                borderColor: alpha(mode === "dark" ? "#93b4d9" : "#0f172a", mode === "dark" ? 0.2 : 0.12),
                boxShadow:
                  mode === "dark"
                    ? "0 14px 40px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255,255,255,0.04)"
                    : "0 10px 30px rgba(15, 23, 42, 0.10)",
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 12,
              },
              containedPrimary: {
                boxShadow: mode === "dark" ? "0 6px 24px rgba(56, 189, 248, 0.25)" : undefined,
              },
            },
          },
        },
      }),
    [mode],
  );
  const value = useMemo(() => ({ mode, toggleMode }), [mode]);

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode() {
  const context = useContext(ThemeModeContext);
  if (!context) {
    throw new Error("useThemeMode must be used within ThemeModeProvider");
  }
  return context;
}
