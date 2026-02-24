import { Alert, Snackbar, Stack } from "@mui/material";
import { useToast } from "../context/ToastContext";

export function ToastContainer() {
  const { toasts, removeToast } = useToast();
  if (!toasts.length) {
    return null;
  }
  return (
    <Stack
      spacing={1}
      sx={{
        position: "fixed",
        top: 12,
        right: 12,
        zIndex: 1400,
        width: "min(92vw, 360px)",
      }}
    >
      {toasts.map((toast) => (
        <Snackbar
          key={toast.id}
          open
          anchorOrigin={{ vertical: "top", horizontal: "right" }}
          onClose={() => removeToast(toast.id)}
          autoHideDuration={3500}
          sx={{ position: "static", transform: "none" }}
        >
          <Alert
            variant="filled"
            onClose={() => removeToast(toast.id)}
            severity={toast.type}
            sx={{ width: "100%" }}
          >
            {toast.message}
          </Alert>
        </Snackbar>
      ))}
    </Stack>
  );
}

