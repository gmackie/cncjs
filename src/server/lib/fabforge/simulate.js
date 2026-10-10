/* eslint-disable no-loop-func -- All callbacks inside the parser loop run synchronously. */
// Deliberately bounded offline backplot. Never evaluates CNCjs macros or sends G-code.
const MAX_BYTES = 2 * 1024 * 1024;
const LIMITATIONS = [
  'Starts at work position X0 Y0 Z0; actual machine position and offsets are not known.',
  'Tool-center backplot only: no stock removal, fixture collision, tool geometry or machine-limit validation.',
  'Time excludes acceleration, spindle ramp-up and operator pauses; rapids assume 3000 mm/min.',
  'Supports G17 XY arcs with incremental I/J centers. Other planes, R arcs, probing, offsets and macros require external review.'
];

function simulate(gcode) {
  if (typeof gcode !== 'string' || !gcode.trim() || Buffer.byteLength(gcode) > MAX_BYTES || gcode.includes('\0')) {
    throw new Error('Provide a nonempty text G-code file up to 2 MiB.');
  }
  const lines = gcode.split(/\r?\n/);
  if (lines.length > 20000) {
    throw new Error('Backplot is limited to 20,000 lines.');
  }
  const segments = [];
  const errors = [];
  const warnings = [];
  let position = [0, 0, 0];
  let scale = 1;
  let absolute = true;
  let explicitUnits = false;
  let explicitDistance = false;
  let motion = 0;
  let feed = 0;
  let spindle = 'M5';
  let power = 0;
  let tool = 0;
  let seconds = 0;
  let distance = 0;
  let ended = false;
  const min = [0, 0, 0];
  const max = [0, 0, 0];
  const add = (to, line) => {
    if (segments.length >= 50000 || to.some((v) => !Number.isFinite(v) || Math.abs(v) > 100000)) {
      throw new Error('Backplot exceeds supported size or coordinate range.');
    }
    const length = Math.hypot(...to.map((v, i) => v - position[i]));
    const duration = (length / (motion === 0 ? 3000 : feed)) * 60;
    if (!Number.isFinite(duration)) {
      throw new Error('Cutting moves need a positive feed rate.');
    }
    segments.push({ from: position, to, line, motion, spindle, power, tool, seconds: duration });
    seconds += duration;
    distance += length;
    to.forEach((v, i) => {
      min[i] = Math.min(min[i], v);
      max[i] = Math.max(max[i], v);
    });
    position = to;
  };
  for (let index = 0; index < lines.length; index++) {
    const line = index + 1;
    const code = lines[index]
      .replace(/\([^()]*\)/g, '')
      .replace(/;.*/, '')
      .trim()
      .toUpperCase();
    if (!code || code === '%') {
      continue;
    }
    if (ended) {
      warnings.push({ line, message: 'Content after program end was not simulated.' });
      break;
    }
    try {
      const words = [];
      const rest = code
        .replace(/([A-Z])\s*([+-]?(?:\d+\.?\d*|\.\d+))/g, (match, letter, number) => {
          words.push([letter, Number(number)]);
          return '';
        })
        .trim();
      if (rest || !words.length) {
        throw new Error('Unsupported syntax, expression or macro.');
      }
      const values = {};
      const gs = [];
      const ms = [];
      words.forEach(([key, value]) => {
        if (!Number.isFinite(value)) {
          throw new Error('Invalid numeric value.');
        }
        if (key === 'G') {
          gs.push(value);
        } else if (key === 'M') {
          ms.push(value);
        } else if (key !== 'N') {
          if (!'XYZIJFST'.includes(key)) {
            throw new Error(`Unsupported word ${key}.`);
          }
          if (values[key] !== undefined) {
            throw new Error(`Repeated ${key} word.`);
          }
          values[key] = value;
        }
      });
      const groups = [
        [0, 1, 2, 3],
        [20, 21],
        [90, 91]
      ];
      if (groups.some((group) => gs.filter((g) => group.includes(g)).length > 1)) {
        throw new Error('Conflicting modal commands.');
      }
      gs.forEach((g) => {
        if (![0, 1, 2, 3, 17, 20, 21, 90, 91, 91.1, 94, 54].includes(g)) {
          throw new Error(`G${g} is not supported by this backplot.`);
        }
        if (g <= 3) {
          motion = g;
        }
        if (g === 20 || g === 21) {
          scale = g === 20 ? 25.4 : 1;
          explicitUnits = true;
        }
        if (g === 90 || g === 91) {
          absolute = g === 90;
          explicitDistance = true;
        }
      });
      ms.forEach((m) => {
        if (![0, 1, 2, 3, 4, 5, 7, 8, 9, 30].includes(m)) {
          throw new Error(`M${m} is not supported by this backplot.`);
        }
        if ([3, 4, 5].includes(m)) {
          spindle = `M${m}`;
        }
        if ([0, 1].includes(m)) {
          warnings.push({ line, message: `M${m}: operator pause; elapsed pause time is unknown.` });
        }
        if ([2, 30].includes(m)) {
          ended = true;
        }
      });
      if (values.F !== undefined) {
        if (values.F <= 0) {
          throw new Error('Feed rate must be positive.');
        }
        feed = values.F * scale;
      }
      if (values.S !== undefined) {
        if (values.S < 0) {
          throw new Error('Spindle/laser power cannot be negative.');
        }
        power = values.S;
      }
      if (values.T !== undefined) {
        tool = values.T;
      }
      const hasAxes = ['X', 'Y', 'Z'].some((axis) => values[axis] !== undefined);
      const hasCenter = values.I !== undefined || values.J !== undefined;
      if (!hasAxes && !hasCenter) {
        continue;
      }
      if (!explicitUnits || !explicitDistance) {
        throw new Error('Specify G20/G21 and G90/G91 before the first move.');
      }
      if (motion !== 0 && feed <= 0) {
        throw new Error('Cutting moves need a positive feed rate.');
      }
      const target = ['X', 'Y', 'Z'].map((axis, i) => (values[axis] === undefined ? position[i] : values[axis] * scale + (absolute ? 0 : position[i])));
      if (motion < 2) {
        if (hasCenter) {
          throw new Error('Arc-center words on a linear move.');
        }
        add(target, line);
      } else {
        if (!hasCenter) {
          throw new Error('XY arcs require incremental I/J center offsets.');
        }
        const start = position;
        const center = [start[0] + (values.I || 0) * scale, start[1] + (values.J || 0) * scale];
        const radius = Math.hypot(start[0] - center[0], start[1] - center[1]);
        const endRadius = Math.hypot(target[0] - center[0], target[1] - center[1]);
        if (!radius || Math.abs(radius - endRadius) > Math.max(0.005, radius * 0.001)) {
          throw new Error('Arc endpoints have inconsistent radii.');
        }
        const a = Math.atan2(start[1] - center[1], start[0] - center[0]);
        let sweep = Math.atan2(target[1] - center[1], target[0] - center[0]) - a;
        if (motion === 2 && sweep >= 0) {
          sweep -= 2 * Math.PI;
        }
        if (motion === 3 && sweep <= 0) {
          sweep += 2 * Math.PI;
        }
        const count = Math.ceil(Math.abs(sweep) / (Math.PI / 180));
        for (let n = 1; n <= count; n++) {
          const t = n / count;
          add(
            n === count
              ? target
              : [
                  center[0] + radius * Math.cos(a + sweep * t),
                  center[1] + radius * Math.sin(a + sweep * t),
                  start[2] + (target[2] - start[2]) * t
                ],
            line
          );
        }
      }
    } catch (err) {
      errors.push({ line, message: err.message });
      break; // Never draw a plausible continuation after an unsupported operation.
    }
  }
  if (!segments.length && !errors.length) {
    errors.push({ line: 0, message: 'No motion to review.' });
  }
  return {
    version: 1,
    segments,
    errors,
    warnings,
    limitations: LIMITATIONS,
    complete: errors.length === 0,
    bounds: { min, max },
    seconds,
    distance,
    lineCount: lines.length
  };
}

module.exports = simulate;
