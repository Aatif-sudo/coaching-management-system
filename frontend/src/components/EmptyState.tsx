import { Paper, Typography } from "@mui/material";

export function EmptyState({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        px: 3,
        py: 5,
        textAlign: "center",
        borderColor: "#e8ddcc",
        bgcolor: "#f0ece4",
      }}
    >
      <Typography variant="h6">{title}</Typography>
      {subtitle ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {subtitle}
        </Typography>
      ) : null}
    </Paper>
  );
}

