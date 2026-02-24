import { CircularProgress, Stack, Typography } from "@mui/material";

export function LoadingSpinner({ label = "Loading..." }: { label?: string }) {
  return (
    <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center" py={5}>
      <CircularProgress size={28} />
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
    </Stack>
  );
}

