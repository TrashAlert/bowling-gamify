import { useState } from 'react';
import { type GestureResponderEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import type { Scale } from '@/features/progress/present';
import { chart, colors, font, space } from '@/theme';

export interface ChartSeries {
  readonly key: string;
  readonly label: string;
  readonly color: string;
  /** 'dots' for context (every game), 'line' for the story (a trend). */
  readonly mark: 'line' | 'dots';
  /** One per x position; null leaves a gap. */
  readonly values: readonly (number | null)[];
}

export interface LineChartProps {
  readonly series: readonly ChartSeries[];
  /** One per x position: named in the readout; the first and last sit under the axis. */
  readonly xLabels: readonly string[];
  readonly scale: Scale;
  readonly format: (value: number) => string;
  /** What a screen reader hears for the chart as a whole. */
  readonly summary: string;
}

const PLOT_HEIGHT = 160;
const X_AXIS = 22;
const PAD = { left: 36, right: 44, top: 8 } as const;
const DOT_RADIUS = 4;
/** End labels closer than this would overlap; the legend and readout carry them instead. */
const LABEL_GAP = 14;

/**
 * A line/dot chart on one y-scale. The readout above the plot shows the
 * latest point; drag a finger across the plot to read any other. Every value
 * is also in the card's "Show numbers" table, so nothing depends on dragging.
 */
export function LineChart({ series, xLabels, scale, format, summary }: LineChartProps) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  const count = xLabels.length;
  const plotWidth = Math.max(0, width - PAD.left - PAD.right);
  const x = (i: number) => PAD.left + (count <= 1 ? plotWidth / 2 : (i * plotWidth) / (count - 1));
  const y = (value: number) => PAD.top + (1 - (value - scale.min) / (scale.max - scale.min)) * PLOT_HEIGHT;
  const bottom = PAD.top + PLOT_HEIGHT;

  const scrub = (event: GestureResponderEvent) => {
    const fraction = plotWidth === 0 ? 1 : (event.nativeEvent.locationX - PAD.left) / plotWidth;
    setActive(Math.min(count - 1, Math.max(0, Math.round(fraction * (count - 1)))));
  };
  const shown = active ?? count - 1;

  const ends = series
    .filter((s) => s.mark === 'line')
    .map((s) => ({ series: s, index: lastIndex(s.values) }))
    .filter((end): end is { series: ChartSeries; index: number } => end.index !== null);
  const endYs = ends.map(({ series: s, index }) => y(s.values[index]!));
  const endLabelsFit = endYs.every((a, i) => endYs.every((b, j) => i === j || Math.abs(a - b) >= LABEL_GAP));

  return (
    <View>
      <Readout series={series} label={xLabels[shown] ?? ''} index={shown} format={format} />
      <View
        testID="chart-plot"
        accessible
        accessibilityRole="image"
        accessibilityLabel={summary}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={{ height: bottom + X_AXIS }}
        onStartShouldSetResponder={() => true}
        onResponderGrant={scrub}
        onResponderMove={scrub}
        onResponderRelease={() => setActive(null)}
        onResponderTerminate={() => setActive(null)}
      >
        {width > 0 && (
          <Svg width={width} height={bottom + X_AXIS}>
            {scale.ticks.map((tick) => (
              <Line key={`grid-${tick}`} x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke={chart.grid} strokeWidth={1} />
            ))}
            {scale.ticks.map((tick) => (
              <SvgText key={`tick-${tick}`} x={PAD.left - 6} y={y(tick) + 4} fontSize={11} fill={chart.axisText} textAnchor="end">
                {format(tick)}
              </SvgText>
            ))}
            <SvgText x={x(0)} y={bottom + 16} fontSize={11} fill={chart.axisText} textAnchor="start">
              {xLabels[0]}
            </SvgText>
            {count > 1 && (
              <SvgText x={x(count - 1)} y={bottom + 16} fontSize={11} fill={chart.axisText} textAnchor="end">
                {xLabels[count - 1]}
              </SvgText>
            )}

            {active !== null && <Line x1={x(active)} x2={x(active)} y1={PAD.top} y2={bottom} stroke={chart.crosshair} strokeWidth={1} />}

            {/* Context dots underneath, trend lines on top. */}
            {series
              .filter((s) => s.mark === 'dots')
              .map((s) =>
                s.values.map((value, i) =>
                  value === null ? null : <Dot key={`${s.key}-${i}`} cx={x(i)} cy={y(value)} color={s.color} big={i === active} />,
                ),
              )}
            {series
              .filter((s) => s.mark === 'line')
              .map((s) => (
                <Path
                  key={s.key}
                  testID={`line-${s.key}`}
                  d={pathFor(s.values, x, y)}
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              ))}
            {ends.map(({ series: s, index }) => (
              <Dot key={`${s.key}-end`} cx={x(index)} cy={y(s.values[index]!)} color={s.color} big={false} />
            ))}
            {active !== null &&
              series
                .filter((s) => s.mark === 'line' && s.values[active] != null)
                .map((s) => <Dot key={`${s.key}-active`} cx={x(active)} cy={y(s.values[active]!)} color={s.color} big />)}
            {endLabelsFit &&
              ends.map(({ series: s, index }, i) => (
                <SvgText key={`${s.key}-label`} x={x(index) + 8} y={endYs[i]! + 4} fontSize={12} fontWeight="700" fill={colors.text}>
                  {format(s.values[index]!)}
                </SvgText>
              ))}
          </Svg>
        )}
      </View>
    </View>
  );
}

/** The values at one x position. Values lead; series names follow in muted ink. */
function Readout({ series, label, index, format }: { series: readonly ChartSeries[]; label: string; index: number; format: (v: number) => string }) {
  return (
    <View style={styles.readout} accessibilityLiveRegion="polite">
      <Text style={styles.readoutLabel}>{label}</Text>
      <View style={styles.readoutValues}>
        {series.map((s) => {
          const value = s.values[index];
          return (
            <View key={s.key} style={styles.readoutItem}>
              <Key color={s.color} mark={s.mark} />
              <Text style={styles.readoutValue}>{value == null ? '—' : format(value)}</Text>
              <Text style={styles.readoutLabel}>{s.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** A series key: a short stroke for a line, a dot for dots. Mirrors the mark. */
export function Key({ color, mark }: { color: string; mark: ChartSeries['mark'] }) {
  return mark === 'line' ? (
    <View style={[styles.lineKey, { backgroundColor: color }]} />
  ) : (
    <View style={[styles.dotKey, { backgroundColor: color }]} />
  );
}

function Dot({ cx, cy, color, big }: { cx: number; cy: number; color: string; big: boolean }) {
  // The ring in the card colour keeps a dot readable where it crosses a line.
  return <Circle cx={cx} cy={cy} r={big ? DOT_RADIUS + 2 : DOT_RADIUS} fill={color} stroke={colors.surface} strokeWidth={2} />;
}

function lastIndex(values: readonly (number | null)[]): number | null {
  for (let i = values.length - 1; i >= 0; i--) if (values[i] != null) return i;
  return null;
}

/** An SVG path through the non-null values, breaking the line at every gap. */
export function pathFor(values: readonly (number | null)[], x: (i: number) => number, y: (v: number) => number): string {
  let d = '';
  let drawing = false;
  values.forEach((value, i) => {
    if (value === null) {
      drawing = false;
      return;
    }
    d += `${drawing ? 'L' : 'M'}${x(i).toFixed(1)},${y(value).toFixed(1)} `;
    drawing = true;
  });
  return d.trim();
}

const styles = StyleSheet.create({
  readout: { minHeight: 44, gap: 2, marginBottom: space.sm },
  readoutValues: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: 2 },
  readoutItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  readoutValue: { color: colors.text, fontSize: font.body, fontWeight: '800' },
  readoutLabel: { color: colors.textMuted, fontSize: font.small },
  lineKey: { width: 12, height: 2, borderRadius: 1 },
  dotKey: { width: 8, height: 8, borderRadius: 4 },
});
