import * as React from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import Paper, { type PaperProps } from "@mui/material/Paper";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import InputAdornment from "@mui/material/InputAdornment";
import { useTheme } from "@mui/material/styles";
import parse from "autosuggest-highlight/parse";
import match from "autosuggest-highlight/match";
import { debounce } from "@mui/material/utils";

/** Change this if you prefer an env var (VITE_API_BASE_URL) */
const API_BASE = import.meta.env.VITE_API_BASE_URL;

/** API types */
interface AddressSuggestion {
  id: number;
  unit?: string | null;
  streetNumber: string;
  streetName: string;
  suburb: string;
  state: string;
  postcode: string;
  fullAddress: string;
}

/** Call your API */
async function fetchAddressSuggestions(
  input: string,
  pageSize = 8,
  signal?: AbortSignal
): Promise<AddressSuggestion[]> {
  const url = new URL("/api/addresses/search", API_BASE);
  url.searchParams.set("q", input);
  url.searchParams.set("pageSize", String(pageSize));
  const res = await fetch(url.toString(), { signal });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Search failed (${res.status}): ${text || res.statusText}`);
  }
  return (await res.json()) as AddressSuggestion[];
}

/** Optional: keep MUI Paper override similar to the sample */
function CustomPaper(props: PaperProps) {
  const theme = useTheme();
  return (
    <Paper elevation={3} {...props}>
      {props.children}
      <Box
        sx={(staticTheme) => ({
          display: "flex",
          justifyContent: "flex-end",
          p: 1,
          pt: "1px",
          ...staticTheme.applyStyles("dark", { opacity: 0.8 }),
        })}
      >
        {/* Placeholder for branding/footer if you need it */}
      </Box>
    </Paper>
  );
}

export default function AddressAutocomplete() {
  const [value, setValue] = React.useState<AddressSuggestion | null>(null);
  const [inputValue, setInputValue] = React.useState("");
  const [options, setOptions] = React.useState<readonly AddressSuggestion[]>([]);
  const [loading, setLoading] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  const debouncedFetch = React.useMemo(
    () =>
      debounce(async (query: string) => {
        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        try {
          setLoading(true);
          const results = await fetchAddressSuggestions(query, 8, controller.signal);

          setOptions((prev) => {
            const merged = value
              ? [value, ...results.filter((r) => r.id !== value.id)]
              : results;
            return merged;
          });
        } catch (err) {
          if ((err as any).name !== "AbortError") {
            setOptions(value ? [value] : []);
          }
        } finally {
          if (abortRef.current === controller) setLoading(false);
        }
      }, 300),
    [value]
  );

  React.useEffect(() => {
    if (inputValue.trim().length < 2) {
      if (abortRef.current) abortRef.current.abort();
      setLoading(false);
      setOptions(value ? [value] : []);
      return;
    }
    debouncedFetch(inputValue);
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [inputValue, debouncedFetch, value]);

  return (
    <Autocomplete
      sx={{ width: 360 }}
      options={options}
      getOptionLabel={(o) => o.fullAddress}
      filterOptions={(x) => x} // rely on server; no client-side fuzzy filter
      includeInputInList
      filterSelectedOptions
      value={value}
      loading={loading}
      noOptionsText={
        inputValue.length < 2 ? "Start typing your address..." : "No matches"
      }
      onChange={(_, newValue) => {
        setOptions((prev) =>
          newValue ? [newValue, ...prev.filter((p) => p.id !== newValue.id)] : prev
        );
        setValue(newValue);
      }}
      onInputChange={(_, newInput) => setInputValue(newInput)}
      slots={{ paper: CustomPaper }}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Add a location"
          fullWidth
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <InputAdornment position="end" sx={{ mr: 1 }}>
                {loading ? <CircularProgress size={18} /> : null}
                {params.InputProps.endAdornment}
              </InputAdornment>
            ),
          }}
        />
      )}
      renderOption={(props, option) => {
        const parts = match(option.fullAddress, inputValue, { insideWords: true });
        const parsed = parse(option.fullAddress, parts);

        return (
          <li {...props} key={option.id}>
            <Grid container sx={{ alignItems: "center" }}>
              <Grid sx={{ display: "flex", width: 44 }}>
                <LocationOnIcon sx={{ color: "text.secondary" }} />
              </Grid>
              <Grid sx={{ width: "calc(100% - 44px)", wordWrap: "break-word" }}>
                <Typography variant="body1">
                  {parsed.map((part, index) => (
                    <Box
                      key={index}
                      component="span"
                      sx={{ fontWeight: part.highlight ? "fontWeightBold" : "regular" }}
                    >
                      {part.text}
                    </Box>
                  ))}
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {option.suburb} {option.state} {option.postcode}
                </Typography>
              </Grid>
            </Grid>
          </li>
        );
      }}
    />
  );
}
