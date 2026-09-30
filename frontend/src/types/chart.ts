/** Props che Recharts passa al `content` di un `<Tooltip>` personalizzato. */
export interface ChartTooltipEntry<D = unknown> {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  payload: D;
}

export interface ChartTooltipProps<D = unknown> {
  active?: boolean;
  payload?: readonly ChartTooltipEntry<D>[];
  label?: string | number;
}

export type FormatCurrency = (n: number) => string;
